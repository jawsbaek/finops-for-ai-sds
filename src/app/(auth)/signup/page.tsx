"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { useCaptcha } from "~/lib/captcha/useCaptcha";
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
	const { execute: executeCaptcha, isLoading: captchaLoading } = useCaptcha();
	const [isAutoLoggingIn, setIsAutoLoggingIn] = useState(false);

	const signupMutation = api.auth.signup.useMutation({
		onSuccess: async () => {
			// Auto-login after successful signup
			// Need to execute CAPTCHA again for login (tokens are single-use)
			setIsAutoLoggingIn(true);
			try {
				const captchaToken = await executeCaptcha();
				const response = await signIn("credentials", {
					email,
					password,
					captchaToken,
					redirect: false,
				});

				if (response?.ok) {
					// Note: isLoading remains true during navigation to prevent duplicate clicks
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
				}
			} catch (error) {
				// CAPTCHA failed during auto-login
				setErrors({
					general: t.captcha.accountCreatedButLoginFailed,
				});
				toast.error(t.captcha.autoLoginFailed, {
					description: t.captcha.accountCreatedButLoginFailed,
				});
			} finally {
				setIsAutoLoggingIn(false);
			}
		},
		onError: (error) => {
			setErrors({ general: error.message || "Failed to create account" });
			toast.error(t.captcha.signupFailed, {
				description: error.message || "Failed to create account",
			});
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

		try {
			// Execute CAPTCHA proof-of-work
			const captchaToken = await executeCaptcha();

			// Call signup mutation
			signupMutation.mutate({ email, password, name, captchaToken });
		} catch (error) {
			const errorMsg =
				error instanceof Error ? error.message : "CAPTCHA verification failed";
			setErrors({ general: errorMsg });
			toast.error(t.captcha.verificationFailed, {
				description: errorMsg,
			});
		}
	};

	const isFormLoading =
		signupMutation.isPending || captchaLoading || isAutoLoggingIn;

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

					<div>
						<button
							type="submit"
							disabled={isFormLoading}
							className="group relative flex w-full justify-center rounded-md bg-primary px-3 py-2 font-semibold text-primary-foreground text-sm hover:bg-primary-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
						>
							{captchaLoading
								? t.captcha.verifying
								: signupMutation.isPending
									? t.captcha.creatingAccount
									: "Create account"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
