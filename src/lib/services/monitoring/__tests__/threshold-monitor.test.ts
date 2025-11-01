/**
 * Unit tests for Threshold Monitor Service
 *
 * Tests checkThresholds, calculateCurrentCost, and throttling logic
 */

// Mock the database - must be at top level before imports
import { vi } from "vitest";

vi.mock("~/server/db", () => ({
	db: {
		costAlert: {
			findMany: vi.fn(),
			update: vi.fn(),
		},
		costData: {
			aggregate: vi.fn(),
		},
	},
}));

import { Decimal } from "@prisma/client/runtime/library";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "~/server/db";
import {
	type AlertEvent,
	calculateCurrentCost,
	checkThresholds,
	updateAlertSentTimestamp,
} from "../threshold-monitor";

describe("Threshold Monitor Service", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("checkThresholds", () => {
		it("should return empty array when no active alerts exist", async () => {
			// Mock: no active alerts
			vi.mocked(db.costAlert.findMany).mockResolvedValue([]);

			const breaches = await checkThresholds();

			expect(breaches).toEqual([]);
			expect(db.costAlert.findMany).toHaveBeenCalledWith({
				where: { isActive: true },
				include: {
					project: {
						include: { team: true },
					},
				},
			});
		});

		it("should return empty array when costs are below thresholds", async () => {
			const mockAlerts = [
				{
					id: "alert-1",
					projectId: "proj-1",
					thresholdType: "daily",
					thresholdValue: new Decimal(100),
					isActive: true,
					lastAlertSentAt: null,
					project: {
						id: "proj-1",
						name: "Test Project",
						teamId: "team-1",
						team: { id: "team-1", name: "Test Team" },
					},
				},
			];

			vi.mocked(db.costAlert.findMany).mockResolvedValue(mockAlerts as never);

			// Mock: current cost is below threshold
			vi.mocked(db.costData.aggregate).mockResolvedValue({
				_sum: { cost: new Decimal(50) },
			} as never);

			const breaches = await checkThresholds();

			expect(breaches).toEqual([]);
		});

		it("should return breach when cost exceeds threshold", async () => {
			const mockAlerts = [
				{
					id: "alert-1",
					projectId: "proj-1",
					thresholdType: "daily",
					thresholdValue: new Decimal(100),
					isActive: true,
					lastAlertSentAt: null,
					project: {
						id: "proj-1",
						name: "Test Project",
						teamId: "team-1",
						team: { id: "team-1", name: "Test Team" },
					},
				},
			];

			vi.mocked(db.costAlert.findMany).mockResolvedValue(mockAlerts as never);

			// Mock: current cost exceeds threshold (150 > 100)
			vi.mocked(db.costData.aggregate).mockResolvedValue({
				_sum: { cost: new Decimal(150) },
			} as never);

			const breaches = await checkThresholds();

			expect(breaches).toHaveLength(1);
			expect(breaches[0]).toMatchObject({
				alertId: "alert-1",
				projectId: "proj-1",
				projectName: "Test Project",
				teamId: "team-1",
				thresholdType: "daily",
				thresholdValue: 100,
				currentCost: 150,
			});

			// Exceedance percent: ((150 - 100) / 100) * 100 = 50%
			expect(breaches[0]?.exceedancePercent).toBeCloseTo(50, 2);
		});

		it("should skip alerts sent within last hour (throttling)", async () => {
			const now = new Date("2025-11-02T12:00:00Z");
			vi.setSystemTime(now);

			// Alert sent 30 minutes ago (should be throttled)
			const lastAlertTime = new Date("2025-11-02T11:30:00Z");

			const mockAlerts = [
				{
					id: "alert-1",
					projectId: "proj-1",
					thresholdType: "daily",
					thresholdValue: new Decimal(100),
					isActive: true,
					lastAlertSentAt: lastAlertTime,
					project: {
						id: "proj-1",
						name: "Test Project",
						teamId: "team-1",
						team: { id: "team-1", name: "Test Team" },
					},
				},
			];

			vi.mocked(db.costAlert.findMany).mockResolvedValue(mockAlerts as never);

			// Mock: cost exceeds threshold, but should be throttled
			vi.mocked(db.costData.aggregate).mockResolvedValue({
				_sum: { cost: new Decimal(150) },
			} as never);

			const breaches = await checkThresholds();

			// Should be empty due to throttling
			expect(breaches).toEqual([]);
		});

		it("should allow alerts sent more than 1 hour ago (throttling expired)", async () => {
			const now = new Date("2025-11-02T12:00:00Z");
			vi.setSystemTime(now);

			// Alert sent 90 minutes ago (throttling expired)
			const lastAlertTime = new Date("2025-11-02T10:30:00Z");

			const mockAlerts = [
				{
					id: "alert-1",
					projectId: "proj-1",
					thresholdType: "daily",
					thresholdValue: new Decimal(100),
					isActive: true,
					lastAlertSentAt: lastAlertTime,
					project: {
						id: "proj-1",
						name: "Test Project",
						teamId: "team-1",
						team: { id: "team-1", name: "Test Team" },
					},
				},
			];

			vi.mocked(db.costAlert.findMany).mockResolvedValue(mockAlerts as never);

			// Mock: cost exceeds threshold
			vi.mocked(db.costData.aggregate).mockResolvedValue({
				_sum: { cost: new Decimal(150) },
			} as never);

			const breaches = await checkThresholds();

			// Should return breach (throttling expired)
			expect(breaches).toHaveLength(1);
			expect(breaches[0]?.alertId).toBe("alert-1");
		});

		it("should handle multiple alerts with mixed breach states", async () => {
			const mockAlerts = [
				{
					id: "alert-1",
					projectId: "proj-1",
					thresholdType: "daily",
					thresholdValue: new Decimal(100),
					isActive: true,
					lastAlertSentAt: null,
					project: {
						id: "proj-1",
						name: "Project 1",
						teamId: "team-1",
						team: { id: "team-1", name: "Team 1" },
					},
				},
				{
					id: "alert-2",
					projectId: "proj-2",
					thresholdType: "weekly",
					thresholdValue: new Decimal(500),
					isActive: true,
					lastAlertSentAt: null,
					project: {
						id: "proj-2",
						name: "Project 2",
						teamId: "team-1",
						team: { id: "team-1", name: "Team 1" },
					},
				},
			];

			vi.mocked(db.costAlert.findMany).mockResolvedValue(mockAlerts as never);

			// Mock: first alert exceeds, second doesn't
			vi.mocked(db.costData.aggregate)
				.mockResolvedValueOnce({
					_sum: { cost: new Decimal(150) }, // proj-1: exceeds
				} as never)
				.mockResolvedValueOnce({
					_sum: { cost: new Decimal(400) }, // proj-2: below threshold
				} as never);

			const breaches = await checkThresholds();

			expect(breaches).toHaveLength(1);
			expect(breaches[0]?.projectId).toBe("proj-1");
		});
	});

	describe("calculateCurrentCost", () => {
		it("should calculate daily cost correctly", async () => {
			const now = new Date("2025-11-02T15:30:00Z");
			vi.setSystemTime(now);

			vi.mocked(db.costData.aggregate).mockResolvedValue({
				_sum: { cost: new Decimal(123.45) },
			} as never);

			const cost = await calculateCurrentCost("proj-1", "daily");

			expect(cost).toBe(123.45);
			expect(db.costData.aggregate).toHaveBeenCalledWith({
				where: {
					projectId: "proj-1",
					date: {
						gte: expect.any(Date), // startOfDay
						lte: expect.any(Date), // endOfDay
					},
				},
				_sum: {
					cost: true,
				},
			});
		});

		it("should calculate weekly cost correctly", async () => {
			// Wednesday, Nov 6, 2025
			const now = new Date("2025-11-06T15:30:00Z");
			vi.setSystemTime(now);

			vi.mocked(db.costData.aggregate).mockResolvedValue({
				_sum: { cost: new Decimal(567.89) },
			} as never);

			const cost = await calculateCurrentCost("proj-1", "weekly");

			expect(cost).toBe(567.89);

			// Should query from Monday (Nov 4) 00:00 to Wednesday (Nov 6) 23:59
			const call = vi.mocked(db.costData.aggregate).mock.calls[0];
			const dateFilter = call?.[0]?.where?.date as
				| { gte?: Date; lte?: Date }
				| undefined;
			expect(dateFilter?.gte?.getDay()).toBe(1); // Monday
		});

		it("should return 0 when no cost data exists", async () => {
			vi.mocked(db.costData.aggregate).mockResolvedValue({
				_sum: { cost: null },
			} as never);

			const cost = await calculateCurrentCost("proj-1", "daily");

			expect(cost).toBe(0);
		});

		it("should throw error for invalid threshold type", async () => {
			await expect(calculateCurrentCost("proj-1", "monthly")).rejects.toThrow(
				"Invalid threshold type: monthly",
			);
		});
	});

	describe("updateAlertSentTimestamp", () => {
		it("should update lastAlertSentAt to current time", async () => {
			const now = new Date("2025-11-02T12:00:00Z");
			vi.setSystemTime(now);

			vi.mocked(db.costAlert.update).mockResolvedValue({} as never);

			await updateAlertSentTimestamp("alert-1");

			expect(db.costAlert.update).toHaveBeenCalledWith({
				where: { id: "alert-1" },
				data: {
					lastAlertSentAt: now,
				},
			});
		});
	});
});
