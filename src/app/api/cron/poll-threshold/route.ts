/**
 * Threshold Polling Cron Job
 *
 * Scheduled to run every 5 minutes via Vercel Cron
 * Checks all active cost alerts and sends notifications for threshold breaches
 *
 * Security: Protected by CRON_SECRET Bearer token
 * No idempotency check needed (designed to run every 5 minutes)
 */

import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { env } from "~/env";
import { logger } from "~/lib/logger";
import { sendCostAlertEmail } from "~/lib/services/email/resend-client";
import {
	checkThresholds,
	updateAlertSentTimestamp,
} from "~/lib/services/monitoring/threshold-monitor";
import { sendCostAlert } from "~/lib/services/slack/webhook";
import { db } from "~/server/db";

/**
 * Constant-time string comparison to prevent timing attacks
 */
function constantTimeCompare(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * GET /api/cron/poll-threshold
 *
 * Cron job handler for threshold monitoring
 * Called by Vercel Cron every 5 minutes
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

		logger.info("Starting threshold polling cron job");

		// Step 2: Check all thresholds
		const breaches = await checkThresholds();

		logger.info({ breachCount: breaches.length }, "Threshold check completed");

		if (breaches.length === 0) {
			const duration = Date.now() - startTime;
			return NextResponse.json({
				message: "No threshold breaches detected",
				duration,
			});
		}

		// Step 3: Send alerts for each breach (Slack + Email in parallel)
		const alertResults = await Promise.allSettled(
			breaches.map(async (breach) => {
				// Get team members' emails for notification
				const teamMembers = await db.teamMember.findMany({
					where: { teamId: breach.teamId },
					include: {
						user: {
							select: {
								email: true,
								name: true,
							},
						},
					},
				});

				// Get team name
				const team = await db.team.findUnique({
					where: { id: breach.teamId },
					select: { name: true },
				});

				const teamName = team?.name ?? "Unknown Team";
				const dashboardUrl = `${env.NEXTAUTH_URL}/projects/${breach.projectId}`;

				// Send Slack and Email alerts in parallel
				const [slackResult, ...emailResults] = await Promise.allSettled([
					sendCostAlert({
						projectName: breach.projectName,
						teamName,
						currentCost: breach.currentCost,
						threshold: breach.thresholdValue,
						exceedancePercent: breach.exceedancePercent,
						dashboardUrl,
					}),
					...teamMembers.map((member) =>
						sendCostAlertEmail({
							to: member.user.email,
							projectName: breach.projectName,
							teamName,
							currentCost: breach.currentCost,
							threshold: breach.thresholdValue,
							exceedancePercent: breach.exceedancePercent,
							dashboardUrl,
						}),
					),
				]);

				// Log results
				if (slackResult.status === "rejected") {
					logger.error(
						{
							projectId: breach.projectId,
							error: slackResult.reason,
						},
						"Slack alert failed",
					);
				}

				const failedEmails = emailResults.filter(
					(result) => result.status === "rejected",
				);
				if (failedEmails.length > 0) {
					logger.error(
						{
							projectId: breach.projectId,
							failedCount: failedEmails.length,
						},
						"Some email alerts failed",
					);
				}

				// Update alert timestamp only if at least one notification succeeded
				// This prevents throttling when all delivery methods fail
				const slackSuccess = slackResult.status === "fulfilled";
				const emailSuccessCount = emailResults.filter(
					(result) => result.status === "fulfilled",
				).length;
				const anySuccess = slackSuccess || emailSuccessCount > 0;

				if (anySuccess) {
					await updateAlertSentTimestamp(breach.alertId);
					logger.info(
						{
							projectId: breach.projectId,
							slackSuccess,
							emailsSent: emailSuccessCount,
						},
						"Alert sent, timestamp updated",
					);
				} else {
					logger.warn(
						{
							projectId: breach.projectId,
						},
						"All alert deliveries failed, skipping throttle update",
					);
				}

				return {
					projectId: breach.projectId,
					slackSuccess,
					emailsSent: emailSuccessCount,
					emailsFailed: failedEmails.length,
				};
			}),
		);

		// Count successes and failures
		const successCount = alertResults.filter(
			(result) => result.status === "fulfilled",
		).length;
		const failureCount = alertResults.filter(
			(result) => result.status === "rejected",
		).length;

		const duration = Date.now() - startTime;

		logger.info(
			{
				breaches: breaches.length,
				alertsSent: successCount,
				alertsFailed: failureCount,
				duration,
			},
			"Threshold polling cron job completed",
		);

		return NextResponse.json({
			message: "Threshold polling completed",
			breaches: breaches.length,
			alertsSent: successCount,
			alertsFailed: failureCount,
			duration,
		});
	} catch (error) {
		const duration = Date.now() - startTime;
		logger.error(
			{
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
				duration,
			},
			"Threshold polling cron job failed",
		);

		return NextResponse.json(
			{
				error: "Internal server error",
				message: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 },
		);
	}
}
