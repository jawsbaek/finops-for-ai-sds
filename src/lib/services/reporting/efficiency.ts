/**
 * Efficiency Calculator Service
 *
 * Novel Pattern 1: Cost-Value Attribution
 * Calculates efficiency metrics for projects based on success count and total cost
 */

import { subDays } from "date-fns";
import { db } from "~/server/db";

/**
 * Calculate efficiency metric
 *
 * Formula: efficiency = successCount / totalCost
 * Higher efficiency means more value delivered per dollar spent
 *
 * @param successCount - Number of successful tasks/operations
 * @param totalCost - Total cost in dollars
 * @returns Efficiency score (null if totalCost is 0)
 */
export function calculateEfficiency(
	successCount: number,
	totalCost: number,
): number | null {
	if (totalCost <= 0) {
		return null;
	}
	return successCount / totalCost;
}

/**
 * Cost-value data point for time series charts
 */
export interface CostValueDataPoint {
	date: Date;
	cost: number;
	successCount: number;
	efficiency: number | null;
}

/**
 * Get cost-value time series data for a project
 *
 * AC #5: Provides data for cost-value charts showing trends over time
 *
 * @param projectId - Project ID
 * @param days - Number of days to look back (default: 30)
 * @returns Array of cost-value data points ordered by date
 */
export async function getCostValueData(
	projectId: string,
	days = 30,
): Promise<CostValueDataPoint[]> {
	const startDate = subDays(new Date(), days);

	// Get cost data grouped by date
	const costData = await db.costData.groupBy({
		by: ["date"],
		where: {
			projectId,
			date: {
				gte: startDate,
			},
		},
		_sum: {
			cost: true,
		},
		orderBy: {
			date: "asc",
		},
	});

	// Get project metrics (current snapshot - in real scenario would track over time)
	const metrics = await db.projectMetrics.findUnique({
		where: {
			projectId,
		},
		select: {
			successCount: true,
		},
	});

	const successCount = metrics?.successCount ?? 0;

	// Transform to cost-value data points
	return costData.map((item) => {
		const cost = item._sum.cost?.toNumber() ?? 0;
		const efficiency = calculateEfficiency(successCount, cost);

		return {
			date: item.date,
			cost,
			successCount,
			efficiency,
		};
	});
}

/**
 * Task type breakdown for cost distribution
 */
export interface TaskTypeBreakdown {
	taskType: string;
	cost: number;
	percentage: number;
}

/**
 * Get cost breakdown by task type for a project
 *
 * AC #3: Provides data for task type cost distribution charts
 *
 * @param projectId - Project ID
 * @param days - Number of days to look back (default: 30)
 * @returns Array of task type breakdowns with cost and percentage
 */
export async function getCostByTaskType(
	projectId: string,
	days = 30,
): Promise<TaskTypeBreakdown[]> {
	const startDate = subDays(new Date(), days);

	// Get cost data grouped by task type
	const costData = await db.costData.groupBy({
		by: ["taskType"],
		where: {
			projectId,
			date: {
				gte: startDate,
			},
		},
		_sum: {
			cost: true,
		},
	});

	// Calculate total cost for percentage calculation
	const totalCost = costData.reduce(
		(sum, item) => sum + (item._sum.cost?.toNumber() ?? 0),
		0,
	);

	// Transform to breakdown with percentages
	return costData.map((item) => {
		const cost = item._sum.cost?.toNumber() ?? 0;
		const percentage = totalCost > 0 ? (cost / totalCost) * 100 : 0;

		return {
			taskType: item.taskType || "unknown",
			cost,
			percentage,
		};
	});
}

/**
 * Project efficiency summary
 */
export interface ProjectEfficiencySummary {
	projectId: string;
	projectName: string;
	totalCost: number;
	successCount: number;
	feedbackScore: number | null;
	efficiency: number | null;
	costTrend: "increasing" | "decreasing" | "stable";
}

/**
 * Get efficiency summary for multiple projects (for rankings)
 *
 * Novel Pattern 1: Used for weekly reports to rank Top 3 / Bottom 3 projects
 *
 * @param teamIds - Team IDs to filter projects
 * @param days - Number of days to look back (default: 30)
 * @returns Array of project efficiency summaries sorted by efficiency (desc)
 */
export async function getProjectEfficiencyRankings(
	teamIds: string[],
	days = 30,
): Promise<ProjectEfficiencySummary[]> {
	const startDate = subDays(new Date(), days);

	// Get all projects with costs and metrics
	const projects = await db.project.findMany({
		where: {
			teamId: { in: teamIds },
		},
		include: {
			metrics: true,
			costData: {
				where: {
					date: {
						gte: startDate,
					},
				},
				select: {
					cost: true,
					date: true,
				},
				orderBy: {
					date: "asc",
				},
			},
		},
	});

	// Calculate summaries
	const summaries: ProjectEfficiencySummary[] = projects.map((project) => {
		const totalCost = project.costData.reduce(
			(sum, cost) => sum + cost.cost.toNumber(),
			0,
		);

		const successCount = project.metrics?.successCount ?? 0;
		const feedbackScore = project.metrics?.feedbackScore ?? null;
		const efficiency = calculateEfficiency(successCount, totalCost);

		// Calculate cost trend (comparing first half vs second half of period)
		const midpoint = Math.floor(project.costData.length / 2);
		const firstHalfCost = project.costData
			.slice(0, midpoint)
			.reduce((sum, cost) => sum + cost.cost.toNumber(), 0);
		const secondHalfCost = project.costData
			.slice(midpoint)
			.reduce((sum, cost) => sum + cost.cost.toNumber(), 0);

		let costTrend: "increasing" | "decreasing" | "stable" = "stable";
		if (secondHalfCost > firstHalfCost * 1.1) {
			costTrend = "increasing";
		} else if (secondHalfCost < firstHalfCost * 0.9) {
			costTrend = "decreasing";
		}

		return {
			projectId: project.id,
			projectName: project.name,
			totalCost,
			successCount,
			feedbackScore,
			efficiency,
			costTrend,
		};
	});

	// Sort by efficiency (descending)
	return summaries.sort((a, b) => {
		if (a.efficiency === null) return 1;
		if (b.efficiency === null) return -1;
		return b.efficiency - a.efficiency;
	});
}
