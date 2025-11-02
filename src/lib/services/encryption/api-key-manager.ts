/**
 * API Key Manager Service
 *
 * Provides API key encryption, decryption, and validation
 * Wraps KMS Envelope Encryption for secure API key storage
 */

import { KMSEnvelopeEncryption } from "./kms-envelope";

// Singleton instance of KMS encryption service
let kmsService: KMSEnvelopeEncryption | null = null;

/**
 * Get or create KMS encryption service instance
 */
function getKMSService(): KMSEnvelopeEncryption {
	if (!kmsService) {
		kmsService = new KMSEnvelopeEncryption();
	}
	return kmsService;
}

/**
 * Validate API key format for a given provider
 *
 * @param apiKey - The API key to validate
 * @param provider - The provider type ('openai', 'aws', 'azure')
 * @returns true if valid, false otherwise
 */
export function validateApiKey(
	apiKey: string,
	provider: "openai" | "aws" | "azure",
): boolean {
	if (!apiKey || apiKey.trim().length === 0) {
		return false;
	}

	switch (provider) {
		case "openai":
			// OpenAI API keys: sk-proj-* or sk-* format
			// Project-scoped keys: sk-proj-[48 alphanumeric chars]
			// Legacy keys: sk-[48 alphanumeric chars]
			return /^sk-(proj-)?[a-zA-Z0-9]{20,}$/.test(apiKey);

		case "aws":
			// AWS access keys: AKIA[20 alphanumeric chars]
			return /^AKIA[A-Z0-9]{16}$/.test(apiKey);

		case "azure":
			// Azure API keys are typically 32 hex characters
			return /^[a-f0-9]{32}$/i.test(apiKey);

		default:
			return false;
	}
}

/**
 * Generate and encrypt an API key using KMS envelope encryption
 *
 * @param plainApiKey - The plain text API key to encrypt
 * @returns Encrypted key data (ciphertext, encryptedDataKey, iv)
 */
export async function generateEncryptedApiKey(plainApiKey: string): Promise<{
	ciphertext: string;
	encryptedDataKey: string;
	iv: string;
}> {
	const kms = getKMSService();
	return await kms.encrypt(plainApiKey);
}

/**
 * Decrypt an encrypted API key
 *
 * @param ciphertext - The encrypted API key
 * @param encryptedDataKey - The encrypted data key from KMS
 * @param iv - The initialization vector used for encryption
 * @returns Decrypted plain text API key
 */
export async function decryptApiKey(
	ciphertext: string,
	encryptedDataKey: string,
	iv: string,
): Promise<string> {
	const kms = getKMSService();
	return await kms.decrypt(ciphertext, encryptedDataKey, iv);
}

/**
 * Test helper: Set custom KMS service instance (for testing)
 * @internal
 */
export function setKMSServiceForTesting(
	service: KMSEnvelopeEncryption | null,
): void {
	kmsService = service;
}
