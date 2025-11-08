/**
 * OpenAI Usage Completions API Collector
 *
 * Fetches detailed token usage data from OpenAI Usage API
 * Complements cost-collector-v2.ts by providing granular token metrics
 */

import pino from "pino";
import { COST_COLLECTION } from "~/lib/constants";
import { retryWithBackoff } from "~/lib/utils/retry";
import { db } from "~/server/db";
import { getKMSEncryption } from "../encryption/kms-envelope";

const logger = pino({ name: "openai-usage-collector" });

// OpenAI Usage Completions API response types
interface UsageCompletionsResult {
	object: "organization.usage.completions.result";
	project_id: string | null; // Can be null or empty string
	num_model_requests: number;
	user_id: string | null;
	api_key_id: string | null;
	model: string | null;
	batch: string | null;
	service_tier: string | null;

	// Token counts
	input_tokens: number;
	output_tokens: number;
	input_cached_tokens: number;
	input_uncached_tokens: number;

	// Text tokens
	input_text_tokens: number;
	output_text_tokens: number;
	input_cached_text_tokens: number;

	// Audio tokens
	input_audio_tokens: number;
	input_cached_audio_tokens: number;
	output_audio_tokens: number;

	// Image tokens
	input_image_tokens: number;
	input_cached_image_tokens: number;
	output_image_tokens: number;
}

interface UsageCompletionsBucket {
	object: "bucket";
	start_time: number; // Unix seconds
	end_time: number;
	start_time_iso: string;
	end_time_iso: string;
	results: UsageCompletionsResult[];
}

interface UsageCompletionsResponse {
	object: "page";
	data: UsageCompletionsBucket[];
	has_more: boolean;
	next_page: string | null;
}

/**
 * Collected token usage data structure
 */
export interface CollectedTokenUsage {
	projectId: string;
	teamId: string;
	provider: string;
	organizationId: string;
	aiProjectId: string | null; // Can be null or empty string from API

	model: string;
	numModelRequests: number;

	// Token breakdown
	inputTokens: number;
	outputTokens: number;
	inputCachedTokens: number;
	inputUncachedTokens: number;

	// Text tokens
	inputTextTokens: number;
	outputTextTokens: number;
	inputCachedTextTokens: number;

	// Audio tokens
	inputAudioTokens: number;
	inputCachedAudioTokens: number;
	outputAudioTokens: number;

	// Image tokens
	inputImageTokens: number;
	inputCachedImageTokens: number;
	outputImageTokens: number;

	// Time bucket
	bucketStartTime: Date;
	bucketEndTime: Date;

	// Metadata
	userId: string | null;
	apiKeyId: string | null;
	batch: string | null;
	serviceTier: string | null;
}

/**
 * Fetch usage data from OpenAI Usage Completions API
 */
async function fetchUsageCompletions(
	adminApiKey: string,
	startTime: number,
	endTime?: number,
	projectIds?: string[],
	limit = 7,
	page?: string,
): Promise<UsageCompletionsResponse> {
	const url = new URL(
		"https://api.openai.com/v1/organization/usage/completions",
	);

	url.searchParams.set("start_time", startTime.toString());
	url.searchParams.set("bucket_width", "1d"); // Daily buckets
	url.searchParams.set("limit", Math.min(limit, 31).toString()); // Max 31 for daily buckets
	url.searchParams.set("group_by", "project_id,model"); // Group by project and model

	if (endTime) {
		url.searchParams.set("end_time", endTime.toString());
	}

	if (page) {
		url.searchParams.set("page", page);
	}

	// Filter by specific projects if provided
	if (projectIds && projectIds.length > 0) {
		for (const id of projectIds) {
			url.searchParams.append("project_ids", id);
		}
	}

	logger.info({ url: url.toString() }, "Fetching OpenAI Usage Completions API");

	try {
		const response = await fetch(url.toString(), {
			method: "GET",
			headers: {
				Authorization: `Bearer ${adminApiKey}`,
				"Content-Type": "application/json",
			},
			signal: AbortSignal.timeout(10000),
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(
				`OpenAI Usage Completions API error (${response.status}): ${errorText}`,
			);
		}

		return (await response.json()) as UsageCompletionsResponse;
	} catch (error) {
		if (error instanceof Error && error.name === "AbortError") {
			throw new Error(
				"OpenAI Usage Completions API request timed out after 10 seconds",
			);
		}
		throw error;
	}
}

/**
 * Fetch all usage data with pagination
 */
async function fetchUsageCompletionsComplete(
	adminApiKey: string,
	startTime: number,
	endTime?: number,
	projectIds?: string[],
): Promise<UsageCompletionsBucket[]> {
	const allBuckets: UsageCompletionsBucket[] = [];
	let currentPage: string | undefined;
	let hasMore = true;
	let pageCount = 0;
	const MAX_PAGES = Number.parseInt(
		process.env.USAGE_COLLECTOR_MAX_PAGES ?? "100",
		10,
	);

	while (hasMore && pageCount < MAX_PAGES) {
		pageCount++;

		const response = await retryWithBackoff(
			() =>
				fetchUsageCompletions(
					adminApiKey,
					startTime,
					endTime,
					projectIds,
					31, // Max limit for daily buckets
					currentPage,
				),
			{ context: "OpenAI Usage Completions API fetch" },
		);

		allBuckets.push(...response.data);

		logger.info(
			{
				bucketsInPage: response.data.length,
				totalBuckets: allBuckets.length,
				hasMore: response.has_more,
				pageCount,
			},
			"Fetched Usage Completions page",
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
			"Hit maximum page limit for usage collection",
		);
	}

	return allBuckets;
}

/**
 * Collect daily token usage for a team
 */
export async function collectDailyTokenUsage(
	teamId: string,
	targetDate?: Date,
): Promise<CollectedTokenUsage[]> {
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
		"Starting Usage Completions API collection",
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

	const allUsageData: CollectedTokenUsage[] = [];

	// 2. Process each organization separately
	for (const orgApiKey of orgApiKeys) {
		try {
			// Verify key is still active
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
						// Legacy OpenAI projects
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
					openaiProjectId: true,
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
			const validProjects = projects.filter(
				(p) => p.aiProjectId != null || p.openaiProjectId != null,
			);

			if (validProjects.length === 0) {
				logger.warn(
					{
						teamId,
						organizationId: orgApiKey.organizationId,
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
				},
				"Fetching usage for organization",
			);

			// 4. Call Usage Completions API with project_ids filter
			const usageBuckets = await fetchUsageCompletionsComplete(
				decryptedKey,
				startTime,
				endTime,
				aiProjectIds,
			);

			// 5. Transform data
			for (const bucket of usageBuckets) {
				const bucketStartTime = new Date(bucket.start_time * 1000);
				const bucketEndTime = new Date(bucket.end_time * 1000);

				for (const result of bucket.results) {
					// Handle project_id: can be null, empty string, or actual ID
					const apiProjectId = result.project_id || null;
					const internalProjectId = apiProjectId
						? projectIdMap.get(apiProjectId)
						: null;

					if (!internalProjectId) {
						logger.warn(
							{
								apiProjectId: apiProjectId || "(null/empty)",
								organizationId: orgApiKey.organizationId,
								model: result.model,
								requests: result.num_model_requests,
							},
							"Unknown AI Project ID in usage data, skipping",
						);
						continue;
					}

					// Skip results without model information
					if (!result.model) {
						logger.warn(
							{
								projectId: internalProjectId,
								apiProjectId,
							},
							"Usage result without model information, skipping",
						);
						continue;
					}

					allUsageData.push({
						projectId: internalProjectId,
						teamId,
						provider: orgApiKey.provider,
						organizationId: orgApiKey.organizationId as string,
						aiProjectId: apiProjectId,

						model: result.model,
						numModelRequests: result.num_model_requests,

						inputTokens: result.input_tokens,
						outputTokens: result.output_tokens,
						inputCachedTokens: result.input_cached_tokens,
						inputUncachedTokens: result.input_uncached_tokens,

						inputTextTokens: result.input_text_tokens,
						outputTextTokens: result.output_text_tokens,
						inputCachedTextTokens: result.input_cached_text_tokens,

						inputAudioTokens: result.input_audio_tokens,
						inputCachedAudioTokens: result.input_cached_audio_tokens,
						outputAudioTokens: result.output_audio_tokens,

						inputImageTokens: result.input_image_tokens,
						inputCachedImageTokens: result.input_cached_image_tokens,
						outputImageTokens: result.output_image_tokens,

						bucketStartTime,
						bucketEndTime,

						userId: result.user_id,
						apiKeyId: result.api_key_id,
						batch: result.batch,
						serviceTier: result.service_tier,
					});
				}
			}

			logger.info(
				{
					teamId,
					organizationId: orgApiKey.organizationId,
					recordCount: allUsageData.filter(
						(u) => u.organizationId === orgApiKey.organizationId,
					).length,
				},
				"Usage Completions collection completed for organization",
			);
		} catch (error) {
			logger.error(
				{
					teamId,
					organizationId: orgApiKey.organizationId,
					provider: orgApiKey.provider,
					error: error instanceof Error ? error.message : String(error),
				},
				"Failed to collect usage for organization",
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
		{ teamId, totalRecords: allUsageData.length },
		"Multi-org usage collection completed",
	);

	return allUsageData;
}

/**
 * Store collected token usage data to database
 */
export async function storeTokenUsage(
	usageData: CollectedTokenUsage[],
): Promise<number> {
	if (usageData.length === 0) {
		return 0;
	}

	logger.info(
		{ count: usageData.length },
		"Storing token usage data to database",
	);

	// Transform usage data for bulk insert
	const dataToInsert = usageData.map((data) => ({
		projectId: data.projectId,
		teamId: data.teamId,
		provider: data.provider,
		organizationId: data.organizationId,
		aiProjectId: data.aiProjectId,

		model: data.model,
		numModelRequests: data.numModelRequests,

		inputTokens: data.inputTokens,
		outputTokens: data.outputTokens,
		inputCachedTokens: data.inputCachedTokens,
		inputUncachedTokens: data.inputUncachedTokens,

		inputTextTokens: data.inputTextTokens,
		outputTextTokens: data.outputTextTokens,
		inputCachedTextTokens: data.inputCachedTextTokens,

		inputAudioTokens: data.inputAudioTokens,
		inputCachedAudioTokens: data.inputCachedAudioTokens,
		outputAudioTokens: data.outputAudioTokens,

		inputImageTokens: data.inputImageTokens,
		inputCachedImageTokens: data.inputCachedImageTokens,
		outputImageTokens: data.outputImageTokens,

		bucketStartTime: data.bucketStartTime,
		bucketEndTime: data.bucketEndTime,
		date: data.bucketStartTime, // Use start time as the date

		userId: data.userId,
		apiKeyId: data.apiKeyId,
		batch: data.batch,
		serviceTier: data.serviceTier,
	}));

	// Use createMany with skipDuplicates to handle retries idempotently
	const result = await db.tokenUsage.createMany({
		data: dataToInsert,
		skipDuplicates: true,
	});

	logger.info(
		{ storedCount: result.count, attemptedCount: usageData.length },
		"Token usage data stored successfully",
	);

	return result.count;
}
