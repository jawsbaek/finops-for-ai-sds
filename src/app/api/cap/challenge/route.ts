/**
 * Cap.js Challenge API Endpoint
 *
 * Creates a new proof-of-work challenge for clients to solve.
 * This endpoint is called by the Cap.js widget to initiate CAPTCHA verification.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { logger } from "~/lib/logger";
import { createCaptchaChallenge } from "~/server/api/captcha";
import { rateLimits } from "~/server/api/ratelimit";

export async function POST(request: NextRequest) {
	// Rate limiting: 100 requests/min per IP
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success, limit, remaining, reset } =
		await rateLimits.normal.limit(ip);

	// Add rate limit headers for better client experience
	const headers = new Headers({
		"X-RateLimit-Limit": limit.toString(),
		"X-RateLimit-Remaining": remaining.toString(),
		"X-RateLimit-Reset": new Date(reset).toISOString(),
	});

	if (!success) {
		// Add Retry-After header when rate limited
		const retryAfter = Math.ceil((reset - Date.now()) / 1000);
		headers.set("Retry-After", retryAfter.toString());

		logger.warn({ ip }, "Rate limit exceeded for CAPTCHA challenge");
		return NextResponse.json(
			{ error: "Rate limit exceeded. Please try again later." },
			{ status: 429, headers },
		);
	}
	try {
		const challenge = await createCaptchaChallenge();

		logger.info(
			{
				tokenPrefix: challenge.token?.slice(0, 10) ?? "no-token",
			},
			"CAPTCHA challenge created",
		);

		return NextResponse.json(challenge, { headers });
	} catch (error) {
		logger.error(
			{
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
			},
			"Failed to create CAPTCHA challenge",
		);

		return NextResponse.json(
			{
				error: "Failed to create challenge",
				message: error instanceof Error ? error.message : String(error),
			},
			{ status: 500, headers },
		);
	}
}
