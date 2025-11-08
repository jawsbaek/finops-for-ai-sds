/**
 * Cap.js CAPTCHA Server Integration
 *
 * Provides server-side validation for Cap.js proof-of-work CAPTCHA tokens.
 * Integrates with tRPC middleware to protect sensitive endpoints.
 */

import Cap from "@cap.js/server";
import { env } from "~/env";
import { logger } from "~/lib/logger";
import { cleanupExpiredTokens, databaseStorage } from "./captcha-storage";

/**
 * Cap instance singleton
 * Uses PostgreSQL database for storing challenges and tokens (serverless-compatible)
 */
let capInstance: Cap | null = null;

function getCapInstance(): Cap {
	if (!capInstance) {
		// SECURITY: Runtime validation for production environment
		// Build-time validation in env.js caused false positives during `next build`
		// so we validate at runtime when the Cap instance is actually used
		if (process.env.NODE_ENV === "production" && env.CAP_BYPASS) {
			throw new Error(
				"SECURITY ERROR: CAP_BYPASS must be false in production environment",
			);
		}

		capInstance = new Cap({
			// ✅ SERVERLESS-COMPATIBLE: Database storage for Vercel/AWS Lambda/etc.
			//
			// Uses PostgreSQL via Prisma to store CAPTCHA challenges and solutions.
			// This ensures tokens persist across serverless function invocations.
			//
			// The databaseStorage implementation provides:
			// - set(token, data, expiresMs): Store challenge or solution
			// - get(token): Retrieve and validate token
			// - delete(token): Remove used/invalid token
			// - cleanup(): Remove expired tokens (called by cron)
			//
			// See: src/server/api/captcha-storage.ts for implementation details
			storage: databaseStorage,
		});
	}
	return capInstance;
}

/**
 * Verify CAPTCHA token from client
 *
 * @param token - Token string from client-side Cap widget
 * @returns true if token is valid, false otherwise
 *
 * @example
 * const isValid = await verifyCaptchaToken("client-generated-token");
 * if (!isValid) {
 *   throw new Error("CAPTCHA verification failed");
 * }
 */
export async function verifyCaptchaToken(token: string): Promise<boolean> {
	// Test bypass (only enabled in test environment)
	if (env.CAP_BYPASS) {
		logger.warn("CAPTCHA bypassed (test mode enabled)");
		return true;
	}

	// Validate token format
	if (!token || typeof token !== "string" || token.length === 0) {
		logger.warn(
			{
				tokenType: typeof token,
				tokenPrefix:
					typeof token === "string" && token.length > 0
						? token.slice(0, 10)
						: "invalid",
			},
			"Invalid CAPTCHA token format",
		);
		return false;
	}

	try {
		const cap = getCapInstance();

		// Validate token and consume it (keepToken: false prevents replay)
		const result = await cap.validateToken(token, { keepToken: false });

		if (!result.success) {
			logger.warn(
				{ token: token.slice(0, 10) },
				"CAPTCHA token validation failed",
			);
			return false;
		}

		logger.info(
			{ token: token.slice(0, 10) },
			"CAPTCHA token validated successfully",
		);
		return true;
	} catch (error) {
		logger.error(
			{
				error: error instanceof Error ? error.message : String(error),
				token: token.slice(0, 10),
			},
			"CAPTCHA verification error",
		);
		return false;
	}
}

/**
 * Create a new CAPTCHA challenge
 * Used for custom challenge creation (optional)
 *
 * @returns Challenge object with token
 */
export async function createCaptchaChallenge() {
	const cap = getCapInstance();

	const challenge = await cap.createChallenge({
		challengeCount: 50, // Number of hashes to solve
		challengeSize: 32, // Bytes per challenge
		// Convert CAP_DIFFICULTY (iterations) to Cap.js difficulty level
		//
		// Cap.js uses a "difficulty level" that gets multiplied by 2000 internally
		// to determine the actual number of SHA-256 hash iterations required.
		//
		// Formula: difficulty = iterations / 2000
		// Reverse: iterations = difficulty × 2000
		//
		// Example conversions:
		// - 100,000 iterations → difficulty level 50
		// - 200,000 iterations → difficulty level 100
		// - 50,000 iterations → difficulty level 25
		//
		// The division by 2000 converts our env variable (total iterations)
		// into Cap.js's internal difficulty representation.
		challengeDifficulty: Math.floor(env.CAP_DIFFICULTY / 2000),
		expiresMs: 600000, // 10 minutes
	});

	return challenge;
}

/**
 * Redeem a challenge with solutions
 * Used for custom challenge flow (optional)
 */
export async function redeemCaptchaChallenge(
	token: string,
	solutions: number[] | number[][],
) {
	const cap = getCapInstance();

	const result = await cap.redeemChallenge({
		token,
		solutions: solutions as number[], // Cap.js expects number[]
	});

	return result;
}

/**
 * Cleanup expired challenges and tokens
 *
 * IMPORTANT: This function should be called periodically via a cron job or scheduled task
 * to prevent the database from accumulating stale CAPTCHA tokens.
 *
 * Recommended schedule: Every 1 hour
 *
 * Implementation:
 * - Deletes all CaptchaToken records where expiresAt < now()
 * - Uses database index on expiresAt for efficient cleanup
 * - Logs number of tokens removed
 *
 * API endpoint: POST /api/cron/captcha-cleanup
 * Vercel Cron: Configure in vercel.json or Vercel Dashboard
 *
 * Without periodic cleanup, expired tokens will accumulate in the database,
 * potentially degrading query performance over time.
 */
export async function cleanupExpiredCaptchaTokens() {
	// Use the cleanup function which deletes all expired tokens from the database
	await cleanupExpiredTokens();
}
