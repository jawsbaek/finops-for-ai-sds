import type { DefaultSession, NextAuthConfig } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
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

				// Find user
				const user = await db.user.findUnique({
					where: { email },
				});

				if (!user) {
					return null;
				}

				// Verify password
				const isValid = await bcrypt.compare(password, user.passwordHash);

				if (!isValid) {
					return null;
				}

				// Return user object
				return {
					id: user.id,
					email: user.email,
					name: user.name,
				};
			},
		}),
	],
	session: {
		strategy: "jwt",
		maxAge: 30 * 24 * 60 * 60, // 30 days
	},
	callbacks: {
		async jwt({ token, user }) {
			if (user) {
				token.id = user.id;
			}
			return token;
		},
		async session({ session, token }) {
			if (token && session.user) {
				session.user.id = token.id as string;
			}
			return session;
		},
	},
	pages: {
		signIn: "/login",
	},
} satisfies NextAuthConfig;
