/**
 * Unit tests for Retry Utility
 *
 * Tests exponential backoff, retry logic, and error handling
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as loggerModule from "~/lib/logger";
import { retryWithBackoff } from "../retry";

describe("Retry Utility", () => {
	let warnSpy: ReturnType<typeof vi.fn>;
	let errorSpy: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		vi.clearAllMocks();
		// Spy on logger methods to verify they're called correctly
		warnSpy = vi
			.spyOn(loggerModule.logger, "warn")
			.mockImplementation(() => {}) as ReturnType<typeof vi.fn>;
		errorSpy = vi
			.spyOn(loggerModule.logger, "error")
			.mockImplementation(() => {}) as ReturnType<typeof vi.fn>;
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	describe("retryWithBackoff", () => {
		it("should succeed on first attempt without retry", async () => {
			const mockFn = vi.fn().mockResolvedValue("success");

			const result = await retryWithBackoff(mockFn);

			expect(result).toBe("success");
			expect(mockFn).toHaveBeenCalledTimes(1);
			expect(warnSpy).not.toHaveBeenCalled();
			expect(errorSpy).not.toHaveBeenCalled();
		});

		it("should retry on failure and succeed eventually", async () => {
			const mockFn = vi
				.fn()
				.mockRejectedValueOnce(new Error("First failure"))
				.mockRejectedValueOnce(new Error("Second failure"))
				.mockResolvedValueOnce("success");

			vi.useFakeTimers();

			const promise = retryWithBackoff(mockFn);

			// Fast-forward through retries
			await vi.advanceTimersByTimeAsync(1000); // 1st retry
			await vi.advanceTimersByTimeAsync(2000); // 2nd retry

			const result = await promise;

			expect(result).toBe("success");
			expect(mockFn).toHaveBeenCalledTimes(3);
			expect(warnSpy).toHaveBeenCalledTimes(2);
			expect(errorSpy).not.toHaveBeenCalled();
		});

		it("should throw error after all retries exhausted", async () => {
			const mockFn = vi.fn().mockRejectedValue(new Error("Permanent failure"));

			vi.useFakeTimers();

			let caughtError: Error | undefined;
			const testPromise = (async () => {
				try {
					await retryWithBackoff(mockFn, { maxRetries: 3 });
					expect.fail("Should have thrown error");
				} catch (error) {
					caughtError = error as Error;
				}
			})();

			// Fast-forward through all retries
			await vi.advanceTimersByTimeAsync(1000);
			await vi.advanceTimersByTimeAsync(2000);

			await testPromise;

			expect(caughtError).toBeDefined();
			expect(caughtError?.message).toBe("Permanent failure");
			expect(mockFn).toHaveBeenCalledTimes(3);
			expect(warnSpy).toHaveBeenCalledTimes(2);
			expect(errorSpy).toHaveBeenCalledTimes(1);
		});

		it("should use custom maxRetries", async () => {
			const mockFn = vi.fn().mockRejectedValue(new Error("Failure"));

			vi.useFakeTimers();

			let caughtError: Error | undefined;
			const testPromise = (async () => {
				try {
					await retryWithBackoff(mockFn, { maxRetries: 2 });
				} catch (error) {
					caughtError = error as Error;
				}
			})();

			// Fast-forward through retries
			await vi.advanceTimersByTimeAsync(1000);

			await testPromise;

			expect(caughtError).toBeDefined();
			expect(mockFn).toHaveBeenCalledTimes(2); // Only 2 attempts
		});

		it("should use custom baseDelayMs for exponential backoff", async () => {
			const mockFn = vi.fn().mockRejectedValue(new Error("Failure"));
			const attemptTimestamps: number[] = [];

			mockFn.mockImplementation(async () => {
				attemptTimestamps.push(Date.now());
				throw new Error("Failure");
			});

			vi.useFakeTimers({ now: 0 });

			let error: Error | undefined;
			const testPromise = (async () => {
				try {
					await retryWithBackoff(mockFn, { baseDelayMs: 500, maxRetries: 3 });
				} catch (e) {
					error = e as Error;
				}
			})();

			// Fast-forward with custom delay
			await vi.advanceTimersByTimeAsync(500); // 1st retry (500ms)
			await vi.advanceTimersByTimeAsync(1000); // 2nd retry (1000ms)

			await testPromise;

			expect(error).toBeDefined();
			expect(attemptTimestamps).toEqual([
				0, // Initial attempt
				500, // 1st retry after 500ms
				1500, // 2nd retry after 1000ms (cumulative: 1500ms)
			]);
		});

		it("should use custom context in logs", async () => {
			const mockFn = vi.fn().mockRejectedValue(new Error("Test error"));

			vi.useFakeTimers();

			const testPromise = (async () => {
				try {
					await retryWithBackoff(mockFn, {
						context: "Custom operation",
						maxRetries: 2,
					});
				} catch {
					// Expected to fail
				}
			})();

			await vi.advanceTimersByTimeAsync(1000);

			await testPromise;

			expect(warnSpy).toHaveBeenCalledWith(
				expect.objectContaining({ attempt: 0, delayMs: 1000 }),
				"Retrying Custom operation after error",
			);

			expect(errorSpy).toHaveBeenCalledWith(
				expect.any(Object),
				"Custom operation failed after all retries",
			);
		});

		it("should use finalErrorMessage when provided", async () => {
			const mockFn = vi.fn().mockRejectedValue(new Error("Test error"));

			vi.useFakeTimers();

			const testPromise = (async () => {
				try {
					await retryWithBackoff(mockFn, {
						finalErrorMessage: "Custom final error message",
						maxRetries: 2,
					});
				} catch {
					// Expected to fail
				}
			})();

			await vi.advanceTimersByTimeAsync(1000);

			await testPromise;

			expect(errorSpy).toHaveBeenCalledWith(
				expect.any(Object),
				"Custom final error message",
			);
		});

		it("should use default error message when finalErrorMessage is not provided", async () => {
			const mockFn = vi.fn().mockRejectedValue(new Error("Test error"));

			vi.useFakeTimers();

			const testPromise = (async () => {
				try {
					await retryWithBackoff(mockFn, {
						context: "Test context",
						maxRetries: 2,
						// No finalErrorMessage provided
					});
				} catch {
					// Expected to fail
				}
			})();

			await vi.advanceTimersByTimeAsync(1000);

			await testPromise;

			// This tests the ?? operator branch (line 89)
			expect(errorSpy).toHaveBeenCalledWith(
				expect.any(Object),
				"Test context failed after all retries",
			);
		});

		it("should handle functions that return different types", async () => {
			const objectFn = vi.fn().mockResolvedValue({ data: "test" });
			const numberFn = vi.fn().mockResolvedValue(42);
			const arrayFn = vi.fn().mockResolvedValue([1, 2, 3]);

			const objResult = await retryWithBackoff(objectFn);
			const numResult = await retryWithBackoff(numberFn);
			const arrResult = await retryWithBackoff(arrayFn);

			expect(objResult).toEqual({ data: "test" });
			expect(numResult).toBe(42);
			expect(arrResult).toEqual([1, 2, 3]);
		});

		it("should preserve error details through retries", async () => {
			class CustomError extends Error {
				constructor(
					message: string,
					public statusCode: number,
				) {
					super(message);
					this.name = "CustomError";
				}
			}

			const customError = new CustomError("API Error", 500);
			const mockFn = vi.fn().mockRejectedValue(customError);

			vi.useFakeTimers();

			let caughtError: CustomError | undefined;
			const testPromise = (async () => {
				try {
					await retryWithBackoff(mockFn, { maxRetries: 2 });
				} catch (error) {
					caughtError = error as CustomError;
				}
			})();

			await vi.advanceTimersByTimeAsync(1000);

			await testPromise;

			expect(caughtError).toBeInstanceOf(CustomError);
			expect(caughtError?.statusCode).toBe(500);
			expect(caughtError?.message).toBe("API Error");
		});
	});
});
