/**
 * Cap.js CAPTCHA React Hook
 *
 * Provides a React hook for integrating Cap.js proof-of-work CAPTCHA
 * into client-side forms and operations.
 *
 * @example
 * ```tsx
 * function LoginForm() {
 *   const { execute, isLoading, error } = useCaptcha();
 *
 *   const handleSubmit = async () => {
 *     const token = await execute();
 *     await api.auth.login.mutate({ email, password, captchaToken: token });
 *   };
 *
 *   return (
 *     <button onClick={handleSubmit} disabled={isLoading}>
 *       {isLoading ? "Verifying..." : "Login"}
 *     </button>
 *   );
 * }
 * ```
 */

"use client";

import { Cap } from "@cap.js/widget";
import { useCallback, useState } from "react";
import { env } from "~/env";

interface UseCaptchaReturn {
	/**
	 * Indicates if CAPTCHA proof-of-work is currently being computed
	 */
	isLoading: boolean;

	/**
	 * Execute CAPTCHA proof-of-work and return token
	 * @returns Promise resolving to CAPTCHA token string
	 * @throws Error if CAPTCHA execution fails
	 */
	execute: () => Promise<string>;

	/**
	 * Error message if CAPTCHA execution failed
	 */
	error: string | null;

	/**
	 * Clear error state
	 */
	clearError: () => void;
}

/**
 * React hook for Cap.js CAPTCHA integration
 *
 * This hook provides a programmatic interface to execute Cap.js proof-of-work
 * CAPTCHA challenges. It handles loading states, error management, and token
 * generation.
 *
 * The CAPTCHA runs in "invisible" mode - no UI widget is shown, and the
 * proof-of-work computation happens in the background using WebAssembly.
 *
 * @returns Object containing execute function, loading state, and error state
 */
export function useCaptcha(): UseCaptchaReturn {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const execute = useCallback(async (): Promise<string> => {
		setIsLoading(true);
		setError(null);

		try {
			// Create Cap instance with API endpoint
			const cap = new Cap({
				apiEndpoint: "/api/cap",
			});

			// Execute proof-of-work
			// This will:
			// 1. Call /api/cap/challenge to get a challenge
			// 2. Compute SHA-256 hashes in WebAssembly until difficulty threshold is met
			// 3. Call /api/cap/redeem with solutions to get a token
			const result = await cap.solve();

			if (!result.success || !result.token) {
				throw new Error("CAPTCHA 검증에 실패했습니다.");
			}

			return result.token;
		} catch (err) {
			const errorMsg =
				err instanceof Error
					? err.message
					: "CAPTCHA 검증 중 오류가 발생했습니다.";
			setError(errorMsg);
			throw new Error(errorMsg);
		} finally {
			setIsLoading(false);
		}
	}, []);

	const clearError = useCallback(() => {
		setError(null);
	}, []);

	return {
		isLoading,
		execute,
		error,
		clearError,
	};
}
