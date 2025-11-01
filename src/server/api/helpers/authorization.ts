/**
 * Authorization Helpers for tRPC Procedures
 *
 * Provides reusable authorization logic following T3 App best practices
 * Reduces code duplication and ensures consistent error messages
 */

import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";

/**
 * Verify user has access to a project through team membership
 *
 * @param projectId - Project ID to check
 * @param userId - User ID to verify membership
 * @throws TRPCError with NOT_FOUND if project doesn't exist
 * @throws TRPCError with FORBIDDEN if user doesn't have access
 * @returns Project with team data if authorized
 */
export async function verifyProjectAccess(projectId: string, userId: string) {
	const project = await db.project.findUnique({
		where: { id: projectId },
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

	return project;
}

/**
 * Verify user has access to an alert through project team membership
 *
 * @param alertId - Alert ID to check
 * @param userId - User ID to verify membership
 * @throws TRPCError with NOT_FOUND if alert doesn't exist
 * @throws TRPCError with FORBIDDEN if user doesn't have access
 * @returns Alert with project and team data if authorized
 */
export async function verifyAlertAccess(alertId: string, userId: string) {
	const alert = await db.costAlert.findUnique({
		where: { id: alertId },
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
			message: "이 알림에 접근할 권한이 없습니다",
		});
	}

	return alert;
}
