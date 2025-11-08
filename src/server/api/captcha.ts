/**
 * Cap.js CAPTCHA Server Integration
 *
 * Provides server-side validation for Cap.js proof-of-work CAPTCHA tokens.
 * Integrates with tRPC middleware to protect sensitive endpoints.
 */

import Cap from "@cap.js/server";
import { env } from "~/env";
import { logger } from "~/lib/logger";

/**
 * Cap instance singleton
 * Uses file system state for storing challenges and tokens
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
			// Use file system state (default)
			// Alternative: Implement custom storage with database hooks
			tokens_store_path: "./.cap-tokens",
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
		logger.warn({ token }, "Invalid CAPTCHA token format");
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
		// Formula: difficulty = iterations / 2000
		// Example: 100000 iterations → difficulty level 50
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
 * Should be called periodically (e.g., via cron)
 */
export async function cleanupExpiredCaptchaTokens() {
	const cap = getCapInstance();
	await cap.cleanup();
	logger.info("CAPTCHA tokens cleanup completed");
}
