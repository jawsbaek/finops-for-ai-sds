/**
 * Database-backed CAPTCHA Token Storage
 *
 * Implements Cap.js custom storage interface using PostgreSQL via Prisma.
 * This replaces file-based .cap-tokens storage to support serverless deployments
 * (Vercel, AWS Lambda, Google Cloud Functions, etc.)
 *
 * @see https://cap.js.org/docs/server#custom-storage
 */

import type {
	ChallengeData,
	ChallengeStorage,
	StorageHooks,
	TokenStorage,
} from "@cap.js/server";
import { logger } from "~/lib/logger";
import { db } from "~/server/db";

/**
 * Challenge storage implementation
 *
 * Stores CAPTCHA challenge data in PostgreSQL with 10-minute expiration
 */
const challengeStorage: ChallengeStorage = {
	/**
	 * Store challenge data
	 */
	async store(token: string, data: ChallengeData): Promise<void> {
		try {
			const expiresAt = new Date(Date.now() + 600000); // 10 minutes

			await db.captchaToken.upsert({
				where: { token },
				create: {
					token,
					type: "challenge",
					data: data as object,
					expiresAt,
				},
				update: {
					data: data as object,
					expiresAt,
				},
			});

			logger.debug(
				{
					tokenPrefix: token.slice(0, 10),
					expiresAt: expiresAt.toISOString(),
				},
				"Challenge stored in database",
			);
		} catch (error) {
			logger.error(
				{
					error: error instanceof Error ? error.message : String(error),
					tokenPrefix: token.slice(0, 10),
				},
				"Failed to store challenge in database",
			);
			throw new Error("Failed to store challenge");
		}
	},

	/**
	 * Retrieve challenge data
	 */
	async read(token: string): Promise<ChallengeData | null> {
		try {
			// SECURITY: Atomic expiration check to prevent TOCTOU race condition
			// Query only returns non-expired records, eliminating time-gap between check and use
			const record = await db.captchaToken.findFirst({
				where: {
					token,
					type: "challenge",
					expiresAt: { gte: new Date() }, // Only return non-expired
				},
			});

			if (!record) {
				return null;
			}

			return record.data as ChallengeData;
		} catch (error) {
			logger.error(
				{
					error: error instanceof Error ? error.message : String(error),
					tokenPrefix: token.slice(0, 10),
				},
				"Failed to read challenge from database",
			);
			return null;
		}
	},

	/**
	 * Delete challenge data
	 *
	 * Note: Prisma P2025 (record not found) errors are silently ignored because:
	 * - delete() is idempotent - calling it multiple times should not fail
	 * - A missing record achieves the desired state (record doesn't exist)
	 * - This prevents race conditions when multiple processes try to delete the same token
	 */
	async delete(token: string): Promise<void> {
		try {
			await db.captchaToken.delete({ where: { token } });
		} catch (error) {
			// Ignore P2025 (record not found) - deletion is idempotent
			if (
				!(
					error &&
					typeof error === "object" &&
					"code" in error &&
					error.code === "P2025"
				)
			) {
				logger.error(
					{
						error: error instanceof Error ? error.message : String(error),
						tokenPrefix: token.slice(0, 10),
					},
					"Failed to delete challenge from database",
				);
			}
		}
	},

	/**
	 * Delete expired challenges
	 *
	 * Note: deleteMany() never throws P2025 (record not found) errors.
	 * It returns { count: 0 } when no records match, which is a valid success state.
	 */
	async deleteExpired(): Promise<void> {
		try {
			const result = await db.captchaToken.deleteMany({
				where: {
					type: "challenge",
					expiresAt: { lt: new Date() },
				},
			});

			logger.info({ deletedCount: result.count }, "Expired challenges deleted");
		} catch (error) {
			logger.error(
				{
					error: error instanceof Error ? error.message : String(error),
				},
				"Failed to delete expired challenges",
			);
		}
	},
};

/**
 * Token storage implementation
 *
 * Stores CAPTCHA solution tokens with their expiration timestamps
 */
const tokenStorage: TokenStorage = {
	/**
	 * Store token with expiration timestamp (Unix ms)
	 */
	async store(token: string, expiresAt: number): Promise<void> {
		try {
			await db.captchaToken.upsert({
				where: { token },
				create: {
					token,
					type: "solution",
					data: { expiresAt },
					expiresAt: new Date(expiresAt),
				},
				update: {
					data: { expiresAt },
					expiresAt: new Date(expiresAt),
				},
			});

			logger.debug(
				{
					tokenPrefix: token.slice(0, 10),
					expiresAt: new Date(expiresAt).toISOString(),
				},
				"Solution token stored in database",
			);
		} catch (error) {
			logger.error(
				{
					error: error instanceof Error ? error.message : String(error),
					tokenPrefix: token.slice(0, 10),
				},
				"Failed to store solution token in database",
			);
			throw new Error("Failed to store solution token");
		}
	},

	/**
	 * Get token expiration timestamp (Unix ms)
	 */
	async get(token: string): Promise<number | null> {
		try {
			const record = await db.captchaToken.findUnique({
				where: { token },
			});

			if (!record || record.type !== "solution") {
				return null;
			}

			// Return expiration timestamp in Unix milliseconds
			const data = record.data as { expiresAt?: number };
			return data.expiresAt ?? null;
		} catch (error) {
			logger.error(
				{
					error: error instanceof Error ? error.message : String(error),
					tokenPrefix: token.slice(0, 10),
				},
				"Failed to get solution token from database",
			);
			return null;
		}
	},

	/**
	 * Delete solution token
	 *
	 * Note: Prisma P2025 (record not found) errors are silently ignored because:
	 * - delete() is idempotent - calling it multiple times should not fail
	 * - A missing record achieves the desired state (record doesn't exist)
	 * - This prevents race conditions when multiple processes try to delete the same token
	 */
	async delete(token: string): Promise<void> {
		try {
			await db.captchaToken.delete({ where: { token } });
		} catch (error) {
			// Ignore P2025 (record not found) - deletion is idempotent
			if (
				!(
					error &&
					typeof error === "object" &&
					"code" in error &&
					error.code === "P2025"
				)
			) {
				logger.error(
					{
						error: error instanceof Error ? error.message : String(error),
						tokenPrefix: token.slice(0, 10),
					},
					"Failed to delete solution token from database",
				);
			}
		}
	},

	/**
	 * Delete expired solution tokens
	 *
	 * Note: deleteMany() never throws P2025 (record not found) errors.
	 * It returns { count: 0 } when no records match, which is a valid success state.
	 */
	async deleteExpired(): Promise<void> {
		try {
			const result = await db.captchaToken.deleteMany({
				where: {
					type: "solution",
					expiresAt: { lt: new Date() },
				},
			});

			logger.info(
				{ deletedCount: result.count },
				"Expired solution tokens deleted",
			);
		} catch (error) {
			logger.error(
				{
					error: error instanceof Error ? error.message : String(error),
				},
				"Failed to delete expired solution tokens",
			);
		}
	},
};

/**
 * Combined storage hooks for Cap.js
 */
export const databaseStorage: StorageHooks = {
	challenges: challengeStorage,
	tokens: tokenStorage,
};

/**
 * Cleanup function for cron job
 * Deletes all expired CAPTCHA tokens (challenges + solutions)
 */
export async function cleanupExpiredTokens(): Promise<void> {
	try {
		const result = await db.captchaToken.deleteMany({
			where: {
				expiresAt: { lt: new Date() },
			},
		});

		logger.info(
			{ deletedCount: result.count },
			"CAPTCHA token cleanup completed",
		);
	} catch (error) {
		logger.error(
			{
				error: error instanceof Error ? error.message : String(error),
			},
			"Failed to cleanup expired CAPTCHA tokens",
		);
		throw new Error("Failed to cleanup expired CAPTCHA tokens");
	}
}
