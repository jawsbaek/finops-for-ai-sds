/**
 * Cap.js Redeem API Endpoint
 *
 * Validates proof-of-work solutions from clients and issues tokens.
 * This endpoint is called by the Cap.js widget after solving the challenge.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { logger } from "~/lib/logger";
import { redeemCaptchaChallenge } from "~/server/api/captcha";
import { rateLimits } from "~/server/api/ratelimit";

export async function POST(request: NextRequest) {
	// Rate limiting: 100 requests/min per IP
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = await rateLimits.normal.limit(ip);

	if (!success) {
		logger.warn({ ip }, "Rate limit exceeded for CAPTCHA redeem");
		return NextResponse.json(
			{ success: false, error: "Rate limit exceeded. Please try again later." },
			{ status: 429 },
		);
	}
	try {
		const body = (await request.json()) as {
			token: string;
			solutions: number[][];
		};

		const { token, solutions } = body;

		if (!token || !solutions) {
			return NextResponse.json(
				{ success: false, error: "Missing token or solutions" },
				{ status: 400 },
			);
		}

		const result = await redeemCaptchaChallenge(token, solutions);

		if (!result.success) {
			logger.warn(
				{
					tokenPrefix: token.slice(0, 10),
				},
				"CAPTCHA challenge redemption failed",
			);
		} else {
			logger.info(
				{
					tokenPrefix: result.token?.slice(0, 10),
				},
				"CAPTCHA challenge redeemed successfully",
			);
		}

		return NextResponse.json(result);
	} catch (error) {
		logger.error(
			{
				error: error instanceof Error ? error.message : String(error),
			},
			"Failed to redeem CAPTCHA challenge",
		);

		return NextResponse.json(
			{ success: false, error: "Failed to redeem challenge" },
			{ status: 500 },
		);
	}
}
