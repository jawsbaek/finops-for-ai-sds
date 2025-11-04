import { NextResponse } from "next/server";
import { logger } from "~/lib/logger";
import { db } from "~/server/db";

/**
 * Automated session cleanup cron job
 *
 * Removes expired sessions from the database to:
 * - Reduce database storage costs
 * - Improve query performance
 * - Maintain system hygiene
 *
 * Schedule: Daily at 2 AM (configured in vercel.json)
 * Retention: Deletes sessions expired more than 7 days ago
 *
 * @see docs/auth-future-improvements.md
 */
export async function GET(request: Request) {
	try {
		// Verify cron secret to prevent unauthorized access
		const authHeader = request.headers.get("authorization");
		const cronSecret = process.env.CRON_SECRET;

		// CRON_SECRET must be configured for security
		if (!cronSecret) {
			logger.error(
				{
					endpoint: "/api/cron/cleanup-sessions",
				},
				"CRON_SECRET environment variable not configured",
			);

			return NextResponse.json(
				{ error: "Server misconfigured" },
				{ status: 500 },
			);
		}

		if (authHeader !== `Bearer ${cronSecret}`) {
			logger.warn(
				{
					endpoint: "/api/cron/cleanup-sessions",
					authHeader: authHeader?.substring(0, 20),
				},
				"Unauthorized cron job access attempt",
			);

			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Delete sessions expired more than 7 days ago
		const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

		const result = await db.session.deleteMany({
			where: {
				expires: {
					lt: sevenDaysAgo,
				},
			},
		});

		logger.info(
			{
				deletedCount: result.count,
				olderThan: sevenDaysAgo.toISOString(),
			},
			"Session cleanup completed successfully",
		);

		return NextResponse.json({
			success: true,
			deletedCount: result.count,
			olderThan: sevenDaysAgo.toISOString(),
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		logger.error(
			{
				error:
					error instanceof Error
						? { message: error.message, stack: error.stack }
						: error,
			},
			"Session cleanup failed",
		);

		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
