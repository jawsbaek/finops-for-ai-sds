/**
 * OpenAI Cost Collector Service
 *
 * Fetches daily usage data from OpenAI Usage API
 * Implements retry logic with exponential backoff for resilience
 */

import pino from "pino";
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

interface CollectedCostData {
	teamId: string;
	apiKeyId: string;
	provider: string;
	service: string;
	model: string;
	tokens: number;
	cost: number; // in dollars
	date: Date;
}

/**
 * Retry a function with exponential backoff
 *
 * @param fn - The async function to retry
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @returns The result of the function
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
					"Retrying after error",
				);
				await new Promise((resolve) => setTimeout(resolve, delayMs));
			}
		}
	}

	throw lastError;
}

/**
 * Fetch usage data from OpenAI API for a specific date
 *
 * @param apiKey - Decrypted OpenAI API key
 * @param date - Date to fetch usage for (YYYY-MM-DD format)
 * @returns OpenAI usage response
 */
async function fetchOpenAIUsage(
	apiKey: string,
	date: string,
): Promise<OpenAIUsageResponse> {
	const url = `https://api.openai.com/v1/usage?date=${date}`;

	logger.info({ date, url }, "Fetching OpenAI usage data");

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
 * Collect daily costs for all teams
 *
 * @param targetDate - Date to collect costs for (defaults to yesterday)
 * @returns Array of collected cost data records
 */
export async function collectDailyCosts(
	targetDate?: Date,
): Promise<CollectedCostData[]> {
	// Default to yesterday (OpenAI data is delayed 8-24 hours)
	const date = targetDate ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
	const dateString = date.toISOString().split("T")[0] as string; // YYYY-MM-DD

	logger.info({ date: dateString }, "Starting daily cost collection");

	// Fetch all active OpenAI API keys
	const apiKeys = await db.apiKey.findMany({
		where: {
			provider: "openai",
			isActive: true,
		},
		include: {
			team: true,
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
				{ apiKeyId: apiKeyRecord.id, teamId: apiKeyRecord.teamId },
				"Processing API key",
			);

			// Decrypt API key using KMS
			const decryptedKey = await retryWithBackoff(() =>
				getKMSEncryption().decrypt(
					apiKeyRecord.encryptedKey,
					apiKeyRecord.encryptedDataKey,
					apiKeyRecord.iv,
				),
			);

			// Fetch usage data from OpenAI with retry
			const usageData = await retryWithBackoff(() =>
				fetchOpenAIUsage(decryptedKey, dateString),
			);

			logger.info(
				{
					apiKeyId: apiKeyRecord.id,
					recordsCount: usageData.data.length,
				},
				"Fetched usage data",
			);

			// Transform OpenAI response to our cost data format
			for (const usage of usageData.data) {
				allCostData.push({
					teamId: apiKeyRecord.teamId,
					apiKeyId: apiKeyRecord.id,
					provider: "openai",
					service: usage.model, // e.g., "gpt-4", "gpt-3.5-turbo"
					model: usage.model,
					tokens: usage.n_context_tokens + usage.n_generated_tokens,
					cost: usage.cost_in_cents / 100, // Convert cents to dollars
					date: new Date(date),
				});
			}
		} catch (error) {
			// Log error but continue processing other API keys
			logger.error(
				{
					apiKeyId: apiKeyRecord.id,
					teamId: apiKeyRecord.teamId,
					error: error instanceof Error ? error.message : String(error),
				},
				"Failed to collect costs for API key",
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

	// Use batch insert for performance (max 1,000 records per batch)
	const batchSize = 1000;
	let totalCreated = 0;

	for (let i = 0; i < costDataRecords.length; i += batchSize) {
		const batch = costDataRecords.slice(i, i + batchSize);

		const result = await db.costData.createMany({
			data: batch.map((record) => ({
				teamId: record.teamId,
				apiKeyId: record.apiKeyId,
				provider: record.provider,
				service: record.service,
				model: record.model,
				tokens: record.tokens,
				cost: record.cost,
				date: record.date,
			})),
			skipDuplicates: true, // Skip if already exists
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
