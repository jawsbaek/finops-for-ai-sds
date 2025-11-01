/**
 * AWS KMS Envelope Encryption Service
 *
 * Implements envelope encryption pattern using AWS KMS:
 * 1. KMS generates and encrypts a data key
 * 2. Data key encrypts the actual sensitive data (API keys)
 * 3. Store encrypted data key + encrypted data + IV
 *
 * Security: FIPS 140-3 Level 3 HSM, automatic key rotation, CloudTrail audit
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import {
	DecryptCommand,
	type DecryptCommandInput,
	GenerateDataKeyCommand,
	type GenerateDataKeyCommandInput,
	KMSClient,
} from "@aws-sdk/client-kms";
import { env } from "~/env";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * KMS Envelope Encryption Service
 * Uses AWS KMS for key management and AES-256-GCM for data encryption
 */
export class KMSEnvelopeEncryption {
	private kmsClient: KMSClient;
	private readonly keyId: string;

	constructor(keyId?: string) {
		// Initialize KMS client
		this.kmsClient = new KMSClient({
			region: env.AWS_REGION ?? "us-east-1",
			credentials: {
				accessKeyId: env.AWS_ACCESS_KEY_ID ?? "",
				secretAccessKey: env.AWS_SECRET_ACCESS_KEY ?? "",
			},
		});

		// Use provided key ID or fall back to environment variable
		this.keyId = keyId ?? env.AWS_KMS_KEY_ID ?? "";

		if (!this.keyId) {
			throw new Error(
				"AWS KMS Key ID is required. Set AWS_KMS_KEY_ID environment variable.",
			);
		}
	}

	/**
	 * Encrypt plaintext using envelope encryption
	 *
	 * @param plaintext - The sensitive data to encrypt (e.g., API key)
	 * @returns Object containing encrypted data, encrypted data key, and IV
	 */
	async encrypt(plaintext: string): Promise<{
		ciphertext: string;
		encryptedDataKey: string;
		iv: string;
	}> {
		try {
			// Step 1: Generate a data key from KMS
			const generateKeyInput: GenerateDataKeyCommandInput = {
				KeyId: this.keyId,
				KeySpec: "AES_256",
			};

			const { Plaintext: dataKey, CiphertextBlob: encryptedDataKey } =
				await this.kmsClient.send(new GenerateDataKeyCommand(generateKeyInput));

			if (!dataKey || !encryptedDataKey) {
				throw new Error("KMS failed to generate data key");
			}

			// Step 2: Generate random IV (Initialization Vector)
			const iv = randomBytes(IV_LENGTH);

			// Step 3: Encrypt the plaintext with the data key using AES-256-GCM
			const cipher = createCipheriv(ALGORITHM, Buffer.from(dataKey), iv);

			let encrypted = cipher.update(plaintext, "utf8", "hex");
			encrypted += cipher.final("hex");

			// Get authentication tag for GCM mode
			const authTag = cipher.getAuthTag();

			// Combine encrypted data + auth tag
			const ciphertext = encrypted + authTag.toString("hex");

			// Step 4: Return encrypted data, encrypted data key, and IV
			return {
				ciphertext,
				encryptedDataKey: Buffer.from(encryptedDataKey).toString("base64"),
				iv: iv.toString("hex"),
			};
		} catch (error) {
			throw new Error(
				`KMS encryption failed: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	/**
	 * Decrypt ciphertext using envelope encryption
	 *
	 * @param ciphertext - The encrypted data
	 * @param encryptedDataKey - The KMS-encrypted data key
	 * @param iv - The initialization vector used during encryption
	 * @returns Decrypted plaintext
	 */
	async decrypt(
		ciphertext: string,
		encryptedDataKey: string,
		iv: string,
	): Promise<string> {
		try {
			// Step 1: Decrypt the data key using KMS
			const decryptInput: DecryptCommandInput = {
				CiphertextBlob: Buffer.from(encryptedDataKey, "base64"),
				KeyId: this.keyId,
			};

			const { Plaintext: dataKey } = await this.kmsClient.send(
				new DecryptCommand(decryptInput),
			);

			if (!dataKey) {
				throw new Error("KMS failed to decrypt data key");
			}

			// Step 2: Extract auth tag from ciphertext (last 32 hex chars = 16 bytes)
			const authTag = Buffer.from(
				ciphertext.slice(-AUTH_TAG_LENGTH * 2),
				"hex",
			);
			const encrypted = ciphertext.slice(0, -AUTH_TAG_LENGTH * 2);

			// Step 3: Decrypt the data using the decrypted data key
			const decipher = createDecipheriv(
				ALGORITHM,
				Buffer.from(dataKey),
				Buffer.from(iv, "hex"),
			);
			decipher.setAuthTag(authTag);

			let decrypted = decipher.update(encrypted, "hex", "utf8");
			decrypted += decipher.final("utf8");

			return decrypted;
		} catch (error) {
			throw new Error(
				`KMS decryption failed: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}
}

/**
 * Singleton instance for KMS encryption service
 * Lazy-loaded to avoid initialization during build time
 */
let kmsEncryptionInstance: KMSEnvelopeEncryption | null = null;

export function getKMSEncryption(): KMSEnvelopeEncryption {
	if (!kmsEncryptionInstance) {
		kmsEncryptionInstance = new KMSEnvelopeEncryption();
	}
	return kmsEncryptionInstance;
}
