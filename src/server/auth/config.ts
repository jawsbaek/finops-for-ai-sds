import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcrypt";
import type { DefaultSession, NextAuthConfig } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { z } from "zod";

import { db } from "~/server/db";

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
	interface Session extends DefaultSession {
		user: {
			id: string;
		} & DefaultSession["user"];
	}
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authConfig = {
	adapter: PrismaAdapter(db),
	providers: [
		CredentialsProvider({
			name: "Credentials",
			credentials: {
				email: { label: "Email", type: "email" },
				password: { label: "Password", type: "password" },
			},
			async authorize(credentials) {
				// Validate credentials
				const parsedCredentials = z
					.object({
						email: z.string().email(),
						password: z.string().min(8),
					})
					.safeParse(credentials);

				if (!parsedCredentials.success) {
					return null;
				}

				const { email, password } = parsedCredentials.data;

				// Check recent failed login attempts (last 15 minutes)
				const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
				const recentFailedAttempts = await db.loginAttempt.count({
					where: {
						email,
						successful: false,
						attemptedAt: {
							gte: fifteenMinutesAgo,
						},
					},
				});

				// Block if 5+ failed attempts in last 15 minutes
				if (recentFailedAttempts >= 5) {
					// Log this blocked attempt
					// Note: IP address tracking is currently unavailable in CredentialsProvider
					// NextAuth's authorize function doesn't expose request headers
					// TODO: Implement custom signIn callback to capture real IP addresses
					// See: https://next-auth.js.org/configuration/callbacks#sign-in-callback
					await db.loginAttempt.create({
						data: {
							email,
							ipAddress: "unknown",
							successful: false,
						},
					});
					return null;
				}

				// Find user
				const user = await db.user.findUnique({
					where: { email },
				});

				if (!user) {
					// Log failed attempt (IP tracking limitation noted above)
					await db.loginAttempt.create({
						data: {
							email,
							ipAddress: "unknown",
							successful: false,
						},
					});
					return null;
				}

				// Verify password
				const isValid = await bcrypt.compare(password, user.passwordHash);

				// Log attempt (successful or failed)
				await db.loginAttempt.create({
					data: {
						email,
						ipAddress: "unknown",
						successful: isValid,
					},
				});

				if (!isValid) {
					return null;
				}

				// Return user object for successful login
				return {
					id: user.id,
					email: user.email,
					name: user.name,
				};
			},
		}),
	],
	session: {
		strategy: "database",
		maxAge: 30 * 24 * 60 * 60, // 30 days
		updateAge: 24 * 60 * 60, // Update session every 24 hours
	},
	callbacks: {
		async session({ session, user }) {
			// With database strategy, user comes from database
			if (user && session.user) {
				session.user.id = user.id;
			}
			return session;
		},
	},
	pages: {
		signIn: "/login",
	},
	useSecureCookies: process.env.NODE_ENV === "production",
	cookies: {
		sessionToken: {
			name: `${process.env.NODE_ENV === "production" ? "__Secure-" : ""}next-auth.session-token`,
			options: {
				httpOnly: true,
				sameSite: "lax",
				path: "/",
				secure: process.env.NODE_ENV === "production",
			},
		},
	},
} satisfies NextAuthConfig;
