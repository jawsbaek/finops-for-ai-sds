/**
 * Retry Utility with Exponential Backoff
 *
 * Provides reusable retry logic following T3 App best practices
 * Reduces code duplication across services
 */

import { logger } from "~/lib/logger";

export interface RetryOptions {
	/**
	 * Maximum number of retry attempts
	 * @default 3
	 */
	maxRetries?: number;

	/**
	 * Base delay in milliseconds for exponential backoff
	 * Delay formula: baseDelayMs * 2^attempt
	 * @default 1000 (1 second)
	 */
	baseDelayMs?: number;

	/**
	 * Context string for logging (e.g., "Slack webhook", "Email send")
	 * @default "Operation"
	 */
	context?: string;

	/**
	 * Custom error message for final failure
	 */
	finalErrorMessage?: string;
}

/**
 * Retry a function with exponential backoff
 *
 * Implements retry logic with delays: 1s, 2s, 4s (default)
 * Logs warnings on retry and errors on final failure
 *
 * @example
 * ```typescript
 * const result = await retryWithBackoff(
 *   async () => fetch(url, options),
 *   { context: "API call", maxRetries: 3 }
 * );
 * ```
 *
 * @param fn - Async function to retry
 * @param options - Retry configuration
 * @returns Result of the function if successful
 * @throws Last error if all retries are exhausted
 */
export async function retryWithBackoff<T>(
	fn: () => Promise<T>,
	options: RetryOptions = {},
): Promise<T> {
	const {
		maxRetries = 3,
		baseDelayMs = 1000,
		context = "Operation",
		finalErrorMessage,
	} = options;

	let lastError: Error | undefined;

	for (let attempt = 0; attempt < maxRetries; attempt++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error as Error;

			if (attempt < maxRetries - 1) {
				// Exponential backoff: 1s, 2s, 4s (with baseDelayMs = 1000)
				const delayMs = baseDelayMs * 2 ** attempt;
				logger.warn(
					{ attempt, delayMs, error: lastError.message },
					`Retrying ${context} after error`,
				);
				await new Promise((resolve) => setTimeout(resolve, delayMs));
			}
		}
	}

	// Log to Sentry/monitoring on final failure
	logger.error(
		{ error: lastError?.message },
		finalErrorMessage ?? `${context} failed after all retries`,
	);

	throw lastError;
}
