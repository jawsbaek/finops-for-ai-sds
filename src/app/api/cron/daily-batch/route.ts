/**
 * Daily Batch Cost Collection Cron Job
 *
 * Scheduled to run daily at 9am KST (0am UTC) via Vercel Cron
 * Collects OpenAI API usage data from the previous day
 *
 * Security: Protected by CRON_SECRET Bearer token
 * Idempotency: Uses cron_logs table to prevent duplicate execution
 */

import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import pino from "pino";
import { env } from "~/env";
import { sendCostCollectionFailureNotification } from "~/lib/services/email/notification";
import {
	collectDailyCosts,
	storeCostData,
} from "~/lib/services/openai/cost-collector";
import { db } from "~/server/db";

const logger = pino({ name: "cron-daily-batch" });

/**
 * Constant-time string comparison to prevent timing attacks
 */
function constantTimeCompare(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * GET /api/cron/daily-batch
 *
 * Cron job handler for daily cost collection
 * Called by Vercel Cron at configured schedule
 */
export async function GET(request: Request) {
	const startTime = Date.now();

	try {
		// Step 1: Verify CRON_SECRET for security
		const authHeader = request.headers.get("authorization");
		const expectedAuth = `Bearer ${env.CRON_SECRET}`;

		if (!env.CRON_SECRET) {
			logger.error("CRON_SECRET not configured");
			return NextResponse.json(
				{ error: "Server configuration error" },
				{ status: 500 },
			);
		}

		if (!constantTimeCompare(authHeader ?? "", expectedAuth)) {
			logger.warn({ authHeader }, "Unauthorized cron job attempt");
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Step 2: Idempotency check (atomic via unique constraint)
		const today = new Date().toISOString().split("T")[0] as string; // YYYY-MM-DD
		const jobName = "daily-batch";

		logger.info({ date: today, jobName }, "Starting cron job");

		// Try to create the cron log entry atomically
		// If it already exists, unique constraint will prevent duplicate execution
		try {
			await db.cronLog.create({
				data: {
					jobName,
					date: today,
				},
			});
		} catch (createError) {
			// Check if error is due to unique constraint violation
			if (
				createError &&
				typeof createError === "object" &&
				"code" in createError &&
				createError.code === "P2002"
			) {
				logger.info({ date: today }, "Cron job already executed today");
				return NextResponse.json({
					message: "Already executed today",
					date: today,
				});
			}
			// If it's a different error, re-throw it
			throw createError;
		}

		// Step 3: Collect costs from OpenAI
		logger.info("Collecting daily costs");

		let costData: Awaited<ReturnType<typeof collectDailyCosts>> = [];
		let recordsCreated = 0;

		try {
			costData = await collectDailyCosts();

			// Step 4: Store in database
			if (costData.length > 0) {
				recordsCreated = await storeCostData(costData);
				logger.info({ recordsCreated }, "Cost data stored successfully");
			} else {
				logger.info("No cost data to store");
			}
		} catch (collectionError) {
			// Send notification on failure but don't throw
			// (we still want to log the cron execution)
			const error =
				collectionError instanceof Error
					? collectionError
					: new Error(String(collectionError));

			logger.error({ error: error.message }, "Cost collection failed");

			// Send email notification to admin
			await sendCostCollectionFailureNotification(error, {
				date: today,
			});

			// Note: Cron log already created at the start (atomic idempotency check)
			// So we don't retry immediately even on failure

			return NextResponse.json(
				{
					success: false,
					error: error.message,
					date: today,
				},
				{ status: 500 },
			);
		}

		// Step 5: Complete (cron log already created at the start)
		const duration = Date.now() - startTime;

		logger.info(
			{ duration, recordsCreated, date: today },
			"Cron job completed successfully",
		);

		return NextResponse.json({
			success: true,
			message: "Cost collection completed",
			date: today,
			recordsCollected: costData.length,
			recordsCreated,
			durationMs: duration,
		});
	} catch (error) {
		const duration = Date.now() - startTime;
		const errorMessage = error instanceof Error ? error.message : String(error);

		logger.error(
			{ error: errorMessage, duration },
			"Cron job failed with unexpected error",
		);

		return NextResponse.json(
			{
				success: false,
				error: errorMessage,
			},
			{ status: 500 },
		);
	}
}
