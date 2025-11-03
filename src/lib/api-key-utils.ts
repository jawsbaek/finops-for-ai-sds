/**
 * API Key Utilities
 *
 * Helper functions for API key management and display
 */

/**
 * Extract the last 4 characters from an API key for display purposes
 *
 * @param apiKey - The full API key
 * @returns The last 4 characters, or the full key if shorter than 4 characters
 *
 * @example
 * ```ts
 * extractLast4('sk-1234567890abcd')
 * // Returns: 'abcd'
 *
 * extractLast4('ab')
 * // Returns: 'ab'
 * ```
 */
export function extractLast4(apiKey: string): string {
	if (apiKey.length <= 4) {
		return apiKey;
	}
	return apiKey.slice(-4);
}
