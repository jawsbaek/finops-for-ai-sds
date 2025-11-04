import { TRPCError } from "@trpc/server";
import pino from "pino";
import type { ValidationResult } from "./validation";

const logger = pino({ name: "openai-validator" });

// Simple in-memory cache for validation results (5 minutes TTL)
const validationCache = new Map<
	string,
	{ valid: boolean; error?: string; timestamp: number }
>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Clean expired cache entries
 */
function cleanExpiredCache() {
	const now = Date.now();
	for (const [key, value] of validationCache.entries()) {
		if (now - value.timestamp > CACHE_TTL_MS) {
			validationCache.delete(key);
		}
	}
}

/**
 * Fetch OpenAI organization ID from API
 *
 * @param adminApiKey - Decrypted OpenAI Admin API key
 * @returns Organization ID (e.g., "org_abc123")
 * @throws TRPCError if API call fails or no organizations found
 */
export async function fetchOpenAIOrganizationId(
	adminApiKey: string,
): Promise<string> {
	try {
		const response = await fetch("https://api.openai.com/v1/organizations", {
			headers: {
				Authorization: `Bearer ${adminApiKey}`,
				"Content-Type": "application/json",
			},
			signal: AbortSignal.timeout(5000),
		});

		if (!response.ok) {
			const errorText = await response.text();
			logger.error(
				{ status: response.status, error: errorText },
				"Failed to fetch organization from OpenAI API",
			);

			throw new TRPCError({
				code: "BAD_REQUEST",
				message:
					"Unable to fetch organization. Please verify your API key is valid.",
			});
		}

		const data = (await response.json()) as { data: Array<{ id: string }> };

		// Return first organization (user might belong to multiple)
		if (data.data && data.data.length > 0 && data.data[0]?.id) {
			return data.data[0].id;
		}

		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "No organizations found for this API key",
		});
	} catch (error) {
		if (error instanceof TRPCError) {
			throw error;
		}
		if (
			error instanceof Error &&
			(error.name === "TimeoutError" || error.name === "AbortError")
		) {
			throw new TRPCError({
				code: "TIMEOUT",
				message: "Organization fetch timeout. Please try again.",
			});
		}
		throw error;
	}
}

/**
 * Validate OpenAI project ID via API (Option A: project-scoped)
 *
 * Includes caching to prevent excessive API calls (5 minute TTL)
 *
 * @param adminApiKey - Decrypted OpenAI Admin API key
 * @param projectId - OpenAI project ID (e.g., "proj_xyz")
 * @returns Validation result with error message if invalid
 */
export async function validateOpenAIProjectId(
	adminApiKey: string,
	projectId: string,
): Promise<ValidationResult> {
	// Check cache first
	cleanExpiredCache();
	const cacheKey = `${projectId}-${adminApiKey.slice(-4)}`;
	const cached = validationCache.get(cacheKey);

	if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
		logger.debug({ projectId }, "Validation cache hit");
		return { valid: cached.valid, error: cached.error };
	}

	try {
		const response = await fetch(
			`https://api.openai.com/v1/organization/projects/${projectId}/api_keys?limit=1`,
			{
				headers: {
					Authorization: `Bearer ${adminApiKey}`,
					"Content-Type": "application/json",
				},
				signal: AbortSignal.timeout(5000),
			},
		);

		let result: ValidationResult;

		if (response.ok) {
			result = { valid: true };
		} else if (response.status === 404) {
			result = {
				valid: false,
				error: "Project ID not found in your organization",
			};
		} else if (response.status === 403) {
			result = {
				valid: false,
				error: "Admin API Key does not have access to this project",
			};
		} else {
			// Other errors (429, 500, etc.) - sanitize for security
			const errorText = await response.text();
			logger.error(
				{ status: response.status, error: errorText },
				"OpenAI API validation failed",
			);

			// Return generic error message to prevent information leakage
			result = {
				valid: false,
				error:
					"Unable to validate project ID. Please check your API key permissions and try again.",
			};
		}

		// Cache the result
		validationCache.set(cacheKey, {
			valid: result.valid,
			error: result.error,
			timestamp: Date.now(),
		});

		return result;
	} catch (error) {
		if (
			error instanceof Error &&
			(error.name === "TimeoutError" || error.name === "AbortError")
		) {
			throw new TRPCError({
				code: "TIMEOUT",
				message: "Validation timeout. Please try again.",
			});
		}
		throw error;
	}
}
