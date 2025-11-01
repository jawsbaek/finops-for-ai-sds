/**
 * Slack Webhook Service
 *
 * Sends cost alert notifications to Slack using Webhook API
 * Implements retry logic with exponential backoff
 */

import { logger } from "~/lib/logger";

export interface SlackCostAlertParams {
	projectName: string;
	teamName: string;
	currentCost: number;
	threshold: number;
	exceedancePercent: number;
	dashboardUrl: string;
}

/**
 * Send cost alert notification to Slack
 *
 * Uses Slack Blocks API to create rich formatted message
 * with project details and "View Details" button
 */
export async function sendCostAlert(
	params: SlackCostAlertParams,
): Promise<void> {
	const webhookUrl = process.env.SLACK_WEBHOOK_URL;

	if (!webhookUrl) {
		logger.warn("SLACK_WEBHOOK_URL not configured, skipping Slack alert");
		return;
	}

	const payload = {
		text: `🚨 [${params.teamName}] 비용 임계값 초과`,
		blocks: [
			{
				type: "section",
				text: {
					type: "mrkdwn",
					text: `*🚨 비용 임계값 초과*\n\n*프로젝트*: ${params.projectName}\n*현재 비용*: $${params.currentCost.toFixed(2)}\n*임계값*: $${params.threshold.toFixed(2)}\n*초과율*: ${params.exceedancePercent.toFixed(1)}%`,
				},
			},
			{
				type: "actions",
				elements: [
					{
						type: "button",
						text: {
							type: "plain_text",
							text: "상세 보기",
						},
						url: params.dashboardUrl,
						style: "danger",
					},
				],
			},
		],
	};

	await retryWithBackoff(async () => {
		const response = await fetch(webhookUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(payload),
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Slack webhook failed: ${response.status} ${errorText}`);
		}

		logger.info(
			{ projectName: params.projectName },
			"Slack alert sent successfully",
		);
	});
}

/**
 * Retry function with exponential backoff
 *
 * Retries up to 3 times with delays: 1s, 2s, 4s
 */
async function retryWithBackoff<T>(
	fn: () => Promise<T>,
	maxRetries = 3,
): Promise<T> {
	let lastError: Error | undefined;

	for (let attempt = 0; attempt < maxRetries; attempt++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error as Error;

			if (attempt < maxRetries - 1) {
				// Exponential backoff: 1s, 2s, 4s
				const delayMs = 1000 * 2 ** attempt;
				logger.warn(
					{ attempt, delayMs, error: lastError.message },
					"Retrying Slack webhook after error",
				);
				await new Promise((resolve) => setTimeout(resolve, delayMs));
			}
		}
	}

	// Log to Sentry on final failure
	logger.error(
		{ error: lastError?.message },
		"Slack webhook failed after all retries",
	);

	throw lastError;
}
