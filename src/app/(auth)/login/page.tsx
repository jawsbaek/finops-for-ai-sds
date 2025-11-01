"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";

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
			const response = await signIn("credentials", {
				email,
				password,
				redirect: false,
			});

			if (response?.error) {
				setErrors({ general: "Invalid email or password" });
				setIsLoading(false);
				return;
			}

			// Redirect to dashboard on success
			router.push("/dashboard");
		} catch (error) {
			console.error("Login error:", error);
			setErrors({ general: "An unexpected error occurred" });
			setIsLoading(false);
		}
	};

	return (
		<div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
			<div className="w-full max-w-md space-y-8">
				<div>
					<h2 className="mt-6 text-center font-bold text-3xl text-gray-900 tracking-tight">
						Sign in to your account
					</h2>
					<p className="mt-2 text-center text-gray-600 text-sm">
						Or{" "}
						<a
							href="/signup"
							className="font-medium text-blue-600 hover:text-blue-500"
						>
							create a new account
						</a>
					</p>
				</div>

				<form className="mt-8 space-y-6" onSubmit={handleSubmit}>
					{errors.general && (
						<div className="rounded-md bg-red-50 p-4">
							<p className="text-red-800 text-sm">{errors.general}</p>
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
								className="relative block w-full rounded-t-md border-0 px-3 py-2 text-gray-900 ring-1 ring-gray-300 ring-inset placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-blue-600 focus:ring-inset sm:text-sm sm:leading-6"
								placeholder="Email address"
							/>
							{errors.email && (
								<p className="mt-1 text-red-600 text-sm">{errors.email}</p>
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
								className="relative block w-full rounded-b-md border-0 px-3 py-2 text-gray-900 ring-1 ring-gray-300 ring-inset placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-blue-600 focus:ring-inset sm:text-sm sm:leading-6"
								placeholder="Password"
							/>
							{errors.password && (
								<p className="mt-1 text-red-600 text-sm">{errors.password}</p>
							)}
						</div>
					</div>

					<div>
						<button
							type="submit"
							disabled={isLoading}
							className="group relative flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 font-semibold text-sm text-white hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
						>
							{isLoading ? "Signing in..." : "Sign in"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
