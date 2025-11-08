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
	const { success } = await rateLimits.normal.limit(ip);

	if (!success) {
		logger.warn({ ip }, "Rate limit exceeded for CAPTCHA challenge");
		return NextResponse.json(
			{ error: "Rate limit exceeded. Please try again later." },
			{ status: 429 },
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

		return NextResponse.json(challenge);
	} catch (error) {
		logger.error(
			{
				error: error instanceof Error ? error.message : String(error),
			},
			"Failed to create CAPTCHA challenge",
		);

		return NextResponse.json(
			{ error: "Failed to create challenge" },
			{ status: 500 },
		);
	}
}
