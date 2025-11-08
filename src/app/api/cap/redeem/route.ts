/**
 * Cap.js Redeem API Endpoint
 *
 * Validates proof-of-work solutions from clients and issues tokens.
 * This endpoint is called by the Cap.js widget after solving the challenge.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "~/lib/logger";
import { redeemCaptchaChallenge } from "~/server/api/captcha";
import { rateLimits } from "~/server/api/ratelimit";

const redeemRequestSchema = z.object({
	token: z.string().min(1, "Token is required").max(1000, "Token too long"),
	solutions: z
		.array(z.array(z.number()), {
			required_error: "Solutions are required",
		})
		.max(1000, "Too many solutions") // Prevent DoS with massive arrays
		.refine(
			(solutions) => solutions.every((s) => s.length <= 100),
			"Solution arrays too large",
		),
});

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
		// Parse and validate request body
		let body: unknown;
		try {
			body = await request.json();
		} catch (error) {
			logger.warn({ error }, "Invalid JSON in CAPTCHA redeem request");
			return NextResponse.json(
				{ success: false, error: "Invalid JSON" },
				{ status: 400 },
			);
		}

		// Validate request schema
		const parseResult = redeemRequestSchema.safeParse(body);
		if (!parseResult.success) {
			logger.warn(
				{ errors: parseResult.error.flatten() },
				"Invalid request schema for CAPTCHA redeem",
			);
			return NextResponse.json(
				{
					success: false,
					error: "Invalid request format",
					details: parseResult.error.flatten().fieldErrors,
				},
				{ status: 400 },
			);
		}

		const { token, solutions } = parseResult.data;

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
