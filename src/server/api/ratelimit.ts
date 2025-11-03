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
 * In-memory rate limiter for local development
 * Uses Map to track requests per identifier
 *
 * WARNING: This is NOT production-ready:
 * - Not atomic (race conditions possible between read/write)
 * - Single-instance only (no distributed rate limiting)
 * - Memory-based (resets on server restart)
 *
 * Use Upstash Redis (rateLimits with Redis) for production.
 */
class InMemoryRateLimiter {
	private requests: Map<string, { count: number; resetAt: number }> = new Map();
	private maxRequests: number;
	private windowMs: number;
	private cleanupInterval: NodeJS.Timeout;

	constructor(maxRequests: number, windowMs: number) {
		this.maxRequests = maxRequests;
		this.windowMs = windowMs;

		// Periodic cleanup to prevent memory leaks
		// Clean up expired entries every minute
		this.cleanupInterval = setInterval(() => {
			const now = Date.now();
			for (const [key, value] of this.requests.entries()) {
				if (value.resetAt <= now) {
					this.requests.delete(key);
				}
			}
		}, 60_000);

		// Allow Node.js to exit even if interval is active
		this.cleanupInterval.unref();
	}

	async limit(identifier: string) {
		const now = Date.now();
		const record = this.requests.get(identifier);

		// Clean up expired record if exists
		if (record && record.resetAt <= now) {
			this.requests.delete(identifier);
		}

		const current = this.requests.get(identifier);

		if (!current) {
			// First request in window
			const resetAt = now + this.windowMs;
			this.requests.set(identifier, { count: 1, resetAt });
			return {
				success: true,
				limit: this.maxRequests,
				remaining: this.maxRequests - 1,
				reset: resetAt,
			};
		}

		if (current.count >= this.maxRequests) {
			// Rate limit exceeded
			return {
				success: false,
				limit: this.maxRequests,
				remaining: 0,
				reset: current.resetAt,
			};
		}

		// Increment count
		current.count++;
		return {
			success: true,
			limit: this.maxRequests,
			remaining: this.maxRequests - current.count,
			reset: current.resetAt,
		};
	}
}

/**
 * Create rate limiters based on environment configuration
 */
function createRateLimiters() {
	const redisUrl = env.UPSTASH_REDIS_URL;
	const redisToken = env.UPSTASH_REDIS_TOKEN;

	// Production: Use Upstash Redis if configured
	if (redisUrl && redisToken) {
		const redis = new Redis({ url: redisUrl, token: redisToken });
		return {
			sensitive: new Ratelimit({
				redis,
				limiter: Ratelimit.slidingWindow(10, "1 m"),
				analytics: true,
				prefix: "ratelimit:sensitive",
			}),
			normal: new Ratelimit({
				redis,
				limiter: Ratelimit.slidingWindow(100, "1 m"),
				analytics: true,
				prefix: "ratelimit:normal",
			}),
		};
	}

	// Production: Fail fast if Redis is not configured
	if (env.NODE_ENV === "production") {
		throw new Error(
			"UPSTASH_REDIS_URL and UPSTASH_REDIS_TOKEN are required in production. " +
				"In-memory rate limiting is not suitable for production use.",
		);
	}

	// Development: Use in-memory rate limiter
	console.warn(
		"⚠️  UPSTASH_REDIS_URL or UPSTASH_REDIS_TOKEN not found. Using in-memory rate limiting (development only).",
	);
	return {
		sensitive: new InMemoryRateLimiter(10, 60 * 1000),
		normal: new InMemoryRateLimiter(100, 60 * 1000),
	};
}

/**
 * Rate limiters for different operation types
 */
export const rateLimits = createRateLimiters();
