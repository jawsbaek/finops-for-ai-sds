/**
 * Threshold Monitor Service
 *
 * Checks all active cost alerts and calculates current costs
 * to detect threshold breaches. Implements alert throttling
 * to prevent notification spam.
 */

import type { Decimal } from "@prisma/client/runtime/library";
import { endOfDay, startOfDay, startOfWeek, subHours } from "date-fns";
import { ALERT_THRESHOLDS } from "~/lib/constants";
import { db } from "~/server/db";

export interface AlertEvent {
	alertId: string;
	projectId: string;
	projectName: string;
	teamId: string;
	thresholdType: "daily" | "weekly";
	thresholdValue: number;
	currentCost: number;
	exceedancePercent: number;
}

/**
 * Check all active cost thresholds across all projects
 *
 * Returns array of threshold breaches that need alerts sent
 * Applies throttling: only returns alerts if >1 hour since last alert
 */
export async function checkThresholds(): Promise<AlertEvent[]> {
	// Get all active cost alerts
	const alerts = await db.costAlert.findMany({
		where: {
			isActive: true,
		},
		include: {
			project: {
				include: {
					team: true,
				},
			},
		},
	});

	const breaches: AlertEvent[] = [];
	const now = new Date();

	for (const alert of alerts) {
		// Apply throttling: skip if alert sent recently
		if (alert.lastAlertSentAt) {
			const hoursSinceLastAlert =
				(now.getTime() - alert.lastAlertSentAt.getTime()) / (1000 * 60 * 60);
			if (hoursSinceLastAlert < ALERT_THRESHOLDS.MIN_HOURS_BETWEEN_ALERTS) {
				continue; // Skip this alert (throttled)
			}
		}

		// Calculate current cost based on threshold type
		const currentCost = await calculateCurrentCost(
			alert.projectId,
			alert.thresholdType,
		);

		const thresholdValue = Number(alert.thresholdValue);

		// Check if threshold exceeded
		if (currentCost > thresholdValue) {
			const exceedancePercent =
				((currentCost - thresholdValue) / thresholdValue) * 100;

			breaches.push({
				alertId: alert.id,
				projectId: alert.projectId,
				projectName: alert.project.name,
				teamId: alert.project.teamId,
				thresholdType: alert.thresholdType as "daily" | "weekly",
				thresholdValue,
				currentCost,
				exceedancePercent,
			});
		}
	}

	return breaches;
}

/**
 * Calculate current cost for a project
 *
 * @param projectId - Project ID
 * @param type - "daily" for today's cost, "weekly" for this week's cost (Mon-today)
 * @returns Current cost in USD
 */
export async function calculateCurrentCost(
	projectId: string,
	type: string,
): Promise<number> {
	const now = new Date();
	let startDate: Date;
	let endDate: Date;

	if (type === "daily") {
		// Today's cost (00:00:00 - 23:59:59)
		startDate = startOfDay(now);
		endDate = endOfDay(now);
	} else if (type === "weekly") {
		// This week's cost (Monday 00:00:00 - today 23:59:59)
		startDate = startOfWeek(now, { weekStartsOn: 1 }); // Monday
		endDate = endOfDay(now);
	} else {
		throw new Error(`Invalid threshold type: ${type}`);
	}

	// Aggregate cost data for the period
	const result = await db.costData.aggregate({
		where: {
			projectId,
			date: {
				gte: startDate,
				lte: endDate,
			},
		},
		_sum: {
			cost: true,
		},
	});

	const totalCost = result._sum.cost as Decimal | null;
	return totalCost ? Number(totalCost) : 0;
}

/**
 * Update alert's last sent timestamp
 *
 * Called after successfully sending alert notification
 * to enable throttling for future checks
 */
export async function updateAlertSentTimestamp(alertId: string): Promise<void> {
	await db.costAlert.update({
		where: { id: alertId },
		data: {
			lastAlertSentAt: new Date(),
		},
	});
}
