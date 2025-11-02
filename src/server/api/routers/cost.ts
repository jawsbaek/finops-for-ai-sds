/**
 * Cost tRPC Router
 *
 * Provides API endpoints for cost data queries
 * - getSummary: Get yesterday's and this week's total costs
 * - getRecentCosts: Get recent cost data for charts/analysis
 */

import { TRPCError } from "@trpc/server";
import { endOfDay, startOfWeek, subDays } from "date-fns";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";

export const costRouter = createTRPCRouter({
	/**
	 * Get cost summary (yesterday, this week, and this month)
	 *
	 * Returns:
	 * - yesterdayCost: Total cost for yesterday
	 * - thisWeekCost: Total cost for current week (Monday-today)
	 * - weeklyChange: Percentage change from last week
	 * - thisMonthCost: Total cost for current month
	 * - monthlyChange: Percentage change from last month
	 */
	getSummary: protectedProcedure
		.input(
			z.object({
				teamId: z.string().optional(),
			}),
		)
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;

			// Get user's teams
			const userTeams = await db.teamMember.findMany({
				where: { userId },
				select: { teamId: true },
			});

			// If teamId is specified, verify user has access to it
			if (input.teamId) {
				const hasAccess = userTeams.some((tm) => tm.teamId === input.teamId);
				if (!hasAccess) {
					throw new TRPCError({
						code: "FORBIDDEN",
						message: "You do not have access to this team",
					});
				}
			}

			const teamIds = input.teamId
				? [input.teamId]
				: userTeams.map((tm) => tm.teamId);

			if (teamIds.length === 0) {
				return {
					yesterdayCost: 0,
					thisWeekCost: 0,
					weeklyChange: 0,
					thisMonthCost: 0,
					monthlyChange: 0,
				};
			}

			const now = new Date();
			const yesterday = subDays(now, 1);
			const yesterdayStart = new Date(yesterday.setHours(0, 0, 0, 0));
			const yesterdayEnd = new Date(yesterday.setHours(23, 59, 59, 999));

			// This week (Monday to today)
			const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
			const weekEnd = endOfDay(now);

			// Last week (for comparison)
			const lastWeekStart = subDays(weekStart, 7);
			const lastWeekEnd = subDays(weekEnd, 7);

			// This month (1st to today)
			const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
			const monthEnd = endOfDay(now);

			// Last month (for comparison)
			const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
			const lastMonthEnd = new Date(
				now.getFullYear(),
				now.getMonth(),
				0,
				23,
				59,
				59,
				999,
			);

			// Query yesterday's cost
			const yesterdayData = await db.costData.aggregate({
				where: {
					teamId: { in: teamIds },
					date: {
						gte: yesterdayStart,
						lte: yesterdayEnd,
					},
				},
				_sum: {
					cost: true,
				},
			});

			// Query this week's cost
			const thisWeekData = await db.costData.aggregate({
				where: {
					teamId: { in: teamIds },
					date: {
						gte: weekStart,
						lte: weekEnd,
					},
				},
				_sum: {
					cost: true,
				},
			});

			// Query last week's cost for comparison
			const lastWeekData = await db.costData.aggregate({
				where: {
					teamId: { in: teamIds },
					date: {
						gte: lastWeekStart,
						lte: lastWeekEnd,
					},
				},
				_sum: {
					cost: true,
				},
			});

			// Query this month's cost
			const thisMonthData = await db.costData.aggregate({
				where: {
					teamId: { in: teamIds },
					date: {
						gte: monthStart,
						lte: monthEnd,
					},
				},
				_sum: {
					cost: true,
				},
			});

			// Query last month's cost for comparison
			const lastMonthData = await db.costData.aggregate({
				where: {
					teamId: { in: teamIds },
					date: {
						gte: lastMonthStart,
						lte: lastMonthEnd,
					},
				},
				_sum: {
					cost: true,
				},
			});

			const yesterdayCost = yesterdayData._sum.cost?.toNumber() ?? 0;
			const thisWeekCost = thisWeekData._sum.cost?.toNumber() ?? 0;
			const lastWeekCost = lastWeekData._sum.cost?.toNumber() ?? 0;
			const thisMonthCost = thisMonthData._sum.cost?.toNumber() ?? 0;
			const lastMonthCost = lastMonthData._sum.cost?.toNumber() ?? 0;

			// Calculate weekly change percentage
			const weeklyChange =
				lastWeekCost > 0
					? ((thisWeekCost - lastWeekCost) / lastWeekCost) * 100
					: 0;

			// Calculate monthly change percentage
			const monthlyChange =
				lastMonthCost > 0
					? ((thisMonthCost - lastMonthCost) / lastMonthCost) * 100
					: 0;

			return {
				yesterdayCost,
				thisWeekCost,
				weeklyChange,
				thisMonthCost,
				monthlyChange,
			};
		}),

	/**
	 * Get recent costs for charts and analysis
	 *
	 * Returns daily cost breakdown for the specified number of days
	 */
	getRecentCosts: protectedProcedure
		.input(
			z.object({
				teamId: z.string().optional(),
				days: z.number().min(1).max(90).default(7),
			}),
		)
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;

			// Get user's teams
			const userTeams = await db.teamMember.findMany({
				where: { userId },
				select: { teamId: true },
			});

			// If teamId is specified, verify user has access to it
			if (input.teamId) {
				const hasAccess = userTeams.some((tm) => tm.teamId === input.teamId);
				if (!hasAccess) {
					throw new TRPCError({
						code: "FORBIDDEN",
						message: "You do not have access to this team",
					});
				}
			}

			const teamIds = input.teamId
				? [input.teamId]
				: userTeams.map((tm) => tm.teamId);

			if (teamIds.length === 0) {
				return [];
			}

			const startDate = subDays(new Date(), input.days);

			const costs = await db.costData.findMany({
				where: {
					teamId: { in: teamIds },
					date: {
						gte: startDate,
					},
				},
				orderBy: {
					date: "asc",
				},
				select: {
					id: true,
					date: true,
					cost: true,
					provider: true,
					service: true,
					model: true,
					tokens: true,
					team: {
						select: {
							id: true,
							name: true,
						},
					},
					project: {
						select: {
							id: true,
							name: true,
						},
					},
				},
			});

			return costs.map((cost) => ({
				...cost,
				cost: cost.cost.toNumber(),
			}));
		}),

	/**
	 * Get cost breakdown by team
	 *
	 * Returns cost aggregated by team for the specified period
	 */
	getCostByTeam: protectedProcedure
		.input(
			z.object({
				days: z.number().min(1).max(90).default(30),
			}),
		)
		.query(async ({ ctx, input }) => {
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

			const startDate = subDays(new Date(), input.days);

			const costsByTeam = await db.costData.groupBy({
				by: ["teamId"],
				where: {
					teamId: { in: teamIds },
					date: {
						gte: startDate,
					},
				},
				_sum: {
					cost: true,
				},
				_count: {
					id: true,
				},
			});

			// Fetch team names
			const teams = await db.team.findMany({
				where: {
					id: { in: costsByTeam.map((c) => c.teamId) },
				},
				select: {
					id: true,
					name: true,
				},
			});

			const teamMap = new Map(teams.map((t) => [t.id, t.name]));

			return costsByTeam.map((cost) => ({
				teamId: cost.teamId,
				teamName: teamMap.get(cost.teamId) ?? "Unknown",
				totalCost: cost._sum.cost?.toNumber() ?? 0,
				recordCount: cost._count.id,
			}));
		}),

	/**
	 * Get top N teams by cost
	 *
	 * Returns top teams ordered by total cost for the specified time period
	 * Useful for dashboard charts showing team cost breakdown
	 */
	getTeamCostsTopN: protectedProcedure
		.input(
			z.object({
				limit: z.number().min(1).max(20).default(5),
				days: z.number().min(1).max(90).default(7),
			}),
		)
		.query(async ({ ctx, input }) => {
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

			const startDate = subDays(new Date(), input.days);

			// Aggregate costs by team
			const costsByTeam = await db.costData.groupBy({
				by: ["teamId"],
				where: {
					teamId: { in: teamIds },
					date: {
						gte: startDate,
					},
				},
				_sum: {
					cost: true,
				},
				_count: {
					id: true,
				},
			});

			// Fetch team details
			const teams = await db.team.findMany({
				where: {
					id: { in: costsByTeam.map((c) => c.teamId) },
				},
				select: {
					id: true,
					name: true,
					budget: true,
				},
			});

			const teamMap = new Map(teams.map((t) => [t.id, t]));

			// Combine and sort by total cost (descending)
			const results = costsByTeam
				.map((cost) => {
					const team = teamMap.get(cost.teamId);
					return {
						teamId: cost.teamId,
						teamName: team?.name ?? "Unknown",
						totalCost: cost._sum.cost?.toNumber() ?? 0,
						budget: team?.budget?.toNumber(),
						recordCount: cost._count.id,
					};
				})
				.sort((a, b) => b.totalCost - a.totalCost)
				.slice(0, input.limit);

			return results;
		}),

	/**
	 * Get top N projects by cost
	 *
	 * Returns top projects ordered by total cost for the specified time period
	 * Useful for dashboard charts showing project cost breakdown
	 */
	getProjectCostsTopN: protectedProcedure
		.input(
			z.object({
				teamId: z.string().optional(),
				limit: z.number().min(1).max(20).default(5),
				days: z.number().min(1).max(90).default(7),
			}),
		)
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;

			// Get user's teams
			const userTeams = await db.teamMember.findMany({
				where: { userId },
				select: { teamId: true },
			});

			// If teamId is specified, verify user has access to it
			if (input.teamId) {
				const hasAccess = userTeams.some((tm) => tm.teamId === input.teamId);
				if (!hasAccess) {
					throw new TRPCError({
						code: "FORBIDDEN",
						message: "You do not have access to this team",
					});
				}
			}

			const teamIds = input.teamId
				? [input.teamId]
				: userTeams.map((tm) => tm.teamId);

			if (teamIds.length === 0) {
				return [];
			}

			const now = new Date();
			const startDate = subDays(now, input.days);

			// Calculate last week's date range for comparison
			const lastWeekStart = subDays(startDate, input.days);
			const lastWeekEnd = subDays(now, input.days);

			// Aggregate costs by project for current period
			const costsByProject = await db.costData.groupBy({
				by: ["projectId"],
				where: {
					teamId: { in: teamIds },
					projectId: { not: null },
					date: {
						gte: startDate,
					},
				},
				_sum: {
					cost: true,
				},
				_count: {
					id: true,
				},
			});

			// Get last week's costs for comparison
			const lastWeekCostsByProject = await db.costData.groupBy({
				by: ["projectId"],
				where: {
					teamId: { in: teamIds },
					projectId: { not: null },
					date: {
						gte: lastWeekStart,
						lt: lastWeekEnd,
					},
				},
				_sum: {
					cost: true,
				},
			});

			const lastWeekCostMap = new Map(
				lastWeekCostsByProject.map((c) => [
					c.projectId,
					c._sum.cost?.toNumber() ?? 0,
				]),
			);

			// Fetch project details
			const projectIds = costsByProject
				.map((c) => c.projectId)
				.filter((id): id is string => id !== null);

			const projects = await db.project.findMany({
				where: {
					id: { in: projectIds },
				},
				select: {
					id: true,
					name: true,
					team: {
						select: {
							id: true,
							name: true,
						},
					},
				},
			});

			const projectMap = new Map(projects.map((p) => [p.id, p]));

			// Combine and sort by total cost (descending)
			const results = costsByProject
				.map((cost) => {
					const project = projectMap.get(cost.projectId ?? "");
					const currentCost = cost._sum.cost?.toNumber() ?? 0;
					const lastWeekCost = lastWeekCostMap.get(cost.projectId ?? "") ?? 0;

					// Calculate weekly change percentage
					const weeklyChange =
						lastWeekCost > 0
							? ((currentCost - lastWeekCost) / lastWeekCost) * 100
							: 0;

					return {
						projectId: cost.projectId ?? "",
						projectName: project?.name ?? "Unknown",
						teamName: project?.team?.name ?? "Unknown",
						totalCost: currentCost,
						weeklyChange,
						recordCount: cost._count.id,
					};
				})
				.sort((a, b) => b.totalCost - a.totalCost)
				.slice(0, input.limit);

			return results;
		}),

	/**
	 * Get project cost trend over time
	 *
	 * Returns daily cost breakdown for a specific project
	 * with associated performance metrics (success count, feedback score)
	 * Implements Novel Pattern 1: Cost-Value Attribution
	 */
	getProjectCostTrend: protectedProcedure
		.input(
			z.object({
				projectId: z.string(),
				days: z.number().min(1).max(90).default(30),
			}),
		)
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;

			// Verify user has access to this project's team
			const project = await db.project.findUnique({
				where: { id: input.projectId },
				select: {
					id: true,
					name: true,
					team: {
						select: {
							id: true,
							members: {
								where: { userId },
								select: { userId: true },
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
					message: "You do not have access to this project",
				});
			}

			const startDate = subDays(new Date(), input.days);

			// Get daily cost data
			const costData = await db.costData.findMany({
				where: {
					projectId: input.projectId,
					date: {
						gte: startDate,
					},
				},
				orderBy: {
					date: "asc",
				},
				select: {
					date: true,
					cost: true,
					tokens: true,
				},
			});

			// Get project metrics (success count, feedback score)
			const projectMetrics = await db.projectMetrics.findUnique({
				where: { projectId: input.projectId },
				select: {
					successCount: true,
					feedbackScore: true,
				},
			});

			// Aggregate daily costs and calculate efficiency
			const dailyData = costData.reduce(
				(acc, item) => {
					const dateKey = item.date.toISOString().split("T")[0];
					if (!dateKey) return acc;

					if (!acc[dateKey]) {
						acc[dateKey] = {
							date: item.date,
							cost: 0,
							tokens: 0,
						};
					}

					const entry = acc[dateKey];
					if (entry) {
						entry.cost += item.cost.toNumber();
						entry.tokens += item.tokens ?? 0;
					}

					return acc;
				},
				{} as Record<
					string,
					{
						date: Date;
						cost: number;
						tokens: number;
					}
				>,
			);

			// Calculate cumulative metrics for efficiency calculation
			const totalCost = Object.values(dailyData).reduce(
				(sum, day) => sum + day.cost,
				0,
			);
			const successCount = projectMetrics?.successCount ?? 0;
			const feedbackScore = projectMetrics?.feedbackScore ?? 0;

			// Calculate efficiency: success count per dollar spent
			const efficiency = totalCost > 0 ? successCount / totalCost : 0;

			return {
				projectId: input.projectId,
				projectName: project.name,
				dailyCosts: Object.entries(dailyData).map(([dateKey, data]) => ({
					date: data.date,
					cost: data.cost,
					tokens: data.tokens,
				})),
				totalCost,
				totalTokens: Object.values(dailyData).reduce(
					(sum, day) => sum + day.tokens,
					0,
				),
				// Performance metrics (Novel Pattern 1)
				successCount,
				feedbackScore,
				efficiency,
			};
		}),
});
