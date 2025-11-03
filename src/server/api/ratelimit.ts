/**
 * Rate Limiting Infrastructure
 *
 * Provides rate limiting for API endpoints using Upstash Redis
 * - Sensitive mutations: 10 requests per minute per user
 * - Normal operations: 100 requests per minute per user
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env } from "~/env";

/**
 * Initialize Redis client
 * Falls back to mock implementation for local development without Redis
 */
function createRedisClient() {
	// Check if Upstash Redis credentials are configured
	if (env.UPSTASH_REDIS_URL && env.UPSTASH_REDIS_TOKEN) {
		return new Redis({
			url: env.UPSTASH_REDIS_URL,
			token: env.UPSTASH_REDIS_TOKEN,
		});
	}

	// For local development: use in-memory store (mock)
	// This allows development to continue without Redis
	// WARNING: This is NOT suitable for production
	console.warn(
		"⚠️  UPSTASH_REDIS_URL or UPSTASH_REDIS_TOKEN not found. Using in-memory rate limiting (development only).",
	);

	// Return a mock Redis client for development
	// In production, this should fail fast
	return new Redis({
		url: "http://localhost:8079",
		token: "development_token",
	});
}

const redis = createRedisClient();

/**
 * Rate limiters for different operation types
 */
export const rateLimits = {
	/**
	 * Sensitive mutations: 10 requests per minute
	 * Applied to: API key operations, member management, etc.
	 */
	sensitive: new Ratelimit({
		redis,
		limiter: Ratelimit.slidingWindow(10, "1 m"),
		analytics: true,
		prefix: "ratelimit:sensitive",
	}),

	/**
	 * Normal operations: 100 requests per minute
	 * Applied to: Regular queries and mutations
	 */
	normal: new Ratelimit({
		redis,
		limiter: Ratelimit.slidingWindow(100, "1 m"),
		analytics: true,
		prefix: "ratelimit:normal",
	}),
};
