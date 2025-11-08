"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { useCaptcha } from "~/lib/captcha/useCaptcha";

const loginSchema = z.object({
	email: z.string().email("Invalid email address"),
	password: z.string().min(8, "Password must be at least 8 characters"),
});

export default function LoginPage() {
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [errors, setErrors] = useState<{
		email?: string;
		password?: string;
		general?: string;
	}>({});
	const [isLoading, setIsLoading] = useState(false);
	const { execute: executeCaptcha, isLoading: captchaLoading } = useCaptcha();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setErrors({});
		setIsLoading(true);

		// Validate inputs
		const result = loginSchema.safeParse({ email, password });
		if (!result.success) {
			const fieldErrors = result.error.flatten().fieldErrors;
			setErrors({
				email: fieldErrors.email?.[0],
				password: fieldErrors.password?.[0],
			});
			setIsLoading(false);
			return;
		}

		try {
			// Execute CAPTCHA proof-of-work
			const captchaToken = await executeCaptcha();

			const response = await signIn("credentials", {
				email,
				password,
				captchaToken,
				redirect: false,
			});

			if (response?.error) {
				setErrors({ general: "Invalid email or password" });
				toast.error("로그인 실패", {
					description: "Invalid email or password",
				});
				setIsLoading(false);
				return;
			}

			// Redirect to dashboard on success
			// Note: isLoading remains true during navigation to prevent duplicate clicks
			toast.success("로그인 성공!");
			router.push("/dashboard");
		} catch (error) {
			console.error("Login error:", error);
			const errorMsg =
				error instanceof Error ? error.message : "An unexpected error occurred";
			setErrors({ general: errorMsg });
			toast.error("로그인 실패", {
				description: errorMsg,
			});
			setIsLoading(false);
		}
	};

	const isFormLoading = isLoading || captchaLoading;

	return (
		<div className="flex min-h-screen items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8">
			<div className="w-full max-w-md space-y-8">
				<div>
					<h2 className="mt-6 text-center font-bold text-3xl text-foreground tracking-tight">
						Sign in to your account
					</h2>
					<p className="mt-2 text-center text-muted-foreground text-sm">
						Or{" "}
						<a
							href="/signup"
							className="font-medium text-primary hover:text-primary-dark"
						>
							create a new account
						</a>
					</p>
				</div>

				<form className="mt-8 space-y-6" onSubmit={handleSubmit}>
					{errors.general && (
						<div className="rounded-md border border-destructive/30 bg-destructive/10 p-4">
							<p className="text-destructive text-sm">{errors.general}</p>
						</div>
					)}

					<div className="-space-y-px rounded-md shadow-sm">
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
								className="relative block w-full rounded-t-md border-0 bg-card px-3 py-2 text-foreground ring-1 ring-border ring-inset placeholder:text-muted-foreground focus:z-10 focus:ring-2 focus:ring-primary focus:ring-inset sm:text-sm sm:leading-6"
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
								autoComplete="current-password"
								required
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								className="relative block w-full rounded-b-md border-0 bg-card px-3 py-2 text-foreground ring-1 ring-border ring-inset placeholder:text-muted-foreground focus:z-10 focus:ring-2 focus:ring-primary focus:ring-inset sm:text-sm sm:leading-6"
								placeholder="Password"
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
								? "Verifying security..."
								: isLoading
									? "Signing in..."
									: "Sign in"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
