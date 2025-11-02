/**
 * Resend Email Service
 *
 * Handles email sending via Resend API with retry logic and error tracking
 */

import { render } from "@react-email/components";
import { Resend } from "resend";
import { logger } from "~/lib/logger";
import {
	type WeeklyReportData,
	formatReportDate,
} from "../reporting/report-generator";
import WeeklyReportEmail from "./templates/weekly-report";

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Retry configuration for email sending
 */
const RETRY_CONFIG = {
	maxRetries: 3,
	initialDelay: 1000, // 1 second
	maxDelay: 8000, // 8 seconds
	backoffFactor: 2,
};

/**
 * Sleep helper for retry delays
 */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Send weekly report email to a list of recipients with retry logic
 *
 * AC #4: Sends email to all registered users using Resend API
 *
 * @param to - Array of recipient email addresses
 * @param reportData - Weekly report data for email content
 * @returns Object with success status and sent count
 */
export async function sendWeeklyReport(
	to: string[],
	reportData: WeeklyReportData,
): Promise<{ success: boolean; sent: number; failed: number }> {
	if (to.length === 0) {
		logger.warn("sendWeeklyReport: No recipients provided");
		return { success: true, sent: 0, failed: 0 };
	}

	// Generate email subject
	const subject = `주간 AI 비용 리포트 - ${formatReportDate(reportData.weekStart)}`;

	// Render React Email component to HTML
	const emailHtml = await render(WeeklyReportEmail({ reportData }));

	let sent = 0;
	let failed = 0;

	// Send emails in batches to avoid rate limits
	const batchSize = 50; // Resend batch limit
	for (let i = 0; i < to.length; i += batchSize) {
		const batch = to.slice(i, i + batchSize);

		// Attempt to send with retries
		let attempt = 0;
		let lastError: Error | null = null;

		while (attempt < RETRY_CONFIG.maxRetries) {
			try {
				const { data, error } = await resend.emails.send({
					from: "FinOps Reports <reports@finops-for-ai.com>",
					to: batch,
					subject,
					html: emailHtml,
				});

				if (error) {
					throw new Error(
						`Resend API error: ${error.message || JSON.stringify(error)}`,
					);
				}

				// Success
				sent += batch.length;
				logger.info({
					batch: i / batchSize + 1,
					recipients: batch.length,
					messageId: data?.id,
					message: "Weekly report email sent successfully",
				});

				break; // Exit retry loop on success
			} catch (error) {
				lastError = error as Error;
				attempt++;

				if (attempt < RETRY_CONFIG.maxRetries) {
					// Calculate exponential backoff delay
					const delay = Math.min(
						RETRY_CONFIG.initialDelay * RETRY_CONFIG.backoffFactor ** attempt,
						RETRY_CONFIG.maxDelay,
					);

					logger.warn({
						attempt,
						maxRetries: RETRY_CONFIG.maxRetries,
						delay,
						error: lastError.message,
						message: "Email send failed, retrying...",
					});

					await sleep(delay);
				} else {
					// Max retries exceeded
					failed += batch.length;

					logger.error({
						batch: i / batchSize + 1,
						recipients: batch.length,
						attempts: attempt,
						error: lastError.message,
						message: "Failed to send weekly report email after retries",
					});
				}
			}
		}
	}

	const success = failed === 0;

	logger.info({
		total: to.length,
		sent,
		failed,
		success,
		message: "Weekly report email delivery summary",
	});

	return { success, sent, failed };
}

/**
 * Get all registered user emails for report distribution
 *
 * AC #4: Retrieves all user emails from database
 *
 * @param db - Prisma database client
 * @returns Array of user email addresses
 */
export async function getAllUserEmails(db: {
	user: {
		findMany: (args: { select: { email: true } }) => Promise<
			{ email: string }[]
		>;
	};
}): Promise<string[]> {
	const users = await db.user.findMany({
		select: {
			email: true,
		},
	});

	return users.map((u) => u.email);
}
