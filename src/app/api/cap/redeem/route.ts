/**
 * Cap.js Redeem API Endpoint
 *
 * Validates proof-of-work solutions from clients and issues tokens.
 * This endpoint is called by the Cap.js widget after solving the challenge.
 */

import { NextResponse } from "next/server";
import { logger } from "~/lib/logger";
import { redeemCaptchaChallenge } from "~/server/api/captcha";

export async function POST(request: Request) {
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
