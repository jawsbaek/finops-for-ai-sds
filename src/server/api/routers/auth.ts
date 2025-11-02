import { TRPCError } from "@trpc/server";
import bcrypt from "bcrypt";
import { z } from "zod";
import {
	createTRPCRouter,
	protectedProcedure,
	publicProcedure,
} from "~/server/api/trpc";

const BCRYPT_ROUNDS = 10;

export const authRouter = createTRPCRouter({
	signup: publicProcedure
		.input(
			z.object({
				email: z.string().email(),
				password: z.string().min(8, "Password must be at least 8 characters"),
				name: z.string().optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const { email, password, name } = input;

			// Check if user already exists
			const existingUser = await ctx.db.user.findUnique({
				where: { email },
			});

			if (existingUser) {
				throw new TRPCError({
					code: "CONFLICT",
					message: "User with this email already exists",
				});
			}

			// Hash password
			const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

			// Create user with default team
			// Fix: Automatically create a personal team for new users
			// This ensures users can immediately create projects
			const user = await ctx.db.user.create({
				data: {
					email,
					passwordHash,
					name,
					teamMemberships: {
						create: {
							role: "owner",
							team: {
								create: {
									name: `${name || email.split("@")[0]}'s Team`,
								},
							},
						},
					},
				},
				select: {
					id: true,
					email: true,
					name: true,
					createdAt: true,
					teamMemberships: {
						include: {
							team: true,
						},
					},
				},
			});

			return {
				success: true,
				user: {
					id: user.id,
					email: user.email,
					name: user.name,
					createdAt: user.createdAt,
				},
			};
		}),

	login: publicProcedure
		.input(
			z.object({
				email: z.string().email(),
				password: z.string(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const { email, password } = input;

			// Find user
			const user = await ctx.db.user.findUnique({
				where: { email },
			});

			if (!user) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "Invalid email or password",
				});
			}

			// Verify password
			const isValid = await bcrypt.compare(password, user.passwordHash);

			if (!isValid) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "Invalid email or password",
				});
			}

			return {
				success: true,
				user: {
					id: user.id,
					email: user.email,
					name: user.name,
				},
			};
		}),

	/**
	 * Get current user with team memberships
	 */
	getMe: protectedProcedure.query(async ({ ctx }) => {
		const userId = ctx.session.user.id;

		const user = await ctx.db.user.findUnique({
			where: { id: userId },
			include: {
				teamMemberships: {
					include: {
						team: {
							select: {
								id: true,
								name: true,
							},
						},
					},
				},
			},
		});

		if (!user) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: "User not found",
			});
		}

		return {
			id: user.id,
			email: user.email,
			name: user.name,
			teamMemberships: user.teamMemberships.map((tm) => ({
				teamId: tm.teamId,
				team: tm.team,
				role: tm.role,
			})),
		};
	}),
});
