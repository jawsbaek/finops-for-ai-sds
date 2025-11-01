/**
 * Alert tRPC Router
 *
 * Provides API endpoints for cost threshold alert management
 * - setThreshold: Create or update cost threshold for a project
 * - getAlerts: Get all active alerts for a project
 * - updateAlert: Update an existing alert threshold
 * - deleteAlert: Deactivate an alert
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
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
			const userId = ctx.session.user.id;

			// Verify user has access to the project's team
			const project = await db.project.findUnique({
				where: { id: input.projectId },
				include: {
					team: {
						include: {
							members: {
								where: { userId },
							},
						},
					},
				},
			});

			if (!project) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "프로젝트를 찾을 수 없습니다",
				});
			}

			if (project.team.members.length === 0) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "이 프로젝트에 접근할 권한이 없습니다",
				});
			}

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
			const userId = ctx.session.user.id;

			// Verify user has access to the project's team
			const project = await db.project.findUnique({
				where: { id: input.projectId },
				include: {
					team: {
						include: {
							members: {
								where: { userId },
							},
						},
					},
				},
			});

			if (!project) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "프로젝트를 찾을 수 없습니다",
				});
			}

			if (project.team.members.length === 0) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "이 프로젝트에 접근할 권한이 없습니다",
				});
			}

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
			const userId = ctx.session.user.id;

			// Get alert and verify access
			const alert = await db.costAlert.findUnique({
				where: { id: input.alertId },
				include: {
					project: {
						include: {
							team: {
								include: {
									members: {
										where: { userId },
									},
								},
							},
						},
					},
				},
			});

			if (!alert) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "알림을 찾을 수 없습니다",
				});
			}

			if (alert.project.team.members.length === 0) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "이 알림을 수정할 권한이 없습니다",
				});
			}

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
			const userId = ctx.session.user.id;

			// Get alert and verify access
			const alert = await db.costAlert.findUnique({
				where: { id: input.alertId },
				include: {
					project: {
						include: {
							team: {
								include: {
									members: {
										where: { userId },
									},
								},
							},
						},
					},
				},
			});

			if (!alert) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "알림을 찾을 수 없습니다",
				});
			}

			if (alert.project.team.members.length === 0) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "이 알림을 삭제할 권한이 없습니다",
				});
			}

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
