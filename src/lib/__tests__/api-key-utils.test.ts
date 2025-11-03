/**
 * Unit tests for API Key Utilities
 *
 * Tests extraction of last 4 characters from API keys for display purposes
 */

import { describe, expect, it } from "vitest";
import { extractLast4 } from "../api-key-utils";

describe("API Key Utilities", () => {
	describe("extractLast4", () => {
		it("should extract last 4 characters from a valid API key", () => {
			const apiKey = "sk-1234567890abcdefghijklmnopqrstuvwxyz";
			const result = extractLast4(apiKey);

			expect(result).toBe("wxyz");
			expect(result).toHaveLength(4);
		});

		it("should handle OpenAI API key format", () => {
			const apiKey = "sk-proj-abcdefghijklmnopqrstuvwxyz1234567890";
			const result = extractLast4(apiKey);

			expect(result).toBe("7890");
		});

		it("should extract last 4 from short keys", () => {
			const apiKey = "abc123";
			const result = extractLast4(apiKey);

			expect(result).toBe("c123");
		});

		it("should handle exactly 4 character keys", () => {
			const apiKey = "abcd";
			const result = extractLast4(apiKey);

			expect(result).toBe("abcd");
		});

		it("should handle keys shorter than 4 characters", () => {
			const apiKey = "ab";
			const result = extractLast4(apiKey);

			expect(result).toBe("ab");
		});

		it("should handle empty strings", () => {
			const result = extractLast4("");

			expect(result).toBe("");
		});

		it("should handle single character", () => {
			const result = extractLast4("a");

			expect(result).toBe("a");
		});

		it("should preserve case", () => {
			const apiKey = "sk-ABCD1234";
			const result = extractLast4(apiKey);

			expect(result).toBe("1234");
		});

		it("should handle keys with special characters", () => {
			const apiKey = "key-with-dashes-ABC123";
			const result = extractLast4(apiKey);

			expect(result).toBe("C123");
		});

		it("should handle numeric-only keys", () => {
			const apiKey = "1234567890";
			const result = extractLast4(apiKey);

			expect(result).toBe("7890");
		});
	});
});
