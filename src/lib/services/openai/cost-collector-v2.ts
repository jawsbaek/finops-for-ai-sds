/**
 * OpenAI Costs API Collector Service (v2)
 *
 * Fetches daily cost data from OpenAI Costs API (organization-level)
 * Uses team-level Admin API keys instead of project-level keys
 * Implements retry logic with exponential backoff for resilience
 */

import pino from "pino";
import { COST_COLLECTION } from "~/lib/constants";
import { retryWithBackoff } from "~/lib/utils/retry";
import { db } from "~/server/db";
import { getKMSEncryption } from "../encryption/kms-envelope";

const logger = pino({ name: "openai-cost-collector-v2" });

// OpenAI Costs API response types
interface CostAmount {
	value: number;
	currency: string;
}

interface CostResult {
	object: "organization.costs.result";
	amount: CostAmount;
	line_item: string | null;
	project_id: string | null;
}

interface CostBucket {
	object: "bucket";
	start_time: number; // Unix seconds
	end_time: number; // Unix seconds
	results: CostResult[];
}

interface CostsAPIResponse {
	object: "page";
	data: CostBucket[];
	has_more: boolean;
	next_page: string | null;
}

/**
 * Cost data structure for collected costs from Costs API
 */
export interface CollectedCostDataV2 {
	projectId: string;
	provider: string;
	service: string; // line_item value
	cost: number; // in dollars
	bucketStartTime: Date;
	bucketEndTime: Date;
	lineItem: string | null;
	currency: string;
	apiVersion: "costs_v1";
	// Optional context (Novel Pattern 1)
	taskType?: string;
	userIntent?: string;
}

/**
 * Fetch costs from OpenAI Costs API
 *
 * @param adminApiKey - Decrypted Admin API Key (Team level)
 * @param startTime - Unix timestamp (start time)
 * @param endTime - Unix timestamp (end time, optional)
 * @param projectIds - Filter by OpenAI Project IDs (optional)
 * @param limit - Number of buckets to return (default 7, max 180)
 * @param page - Pagination cursor (optional)
 */
async function fetchOpenAICosts(
	adminApiKey: string,
	startTime: number,
	endTime?: number,
	projectIds?: string[],
	limit = 7,
	page?: string,
): Promise<CostsAPIResponse> {
	const url = new URL("https://api.openai.com/v1/organization/costs");

	url.searchParams.set("start_time", startTime.toString());
	url.searchParams.set("bucket_width", "1d"); // Daily buckets
	url.searchParams.set("limit", limit.toString());

	if (endTime) {
		url.searchParams.set("end_time", endTime.toString());
	}

	if (page) {
		url.searchParams.set("page", page);
	}

	// Group by line_item and project_id for detailed breakdown
	url.searchParams.set("group_by", "line_item,project_id");

	// Filter by specific projects if provided
	if (projectIds && projectIds.length > 0) {
		for (const id of projectIds) {
			url.searchParams.append("project_ids", id);
		}
	}

	logger.info({ url: url.toString() }, "Fetching OpenAI Costs API");

	const response = await fetch(url.toString(), {
		method: "GET",
		headers: {
			Authorization: `Bearer ${adminApiKey}`,
			"Content-Type": "application/json",
		},
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(
			`OpenAI Costs API error (${response.status}): ${errorText}`,
		);
	}

	return (await response.json()) as CostsAPIResponse;
}

/**
 * Fetch all costs with pagination support
 *
 * @param adminApiKey - Decrypted Admin API Key
 * @param startTime - Unix timestamp (start time)
 * @param endTime - Unix timestamp (end time, optional)
 * @param projectIds - Filter by OpenAI Project IDs (optional)
 * @returns All cost buckets across all pages
 */
async function fetchOpenAICostsComplete(
	adminApiKey: string,
	startTime: number,
	endTime?: number,
	projectIds?: string[],
): Promise<CostBucket[]> {
	const allBuckets: CostBucket[] = [];
	let currentPage: string | undefined;
	let hasMore = true;

	while (hasMore) {
		const response = await retryWithBackoff(
			() =>
				fetchOpenAICosts(
					adminApiKey,
					startTime,
					endTime,
					projectIds,
					180,
					currentPage,
				),
			{ context: "OpenAI Costs API fetch" },
		);

		allBuckets.push(...response.data);

		logger.info(
			{
				bucketsInPage: response.data.length,
				totalBuckets: allBuckets.length,
				hasMore: response.has_more,
			},
			"Fetched OpenAI costs page",
		);

		if (response.has_more && response.next_page) {
			currentPage = response.next_page;
		} else {
			hasMore = false;
		}
	}

	return allBuckets;
}

/**
 * Collect daily costs for a team using Costs API
 *
 * @param teamId - Team ID to collect costs for
 * @param targetDate - Date to collect costs for (defaults to yesterday)
 * @returns Collected cost data
 */
export async function collectDailyCostsV2(
	teamId: string,
	targetDate?: Date,
): Promise<CollectedCostDataV2[]> {
	const date =
		targetDate ??
		new Date(Date.now() - COST_COLLECTION.DATA_DELAY_HOURS * 60 * 60 * 1000);

	// Calculate start/end of day in Unix timestamp
	const startOfDay = new Date(date);
	startOfDay.setHours(0, 0, 0, 0);
	const endOfDay = new Date(date);
	endOfDay.setHours(23, 59, 59, 999);

	const startTime = Math.floor(startOfDay.getTime() / 1000);
	const endTime = Math.floor(endOfDay.getTime() / 1000);

	logger.info(
		{ teamId, date: date.toISOString().split("T")[0] },
		"Starting Costs API collection",
	);

	// 1. Get Team's Admin API Key
	const orgApiKey = await db.organizationApiKey.findUnique({
		where: {
			teamId,
			provider: "openai",
			isActive: true,
		},
	});

	if (!orgApiKey) {
		logger.warn({ teamId }, "No active Admin API key found for team");
		return [];
	}

	// 2. Decrypt Admin API Key
	const decryptedKey = await retryWithBackoff(
		() =>
			getKMSEncryption().decrypt(
				orgApiKey.encryptedKey,
				orgApiKey.encryptedDataKey,
				orgApiKey.iv,
			),
		{ context: "KMS decryption" },
	);

	// 3. Get all projects with OpenAI Project ID
	const projects = await db.project.findMany({
		where: {
			teamId,
			openaiProjectId: { not: null },
		},
		select: {
			id: true,
			openaiProjectId: true,
		},
	});

	if (projects.length === 0) {
		logger.warn({ teamId }, "No projects with OpenAI Project ID found");
		return [];
	}

	const projectIdMap = new Map(
		projects
			.filter(
				(p): p is typeof p & { openaiProjectId: string } =>
					p.openaiProjectId !== null,
			)
			.map((p) => [p.openaiProjectId, p.id]),
	);
	const openaiProjectIds = Array.from(projectIdMap.keys());

	logger.info(
		{ teamId, projectCount: projects.length },
		"Fetching costs for projects",
	);

	// 4. Fetch costs from Costs API
	const costBuckets = await fetchOpenAICostsComplete(
		decryptedKey,
		startTime,
		endTime,
		openaiProjectIds,
	);

	// 5. Transform data
	const allCostData: CollectedCostDataV2[] = [];

	for (const bucket of costBuckets) {
		const bucketStartTime = new Date(bucket.start_time * 1000);
		const bucketEndTime = new Date(bucket.end_time * 1000);

		for (const result of bucket.results) {
			// Map OpenAI Project ID to our internal Project ID
			const internalProjectId = result.project_id
				? projectIdMap.get(result.project_id)
				: null;

			if (!internalProjectId) {
				logger.warn(
					{ openaiProjectId: result.project_id },
					"Unknown OpenAI Project ID, skipping",
				);
				continue;
			}

			allCostData.push({
				projectId: internalProjectId,
				provider: "openai",
				service: result.line_item ?? "Unknown",
				cost: result.amount.value,
				bucketStartTime,
				bucketEndTime,
				lineItem: result.line_item,
				currency: result.amount.currency,
				apiVersion: "costs_v1",
			});
		}
	}

	logger.info(
		{ teamId, recordCount: allCostData.length },
		"Costs API collection completed",
	);

	return allCostData;
}

/**
 * Store collected cost data (Costs API version)
 *
 * @param costDataRecords - Cost data records to store
 * @returns Number of records created
 */
export async function storeCostDataV2(
	costDataRecords: CollectedCostDataV2[],
): Promise<number> {
	if (costDataRecords.length === 0) {
		logger.info("No cost data to store");
		return 0;
	}

	logger.info(
		{ recordsCount: costDataRecords.length },
		"Storing cost data (Costs API)",
	);

	const batchSize = COST_COLLECTION.BATCH_SIZE;
	let totalCreated = 0;

	for (let i = 0; i < costDataRecords.length; i += batchSize) {
		const batch = costDataRecords.slice(i, i + batchSize);

		const result = await db.costData.createMany({
			data: batch.map((record) => ({
				projectId: record.projectId,
				apiKeyId: null, // Costs API uses Admin Key, no project API key
				provider: record.provider,
				service: record.service,
				model: null, // Costs API doesn't provide model info
				tokens: null, // Costs API doesn't provide token info
				cost: record.cost,
				date: record.bucketStartTime, // Use bucket start time as date
				snapshotId: null, // Costs API doesn't have snapshot_id
				bucketStartTime: record.bucketStartTime,
				bucketEndTime: record.bucketEndTime,
				lineItem: record.lineItem,
				currency: record.currency,
				apiVersion: record.apiVersion,
				taskType: record.taskType ?? null,
				userIntent: record.userIntent ?? null,
			})),
			skipDuplicates: true, // Use unique_cost_bucket constraint
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
