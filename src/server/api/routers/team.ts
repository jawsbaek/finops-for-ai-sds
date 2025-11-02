/**
 * Team tRPC Router
 *
 * Provides API endpoints for team management
 * - create: Create a new team with owner as first member
 * - getAll: Get all teams where user is a member
 * - getById: Get team details including members and projects
 * - update: Update team information (name, budget, owner)
 * - addMember: Add a member to the team
 * - removeMember: Remove a member from the team
 * - updateMemberRole: Update a member's role
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { logger } from "~/lib/logger";
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

			// Debug: Verify user exists before creating team
			logger.info(
				{
					userId,
					sessionEmail: ctx.session.user.email,
				},
				"Team create: checking user exists",
			);

			const userExists = await db.user.findUnique({
				where: { id: userId },
				select: { id: true, email: true },
			});

			if (!userExists) {
				logger.error(
					{
						userId,
						sessionEmail: ctx.session.user.email,
					},
					"User from session does not exist in database",
				);
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message:
						"세션이 만료되었거나 사용자 정보가 유효하지 않습니다. 다시 로그인해주세요.",
				});
			}

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
					projects: {
						select: {
							id: true,
							name: true,
							description: true,
							createdAt: true,
							_count: {
								select: {
									members: true,
									apiKeys: true,
								},
							},
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
				projects: team.projects.map((p) => ({
					id: p.id,
					name: p.name,
					description: p.description,
					createdAt: p.createdAt,
					memberCount: p._count.members,
					apiKeyCount: p._count.apiKeys,
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

			// Perform all operations in transaction with row locking to prevent race conditions
			const team = await db.$transaction(async (tx) => {
				// 1. Lock and verify user is an owner (SELECT FOR UPDATE prevents concurrent role changes)
				const membershipLock = await tx.$queryRaw<
					Array<{ id: string; role: string }>
				>`
					SELECT id, role FROM team_members
					WHERE team_id = ${input.teamId} AND user_id = ${userId}
					FOR UPDATE
				`;

				if (
					membershipLock.length === 0 ||
					membershipLock[0]?.role !== "owner"
				) {
					throw new TRPCError({
						code: "FORBIDDEN",
						message: "Only team owners can update team information",
					});
				}

				// 2. Check if ownership is being transferred
				const currentTeam = await tx.team.findUnique({
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

				// 3. Validate new owner exists if transferring ownership
				if (isOwnershipTransfer && input.ownerId) {
					const newOwner = await tx.user.findUnique({
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
				if (isOwnershipTransfer && input.ownerId) {
					// Demote all current owners to admin (handles both explicit ownerId and legacy teams)
					const currentOwners = await tx.teamMember.findMany({
						where: {
							teamId: input.teamId,
							role: "owner",
						},
					});

					for (const owner of currentOwners) {
						await tx.teamMember.update({
							where: {
								teamId_userId: {
									teamId: input.teamId,
									userId: owner.userId,
								},
							},
							data: {
								role: "admin",
							},
						});
					}

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
							demotedOwnerCount: currentOwners.length,
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
	 * Add a member to the team by email
	 *
	 * Only team owners and admins can add members
	 */
	addMember: protectedProcedure
		.input(
			z.object({
				teamId: z.string(),
				email: z.string().email(),
				role: z.enum(["member", "admin"]).default("member"),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;

			// Verify requester is owner or admin
			const requesterMembership = await db.teamMember.findUnique({
				where: {
					teamId_userId: {
						teamId: input.teamId,
						userId,
					},
				},
			});

			if (
				!requesterMembership ||
				(requesterMembership.role !== "owner" &&
					requesterMembership.role !== "admin")
			) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Only team owners and admins can add members",
				});
			}

			// Find user by email
			const invitedUser = await db.user.findUnique({
				where: { email: input.email },
			});

			if (!invitedUser) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: `사용자를 찾을 수 없습니다: ${input.email}`,
				});
			}

			// Check if already a member
			const existingMembership = await db.teamMember.findUnique({
				where: {
					teamId_userId: {
						teamId: input.teamId,
						userId: invitedUser.id,
					},
				},
			});

			if (existingMembership) {
				throw new TRPCError({
					code: "CONFLICT",
					message: "이미 팀 멤버입니다",
				});
			}

			// Add member
			const membership = await db.teamMember.create({
				data: {
					teamId: input.teamId,
					userId: invitedUser.id,
					role: input.role,
				},
				include: {
					user: {
						select: {
							id: true,
							email: true,
							name: true,
						},
					},
				},
			});

			logger.info(
				{
					teamId: input.teamId,
					invitedUserId: invitedUser.id,
					invitedEmail: input.email,
					role: input.role,
					invitedBy: userId,
				},
				"Team member added successfully",
			);

			return membership;
		}),

	/**
	 * Remove a member from the team
	 *
	 * Only team owners can remove members
	 */
	removeMember: protectedProcedure
		.input(
			z.object({
				teamId: z.string(),
				userId: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const requesterId = ctx.session.user.id;

			// Verify requester is owner
			const requesterMembership = await db.teamMember.findUnique({
				where: {
					teamId_userId: {
						teamId: input.teamId,
						userId: requesterId,
					},
				},
			});

			if (!requesterMembership || requesterMembership.role !== "owner") {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Only team owners can remove members",
				});
			}

			// Cannot remove team owner
			if (input.userId === requesterId) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "팀 소유자는 팀에서 나갈 수 없습니다",
				});
			}

			// Get all projects for this team
			const teamProjects = await db.project.findMany({
				where: { teamId: input.teamId },
				select: { id: true },
			});

			// Remove member from team and all associated projects
			await db.$transaction([
				// Remove from all team projects
				db.projectMember.deleteMany({
					where: {
						userId: input.userId,
						projectId: { in: teamProjects.map((p) => p.id) },
					},
				}),
				// Remove from team
				db.teamMember.delete({
					where: {
						teamId_userId: {
							teamId: input.teamId,
							userId: input.userId,
						},
					},
				}),
			]);

			logger.info(
				{
					teamId: input.teamId,
					removedUserId: input.userId,
					removedBy: requesterId,
				},
				"Team member removed successfully",
			);

			return {
				success: true,
			};
		}),

	/**
	 * Update member role
	 *
	 * Only team owners can change roles
	 */
	updateMemberRole: protectedProcedure
		.input(
			z.object({
				teamId: z.string(),
				userId: z.string(),
				role: z.enum(["member", "admin", "owner"]),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const requesterId = ctx.session.user.id;

			// Verify requester is owner
			const requesterMembership = await db.teamMember.findUnique({
				where: {
					teamId_userId: {
						teamId: input.teamId,
						userId: requesterId,
					},
				},
			});

			if (!requesterMembership || requesterMembership.role !== "owner") {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Only team owners can change member roles",
				});
			}

			// Cannot change own role
			if (input.userId === requesterId) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "자신의 역할은 변경할 수 없습니다",
				});
			}

			// Update role
			const membership = await db.teamMember.update({
				where: {
					teamId_userId: {
						teamId: input.teamId,
						userId: input.userId,
					},
				},
				data: {
					role: input.role,
				},
				include: {
					user: {
						select: {
							id: true,
							email: true,
							name: true,
						},
					},
				},
			});

			// If promoting to owner, update team.ownerId
			if (input.role === "owner") {
				await db.team.update({
					where: { id: input.teamId },
					data: { ownerId: input.userId },
				});
			}

			logger.info(
				{
					teamId: input.teamId,
					userId: input.userId,
					newRole: input.role,
					changedBy: requesterId,
				},
				"Team member role updated successfully",
			);

			return membership;
		}),
});
