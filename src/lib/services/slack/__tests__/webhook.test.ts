/**
 * Unit tests for Slack Webhook Service
 *
 * Tests sendCostAlert message formatting, retry logic, and error handling
 */

// Mock logger to avoid console noise
vi.mock("~/lib/logger", () => ({
	logger: {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	},
}));

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type SlackCostAlertParams, sendCostAlert } from "../webhook";

describe("Slack Webhook Service", () => {
	let originalEnv: string | undefined;
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		originalEnv = process.env.SLACK_WEBHOOK_URL;
		fetchMock = vi.fn();
		global.fetch = fetchMock as typeof global.fetch;
	});

	afterEach(() => {
		process.env.SLACK_WEBHOOK_URL = originalEnv;
		vi.useRealTimers(); // Ensure fake timers are restored
		vi.restoreAllMocks();
	});

	const mockParams: SlackCostAlertParams = {
		projectName: "Test Project",
		teamName: "Test Team",
		currentCost: 150.5,
		threshold: 100.0,
		exceedancePercent: 50.5,
		dashboardUrl: "https://app.example.com/dashboard/projects/proj-1",
	};

	describe("sendCostAlert", () => {
		it("should skip sending when SLACK_WEBHOOK_URL is not configured", async () => {
			// biome-ignore lint/performance/noDelete: Need to delete env var for test
			delete process.env.SLACK_WEBHOOK_URL;

			await sendCostAlert(mockParams);

			expect(fetchMock).not.toHaveBeenCalled();
		});

		it("should send Slack message with correct Blocks API format", async () => {
			process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/test";

			fetchMock.mockResolvedValue({
				ok: true,
				status: 200,
				text: async () => "ok",
			});

			await sendCostAlert(mockParams);

			expect(fetchMock).toHaveBeenCalledTimes(1);
			expect(fetchMock).toHaveBeenCalledWith("https://hooks.slack.com/test", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: expect.stringContaining('"blocks"'),
			});

			// Parse the payload to verify structure
			const callArgs = fetchMock.mock.calls[0];
			const payload = JSON.parse(callArgs?.[1]?.body as string);

			expect(payload.text).toBe("🚨 [Test Team] 비용 임계값 초과");
			expect(payload.blocks).toHaveLength(2);

			// Verify section block
			expect(payload.blocks[0]?.type).toBe("section");
			expect(payload.blocks[0]?.text?.text).toContain("Test Project");
			expect(payload.blocks[0]?.text?.text).toContain("$150.50");
			expect(payload.blocks[0]?.text?.text).toContain("$100.00");
			expect(payload.blocks[0]?.text?.text).toContain("50.5%");

			// Verify actions block with button
			expect(payload.blocks[1]?.type).toBe("actions");
			expect(payload.blocks[1]?.elements[0]?.type).toBe("button");
			expect(payload.blocks[1]?.elements[0]?.url).toBe(
				"https://app.example.com/dashboard/projects/proj-1",
			);
			expect(payload.blocks[1]?.elements[0]?.style).toBe("danger");
		});

		it("should format cost values correctly", async () => {
			process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/test";

			fetchMock.mockResolvedValue({
				ok: true,
				status: 200,
				text: async () => "ok",
			});

			await sendCostAlert({
				...mockParams,
				currentCost: 1234.567,
				threshold: 999.99,
				exceedancePercent: 23.456,
			});

			const payload = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
			const text = payload.blocks[0]?.text?.text;

			expect(text).toContain("$1234.57"); // Rounded to 2 decimals
			expect(text).toContain("$999.99");
			expect(text).toContain("23.5%"); // Rounded to 1 decimal
		});

		it("should retry up to 3 times on failure", async () => {
			process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/test";

			// Fail 2 times, succeed on 3rd attempt
			fetchMock
				.mockResolvedValueOnce({
					ok: false,
					status: 500,
					text: async () => "Internal Server Error",
				})
				.mockResolvedValueOnce({
					ok: false,
					status: 503,
					text: async () => "Service Unavailable",
				})
				.mockResolvedValueOnce({
					ok: true,
					status: 200,
					text: async () => "ok",
				});

			// Mock timers for exponential backoff
			vi.useFakeTimers();

			const promise = sendCostAlert(mockParams);

			// Fast-forward through retries
			await vi.advanceTimersByTimeAsync(1000); // 1st retry after 1s
			await vi.advanceTimersByTimeAsync(2000); // 2nd retry after 2s

			await promise;

			expect(fetchMock).toHaveBeenCalledTimes(3);

			vi.useRealTimers();
		});

		it("should throw error after all retries exhausted", async () => {
			process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/test";

			// All attempts fail
			fetchMock.mockResolvedValue({
				ok: false,
				status: 500,
				text: async () => "Internal Server Error",
			});

			vi.useFakeTimers();

			// Use an async IIFE to handle the promise immediately
			let caughtError: Error | undefined;
			const testPromise = (async () => {
				try {
					await sendCostAlert(mockParams);
					expect.fail("Should have thrown error");
				} catch (error) {
					caughtError = error as Error;
				}
			})();

			// Fast-forward through all retries
			await vi.advanceTimersByTimeAsync(1000); // 1st retry
			await vi.advanceTimersByTimeAsync(2000); // 2nd retry

			// Wait for completion
			await testPromise;

			expect(caughtError).toBeDefined();
			expect(caughtError?.message).toBe(
				"Slack webhook failed: 500 Internal Server Error",
			);
			expect(fetchMock).toHaveBeenCalledTimes(3);

			vi.useRealTimers();
		});

		it("should handle network errors", async () => {
			process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/test";

			fetchMock.mockRejectedValue(new Error("Network error"));

			vi.useFakeTimers();

			// Use an async IIFE to handle the promise immediately
			let caughtError: Error | undefined;
			const testPromise = (async () => {
				try {
					await sendCostAlert(mockParams);
					expect.fail("Should have thrown error");
				} catch (error) {
					caughtError = error as Error;
				}
			})();

			// Fast-forward through all retries
			await vi.advanceTimersByTimeAsync(1000);
			await vi.advanceTimersByTimeAsync(2000);

			// Wait for completion
			await testPromise;

			expect(caughtError).toBeDefined();
			expect(caughtError?.message).toBe("Network error");
			expect(fetchMock).toHaveBeenCalledTimes(3);

			vi.useRealTimers();
		});

		it("should use exponential backoff timing (1s, 2s, 4s)", async () => {
			process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/test";

			const attemptTimestamps: number[] = [];

			fetchMock.mockImplementation(async () => {
				attemptTimestamps.push(Date.now());
				return {
					ok: false,
					status: 500,
					text: async () => "error",
				};
			});

			vi.useFakeTimers({ now: 0 });

			// Use an async IIFE to handle the promise immediately
			let error: Error | undefined;
			const testPromise = (async () => {
				try {
					await sendCostAlert(mockParams);
				} catch (e) {
					error = e as Error;
				}
			})();

			// Fast-forward with exact timing
			await vi.advanceTimersByTimeAsync(1000); // 1st retry
			await vi.advanceTimersByTimeAsync(2000); // 2nd retry

			// Wait for completion
			await testPromise;

			expect(error).toBeDefined();
			expect(attemptTimestamps).toEqual([
				0, // Initial attempt
				1000, // 1st retry after 1s
				3000, // 2nd retry after 2s (cumulative: 3s)
			]);

			vi.useRealTimers();
		});
	});

	describe("URL validation", () => {
		it("should handle webhook URL with trailing slash", async () => {
			process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/test/";

			fetchMock.mockResolvedValue({
				ok: true,
				status: 200,
				text: async () => "ok",
			});

			await sendCostAlert(mockParams);

			expect(fetchMock).toHaveBeenCalledWith(
				"https://hooks.slack.com/test/",
				expect.any(Object),
			);
		});
	});
});
