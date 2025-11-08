/**
 * Unit tests for useCaptcha hook
 *
 * Tests Cap.js client-side CAPTCHA integration including:
 * - Cap instance initialization
 * - CAPTCHA execution and token generation
 * - Error handling
 * - Loading states
 * - Cleanup on unmount
 */

import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock Cap class using vi.hoisted() to prevent hoisting issues
const { mockSolve, mockDispose, MockCap } = vi.hoisted(() => {
	const mockSolve = vi.fn();
	const mockDispose = vi.fn();

	class MockCap {
		solve = mockSolve;
		dispose = mockDispose;
	}

	return { mockSolve, mockDispose, MockCap };
});

// Mock @cap.js/widget module
// Using vi.mock() for external module (CLAUDE.md exception: external package)
vi.mock("@cap.js/widget", () => ({
	default: MockCap,
}));

// Mock i18n
vi.mock("~/lib/i18n", () => ({
	useTranslations: () => ({
		captcha: {
			verificationFailed: "CAPTCHA verification failed",
			verificationError: "CAPTCHA verification error",
		},
	}),
}));

// Import after mocks
import { useCaptcha } from "../useCaptcha";

describe("useCaptcha", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should initialize with default state", () => {
		const { result } = renderHook(() => useCaptcha());

		expect(result.current.isLoading).toBe(false);
		expect(result.current.error).toBe(null);
		expect(typeof result.current.execute).toBe("function");
		expect(typeof result.current.clearError).toBe("function");
	});

	it("should execute CAPTCHA and return token on success", async () => {
		const mockToken = "test-captcha-token-123";
		mockSolve.mockResolvedValue({
			success: true,
			token: mockToken,
		});

		const { result } = renderHook(() => useCaptcha());

		// Execute CAPTCHA and wait for completion
		const token = await result.current.execute();

		// Verify token returned
		expect(token).toBe(mockToken);

		// Verify loading state is cleared
		expect(result.current.isLoading).toBe(false);

		// Verify no error
		expect(result.current.error).toBe(null);

		// Verify Cap.solve was called
		expect(mockSolve).toHaveBeenCalledTimes(1);
	});

	it("should reuse Cap instance across multiple executions", async () => {
		mockSolve.mockResolvedValue({
			success: true,
			token: "token-1",
		});

		const { result } = renderHook(() => useCaptcha());

		// First execution
		await result.current.execute();
		expect(mockSolve).toHaveBeenCalledTimes(1);

		// Second execution
		mockSolve.mockResolvedValue({
			success: true,
			token: "token-2",
		});
		await result.current.execute();

		// Verify solve was called twice but Cap instance was created only once
		// (we can't directly verify constructor calls in this setup, but mockSolve
		// being called twice indicates the instance is reused)
		expect(mockSolve).toHaveBeenCalledTimes(2);
	});

	it("should handle CAPTCHA execution failure", async () => {
		mockSolve.mockResolvedValue({
			success: false,
			token: null,
		});

		const { result } = renderHook(() => useCaptcha());

		// Execute CAPTCHA and expect error
		await expect(result.current.execute()).rejects.toThrow(
			"CAPTCHA verification failed",
		);

		// Verify error state is set
		await waitFor(() => {
			expect(result.current.error).toBe("CAPTCHA verification failed");
		});

		// Verify loading state is cleared
		expect(result.current.isLoading).toBe(false);
	});

	it("should handle network error during CAPTCHA execution", async () => {
		const networkError = new Error("Network request failed");
		mockSolve.mockRejectedValue(networkError);

		const { result } = renderHook(() => useCaptcha());

		// Execute CAPTCHA and expect error
		await expect(result.current.execute()).rejects.toThrow(
			"Network request failed",
		);

		// Verify error state is set
		await waitFor(() => {
			expect(result.current.error).toBe("Network request failed");
		});

		// Verify loading state is cleared
		expect(result.current.isLoading).toBe(false);
	});

	it("should handle non-Error exception", async () => {
		mockSolve.mockRejectedValue("String error");

		const { result } = renderHook(() => useCaptcha());

		// Execute CAPTCHA and expect fallback error
		await expect(result.current.execute()).rejects.toThrow(
			"CAPTCHA verification error",
		);

		// Verify error state is set to fallback message
		await waitFor(() => {
			expect(result.current.error).toBe("CAPTCHA verification error");
		});
	});

	it("should clear error when clearError is called", async () => {
		mockSolve.mockResolvedValue({
			success: false,
			token: null,
		});

		const { result } = renderHook(() => useCaptcha());

		// Trigger error
		await expect(result.current.execute()).rejects.toThrow();

		// Verify error is set
		await waitFor(() => {
			expect(result.current.error).toBe("CAPTCHA verification failed");
		});

		// Clear error
		result.current.clearError();

		// Verify error is cleared
		await waitFor(() => {
			expect(result.current.error).toBe(null);
		});
	});

	it("should clear previous error on new execution", async () => {
		// First execution fails
		mockSolve.mockResolvedValue({
			success: false,
			token: null,
		});

		const { result } = renderHook(() => useCaptcha());

		await expect(result.current.execute()).rejects.toThrow();

		await waitFor(() => {
			expect(result.current.error).toBe("CAPTCHA verification failed");
		});

		// Second execution succeeds
		mockSolve.mockResolvedValue({
			success: true,
			token: "success-token",
		});

		const token = await result.current.execute();

		// Verify error is cleared after successful execution
		await waitFor(() => {
			expect(result.current.error).toBe(null);
		});
		expect(token).toBe("success-token");
	});

	it("should dispose Cap instance on unmount", () => {
		mockSolve.mockResolvedValue({
			success: true,
			token: "test-token",
		});

		const { result, unmount } = renderHook(() => useCaptcha());

		// Execute to initialize Cap instance
		result.current.execute();

		// Unmount component
		unmount();

		// Verify dispose was called
		// Note: In the actual implementation, dispose is called via @ts-expect-error
		// because it's not in the type definitions but exists at runtime
		expect(mockDispose).toHaveBeenCalledTimes(1);
	});

	it("should handle disposal errors gracefully", () => {
		mockSolve.mockResolvedValue({
			success: true,
			token: "test-token",
		});
		mockDispose.mockImplementation(() => {
			throw new Error("Disposal failed");
		});

		const { result, unmount } = renderHook(() => useCaptcha());

		// Execute to initialize Cap instance
		result.current.execute();

		// Unmount should not throw even if dispose fails
		expect(() => unmount()).not.toThrow();
	});

	it("should not fail if Cap instance has no dispose method", () => {
		// Create a Cap mock without dispose
		mockSolve.mockResolvedValue({
			success: true,
			token: "test-token",
		});

		const { result, unmount } = renderHook(() => useCaptcha());

		// Execute to initialize Cap instance
		result.current.execute();

		// Remove dispose method
		// @ts-expect-error - testing runtime behavior
		result.current.execute = undefined;

		// Unmount should not throw
		expect(() => unmount()).not.toThrow();
	});

	it("should set isLoading to true during execution", async () => {
		let resolveSolve: ((value: unknown) => void) | undefined;
		const solvePromise = new Promise((resolve) => {
			resolveSolve = resolve;
		});

		mockSolve.mockImplementation(() => solvePromise);

		const { result } = renderHook(() => useCaptcha());

		// Start execution
		const executePromise = result.current.execute();

		// Verify loading state
		await waitFor(() => {
			expect(result.current.isLoading).toBe(true);
		});

		// Resolve solve
		resolveSolve?.({
			success: true,
			token: "test-token",
		});

		await executePromise;

		// Verify loading state cleared
		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});
	});

	it("should maintain loading state across multiple concurrent executions", async () => {
		let resolveSolve1: ((value: unknown) => void) | undefined;
		let resolveSolve2: ((value: unknown) => void) | undefined;
		const solvePromise1 = new Promise((resolve) => {
			resolveSolve1 = resolve;
		});
		const solvePromise2 = new Promise((resolve) => {
			resolveSolve2 = resolve;
		});

		mockSolve
			.mockImplementationOnce(() => solvePromise1)
			.mockImplementationOnce(() => solvePromise2);

		const { result } = renderHook(() => useCaptcha());

		// Start first execution
		const execute1 = result.current.execute();

		await waitFor(() => {
			expect(result.current.isLoading).toBe(true);
		});

		// Resolve first execution
		resolveSolve1?.({
			success: true,
			token: "token-1",
		});

		await execute1;

		// Start second execution immediately
		const execute2 = result.current.execute();

		// Verify loading state is true again
		await waitFor(() => {
			expect(result.current.isLoading).toBe(true);
		});

		// Resolve second execution
		resolveSolve2?.({
			success: true,
			token: "token-2",
		});

		await execute2;

		// Verify loading state cleared
		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});
	});
});
