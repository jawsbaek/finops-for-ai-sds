/**
 * Email Notification Service
 *
 * Sends email notifications using Resend API
 * Implements throttling to prevent notification spam
 */

import pino from "pino";
import { Resend } from "resend";
import { env } from "~/env";

const logger = pino({ name: "email-notification" });

// In-memory throttle tracking (resets on server restart)
const throttleCache = new Map<string, number>();
const THROTTLE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/**
 * Initialize Resend client
 */
function getResendClient(): Resend | null {
	if (!env.RESEND_API_KEY) {
		logger.warn("RESEND_API_KEY not configured, emails will not be sent");
		return null;
	}

	return new Resend(env.RESEND_API_KEY);
}

/**
 * Check if notification should be throttled
 *
 * @param key - Unique key for the notification type
 * @returns true if should throttle, false otherwise
 */
function shouldThrottle(key: string): boolean {
	const lastSent = throttleCache.get(key);
	const now = Date.now();

	if (!lastSent) {
		return false; // Never sent before
	}

	const timeSinceLastSent = now - lastSent;
	if (timeSinceLastSent < THROTTLE_WINDOW_MS) {
		logger.info(
			{ key, timeSinceLastSent, throttleWindow: THROTTLE_WINDOW_MS },
			"Notification throttled",
		);
		return true;
	}

	return false;
}

/**
 * Record that a notification was sent
 *
 * @param key - Unique key for the notification type
 */
function recordNotificationSent(key: string): void {
	throttleCache.set(key, Date.now());
}

/**
 * Send cost collection failure notification to admin
 *
 * @param error - Error details
 * @param context - Additional context (date, API key, etc.)
 */
export async function sendCostCollectionFailureNotification(
	error: Error,
	context: {
		date?: string;
		apiKeyId?: string;
		teamId?: string;
	},
): Promise<void> {
	const throttleKey = `cost-collection-failure-${context.date ?? "unknown"}`;

	// Check throttling
	if (shouldThrottle(throttleKey)) {
		return;
	}

	const resend = getResendClient();
	if (!resend) {
		logger.warn("Resend client not configured, skipping email notification");
		return;
	}

	if (!env.ADMIN_EMAIL) {
		logger.warn("ADMIN_EMAIL not configured, skipping email notification");
		return;
	}

	const subject = `[FinOps Alert] Cost Collection Failed - ${context.date ?? "Unknown Date"}`;
	const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Cost Collection Failure</title>
</head>
<body style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #dc2626; border-bottom: 2px solid #dc2626; padding-bottom: 10px;">
    Cost Collection Failed
  </h1>

  <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0;">
    <h2 style="margin-top: 0; color: #991b1b;">Error Details</h2>
    <p><strong>Message:</strong> ${error.message}</p>
    ${error.stack ? `<pre style="background-color: #fff; padding: 10px; overflow-x: auto; font-size: 12px;">${error.stack}</pre>` : ""}
  </div>

  <div style="background-color: #f3f4f6; padding: 15px; margin: 20px 0; border-radius: 5px;">
    <h2 style="margin-top: 0; color: #374151;">Context</h2>
    <ul style="margin: 0; padding-left: 20px;">
      <li><strong>Date:</strong> ${context.date ?? "Not specified"}</li>
      ${context.apiKeyId ? `<li><strong>API Key ID:</strong> ${context.apiKeyId}</li>` : ""}
      ${context.teamId ? `<li><strong>Team ID:</strong> ${context.teamId}</li>` : ""}
      <li><strong>Timestamp:</strong> ${new Date().toISOString()}</li>
    </ul>
  </div>

  <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #d1d5db; font-size: 14px; color: #6b7280;">
    <p>This notification was sent by the FinOps for AI platform.</p>
    <p>You are receiving this because you are configured as the system administrator.</p>
  </div>
</body>
</html>
  `;

	try {
		const result = await resend.emails.send({
			from: "FinOps Alerts <alerts@finops-ai.com>",
			to: env.ADMIN_EMAIL,
			subject,
			html: htmlBody,
		});

		logger.info(
			{ emailId: result.data?.id, to: env.ADMIN_EMAIL },
			"Sent cost collection failure notification",
		);

		// Record that we sent this notification
		recordNotificationSent(throttleKey);
	} catch (emailError) {
		logger.error(
			{
				error:
					emailError instanceof Error ? emailError.message : String(emailError),
			},
			"Failed to send email notification",
		);
	}
}

/**
 * Send test notification (for debugging)
 *
 * @param to - Email address to send to
 */
export async function sendTestNotification(to: string): Promise<void> {
	const resend = getResendClient();
	if (!resend) {
		throw new Error("Resend client not configured");
	}

	const result = await resend.emails.send({
		from: "FinOps Test <test@finops-ai.com>",
		to,
		subject: "Test Notification from FinOps for AI",
		html: "<p>This is a test notification. Your email service is working correctly!</p>",
	});

	logger.info({ emailId: result.data?.id, to }, "Sent test notification");
}
