/**
 * CAPTCHA Token Cleanup Cron Job
 *
 * Periodically removes expired CAPTCHA challenges and tokens from storage.
 * This endpoint should be called by a cron job (e.g., Vercel Cron Jobs) to prevent
 * unbounded growth of the .cap-tokens directory.
 *
 * Recommended schedule: Every 1 hour
 *
 * Security: Protected by CRON_SECRET environment variable
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { env } from "~/env";
import { logger } from "~/lib/logger";
import { cleanupExpiredCaptchaTokens } from "~/server/api/captcha";

export async function POST(request: NextRequest) {
	// Verify cron secret for security
	// SECURITY: Defense in depth - check for undefined CRON_SECRET to prevent bypass attacks
	if (!env.CRON_SECRET) {
		logger.error("CRON_SECRET is not configured");
		return NextResponse.json(
			{ error: "Server misconfigured" },
			{ status: 500 },
		);
	}

	const authHeader = request.headers.get("authorization");
	const expectedAuth = `Bearer ${env.CRON_SECRET}`;

	if (authHeader !== expectedAuth) {
		logger.warn(
			{
				authProvided: !!authHeader,
				ip: request.headers.get("x-forwarded-for") ?? "unknown",
			},
			"Unauthorized CAPTCHA cleanup attempt",
		);
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		await cleanupExpiredCaptchaTokens();

		logger.info("CAPTCHA cleanup cron job completed successfully");

		return NextResponse.json({
			success: true,
			message: "CAPTCHA tokens cleaned up successfully",
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		logger.error(
			{
				error: error instanceof Error ? error.message : String(error),
			},
			"CAPTCHA cleanup cron job failed",
		);

		return NextResponse.json(
			{
				success: false,
				error: "Failed to cleanup CAPTCHA tokens",
			},
			{ status: 500 },
		);
	}
}
