/**
 * Report tRPC Router
 *
 * Handles weekly report archive queries
 */

import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const reportRouter = createTRPCRouter({
	/**
	 * Get recent weekly reports
	 *
	 * AC #5: Retrieves weekly reports for archive page
	 *
	 * @input limit - Number of reports to fetch (default: 12 weeks)
	 * @returns Array of weekly reports ordered by week_start descending
	 */
	getRecentReports: protectedProcedure
		.input(
			z.object({
				limit: z.number().min(1).max(52).default(12),
			}),
		)
		.query(async ({ input, ctx }) => {
			const reports = await ctx.db.weeklyReport.findMany({
				orderBy: {
					weekStart: "desc",
				},
				take: input.limit,
			});

			return reports;
		}),

	/**
	 * Get a specific weekly report by ID
	 *
	 * @input id - Report ID
	 * @returns Weekly report details
	 */
	getReportById: protectedProcedure
		.input(
			z.object({
				id: z.string(),
			}),
		)
		.query(async ({ input, ctx }) => {
			const report = await ctx.db.weeklyReport.findUnique({
				where: {
					id: input.id,
				},
			});

			if (!report) {
				throw new Error("Report not found");
			}

			return report;
		}),
});
