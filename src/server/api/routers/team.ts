/**
 * Team tRPC Router
 *
 * Provides API endpoints for team management and API key operations
 * - create: Create a new team with owner as first member
 * - getAll: Get all teams where user is a member
 * - getById: Get team details including members and API keys
 * - update: Update team information (name, budget, owner)
 * - generateApiKey: Create and encrypt a new API key for the team
 * - listApiKeys: List all API keys for a team
 * - disableApiKey: Disable an API key with audit logging
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { logger } from "~/lib/logger";
import {
	decryptApiKey,
	generateEncryptedApiKey,
	validateApiKey,
} from "~/lib/services/encryption/api-key-manager";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";

export const teamRouter = createTRPCRouter({
	/**
	 * Create a new team
	 *
	 * Creates a team and automatically adds the creator as the first member with 'owner' role
	 * The creator is always set as the team owner to ensure consistency between
	 * Team.ownerId and TeamMember.role
	 */
	create: protectedProcedure
		.input(
			z.object({
				name: z.string().min(1, "Team name is required"),
				budget: z.number().positive().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;

			// Create team and add creator as owner in a transaction
			const team = await db.$transaction(async (tx) => {
				const newTeam = await tx.team.create({
					data: {
						name: input.name,
						ownerId: userId,
						budget: input.budget,
					},
				});

				// Add creator as team owner
				await tx.teamMember.create({
					data: {
						teamId: newTeam.id,
						userId: userId,
						role: "owner",
					},
				});

				return newTeam;
			});

			logger.info(
				{
					teamId: team.id,
					teamName: team.name,
					userId,
				},
				"Team created successfully",
			);

			return team;
		}),

	/**
	 * Get all teams for the current user
	 *
	 * Returns teams where the user is a member, including role and member count
	 */
	getAll: protectedProcedure.query(async ({ ctx }) => {
		const userId = ctx.session.user.id;

		const teamMemberships = await db.teamMember.findMany({
			where: { userId },
			include: {
				team: {
					include: {
						_count: {
							select: {
								members: true,
								apiKeys: true,
							},
						},
					},
				},
			},
			orderBy: {
				team: {
					createdAt: "desc",
				},
			},
		});

		return teamMemberships.map((membership) => ({
			id: membership.team.id,
			name: membership.team.name,
			ownerId: membership.team.ownerId,
			budget: membership.team.budget?.toNumber(),
			role: membership.role,
			memberCount: membership.team._count.members,
			apiKeyCount: membership.team._count.apiKeys,
			createdAt: membership.team.createdAt,
			updatedAt: membership.team.updatedAt,
		}));
	}),

	/**
	 * Get team by ID
	 *
	 * Returns team details including members and API keys (masked)
	 * User must be a member of the team to access
	 */
	getById: protectedProcedure
		.input(
			z.object({
				teamId: z.string(),
			}),
		)
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;

			// Verify user is a member of this team
			const membership = await db.teamMember.findUnique({
				where: {
					teamId_userId: {
						teamId: input.teamId,
						userId,
					},
				},
			});

			if (!membership) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You do not have access to this team",
				});
			}

			// Get team details
			const team = await db.team.findUnique({
				where: { id: input.teamId },
				include: {
					members: {
						include: {
							user: {
								select: {
									id: true,
									name: true,
									email: true,
								},
							},
						},
						orderBy: {
							createdAt: "asc",
						},
					},
					apiKeys: {
						where: {
							isActive: true,
						},
						select: {
							id: true,
							provider: true,
							isActive: true,
							createdAt: true,
							updatedAt: true,
							encryptedKey: true, // We'll mask this
						},
						orderBy: {
							createdAt: "desc",
						},
					},
				},
			});

			if (!team) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Team not found",
				});
			}

			return {
				id: team.id,
				name: team.name,
				ownerId: team.ownerId,
				budget: team.budget?.toNumber(),
				createdAt: team.createdAt,
				updatedAt: team.updatedAt,
				members: team.members.map((m) => ({
					id: m.id,
					userId: m.userId,
					role: m.role,
					user: m.user,
					createdAt: m.createdAt,
				})),
				apiKeys: team.apiKeys.map((key) => ({
					id: key.id,
					provider: key.provider,
					isActive: key.isActive,
					// Mask the encrypted key - use generic placeholder to avoid exposing encryption patterns
					maskedKey: "sk-••••••••••••••••••••",
					createdAt: key.createdAt,
					updatedAt: key.updatedAt,
				})),
			};
		}),

	/**
	 * Update team information
	 *
	 * Only team owners can update team information
	 */
	update: protectedProcedure
		.input(
			z.object({
				teamId: z.string(),
				name: z.string().min(1).optional(),
				ownerId: z.string().optional(),
				budget: z.number().positive().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;

			// Verify user is an owner of this team
			const membership = await db.teamMember.findUnique({
				where: {
					teamId_userId: {
						teamId: input.teamId,
						userId,
					},
				},
			});

			if (!membership || membership.role !== "owner") {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Only team owners can update team information",
				});
			}

			// Check if ownership is being transferred
			const currentTeam = await db.team.findUnique({
				where: { id: input.teamId },
				select: { ownerId: true },
			});

			if (!currentTeam) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Team not found",
				});
			}

			const isOwnershipTransfer =
				input.ownerId && input.ownerId !== currentTeam.ownerId;

			// Validate new owner exists if transferring ownership
			if (isOwnershipTransfer && input.ownerId) {
				const newOwner = await db.user.findUnique({
					where: { id: input.ownerId },
					select: { id: true },
				});

				if (!newOwner) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "New owner user does not exist",
					});
				}
			}

			// Update team with ownership transfer logic
			const team = await db.$transaction(async (tx) => {
				// Update team record
				const updatedTeam = await tx.team.update({
					where: { id: input.teamId },
					data: {
						...(input.name && { name: input.name }),
						...(input.ownerId && { ownerId: input.ownerId }),
						...(input.budget !== undefined && { budget: input.budget }),
					},
				});

				// If ownership is being transferred, update team member roles
				if (isOwnershipTransfer && input.ownerId && currentTeam.ownerId) {
					// Demote current owner to admin
					await tx.teamMember.update({
						where: {
							teamId_userId: {
								teamId: input.teamId,
								userId: currentTeam.ownerId,
							},
						},
						data: {
							role: "admin",
						},
					});

					// Check if new owner is already a member
					const newOwnerMembership = await tx.teamMember.findUnique({
						where: {
							teamId_userId: {
								teamId: input.teamId,
								userId: input.ownerId,
							},
						},
					});

					if (newOwnerMembership) {
						// Promote existing member to owner
						await tx.teamMember.update({
							where: {
								teamId_userId: {
									teamId: input.teamId,
									userId: input.ownerId,
								},
							},
							data: {
								role: "owner",
							},
						});
					} else {
						// Add new owner as team member
						await tx.teamMember.create({
							data: {
								teamId: input.teamId,
								userId: input.ownerId,
								role: "owner",
							},
						});
					}

					logger.info(
						{
							teamId: input.teamId,
							previousOwnerId: currentTeam.ownerId,
							newOwnerId: input.ownerId,
							userId,
						},
						"Team ownership transferred successfully",
					);
				}

				return updatedTeam;
			});

			logger.info(
				{
					teamId: team.id,
					userId,
					updates: input,
				},
				"Team updated successfully",
			);

			return {
				id: team.id,
				name: team.name,
				ownerId: team.ownerId,
				budget: team.budget?.toNumber(),
				updatedAt: team.updatedAt,
			};
		}),

	/**
	 * Generate and store an encrypted API key for the team
	 *
	 * Enforces constraint: Each team can have only one active API key per provider
	 * Uses KMS envelope encryption to securely store the API key
	 */
	generateApiKey: protectedProcedure
		.input(
			z.object({
				teamId: z.string(),
				provider: z.literal("openai"),
				apiKey: z.string().min(1, "API key is required"),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;

			// Verify user is an owner of this team
			const membership = await db.teamMember.findUnique({
				where: {
					teamId_userId: {
						teamId: input.teamId,
						userId,
					},
				},
			});

			if (!membership || membership.role !== "owner") {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Only team owners can generate API keys",
				});
			}

			// Validate API key format
			const isValid = validateApiKey(input.apiKey, input.provider);
			if (!isValid) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `Invalid ${input.provider} API key format`,
				});
			}

			// Encrypt the API key using KMS envelope encryption (before transaction)
			const encrypted = await generateEncryptedApiKey(input.apiKey);

			// Check for existing key and create new one in transaction to prevent race condition
			const apiKey = await db.$transaction(async (tx) => {
				// Check if team already has an active API key for this provider
				const existingKey = await tx.apiKey.findFirst({
					where: {
						teamId: input.teamId,
						provider: input.provider,
						isActive: true,
					},
				});

				if (existingKey) {
					throw new TRPCError({
						code: "CONFLICT",
						message:
							"Team already has an active API key for this provider. Please disable the existing key first.",
					});
				}

				// Store encrypted key in database
				return await tx.apiKey.create({
					data: {
						teamId: input.teamId,
						provider: input.provider,
						encryptedKey: encrypted.ciphertext,
						encryptedDataKey: encrypted.encryptedDataKey,
						iv: encrypted.iv,
						isActive: true,
					},
				});
			});

			logger.info(
				{
					apiKeyId: apiKey.id,
					teamId: input.teamId,
					provider: input.provider,
					userId,
				},
				"API key generated and encrypted successfully",
			);

			return {
				id: apiKey.id,
				provider: apiKey.provider,
				maskedKey: `****${encrypted.ciphertext.slice(-4)}`,
				createdAt: apiKey.createdAt,
			};
		}),

	/**
	 * List all API keys for a team
	 *
	 * Returns both active and inactive keys with masked values
	 */
	listApiKeys: protectedProcedure
		.input(
			z.object({
				teamId: z.string(),
			}),
		)
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;

			// Verify user is a member of this team
			const membership = await db.teamMember.findUnique({
				where: {
					teamId_userId: {
						teamId: input.teamId,
						userId,
					},
				},
			});

			if (!membership) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You do not have access to this team",
				});
			}

			const apiKeys = await db.apiKey.findMany({
				where: {
					teamId: input.teamId,
				},
				orderBy: {
					createdAt: "desc",
				},
			});

			return apiKeys.map((key) => ({
				id: key.id,
				provider: key.provider,
				isActive: key.isActive,
				maskedKey: "sk-••••••••••••••••••••",
				createdAt: key.createdAt,
				updatedAt: key.updatedAt,
			}));
		}),

	/**
	 * Disable an API key
	 *
	 * Immediately disables an API key to prevent further cost accumulation
	 * Records action in audit log
	 */
	disableApiKey: protectedProcedure
		.input(
			z.object({
				apiKeyId: z.string(),
				reason: z.string().min(1, "Reason is required"),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;

			// Verify API key exists and get team info
			const apiKey = await db.apiKey.findUnique({
				where: { id: input.apiKeyId },
				include: {
					team: {
						select: {
							id: true,
							name: true,
						},
					},
				},
			});

			if (!apiKey) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "API key not found",
				});
			}

			// Verify user is an owner of this team
			const membership = await db.teamMember.findUnique({
				where: {
					teamId_userId: {
						teamId: apiKey.teamId,
						userId,
					},
				},
			});

			if (!membership || membership.role !== "owner") {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Only team owners can disable API keys",
				});
			}

			// Store previous state for audit
			const previousState = {
				isActive: apiKey.isActive,
			};

			// Disable API key and create audit log in transaction
			await db.$transaction(async (tx) => {
				// Disable the API key
				await tx.apiKey.update({
					where: { id: input.apiKeyId },
					data: {
						isActive: false,
					},
				});

				// Create audit log
				await tx.auditLog.create({
					data: {
						userId,
						actionType: "api_key_disabled",
						resourceType: "api_key",
						resourceId: input.apiKeyId,
						metadata: {
							reason: input.reason,
							previousState,
							teamId: apiKey.teamId,
						},
					},
				});
			});

			logger.info(
				{
					apiKeyId: input.apiKeyId,
					teamId: apiKey.teamId,
					userId,
					reason: input.reason,
				},
				"API key disabled successfully",
			);

			return {
				success: true,
			};
		}),
});
