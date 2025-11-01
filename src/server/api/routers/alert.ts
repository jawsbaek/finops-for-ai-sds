/**
 * Alert tRPC Router
 *
 * Provides API endpoints for cost threshold alert management
 * - setThreshold: Create or update cost threshold for a project
 * - getAlerts: Get all active alerts for a project
 * - updateAlert: Update an existing alert threshold
 * - deleteAlert: Deactivate an alert
 */

import { z } from "zod";
import {
	verifyAlertAccess,
	verifyProjectAccess,
} from "~/server/api/helpers/authorization";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";

export const alertRouter = createTRPCRouter({
	/**
	 * Set cost threshold for a project
	 *
	 * Creates a new alert or updates existing one if same type exists
	 */
	setThreshold: protectedProcedure
		.input(
			z.object({
				projectId: z.string(),
				type: z.enum(["daily", "weekly"]),
				value: z.number().positive(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Verify user has access to the project
			await verifyProjectAccess(input.projectId, ctx.session.user.id);

			// Check if an alert of this type already exists for this project
			const existingAlert = await db.costAlert.findFirst({
				where: {
					projectId: input.projectId,
					thresholdType: input.type,
					isActive: true,
				},
			});

			if (existingAlert) {
				// Update existing alert
				const updatedAlert = await db.costAlert.update({
					where: { id: existingAlert.id },
					data: {
						thresholdValue: input.value,
						updatedAt: new Date(),
					},
				});

				return {
					id: updatedAlert.id,
					projectId: updatedAlert.projectId,
					type: updatedAlert.thresholdType,
					value: Number(updatedAlert.thresholdValue),
					isActive: updatedAlert.isActive,
					createdAt: updatedAlert.createdAt,
					updatedAt: updatedAlert.updatedAt,
				};
			}

			// Create new alert
			const newAlert = await db.costAlert.create({
				data: {
					projectId: input.projectId,
					thresholdType: input.type,
					thresholdValue: input.value,
					isActive: true,
				},
			});

			return {
				id: newAlert.id,
				projectId: newAlert.projectId,
				type: newAlert.thresholdType,
				value: Number(newAlert.thresholdValue),
				isActive: newAlert.isActive,
				createdAt: newAlert.createdAt,
				updatedAt: newAlert.updatedAt,
			};
		}),

	/**
	 * Get all active alerts for a project
	 */
	getAlerts: protectedProcedure
		.input(
			z.object({
				projectId: z.string(),
			}),
		)
		.query(async ({ ctx, input }) => {
			// Verify user has access to the project
			await verifyProjectAccess(input.projectId, ctx.session.user.id);

			const alerts = await db.costAlert.findMany({
				where: {
					projectId: input.projectId,
					isActive: true,
				},
				orderBy: {
					createdAt: "desc",
				},
			});

			return alerts.map((alert) => ({
				id: alert.id,
				projectId: alert.projectId,
				type: alert.thresholdType,
				value: Number(alert.thresholdValue),
				isActive: alert.isActive,
				lastAlertSentAt: alert.lastAlertSentAt,
				createdAt: alert.createdAt,
				updatedAt: alert.updatedAt,
			}));
		}),

	/**
	 * Update an existing alert
	 */
	updateAlert: protectedProcedure
		.input(
			z.object({
				alertId: z.string(),
				value: z.number().positive(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Verify user has access to the alert
			await verifyAlertAccess(input.alertId, ctx.session.user.id);

			const updatedAlert = await db.costAlert.update({
				where: { id: input.alertId },
				data: {
					thresholdValue: input.value,
					updatedAt: new Date(),
				},
			});

			return {
				id: updatedAlert.id,
				projectId: updatedAlert.projectId,
				type: updatedAlert.thresholdType,
				value: Number(updatedAlert.thresholdValue),
				isActive: updatedAlert.isActive,
				createdAt: updatedAlert.createdAt,
				updatedAt: updatedAlert.updatedAt,
			};
		}),

	/**
	 * Delete (deactivate) an alert
	 */
	deleteAlert: protectedProcedure
		.input(
			z.object({
				alertId: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Verify user has access to the alert
			await verifyAlertAccess(input.alertId, ctx.session.user.id);

			const deletedAlert = await db.costAlert.update({
				where: { id: input.alertId },
				data: {
					isActive: false,
					updatedAt: new Date(),
				},
			});

			return {
				id: deletedAlert.id,
				projectId: deletedAlert.projectId,
				type: deletedAlert.thresholdType,
				value: Number(deletedAlert.thresholdValue),
				isActive: deletedAlert.isActive,
				createdAt: deletedAlert.createdAt,
				updatedAt: deletedAlert.updatedAt,
			};
		}),
});
