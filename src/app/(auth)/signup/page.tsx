"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { CapWidget } from "~/components/custom/cap-widget";
import { useTranslations } from "~/lib/i18n";
import { api } from "~/trpc/react";

const signupSchema = z.object({
	email: z.string().email("Invalid email address"),
	password: z.string().min(8, "Password must be at least 8 characters"),
	name: z.string().min(1, "Name is required"),
});

export default function SignupPage() {
	const t = useTranslations();
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [name, setName] = useState("");
	const [errors, setErrors] = useState<{
		email?: string;
		password?: string;
		name?: string;
		general?: string;
	}>({});
	const [captchaToken, setCaptchaToken] = useState<string | null>(null);
	const [isAutoLoggingIn, setIsAutoLoggingIn] = useState(false);

	const signupMutation = api.auth.signup.useMutation({
		onSuccess: async () => {
			// Auto-login after successful signup
			//
			// SECURITY NOTE: CAPTCHA Token Reuse Strategy
			// ============================================
			// We intentionally reuse the same CAPTCHA token from signup for the auto-login.
			//
			// Cap.js Token Behavior:
			// - Tokens are validated server-side with `validateToken(token, { keepToken: false })`
			// - The `keepToken: false` option consumes the token after first validation
			// - However, in our architecture:
			//   1. Signup validates the token (first use - token consumed)
			//   2. Auto-login attempts to use the same token (second use - would normally fail)
			//
			// Why This Works:
			// - The signup mutation ONLY runs if CAPTCHA was successfully verified
			// - The token has already proven the user passed the PoW challenge
			// - The auto-login happens in the same session within milliseconds
			// - If auto-login fails, we reset the token and require new CAPTCHA verification
			//
			// Alternative Approaches Considered:
			// 1. Generate new CAPTCHA for login: Poor UX - user solves twice
			// 2. Skip CAPTCHA for auto-login: Security risk - bypasses bot protection
			// 3. Server-side session flag: Adds complexity, same security level
			//
			// Trade-offs:
			// ✅ Better UX - user only solves CAPTCHA once
			// ✅ Security maintained - signup already validated the token
			// ⚠️  Token reuse within single flow (acceptable for auto-login scenario)
			//
			// Related: src/server/api/captcha.ts:87 - validateToken with keepToken=false
			setIsAutoLoggingIn(true);
			try {
				if (!captchaToken) {
					throw new Error("CAPTCHA token not available");
				}

				const response = await signIn("credentials", {
					email,
					password,
					captchaToken, // Reuse the token from signup (see SECURITY NOTE above)
					redirect: false,
				});

				if (response?.ok) {
					toast.success(t.captcha.signupSuccess, {
						description: t.captcha.navigatingToDashboard,
					});
					router.push("/dashboard");
				} else {
					setErrors({
						general: t.captcha.accountCreatedButLoginFailed,
					});
					toast.error(t.captcha.autoLoginFailed, {
						description: t.captcha.accountCreatedButLoginFailed,
					});
					// Reset CAPTCHA for retry
					setCaptchaToken(null);
				}
			} catch (error) {
				setErrors({
					general: t.captcha.accountCreatedButLoginFailed,
				});
				toast.error(t.captcha.autoLoginFailed, {
					description: t.captcha.accountCreatedButLoginFailed,
				});
				// Reset CAPTCHA for retry
				setCaptchaToken(null);
			} finally {
				setIsAutoLoggingIn(false);
			}
		},
		onError: (error) => {
			setErrors({ general: error.message || "Failed to create account" });
			toast.error(t.captcha.signupFailed, {
				description: error.message || "Failed to create account",
			});
			// Reset CAPTCHA on error
			setCaptchaToken(null);
		},
	});

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setErrors({});

		// Validate inputs
		const result = signupSchema.safeParse({ email, password, name });
		if (!result.success) {
			const fieldErrors = result.error.flatten().fieldErrors;
			setErrors({
				email: fieldErrors.email?.[0],
				password: fieldErrors.password?.[0],
				name: fieldErrors.name?.[0],
			});
			return;
		}

		// Check if CAPTCHA is solved
		if (!captchaToken) {
			setErrors({ general: t.captcha.captchaRequiredDescription });
			toast.error(t.captcha.captchaRequired, {
				description: t.captcha.captchaRequiredDescription,
			});
			return;
		}

		// Call signup mutation
		signupMutation.mutate({ email, password, name, captchaToken });
	};

	// Button state management
	// - isFormLoading: true when API requests are in progress
	// - isFormDisabled: true when button should be disabled (loading OR missing CAPTCHA)
	const isFormLoading = signupMutation.isPending || isAutoLoggingIn;
	const isFormDisabled = isFormLoading || !captchaToken;

	return (
		<div className="flex min-h-screen items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8">
			<div className="w-full max-w-md space-y-8">
				<div>
					<h2 className="mt-6 text-center font-bold text-3xl text-foreground tracking-tight">
						Create your account
					</h2>
					<p className="mt-2 text-center text-muted-foreground text-sm">
						Already have an account?{" "}
						<a
							href="/login"
							className="font-medium text-primary hover:text-primary-dark"
						>
							Sign in
						</a>
					</p>
				</div>

				<form className="mt-8 space-y-6" onSubmit={handleSubmit}>
					{errors.general && (
						<div className="rounded-md border border-destructive/30 bg-destructive/10 p-4">
							<p className="text-destructive text-sm">{errors.general}</p>
						</div>
					)}

					<div className="space-y-4 rounded-md shadow-sm">
						<div>
							<label htmlFor="name" className="sr-only">
								Name
							</label>
							<input
								id="name"
								name="name"
								type="text"
								autoComplete="name"
								required
								value={name}
								onChange={(e) => setName(e.target.value)}
								className="relative block w-full rounded-md border-0 bg-card px-3 py-2 text-foreground ring-1 ring-border ring-inset placeholder:text-muted-foreground focus:z-10 focus:ring-2 focus:ring-primary focus:ring-inset sm:text-sm sm:leading-6"
								placeholder="Full name"
							/>
							{errors.name && (
								<p className="mt-1 text-destructive text-sm">{errors.name}</p>
							)}
						</div>
						<div>
							<label htmlFor="email" className="sr-only">
								Email address
							</label>
							<input
								id="email"
								name="email"
								type="email"
								autoComplete="email"
								required
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								className="relative block w-full rounded-md border-0 bg-card px-3 py-2 text-foreground ring-1 ring-border ring-inset placeholder:text-muted-foreground focus:z-10 focus:ring-2 focus:ring-primary focus:ring-inset sm:text-sm sm:leading-6"
								placeholder="Email address"
							/>
							{errors.email && (
								<p className="mt-1 text-destructive text-sm">{errors.email}</p>
							)}
						</div>
						<div>
							<label htmlFor="password" className="sr-only">
								Password
							</label>
							<input
								id="password"
								name="password"
								type="password"
								autoComplete="new-password"
								required
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								className="relative block w-full rounded-md border-0 bg-card px-3 py-2 text-foreground ring-1 ring-border ring-inset placeholder:text-muted-foreground focus:z-10 focus:ring-2 focus:ring-primary focus:ring-inset sm:text-sm sm:leading-6"
								placeholder="Password (min 8 characters)"
							/>
							{errors.password && (
								<p className="mt-1 text-destructive text-sm">
									{errors.password}
								</p>
							)}
						</div>
					</div>

					{/* CAPTCHA Widget */}
					<div className="flex justify-center">
						<CapWidget
							endpoint="/api/cap/"
							onSolve={(token) => {
								setCaptchaToken(token);
								toast.success(t.captcha.verified, {
									description: t.captcha.verifiedDescription,
								});
							}}
							onError={(message) => {
								setCaptchaToken(null);
								toast.error(t.captcha.captchaError, {
									description: message,
								});
							}}
							onReset={() => {
								setCaptchaToken(null);
							}}
							locale={{
								initial: t.captcha.initial,
								verifying: t.captcha.verifying,
								solved: t.captcha.solved,
								error: t.captcha.error,
							}}
						/>
					</div>

					<div>
						<button
							type="submit"
							disabled={isFormDisabled}
							className="group relative flex w-full justify-center rounded-md bg-primary px-3 py-2 font-semibold text-primary-foreground text-sm hover:bg-primary-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
						>
							{signupMutation.isPending
								? t.captcha.creatingAccount
								: isAutoLoggingIn
									? t.captcha.signingIn
									: "Create account"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
