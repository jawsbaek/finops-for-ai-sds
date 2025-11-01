/**
 * Application Constants
 *
 * Centralized configuration values following T3 App best practices
 * Provides single source of truth for magic numbers and configuration
 */

/**
 * Cost Collection Constants
 */
export const COST_COLLECTION = {
	/** Batch size for database inserts (Prisma optimization) */
	BATCH_SIZE: 1000,

	/** Delay between API calls in milliseconds (rate limiting) */
	RATE_LIMIT_DELAY_MS: 1000,

	/** Hours to look back for cost data (OpenAI data delay) */
	DATA_DELAY_HOURS: 24,
} as const;

/**
 * Alert Threshold Constants
 */
export const ALERT_THRESHOLDS = {
	/** Minimum hours between alert notifications (throttling) */
	MIN_HOURS_BETWEEN_ALERTS: 1,
} as const;

/**
 * Retry Configuration Constants
 */
export const RETRY_CONFIG = {
	/** Default maximum retry attempts */
	MAX_RETRIES: 3,

	/** Base delay for exponential backoff in milliseconds */
	BASE_DELAY_MS: 1000,
} as const;
