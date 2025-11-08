/**
 * CAPTCHA Server-side Verification Tests
 *
 * Tests for verifyCaptchaToken and related server-side CAPTCHA functions.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock env before importing captcha module
const mockEnv = vi.hoisted(() => ({
	CAP_SECRET_KEY: "test-secret-key-32-chars-12345678",
	CAP_DIFFICULTY: 100000,
	CAP_BYPASS: true,
	NEXT_PUBLIC_CAP_SITE_KEY: "test-site-key",
}));

vi.mock("~/env", () => ({
	env: mockEnv,
}));

import * as loggerModule from "~/lib/logger";
import * as captchaModule from "../captcha";

describe("verifyCaptchaToken", () => {
	let warnSpy: ReturnType<typeof vi.fn>;
	let infoSpy: ReturnType<typeof vi.fn>;
	let errorSpy: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		warnSpy = vi
			.spyOn(loggerModule.logger, "warn")
			.mockImplementation(() => {}) as ReturnType<typeof vi.fn>;
		infoSpy = vi
			.spyOn(loggerModule.logger, "info")
			.mockImplementation(() => {}) as ReturnType<typeof vi.fn>;
		errorSpy = vi
			.spyOn(loggerModule.logger, "error")
			.mockImplementation(() => {}) as ReturnType<typeof vi.fn>;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("Test Bypass Mode", () => {
		it("should return true when CAP_BYPASS is enabled", async () => {
			// In vitest.setup.ts, CAP_BYPASS is set to "true"
			const result = await captchaModule.verifyCaptchaToken("any-token");

			expect(result).toBe(true);
			expect(warnSpy).toHaveBeenCalledWith(
				"CAPTCHA bypassed (test mode enabled)",
			);
		});

		it("should work with empty token in bypass mode", async () => {
			const result = await captchaModule.verifyCaptchaToken("");

			expect(result).toBe(true);
			expect(warnSpy).toHaveBeenCalledWith(
				"CAPTCHA bypassed (test mode enabled)",
			);
		});

		it("should work with any string in bypass mode", async () => {
			const result = await captchaModule.verifyCaptchaToken(
				"invalid-token-format",
			);

			expect(result).toBe(true);
			expect(warnSpy).toHaveBeenCalledWith(
				"CAPTCHA bypassed (test mode enabled)",
			);
		});
	});

	describe("Token Validation", () => {
		it("should handle null token gracefully", async () => {
			// @ts-expect-error - Testing invalid input
			const result = await captchaModule.verifyCaptchaToken(null);

			// In bypass mode, even null returns true
			expect(result).toBe(true);
		});

		it("should handle undefined token gracefully", async () => {
			// @ts-expect-error - Testing invalid input
			const result = await captchaModule.verifyCaptchaToken(undefined);

			// In bypass mode, even undefined returns true
			expect(result).toBe(true);
		});
	});

	describe("Logging", () => {
		it("should log bypass warning when CAP_BYPASS is true", async () => {
			await captchaModule.verifyCaptchaToken("test-token");

			expect(warnSpy).toHaveBeenCalledWith(
				"CAPTCHA bypassed (test mode enabled)",
			);
		});
	});
});

describe("createCaptchaChallenge", () => {
	it("should create a challenge with token", async () => {
		const challenge = await captchaModule.createCaptchaChallenge();

		expect(challenge).toBeDefined();
		expect(challenge).toHaveProperty("token");
		expect(typeof challenge.token).toBe("string");
	});

	it("should create challenges with different tokens", async () => {
		const challenge1 = await captchaModule.createCaptchaChallenge();
		const challenge2 = await captchaModule.createCaptchaChallenge();

		// Each challenge should have a unique token
		expect(challenge1.token).not.toBe(challenge2.token);
	});
});

describe("redeemCaptchaChallenge", () => {
	it("should handle redeem request", async () => {
		const challenge = await captchaModule.createCaptchaChallenge();
		const token = challenge.token ?? "";

		// Mock solutions (actual solving would be complex)
		const solutions: number[][] = [];

		const result = await captchaModule.redeemCaptchaChallenge(token, solutions);

		expect(result).toBeDefined();
		expect(result).toHaveProperty("success");
	});
});
