/**
 * OpenAI Cost Collector Service
 *
 * Fetches daily usage data from OpenAI Usage API
 * Implements retry logic with exponential backoff for resilience
 */

import pino from "pino";
import { COST_COLLECTION } from "~/lib/constants";
import { retryWithBackoff } from "~/lib/utils/retry";
import { db } from "~/server/db";
import { getKMSEncryption } from "../encryption/kms-envelope";

const logger = pino({ name: "openai-cost-collector" });

// OpenAI Usage API response types
interface OpenAIUsageData {
	aggregation_timestamp: number;
	snapshot_id: string;
	model: string;
	n_requests: number;
	n_context_tokens: number;
	n_generated_tokens: number;
	cost_in_cents: number;
}

interface OpenAIUsageResponse {
	object: string;
	data: OpenAIUsageData[];
	has_more: boolean;
	next_page?: string;
}

/**
 * Cost data structure for collected costs with context metadata
 * Novel Pattern 1: Cost-Value Attribution
 */
export interface CollectedCostData {
	projectId: string; // Required: costs are attributed to projects
	apiKeyId: string;
	provider: string;
	service: string;
	model: string;
	tokens: number;
	cost: number; // in dollars
	date: Date;
	snapshotId: string; // OpenAI snapshot_id for deduplication
	// Novel Pattern 1: Context metadata (optional)
	taskType?: string; // Optional task type (e.g., "chat", "embedding", "fine-tuning")
	userIntent?: string; // Optional user intent description
}

/**
 * Fetch usage data from OpenAI API for a specific date or URL
 *
 * @param apiKey - Decrypted OpenAI API key
 * @param dateOrUrl - Date to fetch usage for (YYYY-MM-DD format) or pagination URL
 * @returns OpenAI usage response
 */
async function fetchOpenAIUsage(
	apiKey: string,
	dateOrUrl: string,
): Promise<OpenAIUsageResponse> {
	// If it's a full URL (pagination), use it directly. Otherwise, construct the URL
	const url = dateOrUrl.startsWith("http")
		? dateOrUrl
		: `https://api.openai.com/v1/usage?date=${dateOrUrl}`;

	logger.info({ url }, "Fetching OpenAI usage data");

	const response = await fetch(url, {
		method: "GET",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
	}

	return (await response.json()) as OpenAIUsageResponse;
}

/**
 * Fetch all usage data from OpenAI API with pagination support
 *
 * @param apiKey - Decrypted OpenAI API key
 * @param date - Date to fetch usage for (YYYY-MM-DD format)
 * @returns All usage data across all pages
 */
async function fetchOpenAIUsageComplete(
	apiKey: string,
	date: string,
): Promise<OpenAIUsageData[]> {
	const allData: OpenAIUsageData[] = [];
	let currentUrl: string = date; // Start with date string
	let hasMore = true;

	while (hasMore) {
		const response = await retryWithBackoff(
			() => fetchOpenAIUsage(apiKey, currentUrl),
			{ context: "OpenAI Usage API fetch" },
		);

		allData.push(...response.data);

		logger.info(
			{
				recordsInPage: response.data.length,
				totalRecords: allData.length,
				hasMore: response.has_more,
			},
			"Fetched OpenAI usage page",
		);

		// Check if there are more pages
		if (response.has_more && response.next_page) {
			currentUrl = response.next_page;
		} else {
			hasMore = false; // Exit loop
		}
	}

	return allData;
}

/**
 * Collect daily costs for all teams
 *
 * @param targetDate - Date to collect costs for (defaults to yesterday)
 * @returns Array of collected cost data records
 */
export async function collectDailyCosts(
	targetDate?: Date,
): Promise<CollectedCostData[]> {
	// Default to yesterday (OpenAI data is delayed 8-24 hours)
	const date =
		targetDate ??
		new Date(Date.now() - COST_COLLECTION.DATA_DELAY_HOURS * 60 * 60 * 1000);
	const dateString = date.toISOString().split("T")[0] as string; // YYYY-MM-DD

	logger.info({ date: dateString }, "Starting daily cost collection");

	// Fetch all active OpenAI API keys with their projects
	const apiKeys = await db.apiKey.findMany({
		where: {
			provider: "openai",
			isActive: true,
		},
		include: {
			project: true,
		},
	});

	if (apiKeys.length === 0) {
		logger.warn("No active OpenAI API keys found");
		return [];
	}

	logger.info({ count: apiKeys.length }, "Found active API keys");

	const allCostData: CollectedCostData[] = [];

	// Process each API key sequentially to respect rate limits
	// OpenAI rate limit: 60 requests/second, so sequential is safe
	for (const apiKeyRecord of apiKeys) {
		try {
			logger.info(
				{ apiKeyId: apiKeyRecord.id, projectId: apiKeyRecord.projectId },
				"Processing API key",
			);

			// Double-check isActive status (defensive programming)
			if (!apiKeyRecord.isActive) {
				logger.warn(
					{ apiKeyId: apiKeyRecord.id },
					"API key is disabled, skipping cost collection",
				);
				continue;
			}

			// Decrypt API key using KMS
			const decryptedKey = await retryWithBackoff(
				() =>
					getKMSEncryption().decrypt(
						apiKeyRecord.encryptedKey,
						apiKeyRecord.encryptedDataKey,
						apiKeyRecord.iv,
					),
				{ context: "KMS decryption" },
			);

			// Fetch usage data from OpenAI with retry and pagination support
			const usageData = await fetchOpenAIUsageComplete(
				decryptedKey,
				dateString,
			);

			logger.info(
				{
					apiKeyId: apiKeyRecord.id,
					recordsCount: usageData.length,
				},
				"Fetched usage data",
			);

			// Transform OpenAI response to our cost data format
			for (const usage of usageData) {
				allCostData.push({
					projectId: apiKeyRecord.projectId,
					apiKeyId: apiKeyRecord.id,
					provider: "openai",
					service: usage.model, // e.g., "gpt-4", "gpt-3.5-turbo"
					model: usage.model,
					tokens: usage.n_context_tokens + usage.n_generated_tokens,
					cost: usage.cost_in_cents / 100, // Convert cents to dollars
					date: new Date(date),
					snapshotId: usage.snapshot_id, // For deduplication
				});
			}
		} catch (error) {
			// Log error but continue processing other API keys
			logger.error(
				{
					apiKeyId: apiKeyRecord.id,
					projectId: apiKeyRecord.projectId,
					error: error instanceof Error ? error.message : String(error),
				},
				"Failed to collect costs for API key",
			);
		}

		// Rate limiting: Wait between API calls to respect OpenAI limits
		// OpenAI rate limit is 60 requests/second, but we add delay for safety
		if (apiKeys.length > 1) {
			await new Promise((resolve) =>
				setTimeout(resolve, COST_COLLECTION.RATE_LIMIT_DELAY_MS),
			);
		}
	}

	logger.info(
		{ totalRecords: allCostData.length },
		"Cost collection completed",
	);

	return allCostData;
}

/**
 * Store collected cost data in the database
 *
 * @param costDataRecords - Array of cost data to store
 * @returns Number of records created
 */
export async function storeCostData(
	costDataRecords: CollectedCostData[],
): Promise<number> {
	if (costDataRecords.length === 0) {
		logger.info("No cost data to store");
		return 0;
	}

	logger.info(
		{ recordsCount: costDataRecords.length },
		"Storing cost data in database",
	);

	// Use batch insert for performance
	const batchSize = COST_COLLECTION.BATCH_SIZE;
	let totalCreated = 0;

	for (let i = 0; i < costDataRecords.length; i += batchSize) {
		const batch = costDataRecords.slice(i, i + batchSize);

		const result = await db.costData.createMany({
			data: batch.map((record) => ({
				projectId: record.projectId,
				apiKeyId: record.apiKeyId,
				provider: record.provider,
				service: record.service,
				model: record.model,
				tokens: record.tokens,
				cost: record.cost,
				date: record.date,
				snapshotId: record.snapshotId,
				// Novel Pattern 1: Context metadata
				taskType: record.taskType ?? null,
				userIntent: record.userIntent ?? null,
			})),
			skipDuplicates: true, // Skip if already exists (now works with unique constraint)
		});

		totalCreated += result.count;
		logger.info(
			{ batchIndex: i / batchSize, created: result.count },
			"Batch inserted",
		);
	}

	logger.info({ totalCreated }, "Cost data storage completed");

	return totalCreated;
}
