/**
 * Project tRPC Router
 *
 * Provides API endpoints for project management and cost-value tracking
 * - create: Create a new project with required name
 * - getAll: Get all projects for user's teams with recent costs
 * - getById: Get project details with cost trends and efficiency metrics
 * - updateMetrics: Update project performance metrics (success count, feedback score)
 */

import { TRPCError } from "@trpc/server";
import { subDays } from "date-fns";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";

export const projectRouter = createTRPCRouter({
	/**
	 * Create a new project
	 *
	 * AC #1: Project name is required
	 * Automatically initializes ProjectMetrics with default values
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
			const userId = ctx.session.user.id;

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

			// Create project with metrics
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
			});

			return project;
		}),

	/**
	 * Get all projects for user's teams
	 *
	 * Includes recent 30-day costs for each project
	 */
	getAll: protectedProcedure.query(async ({ ctx }) => {
		const userId = ctx.session.user.id;

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
			const userId = ctx.session.user.id;

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
			const userId = ctx.session.user.id;

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
});
