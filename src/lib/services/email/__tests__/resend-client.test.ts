/**
 * Unit tests for Resend Email Client
 *
 * Tests sendCostAlertEmail template rendering, Resend API integration, and retry logic
 */

// Mock dependencies
vi.mock("~/env", () => ({
	env: {
		RESEND_API_KEY: "re_test_key_123",
		RESEND_FROM_EMAIL: "test@example.com",
	},
}));

vi.mock("~/lib/logger", () => ({
	logger: {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	},
}));

vi.mock("@react-email/components", () => ({
	render: vi.fn(),
}));

vi.mock("../templates/CostAlertEmail", () => ({
	default: vi.fn(() => null),
}));

const mockEmailsSend = vi.fn();

vi.mock("resend", () => {
	return {
		Resend: class {
			emails = {
				send: mockEmailsSend,
			};
		},
	};
});

import { render } from "@react-email/components";
import { Resend } from "resend";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { env } from "~/env";
import {
	type SendCostAlertEmailParams,
	sendCostAlertEmail,
} from "../resend-client";

describe("Resend Email Client", () => {
	beforeEach(() => {
		mockEmailsSend.mockReset();
		vi.mocked(render).mockResolvedValue("<html>Test Email</html>");
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	const mockParams: SendCostAlertEmailParams = {
		to: "user@example.com",
		projectName: "Test Project",
		teamName: "Test Team",
		currentCost: 150.5,
		threshold: 100.0,
		exceedancePercent: 50.5,
		dashboardUrl: "https://app.example.com/dashboard/projects/proj-1",
	};

	describe("sendCostAlertEmail", () => {
		it("should skip sending when RESEND_API_KEY is not configured", async () => {
			// Temporarily remove API key
			const originalKey = env.RESEND_API_KEY;
			(env as { RESEND_API_KEY: string | undefined }).RESEND_API_KEY =
				undefined;

			await sendCostAlertEmail(mockParams);

			expect(render).not.toHaveBeenCalled();
			expect(mockEmailsSend).not.toHaveBeenCalled();

			// Restore API key
			(env as { RESEND_API_KEY: string | undefined }).RESEND_API_KEY =
				originalKey;
		});

		it("should render email template with correct props", async () => {
			mockEmailsSend.mockResolvedValue({
				data: { id: "email-123" },
				error: null,
			});

			await sendCostAlertEmail(mockParams);

			expect(render).toHaveBeenCalledTimes(1);
			const renderCall = vi.mocked(render).mock.calls[0];
			expect(renderCall?.[0]).toBeDefined();
		});

		it("should send email with correct Resend API parameters", async () => {
			mockEmailsSend.mockResolvedValue({
				data: { id: "email-123" },
				error: null,
			});

			await sendCostAlertEmail(mockParams);

			expect(mockEmailsSend).toHaveBeenCalledTimes(1);
			expect(mockEmailsSend).toHaveBeenCalledWith({
				from: "test@example.com",
				to: "user@example.com",
				subject: "🚨 [Test Team] Test Project 비용 임계값 초과",
				html: "<html>Test Email</html>",
			});
		});

		it("should use default from email if RESEND_FROM_EMAIL not configured", async () => {
			const originalFromEmail = env.RESEND_FROM_EMAIL;
			(env as { RESEND_FROM_EMAIL: string | undefined }).RESEND_FROM_EMAIL =
				undefined;

			mockEmailsSend.mockResolvedValue({
				data: { id: "email-123" },
				error: null,
			});

			await sendCostAlertEmail(mockParams);

			expect(mockEmailsSend).toHaveBeenCalledWith({
				from: "FinOps for AI <alerts@finops-ai.com>",
				to: "user@example.com",
				subject: "🚨 [Test Team] Test Project 비용 임계값 초과",
				html: "<html>Test Email</html>",
			});

			// Restore
			(env as { RESEND_FROM_EMAIL: string | undefined }).RESEND_FROM_EMAIL =
				originalFromEmail;
		});

		it("should throw error when Resend API returns error", async () => {
			mockEmailsSend.mockResolvedValue({
				data: null,
				error: { message: "Invalid API key" },
			});

			vi.useFakeTimers();

			const promise = sendCostAlertEmail(mockParams);

			// Fast-forward through retries
			await vi.advanceTimersByTimeAsync(1000);
			await vi.advanceTimersByTimeAsync(2000);

			await expect(promise).rejects.toThrow(
				"Resend API error: Invalid API key",
			);

			expect(mockEmailsSend).toHaveBeenCalledTimes(3);

			vi.useRealTimers();
		});

		it("should retry up to 3 times on failure", async () => {
			// Fail 2 times, succeed on 3rd attempt
			mockEmailsSend
				.mockResolvedValueOnce({
					data: null,
					error: { message: "Temporary error" },
				})
				.mockResolvedValueOnce({
					data: null,
					error: { message: "Temporary error" },
				})
				.mockResolvedValueOnce({
					data: { id: "email-123" },
					error: null,
				});

			vi.useFakeTimers();

			const promise = sendCostAlertEmail(mockParams);

			// Fast-forward through retries
			await vi.advanceTimersByTimeAsync(1000); // 1st retry
			await vi.advanceTimersByTimeAsync(2000); // 2nd retry

			await promise;

			expect(mockEmailsSend).toHaveBeenCalledTimes(3);

			vi.useRealTimers();
		});

		it("should use exponential backoff timing (1s, 2s, 4s)", async () => {
			const attemptTimestamps: number[] = [];

			mockEmailsSend.mockImplementation(async () => {
				attemptTimestamps.push(Date.now());
				return {
					data: null,
					error: { message: "error" },
				};
			});

			vi.useFakeTimers({ now: 0 });

			const promise = sendCostAlertEmail(mockParams);

			// Fast-forward with exact timing
			await vi.advanceTimersByTimeAsync(1000); // 1st retry
			await vi.advanceTimersByTimeAsync(2000); // 2nd retry

			try {
				await promise;
			} catch (e) {
				// Expected to fail
			}

			expect(attemptTimestamps).toEqual([
				0, // Initial attempt
				1000, // 1st retry after 1s
				3000, // 2nd retry after 2s (cumulative: 3s)
			]);

			vi.useRealTimers();
		});

		it("should handle multiple recipients", async () => {
			mockEmailsSend.mockResolvedValue({
				data: { id: "email-123" },
				error: null,
			});

			await sendCostAlertEmail({
				...mockParams,
				to: "admin@example.com",
			});

			expect(mockEmailsSend).toHaveBeenCalledWith(
				expect.objectContaining({
					to: "admin@example.com",
				}),
			);
		});

		it("should format subject with team and project names", async () => {
			mockEmailsSend.mockResolvedValue({
				data: { id: "email-123" },
				error: null,
			});

			await sendCostAlertEmail({
				...mockParams,
				teamName: "Backend Team",
				projectName: "API Gateway",
			});

			expect(mockEmailsSend).toHaveBeenCalledWith(
				expect.objectContaining({
					subject: "🚨 [Backend Team] API Gateway 비용 임계값 초과",
				}),
			);
		});

		it("should log successful email send with email ID", async () => {
			const { logger } = await import("~/lib/logger");

			mockEmailsSend.mockResolvedValue({
				data: { id: "email-abc123" },
				error: null,
			});

			await sendCostAlertEmail(mockParams);

			expect(logger.info).toHaveBeenCalledWith(
				{
					projectName: "Test Project",
					to: "user@example.com",
					emailId: "email-abc123",
				},
				"Cost alert email sent successfully",
			);
		});
	});

	describe("Error handling", () => {
		it("should handle network errors", async () => {
			mockEmailsSend.mockRejectedValue(new Error("Network error"));

			vi.useFakeTimers();

			const promise = sendCostAlertEmail(mockParams);

			await vi.advanceTimersByTimeAsync(1000);
			await vi.advanceTimersByTimeAsync(2000);

			await expect(promise).rejects.toThrow("Network error");

			expect(mockEmailsSend).toHaveBeenCalledTimes(3);

			vi.useRealTimers();
		});

		it("should log error after all retries exhausted", async () => {
			const { logger } = await import("~/lib/logger");

			mockEmailsSend.mockResolvedValue({
				data: null,
				error: { message: "Persistent error" },
			});

			vi.useFakeTimers();

			const promise = sendCostAlertEmail(mockParams);

			await vi.advanceTimersByTimeAsync(1000);
			await vi.advanceTimersByTimeAsync(2000);

			try {
				await promise;
			} catch (e) {
				// Expected
			}

			expect(logger.error).toHaveBeenCalledWith(
				{ error: "Resend API error: Persistent error" },
				"Email send failed after all retries",
			);

			vi.useRealTimers();
		});
	});
});
