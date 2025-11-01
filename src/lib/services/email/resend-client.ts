/**
 * Resend Email Client for Cost Alerts
 *
 * Sends cost alert emails using Resend API with React Email templates
 * Implements retry logic with exponential backoff
 */

import { render } from "@react-email/components";
import { Resend } from "resend";
import { env } from "~/env";
import { logger } from "~/lib/logger";
import { retryWithBackoff } from "~/lib/utils/retry";
import CostAlertEmail, {
	type CostAlertEmailProps,
} from "./templates/CostAlertEmail";

export interface SendCostAlertEmailParams extends CostAlertEmailProps {
	to: string;
}

/**
 * Send cost alert email using Resend API
 *
 * Renders React Email template and sends via Resend
 * Implements retry with exponential backoff
 */
export async function sendCostAlertEmail(
	params: SendCostAlertEmailParams,
): Promise<void> {
	if (!env.RESEND_API_KEY) {
		logger.warn("RESEND_API_KEY not configured, skipping email alert");
		return;
	}

	const resend = new Resend(env.RESEND_API_KEY);

	// Render email template
	const emailHtml = await render(
		CostAlertEmail({
			projectName: params.projectName,
			teamName: params.teamName,
			currentCost: params.currentCost,
			threshold: params.threshold,
			exceedancePercent: params.exceedancePercent,
			dashboardUrl: params.dashboardUrl,
		}),
	);

	await retryWithBackoff(
		async () => {
			const result = await resend.emails.send({
				from: env.RESEND_FROM_EMAIL ?? "FinOps for AI <alerts@finops-ai.com>",
				to: params.to,
				subject: `🚨 [${params.teamName}] ${params.projectName} 비용 임계값 초과`,
				html: emailHtml,
			});

			if (result.error) {
				throw new Error(`Resend API error: ${result.error.message}`);
			}

			logger.info(
				{
					projectName: params.projectName,
					to: params.to,
					emailId: result.data?.id,
				},
				"Cost alert email sent successfully",
			);
		},
		{
			context: "Email send",
			finalErrorMessage: "Email send failed after all retries",
		},
	);
}
