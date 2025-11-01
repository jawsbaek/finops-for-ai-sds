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
	 * Get cost summary (yesterday and this week)
	 *
	 * Returns:
	 * - yesterdayCost: Total cost for yesterday
	 * - thisWeekCost: Total cost for current week (Monday-today)
	 * - weeklyChange: Percentage change from last week
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

			const yesterdayCost = yesterdayData._sum.cost?.toNumber() ?? 0;
			const thisWeekCost = thisWeekData._sum.cost?.toNumber() ?? 0;
			const lastWeekCost = lastWeekData._sum.cost?.toNumber() ?? 0;

			// Calculate weekly change percentage
			const weeklyChange =
				lastWeekCost > 0
					? ((thisWeekCost - lastWeekCost) / lastWeekCost) * 100
					: 0;

			return {
				yesterdayCost,
				thisWeekCost,
				weeklyChange,
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
});
