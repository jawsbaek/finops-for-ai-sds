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

	// NEW: Provider metadata for traceability
	providerMetadata?: {
		organizationId?: string | null;
		aiProjectId?: string | null;
	};

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
		signal: AbortSignal.timeout(10000), // 10 second timeout
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
	let pageCount = 0;
	const MAX_PAGES = 100; // Safety limit to prevent infinite loops

	while (hasMore && pageCount < MAX_PAGES) {
		pageCount++;

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
				pageCount,
			},
			"Fetched OpenAI costs page",
		);

		if (response.has_more && response.next_page) {
			currentPage = response.next_page;
		} else {
			hasMore = false;
		}
	}

	if (pageCount >= MAX_PAGES) {
		logger.warn(
			{ pageCount, totalBuckets: allBuckets.length },
			"Hit maximum page limit for cost collection",
		);
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

	// 1. Fetch ALL active Admin API Keys for the team
	const orgApiKeys = await db.organizationApiKey.findMany({
		where: {
			teamId,
			provider: "openai",
			isActive: true,
		},
	});

	if (orgApiKeys.length === 0) {
		logger.warn({ teamId }, "No active Admin API keys found for team");
		return [];
	}

	logger.info(
		{ teamId, orgApiKeyCount: orgApiKeys.length },
		"Found active Admin API keys",
	);

	const allCostData: CollectedCostDataV2[] = [];

	// 2. Process each organization separately
	for (const orgApiKey of orgApiKeys) {
		try {
			// Verify key is still active before decrypting (prevent race condition)
			const currentKey = await db.organizationApiKey.findUnique({
				where: { id: orgApiKey.id },
				select: { isActive: true },
			});

			if (!currentKey?.isActive) {
				logger.warn(
					{ orgId: orgApiKey.organizationId },
					"Admin key was deactivated during processing, skipping",
				);
				continue;
			}

			// Decrypt Admin API Key
			const decryptedKey = await retryWithBackoff(
				() =>
					getKMSEncryption().decrypt(
						orgApiKey.encryptedKey,
						orgApiKey.encryptedDataKey,
						orgApiKey.iv,
					),
				{ context: "KMS decryption" },
			);

			// 3. Get all projects for this team + organization
			// Support both new multi-org fields and legacy openaiProjectId
			const projects = await db.project.findMany({
				where: {
					teamId,
					OR: [
						// New multi-org projects
						{
							aiProvider: orgApiKey.provider,
							aiOrganizationId: orgApiKey.organizationId,
							aiProjectId: { not: null },
						},
						// Legacy OpenAI projects (backward compatibility)
						...(orgApiKey.provider === "openai"
							? [
									{
										aiProvider: null,
										aiOrganizationId: null,
										aiProjectId: null,
										openaiProjectId: { not: null },
									},
								]
							: []),
					],
				},
				select: {
					id: true,
					aiProjectId: true,
					openaiProjectId: true, // Include legacy field
				},
			});

			if (projects.length === 0) {
				logger.warn(
					{
						teamId,
						provider: orgApiKey.provider,
						organizationId: orgApiKey.organizationId,
					},
					"No projects with AI Project IDs found for this organization",
				);
				continue;
			}

			// Create mapping: AI Project ID → Internal Project ID
			// Support both new aiProjectId and legacy openaiProjectId
			const validProjects = projects.filter(
				(p) => p.aiProjectId != null || p.openaiProjectId != null,
			);

			if (validProjects.length === 0) {
				logger.warn(
					{
						teamId,
						organizationId: orgApiKey.organizationId,
						totalProjects: projects.length,
					},
					"No projects with valid AI Project IDs found, skipping organization",
				);
				continue;
			}

			const projectIdMap = new Map(
				validProjects.map((p) => [
					(p.aiProjectId ?? p.openaiProjectId) as string,
					p.id,
				]),
			);
			const aiProjectIds = Array.from(projectIdMap.keys());

			logger.info(
				{
					teamId,
					organizationId: orgApiKey.organizationId,
					projectCount: validProjects.length,
					totalProjects: projects.length,
				},
				"Fetching costs for organization",
			);

			// 4. Call Costs API with project_ids filter
			const costBuckets = await fetchOpenAICostsComplete(
				decryptedKey,
				startTime,
				endTime,
				aiProjectIds,
			);

			// 5. Transform data
			for (const bucket of costBuckets) {
				const bucketStartTime = new Date(bucket.start_time * 1000);
				const bucketEndTime = new Date(bucket.end_time * 1000);

				for (const result of bucket.results) {
					// Map OpenAI Project ID → Internal Project ID
					const internalProjectId = result.project_id
						? projectIdMap.get(result.project_id)
						: null;

					if (!internalProjectId) {
						logger.warn(
							{
								openaiProjectId: result.project_id,
								organizationId: orgApiKey.organizationId,
							},
							"Unknown AI Project ID, skipping",
						);
						continue;
					}

					allCostData.push({
						projectId: internalProjectId,
						provider: orgApiKey.provider,
						service: result.line_item ?? "Unknown",
						cost: result.amount.value,
						bucketStartTime,
						bucketEndTime,
						lineItem: result.line_item,
						currency: result.amount.currency,
						apiVersion: "costs_v1",
						// Store provider metadata for traceability
						providerMetadata: {
							organizationId: orgApiKey.organizationId,
							aiProjectId: result.project_id,
						},
					});
				}
			}

			logger.info(
				{
					teamId,
					organizationId: orgApiKey.organizationId,
					recordCount: allCostData.filter(
						(c) =>
							c.providerMetadata?.organizationId === orgApiKey.organizationId,
					).length,
				},
				"Costs API collection completed for organization",
			);
		} catch (error) {
			logger.error(
				{
					teamId,
					organizationId: orgApiKey.organizationId,
					provider: orgApiKey.provider,
					error: error instanceof Error ? error.message : String(error),
				},
				"Failed to collect costs for organization",
			);
			// Continue with next organization
		}

		// Rate limiting between organizations
		if (orgApiKeys.length > 1) {
			await new Promise((resolve) =>
				setTimeout(resolve, COST_COLLECTION.RATE_LIMIT_DELAY_MS),
			);
		}
	}

	logger.info(
		{ teamId, totalRecords: allCostData.length },
		"Multi-org costs collection completed",
	);

	return allCostData;
}

/**
 * Store collected cost data to database
 */
export async function storeCostDataV2(
	costData: CollectedCostDataV2[],
): Promise<number> {
	if (costData.length === 0) {
		return 0;
	}

	logger.info({ count: costData.length }, "Storing cost data to database");

	// Transform cost data for bulk insert
	const dataToInsert = costData.map((data) => ({
		projectId: data.projectId,
		provider: data.provider,
		service: data.service,
		cost: data.cost,
		date: data.bucketStartTime, // Use start time as the date
		bucketStartTime: data.bucketStartTime,
		bucketEndTime: data.bucketEndTime,
		lineItem: data.lineItem,
		currency: data.currency,
		apiVersion: data.apiVersion,
		taskType: data.taskType,
		userIntent: data.userIntent,
	}));

	// Use createMany with skipDuplicates to handle retries idempotently
	const result = await db.costData.createMany({
		data: dataToInsert,
		skipDuplicates: true,
	});

	logger.info(
		{ storedCount: result.count, attemptedCount: costData.length },
		"Cost data stored successfully",
	);

	return result.count;
}
