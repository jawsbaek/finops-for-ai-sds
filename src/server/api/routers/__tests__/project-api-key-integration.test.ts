/**
 * Integration Tests for API Key Management
 *
 * Tests the integration between validation, encryption, and storage logic
 * used by the generateApiKey mutation, without requiring full tRPC setup.
 *
 * Coverage:
 * - API key format validation (sk-admin-, sk-proj-, legacy formats)
 * - Encryption flow
 * - last4 extraction
 * - Error scenarios
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { extractLast4 } from "~/lib/api-key-utils";
import {
	encryptApiKey,
	setKMSServiceForTesting,
	validateApiKey,
} from "~/lib/services/encryption/api-key-manager";
import type { KMSEnvelopeEncryption } from "~/lib/services/encryption/kms-envelope";

describe("API Key Management Integration", () => {
	describe("API Key Format Validation", () => {
		it("should accept sk-admin- prefixed service account keys", () => {
			const mockApiKey = `sk-admin-${"a".repeat(40)}`;
			const isValid = validateApiKey(mockApiKey, "openai");
			expect(isValid).toBe(true);
		});

		it("should accept sk-proj- prefixed project keys", () => {
			const mockApiKey = `sk-proj-${"a".repeat(130)}`;
			const isValid = validateApiKey(mockApiKey, "openai");
			expect(isValid).toBe(true);
		});

		it("should accept legacy sk- format keys", () => {
			const mockApiKey = `sk-${"a".repeat(48)}`;
			const isValid = validateApiKey(mockApiKey, "openai");
			expect(isValid).toBe(true);
		});

		it("should reject invalid format keys", () => {
			const mockApiKey = "invalid-key-format";
			const isValid = validateApiKey(mockApiKey, "openai");
			expect(isValid).toBe(false);
		});

		it("should reject keys exceeding 256 characters", () => {
			const tooLongKey = `sk-${"a".repeat(257)}`;
			const isValid = validateApiKey(tooLongKey, "openai");
			expect(isValid).toBe(false);
		});

		it("should reject keys that are too short", () => {
			const tooShortKey = "sk-abc";
			const isValid = validateApiKey(tooShortKey, "openai");
			expect(isValid).toBe(false);
		});
	});

	describe("Encryption and Storage Integration", () => {
		let mockKMSService: Partial<KMSEnvelopeEncryption>;

		beforeEach(() => {
			// Create a mock KMS service
			mockKMSService = {
				encrypt: vi.fn().mockResolvedValue({
					ciphertext: "encrypted-data",
					encryptedDataKey: "encrypted-key",
					iv: "initialization-vector",
				}),
				decrypt: vi.fn().mockResolvedValue("decrypted-api-key"),
			};
			setKMSServiceForTesting(mockKMSService as KMSEnvelopeEncryption);
		});

		afterEach(() => {
			setKMSServiceForTesting(null);
		});

		it("should encrypt API key using KMS", async () => {
			const mockApiKey = "sk-test-key-12345678901234567890";

			const encrypted = await encryptApiKey(mockApiKey);

			expect(mockKMSService.encrypt).toHaveBeenCalledWith(mockApiKey);
			expect(encrypted).toEqual({
				ciphertext: "encrypted-data",
				encryptedDataKey: "encrypted-key",
				iv: "initialization-vector",
			});
		});

		it("should extract last4 characters correctly", () => {
			const mockApiKey = "sk-test-key-abcd";
			const last4 = extractLast4(mockApiKey);
			expect(last4).toBe("abcd");
		});

		it("should handle last4 extraction for long keys", () => {
			const longKey = `sk-proj-${"x".repeat(130)}abcd`;
			const last4 = extractLast4(longKey);
			expect(last4).toBe("abcd");
		});

		it("should handle last4 extraction for short keys", () => {
			const shortKey = "abcd";
			const last4 = extractLast4(shortKey);
			expect(last4).toBe("abcd");
		});
	});

	describe("Full API Key Registration Flow", () => {
		let mockKMSService: Partial<KMSEnvelopeEncryption>;

		beforeEach(() => {
			mockKMSService = {
				encrypt: vi.fn().mockResolvedValue({
					ciphertext: "encrypted-data",
					encryptedDataKey: "encrypted-key",
					iv: "initialization-vector",
				}),
			};
			setKMSServiceForTesting(mockKMSService as KMSEnvelopeEncryption);
		});

		afterEach(() => {
			setKMSServiceForTesting(null);
		});

		it("should validate, encrypt, and prepare API key for storage", async () => {
			const mockApiKey = "sk-proj-test123456789012345678901234567890abcd";

			// Step 1: Validate
			const isValid = validateApiKey(mockApiKey, "openai");
			expect(isValid).toBe(true);

			// Step 2: Extract last4
			const last4 = extractLast4(mockApiKey);
			expect(last4).toBe("abcd");

			// Step 3: Encrypt
			const encrypted = await encryptApiKey(mockApiKey);
			expect(encrypted.ciphertext).toBe("encrypted-data");
			expect(encrypted.encryptedDataKey).toBe("encrypted-key");
			expect(encrypted.iv).toBe("initialization-vector");

			// This simulates what the mutation would store in the database
			const apiKeyRecord = {
				projectId: "project-1",
				provider: "openai" as const,
				encryptedKey: encrypted.ciphertext,
				encryptedDataKey: encrypted.encryptedDataKey,
				iv: encrypted.iv,
				last4,
				isActive: true,
			};

			expect(apiKeyRecord.last4).toBe("abcd");
			expect(apiKeyRecord.encryptedKey).toBe("encrypted-data");
		});

		it("should reject invalid keys before encryption", async () => {
			const invalidApiKey = "not-a-valid-key";

			// Step 1: Validate (should fail)
			const isValid = validateApiKey(invalidApiKey, "openai");
			expect(isValid).toBe(false);

			// In the actual mutation, we would throw TRPCError here
			// and never reach encryption
		});

		it("should handle all OpenAI key formats in the flow", async () => {
			const keyFormats = [
				{
					name: "legacy",
					key: `sk-${"a".repeat(48)}`,
				},
				{
					name: "project",
					key: `sk-proj-${"b".repeat(130)}test`,
				},
				{
					name: "service account",
					key: `sk-admin-${"c".repeat(40)}1234`,
				},
			];

			for (const format of keyFormats) {
				// Validate
				const isValid = validateApiKey(format.key, "openai");
				expect(isValid).toBe(true);

				// Extract last4
				const last4 = extractLast4(format.key);
				expect(last4).toHaveLength(4);

				// Encrypt
				const encrypted = await encryptApiKey(format.key);
				expect(encrypted.ciphertext).toBeDefined();
				expect(encrypted.encryptedDataKey).toBeDefined();
				expect(encrypted.iv).toBeDefined();
			}
		});
	});
});
