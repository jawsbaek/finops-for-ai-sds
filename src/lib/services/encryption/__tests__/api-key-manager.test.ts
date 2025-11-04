/**
 * Unit tests for API Key Manager Service
 *
 * Tests validation and encryption/decryption of API keys
 */

import { describe, expect, it } from "vitest";
import { validateApiKey } from "../api-key-manager";

describe("API Key Manager - validateApiKey", () => {
	describe("OpenAI API Keys", () => {
		describe("Legacy format (sk-{48 chars})", () => {
			it("should accept legacy sk- format with 48 alphanumeric characters", () => {
				const apiKey = "sk-abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGH";
				expect(validateApiKey(apiKey, "openai")).toBe(true);
			});

			it("should accept legacy sk- format with exactly 48 characters", () => {
				const apiKey = "sk-123456789012345678901234567890123456789012345678";
				expect(validateApiKey(apiKey, "openai")).toBe(true);
			});
		});

		describe("Project format (sk-proj-{chars})", () => {
			it("should accept sk-proj- format with sufficient characters", () => {
				const apiKey =
					"sk-proj-abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
				expect(validateApiKey(apiKey, "openai")).toBe(true);
			});

			it("should accept sk-proj- format with 130+ characters (new format)", () => {
				const longKey = `sk-proj-${"a".repeat(130)}1234567890abcdefghijklmnopqrstuvwxyz`;
				expect(validateApiKey(longKey, "openai")).toBe(true);
			});
		});

		describe("Service account format (sk-admin-{chars})", () => {
			it("should accept sk-admin- format (service account keys)", () => {
				const apiKey =
					"sk-admin-abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
				expect(validateApiKey(apiKey, "openai")).toBe(true);
			});

			it("should accept sk-admin- with mixed alphanumeric", () => {
				const apiKey = "sk-admin-1234567890abcdefABCDEF";
				expect(validateApiKey(apiKey, "openai")).toBe(true);
			});
		});

		describe("Edge cases and variations", () => {
			it("should accept keys with underscores after sk- prefix", () => {
				const apiKey =
					"sk-test_abc123def456ghi789jkl012mno345pqr678stu901vwx234yz";
				expect(validateApiKey(apiKey, "openai")).toBe(true);
			});

			it("should accept minimum length keys (20 chars after sk-)", () => {
				const apiKey = "sk-abcdefghijklmnopqrst";
				expect(validateApiKey(apiKey, "openai")).toBe(true);
			});
		});

		describe("Invalid formats", () => {
			it("should reject empty strings", () => {
				expect(validateApiKey("", "openai")).toBe(false);
			});

			it("should reject keys not starting with sk-", () => {
				expect(validateApiKey("api-key-12345678901234567890", "openai")).toBe(
					false,
				);
			});

			it("should reject keys with only sk- prefix", () => {
				expect(validateApiKey("sk-", "openai")).toBe(false);
			});

			it("should reject keys with fewer than 20 characters after sk-", () => {
				expect(validateApiKey("sk-short", "openai")).toBe(false);
			});

			it("should reject keys with whitespace", () => {
				expect(validateApiKey("sk-abc def123456789012345678", "openai")).toBe(
					false,
				);
			});

			it("should reject keys with special characters (other than - and _)", () => {
				expect(validateApiKey("sk-abc@def#123456789012345678", "openai")).toBe(
					false,
				);
			});

			it("should reject keys exceeding maximum length (256 chars)", () => {
				// Create a key with 257 chars after "sk-"
				const tooLongKey = `sk-${"a".repeat(257)}`;
				expect(validateApiKey(tooLongKey, "openai")).toBe(false);
			});

			it("should accept keys at exactly maximum length (256 chars)", () => {
				// Create a key with exactly 256 chars after "sk-"
				const maxLengthKey = `sk-${"a".repeat(256)}`;
				expect(validateApiKey(maxLengthKey, "openai")).toBe(true);
			});

			it("should reject keys composed entirely of underscores", () => {
				const underscoreKey = `sk-${"_".repeat(20)}`;
				expect(validateApiKey(underscoreKey, "openai")).toBe(false);
			});

			it("should reject keys composed entirely of hyphens", () => {
				const hyphenKey = `sk-${"-".repeat(20)}`;
				expect(validateApiKey(hyphenKey, "openai")).toBe(false);
			});

			it("should reject keys with only underscores and hyphens", () => {
				const mixedKey = `sk-${"_-".repeat(10)}`;
				expect(validateApiKey(mixedKey, "openai")).toBe(false);
			});

			it("should accept keys with at least one alphanumeric character", () => {
				const validKey = `sk-${"_".repeat(10)}a${"_".repeat(9)}`;
				expect(validateApiKey(validKey, "openai")).toBe(true);
			});
		});
	});

	describe("AWS API Keys", () => {
		it("should accept valid AKIA format", () => {
			const apiKey = "AKIAIOSFODNN7EXAMPLE";
			expect(validateApiKey(apiKey, "aws")).toBe(true);
		});

		it("should reject invalid AWS format", () => {
			expect(validateApiKey("sk-1234567890", "aws")).toBe(false);
		});
	});

	describe("Azure API Keys", () => {
		it("should accept valid 32 hex character format", () => {
			const apiKey = "0123456789abcdef0123456789abcdef";
			expect(validateApiKey(apiKey, "azure")).toBe(true);
		});

		it("should reject invalid Azure format", () => {
			expect(validateApiKey("sk-1234567890", "azure")).toBe(false);
		});
	});
});
