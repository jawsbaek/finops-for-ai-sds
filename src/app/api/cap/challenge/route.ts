/**
 * Cap.js Challenge API Endpoint
 *
 * Creates a new proof-of-work challenge for clients to solve.
 * This endpoint is called by the Cap.js widget to initiate CAPTCHA verification.
 */

import { NextResponse } from "next/server";
import { logger } from "~/lib/logger";
import { createCaptchaChallenge } from "~/server/api/captcha";

export async function POST() {
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
