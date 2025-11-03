/**
 * Project tRPC Router
 *
 * Provides API endpoints for project management and cost-value tracking
 * - create: Create a new project with required name and auto-add creator as member
 * - getAll: Get all projects for user's teams with recent costs
 * - getById: Get project details with cost trends and efficiency metrics
 * - updateMetrics: Update project performance metrics (success count, feedback score)
 * - addMember: Add a member to a project (Team admin only)
 * - removeMember: Remove a member from a project (Team admin only)
 * - getMembers: Get all members of a project
 * - generateApiKey: Add an API key to a project (project member or Team admin)
 * - getApiKeys: Get all API keys for a project
 * - disableApiKey: Disable an API key (project member or Team admin)
 * - enableApiKey: Re-enable a disabled API key (project member or Team admin)
 * - deleteApiKey: Delete an API key permanently (project member or Team admin)
 */

import { TRPCError } from "@trpc/server";
import { subDays } from "date-fns";
import { z } from "zod";
import { extractLast4 } from "~/lib/api-key-utils";
import { logger } from "~/lib/logger";
import { sanitizeInput } from "~/lib/sanitize";
import {
	generateEncryptedApiKey,
	validateApiKey,
} from "~/lib/services/encryption/api-key-manager";
import {
	createTRPCRouter,
	protectedProcedure,
	sensitiveProcedure,
} from "~/server/api/trpc";
import { db } from "~/server/db";

/**
 * Helper: Check if user has access to a project
 * User has access if they are:
 * 1. A member of the project, OR
 * 2. An owner/admin of the project's team
 */
async function ensureProjectAccess(userId: string, projectId: string) {
	const project = await db.project.findUnique({
		where: { id: projectId },
		include: {
			members: {
				where: { userId },
			},
			team: {
				include: {
					members: {
						where: {
							userId,
							role: { in: ["owner", "admin"] },
						},
					},
				},
			},
		},
	});

	if (!project) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Project not found",
		});
	}

	const isProjectMember = project.members.length > 0;
	const isTeamAdmin = project.team.members.length > 0;

	if (!isProjectMember && !isTeamAdmin) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You do not have access to this project",
		});
	}

	return { isProjectMember, isTeamAdmin, project };
}

/**
 * Helper: Check if user is a team admin (owner or admin)
 */
async function ensureTeamAdmin(userId: string, projectId: string) {
	const project = await db.project.findUnique({
		where: { id: projectId },
		include: {
			team: {
				include: {
					members: {
						where: {
							userId,
							role: { in: ["owner", "admin"] },
						},
					},
				},
			},
		},
	});

	if (!project) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Project not found",
		});
	}

	if (project.team.members.length === 0) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "Team admin access required",
		});
	}

	return project;
}

export const projectRouter = createTRPCRouter({
	/**
	 * Create a new project
	 *
	 * AC #1: Project name is required
	 * Automatically initializes ProjectMetrics with default values
	 * Auto-adds creator as first project member
	 */
	create: protectedProcedure
		.input(
			z.object({
				name: z.string().min(1, "Project name is required"),
				description: z.string().optional(),
				teamId: z.string(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const session = ctx.session;
			if (!session?.user) {
				throw new TRPCError({ code: "UNAUTHORIZED" });
			}
			const userId = session.user.id;

			// Verify user has access to the team
			const userTeams = await db.teamMember.findMany({
				where: { userId },
				select: { teamId: true },
			});

			const hasAccess = userTeams.some((tm) => tm.teamId === input.teamId);
			if (!hasAccess) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You do not have access to this team",
				});
			}

			// Create project with metrics and auto-add creator as first member
			const project = await db.project.create({
				data: {
					name: input.name,
					description: input.description,
					teamId: input.teamId,
					metrics: {
						create: {
							successCount: 0,
							feedbackScore: null,
						},
					},
					members: {
						create: {
							userId,
						},
					},
				},
				include: {
					team: {
						select: {
							id: true,
							name: true,
						},
					},
					metrics: true,
					members: {
						include: {
							user: {
								select: {
									id: true,
									email: true,
									name: true,
								},
							},
						},
					},
				},
			});

			return project;
		}),

	/**
	 * Get all projects for user's teams
	 *
	 * Includes recent 30-day costs for each project
	 */
	getAll: protectedProcedure.query(async ({ ctx }) => {
		const session = ctx.session;
		if (!session?.user) {
			throw new TRPCError({ code: "UNAUTHORIZED" });
		}
		const userId = session.user.id;

		// Get user's teams
		const userTeams = await db.teamMember.findMany({
			where: { userId },
			select: { teamId: true },
		});

		const teamIds = userTeams.map((tm) => tm.teamId);

		if (teamIds.length === 0) {
			return [];
		}

		const startDate = subDays(new Date(), 30);

		// Get all projects with team info and metrics (Prisma best practice)
		const projects = await db.project.findMany({
			where: {
				teamId: { in: teamIds },
			},
			include: {
				team: {
					select: {
						id: true,
						name: true,
					},
				},
				metrics: true,
			},
			orderBy: {
				createdAt: "desc",
			},
		});

		// Efficiently aggregate costs per project using groupBy (Prisma best practice)
		const costAggregates = await db.costData.groupBy({
			by: ["projectId"],
			where: {
				projectId: { in: projects.map((p) => p.id) },
				date: {
					gte: startDate,
				},
			},
			_sum: {
				cost: true,
			},
		});

		// Create a map for O(1) lookup
		const costMap = new Map(
			costAggregates.map((agg) => [
				agg.projectId,
				agg._sum.cost?.toNumber() ?? 0,
			]),
		);

		// Combine project data with aggregated costs
		return projects.map((project) => {
			const totalCost = costMap.get(project.id) ?? 0;

			// Calculate efficiency if metrics exist
			const efficiency =
				project.metrics && totalCost > 0
					? project.metrics.successCount / totalCost
					: null;

			return {
				...project,
				totalCost,
				efficiency,
			};
		});
	}),

	/**
	 * Get project details by ID
	 *
	 * AC #3, #5: Includes total cost, task type breakdown, and cost-value metrics
	 */
	getById: protectedProcedure
		.input(
			z.object({
				id: z.string(),
			}),
		)
		.query(async ({ input, ctx }) => {
			const session = ctx.session;
			if (!session?.user) {
				throw new TRPCError({ code: "UNAUTHORIZED" });
			}
			const userId = session.user.id;

			// Get user's teams
			const userTeams = await db.teamMember.findMany({
				where: { userId },
				select: { teamId: true },
			});

			const teamIds = userTeams.map((tm) => tm.teamId);

			const startDate = subDays(new Date(), 30);

			// Get project with all related data
			const project = await db.project.findUnique({
				where: {
					id: input.id,
				},
				include: {
					team: {
						select: {
							id: true,
							name: true,
						},
					},
					members: {
						include: {
							user: {
								select: {
									id: true,
									email: true,
									name: true,
								},
							},
						},
					},
					apiKeys: {
						select: {
							id: true,
							provider: true,
							last4: true, // Security: Only return last 4 chars
							isActive: true,
							createdAt: true,
							// Security: NEVER include encryptedKey, encryptedDataKey, or iv
						},
					},
					metrics: true,
					costData: {
						where: {
							date: {
								gte: startDate,
							},
						},
						select: {
							id: true,
							cost: true,
							date: true,
							taskType: true,
							provider: true,
							service: true,
							tokens: true,
						},
						orderBy: {
							date: "asc",
						},
					},
				},
			});

			if (!project) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Project not found",
				});
			}

			// Verify user has access to this project's team
			if (!teamIds.includes(project.teamId)) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You do not have access to this project",
				});
			}

			// Calculate total cost
			const totalCost = project.costData.reduce(
				(sum, cost) => sum + cost.cost.toNumber(),
				0,
			);

			// Calculate cost breakdown by task type (AC #3)
			const costByTaskType = project.costData.reduce(
				(acc, cost) => {
					const taskType = cost.taskType || "unknown";
					if (!acc[taskType]) {
						acc[taskType] = 0;
					}
					acc[taskType] += cost.cost.toNumber();
					return acc;
				},
				{} as Record<string, number>,
			);

			// Calculate efficiency (AC #5)
			const efficiency =
				project.metrics && totalCost > 0
					? project.metrics.successCount / totalCost
					: null;

			// Prepare cost-value time series data (AC #5)
			const costValueData = project.costData.map((cost) => ({
				date: cost.date,
				cost: cost.cost.toNumber(),
				// Value approximation based on metrics at the time
				// In a real scenario, this would track metrics over time
				value: project.metrics ? project.metrics.successCount : 0,
			}));

			return {
				...project,
				// apiKeys already include only safe fields (last4, no encrypted data)
				apiKeys: project.apiKeys,
				costData: project.costData.map((cost) => ({
					...cost,
					cost: cost.cost.toNumber(),
				})),
				totalCost,
				costByTaskType,
				efficiency,
				costValueData,
			};
		}),

	/**
	 * Update project performance metrics
	 *
	 * AC #4: Allows updating success count and feedback score
	 */
	updateMetrics: protectedProcedure
		.input(
			z.object({
				projectId: z.string(),
				successCount: z.number().int().min(0),
				feedbackScore: z.number().min(1).max(5).optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const session = ctx.session;
			if (!session?.user) {
				throw new TRPCError({ code: "UNAUTHORIZED" });
			}
			const userId = session.user.id;

			// Get user's teams
			const userTeams = await db.teamMember.findMany({
				where: { userId },
				select: { teamId: true },
			});

			const teamIds = userTeams.map((tm) => tm.teamId);

			// Verify project exists and user has access
			const project = await db.project.findUnique({
				where: {
					id: input.projectId,
				},
				select: {
					id: true,
					teamId: true,
				},
			});

			if (!project) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Project not found",
				});
			}

			if (!teamIds.includes(project.teamId)) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You do not have access to this project",
				});
			}

			// Update or create metrics
			const metrics = await db.projectMetrics.upsert({
				where: {
					projectId: input.projectId,
				},
				update: {
					successCount: input.successCount,
					feedbackScore: input.feedbackScore,
				},
				create: {
					projectId: input.projectId,
					successCount: input.successCount,
					feedbackScore: input.feedbackScore,
				},
			});

			return metrics;
		}),

	/**
	 * Add a member to a project
	 * Only Team owner/admin can add members
	 *
	 * Security: Rate limited to prevent abuse
	 */
	addMember: sensitiveProcedure
		.input(
			z.object({
				projectId: z.string(),
				userId: z.string(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const session = ctx.session;
			if (!session?.user) {
				throw new TRPCError({ code: "UNAUTHORIZED" });
			}
			const userId = session.user.id;

			// Only Team admin can add members
			await ensureTeamAdmin(userId, input.projectId);

			// Check if user exists
			const user = await db.user.findUnique({
				where: { id: input.userId },
				select: { id: true, email: true },
			});

			if (!user) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "User not found",
				});
			}

			// Check if already a member
			const existingMember = await db.projectMember.findUnique({
				where: {
					projectId_userId: {
						projectId: input.projectId,
						userId: input.userId,
					},
				},
			});

			if (existingMember) {
				throw new TRPCError({
					code: "CONFLICT",
					message: "User is already a member of this project",
				});
			}

			// Add member
			const member = await db.projectMember.create({
				data: {
					projectId: input.projectId,
					userId: input.userId,
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
					projectId: input.projectId,
					newMemberId: input.userId,
					addedBy: userId,
				},
				"Project member added",
			);

			return member;
		}),

	/**
	 * Remove a member from a project
	 * Only Team owner/admin can remove members
	 *
	 * Security: Rate limited to prevent abuse
	 */
	removeMember: sensitiveProcedure
		.input(
			z.object({
				projectId: z.string(),
				userId: z.string(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const session = ctx.session;
			if (!session?.user) {
				throw new TRPCError({ code: "UNAUTHORIZED" });
			}
			const userId = session.user.id;

			// Only Team admin can remove members
			await ensureTeamAdmin(userId, input.projectId);

			// Check if member exists
			const member = await db.projectMember.findUnique({
				where: {
					projectId_userId: {
						projectId: input.projectId,
						userId: input.userId,
					},
				},
			});

			if (!member) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "User is not a member of this project",
				});
			}

			// Remove member
			await db.projectMember.delete({
				where: {
					projectId_userId: {
						projectId: input.projectId,
						userId: input.userId,
					},
				},
			});

			logger.info(
				{
					projectId: input.projectId,
					removedMemberId: input.userId,
					removedBy: userId,
				},
				"Project member removed",
			);

			return { success: true };
		}),

	/**
	 * Get all members of a project
	 * Project member or Team admin can view
	 */
	getMembers: protectedProcedure
		.input(
			z.object({
				projectId: z.string(),
			}),
		)
		.query(async ({ input, ctx }) => {
			const session = ctx.session;
			if (!session?.user) {
				throw new TRPCError({ code: "UNAUTHORIZED" });
			}
			const userId = session.user.id;

			// Ensure user has access to project
			await ensureProjectAccess(userId, input.projectId);

			// Get all members
			const members = await db.projectMember.findMany({
				where: {
					projectId: input.projectId,
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
				orderBy: {
					createdAt: "asc",
				},
			});

			return members;
		}),

	/**
	 * Generate and store an encrypted API key for the project
	 * Project member or Team admin can add API keys
	 *
	 * Security: Rate limited to 10 requests/min, stores only last4 chars for display
	 */
	generateApiKey: sensitiveProcedure
		.input(
			z.object({
				projectId: z.string(),
				provider: z.literal("openai"),
				apiKey: z.string().min(1, "API key is required"),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const session = ctx.session;
			if (!session?.user) {
				throw new TRPCError({ code: "UNAUTHORIZED" });
			}
			const userId = session.user.id;

			// Ensure user has access to project
			await ensureProjectAccess(userId, input.projectId);

			// Validate API key format (fast fail before expensive operations)
			const isValid = validateApiKey(input.apiKey, input.provider);
			if (!isValid) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `Invalid ${input.provider} API key format`,
				});
			}

			// Extract last 4 characters for display (security: never send encrypted key to client)
			const last4 = extractLast4(input.apiKey);

			// Encrypt the API key using KMS envelope encryption
			const encrypted = await generateEncryptedApiKey(input.apiKey);

			// Store encrypted key in database
			const apiKey = await db.apiKey.create({
				data: {
					projectId: input.projectId,
					provider: input.provider,
					encryptedKey: encrypted.ciphertext,
					encryptedDataKey: encrypted.encryptedDataKey,
					iv: encrypted.iv,
					last4, // Security: Only store last 4 chars for display
					isActive: true,
				},
			});

			logger.info(
				{
					apiKeyId: apiKey.id,
					projectId: input.projectId,
					provider: input.provider,
					userId,
				},
				"API key added to project",
			);

			return apiKey;
		}),

	/**
	 * Get all API keys for a project
	 * Project member or Team admin can view
	 *
	 * Security: Returns only last4 chars, never exposes encrypted key
	 */
	getApiKeys: protectedProcedure
		.input(
			z.object({
				projectId: z.string(),
			}),
		)
		.query(async ({ input, ctx }) => {
			const session = ctx.session;
			if (!session?.user) {
				throw new TRPCError({ code: "UNAUTHORIZED" });
			}
			const userId = session.user.id;

			// Ensure user has access to project
			await ensureProjectAccess(userId, input.projectId);

			// Get all API keys
			const apiKeys = await db.apiKey.findMany({
				where: {
					projectId: input.projectId,
				},
				select: {
					id: true,
					provider: true,
					last4: true, // Security: Only return last 4 chars
					isActive: true,
					createdAt: true,
					updatedAt: true,
					// Security: NEVER include encryptedKey, encryptedDataKey, or iv
				},
				orderBy: {
					createdAt: "desc",
				},
			});

			return apiKeys;
		}),

	/**
	 * Disable an API key with audit logging
	 * Project member or Team admin can disable
	 *
	 * Security: Rate limited, input sanitized
	 */
	disableApiKey: sensitiveProcedure
		.input(
			z.object({
				apiKeyId: z.string(),
				reason: z
					.string()
					.min(1, "Reason is required")
					.transform(sanitizeInput),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const session = ctx.session;
			if (!session?.user) {
				throw new TRPCError({ code: "UNAUTHORIZED" });
			}
			const userId = session.user.id;

			// Get API key with project info
			const apiKey = await db.apiKey.findUnique({
				where: { id: input.apiKeyId },
				include: {
					project: {
						select: {
							id: true,
							teamId: true,
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

			// Ensure user has access to the project
			await ensureProjectAccess(userId, apiKey.project.id);

			// Disable the API key
			const updated = await db.apiKey.update({
				where: { id: input.apiKeyId },
				data: { isActive: false },
			});

			// Create audit log
			await db.auditLog.create({
				data: {
					userId,
					actionType: "api_key_disabled",
					resourceType: "api_key",
					resourceId: input.apiKeyId,
					metadata: {
						reason: input.reason,
						projectId: apiKey.project.id,
						provider: apiKey.provider,
					},
				},
			});

			logger.info(
				{
					apiKeyId: input.apiKeyId,
					projectId: apiKey.project.id,
					userId,
					reason: input.reason,
				},
				"API key disabled",
			);

			return updated;
		}),

	/**
	 * Enable an API key with audit logging
	 * Project member or Team admin can enable
	 *
	 * Security: Rate limited, input sanitized
	 */
	enableApiKey: sensitiveProcedure
		.input(
			z.object({
				apiKeyId: z.string(),
				reason: z
					.string()
					.optional()
					.transform((val) => (val ? sanitizeInput(val) : val)),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const session = ctx.session;
			if (!session?.user) {
				throw new TRPCError({ code: "UNAUTHORIZED" });
			}
			const userId = session.user.id;

			// Get API key with project info
			const apiKey = await db.apiKey.findUnique({
				where: { id: input.apiKeyId },
				include: {
					project: {
						select: {
							id: true,
							teamId: true,
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

			// Ensure user has access to the project
			await ensureProjectAccess(userId, apiKey.project.id);

			// Enable the API key
			const updated = await db.apiKey.update({
				where: { id: input.apiKeyId },
				data: { isActive: true },
			});

			// Create audit log
			await db.auditLog.create({
				data: {
					userId,
					actionType: "api_key_enabled",
					resourceType: "api_key",
					resourceId: input.apiKeyId,
					metadata: {
						reason: input.reason || "Re-enabled API key",
						projectId: apiKey.project.id,
						provider: apiKey.provider,
					},
				},
			});

			logger.info(
				{
					apiKeyId: input.apiKeyId,
					projectId: apiKey.project.id,
					userId,
					reason: input.reason,
				},
				"API key enabled",
			);

			return updated;
		}),

	/**
	 * Delete an API key permanently with audit logging
	 * Project member or Team admin can delete
	 *
	 * Note: CostData.apiKeyId is nullable, so cascade deletion is safe
	 * Security: Rate limited, input sanitized
	 */
	deleteApiKey: sensitiveProcedure
		.input(
			z.object({
				apiKeyId: z.string(),
				reason: z
					.string()
					.min(1, "Reason is required")
					.transform(sanitizeInput),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const session = ctx.session;
			if (!session?.user) {
				throw new TRPCError({ code: "UNAUTHORIZED" });
			}
			const userId = session.user.id;

			// Get API key with project info
			const apiKey = await db.apiKey.findUnique({
				where: { id: input.apiKeyId },
				include: {
					project: {
						select: {
							id: true,
							teamId: true,
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

			// Ensure user has access to the project
			await ensureProjectAccess(userId, apiKey.project.id);

			// Create audit log before deletion
			await db.auditLog.create({
				data: {
					userId,
					actionType: "api_key_deleted",
					resourceType: "api_key",
					resourceId: input.apiKeyId,
					metadata: {
						reason: input.reason,
						projectId: apiKey.project.id,
						provider: apiKey.provider,
						wasActive: apiKey.isActive,
					},
				},
			});

			// Delete the API key (hard delete)
			// CostData.apiKeyId is nullable, so historical cost data is preserved
			await db.apiKey.delete({
				where: { id: input.apiKeyId },
			});

			logger.info(
				{
					apiKeyId: input.apiKeyId,
					projectId: apiKey.project.id,
					userId,
					reason: input.reason,
					wasActive: apiKey.isActive,
				},
				"API key deleted",
			);

			return { success: true };
		}),
});
