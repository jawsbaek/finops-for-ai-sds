/**
 * Weekly Report Generator Service
 *
 * Generates comprehensive weekly cost and efficiency reports
 * for email distribution and archive storage
 */

import { endOfWeek, format, startOfWeek, subWeeks } from "date-fns";
import { db } from "~/server/db";
import {
	type ProjectEfficiencySummary,
	getProjectEfficiencyRankings,
} from "./efficiency";

/**
 * Project summary for weekly report
 */
export interface WeeklyProjectSummary extends ProjectEfficiencySummary {
	weekChange: number; // Percentage change from previous week
}

/**
 * Weekly report data structure
 */
export interface WeeklyReportData {
	weekStart: Date;
	weekEnd: Date;
	totalCost: number;
	weekChange: number; // Percentage change from previous week
	projects: WeeklyProjectSummary[];
	top3: WeeklyProjectSummary[];
	bottom3: WeeklyProjectSummary[];
}

/**
 * Calculate week-over-week cost change percentage
 *
 * @param currentWeekCost - Total cost for current week
 * @param previousWeekCost - Total cost for previous week
 * @returns Percentage change (positive = increase, negative = decrease)
 */
export function calculateWeekChange(
	currentWeekCost: number,
	previousWeekCost: number,
): number {
	if (previousWeekCost === 0) {
		return currentWeekCost > 0 ? 100 : 0;
	}

	return ((currentWeekCost - previousWeekCost) / previousWeekCost) * 100;
}

/**
 * Generate weekly report for all teams
 *
 * AC #2, #3: Calculates Top 3/Bottom 3 projects, total cost, and week-over-week changes
 *
 * @returns Complete weekly report data ready for email and storage
 */
export async function generateWeeklyReport(): Promise<WeeklyReportData> {
	// Calculate date ranges
	const now = new Date();
	const weekEnd = endOfWeek(now, { weekStartsOn: 1 }); // Week ends on Sunday
	const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Week starts on Monday

	const previousWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
	const previousWeekStart = startOfWeek(subWeeks(now, 1), {
		weekStartsOn: 1,
	});

	// Get all teams for organization-wide report
	const teams = await db.team.findMany({
		select: { id: true },
	});

	const teamIds = teams.map((t) => t.id);

	if (teamIds.length === 0) {
		// No teams found, return empty report
		return {
			weekStart,
			weekEnd,
			totalCost: 0,
			weekChange: 0,
			projects: [],
			top3: [],
			bottom3: [],
		};
	}

	// Get efficiency rankings for current week (last 7 days)
	const projectSummaries = await getProjectEfficiencyRankings(teamIds, 7);

	// Calculate total cost for current week
	const currentWeekCosts = await db.costData.groupBy({
		by: ["projectId"],
		where: {
			date: {
				gte: weekStart,
				lte: weekEnd,
			},
		},
		_sum: {
			cost: true,
		},
	});

	// Calculate total cost for previous week
	const previousWeekCosts = await db.costData.groupBy({
		by: ["projectId"],
		where: {
			date: {
				gte: previousWeekStart,
				lte: previousWeekEnd,
			},
		},
		_sum: {
			cost: true,
		},
	});

	// Build lookup maps for cost comparison
	const currentWeekCostMap = new Map(
		currentWeekCosts.map((c) => [
			c.projectId || "unknown",
			c._sum.cost?.toNumber() ?? 0,
		]),
	);

	const previousWeekCostMap = new Map(
		previousWeekCosts.map((c) => [
			c.projectId || "unknown",
			c._sum.cost?.toNumber() ?? 0,
		]),
	);

	// Enhance project summaries with week-over-week change
	const projectsWithChange: WeeklyProjectSummary[] = projectSummaries.map(
		(project) => {
			const currentCost = currentWeekCostMap.get(project.projectId) ?? 0;
			const previousCost = previousWeekCostMap.get(project.projectId) ?? 0;
			const weekChange = calculateWeekChange(currentCost, previousCost);

			return {
				...project,
				weekChange,
			};
		},
	);

	// Calculate organization-wide totals
	const totalCurrentWeekCost = Array.from(currentWeekCostMap.values()).reduce(
		(sum, cost) => sum + cost,
		0,
	);

	const totalPreviousWeekCost = Array.from(previousWeekCostMap.values()).reduce(
		(sum, cost) => sum + cost,
		0,
	);

	const organizationWeekChange = calculateWeekChange(
		totalCurrentWeekCost,
		totalPreviousWeekCost,
	);

	// Select Top 3 and Bottom 3 (already sorted by efficiency from rankings)
	const top3 = projectsWithChange.slice(0, 3);
	const bottom3 = projectsWithChange.slice(-3).reverse();

	return {
		weekStart,
		weekEnd,
		totalCost: totalCurrentWeekCost,
		weekChange: organizationWeekChange,
		projects: projectsWithChange,
		top3,
		bottom3,
	};
}

/**
 * Save weekly report to database for archive
 *
 * AC #5: Stores report in WeeklyReport table
 *
 * @param reportData - Generated report data
 * @returns Created WeeklyReport record ID
 */
export async function saveWeeklyReport(
	reportData: WeeklyReportData,
): Promise<string> {
	const report = await db.weeklyReport.create({
		data: {
			weekStart: reportData.weekStart,
			weekEnd: reportData.weekEnd,
			data: JSON.parse(
				JSON.stringify({
					totalCost: reportData.totalCost,
					weekChange: reportData.weekChange,
					projects: reportData.projects,
					top3: reportData.top3,
					bottom3: reportData.bottom3,
				}),
			),
		},
	});

	return report.id;
}

/**
 * Format date for display in reports
 *
 * @param date - Date to format
 * @returns Formatted date string (e.g., "2025년 11월 1일")
 */
export function formatReportDate(date: Date): string {
	return format(date, "yyyy년 MM월 dd일");
}

/**
 * Format currency for display
 *
 * @param amount - Amount in dollars
 * @returns Formatted currency string (e.g., "$1,234.56")
 */
export function formatCurrency(amount: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(amount);
}

/**
 * Format percentage for display
 *
 * @param value - Percentage value
 * @returns Formatted percentage string with sign (e.g., "+12.5%" or "-5.3%")
 */
export function formatPercentage(value: number): string {
	const sign = value > 0 ? "+" : "";
	return `${sign}${value.toFixed(1)}%`;
}
