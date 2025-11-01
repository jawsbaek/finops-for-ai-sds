/**
 * Slack Webhook Service
 *
 * Sends cost alert notifications to Slack using Webhook API
 * Implements retry logic with exponential backoff
 */

import { logger } from "~/lib/logger";
import { retryWithBackoff } from "~/lib/utils/retry";

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

	await retryWithBackoff(
		async () => {
			const response = await fetch(webhookUrl, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(payload),
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(
					`Slack webhook failed: ${response.status} ${errorText}`,
				);
			}

			logger.info(
				{ projectName: params.projectName },
				"Slack alert sent successfully",
			);
		},
		{
			context: "Slack webhook",
			finalErrorMessage: "Slack webhook failed after all retries",
		},
	);
}

export interface SlackDisableNotificationParams {
	teamName: string;
	apiKeyLast4: string;
	reason: string;
	userName: string;
	timestamp: string;
}

/**
 * Send API key disable notification to Slack
 *
 * Notifies team that an API key has been disabled
 */
export async function sendDisableNotification(
	params: SlackDisableNotificationParams,
): Promise<void> {
	const webhookUrl = process.env.SLACK_WEBHOOK_URL;

	if (!webhookUrl) {
		logger.warn(
			"SLACK_WEBHOOK_URL not configured, skipping Slack notification",
		);
		return;
	}

	const payload = {
		text: `⚠️ [${params.teamName}] API 키 비활성화`,
		blocks: [
			{
				type: "section",
				text: {
					type: "mrkdwn",
					text: `*⚠️ API 키 비활성화*\n\n*API 키*: ...${params.apiKeyLast4}\n*비활성화 사유*: ${params.reason}\n*담당자*: ${params.userName}\n*시각*: ${params.timestamp}`,
				},
			},
		],
	};

	await retryWithBackoff(
		async () => {
			const response = await fetch(webhookUrl, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(payload),
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(
					`Slack webhook failed: ${response.status} ${errorText}`,
				);
			}

			logger.info(
				{ teamName: params.teamName },
				"Slack disable notification sent",
			);
		},
		{
			context: "Slack webhook",
			finalErrorMessage: "Slack webhook failed after all retries",
		},
	);
}
