/**
 * Audit Logger Service
 *
 * Provides centralized audit logging for critical system actions
 */

import { db } from "~/server/db";

export interface LogApiKeyDisableParams {
	userId: string;
	apiKeyId: string;
	reason: string;
	previousState?: {
		isActive: boolean;
	};
}

/**
 * Log API key disable action to audit trail
 */
export async function logApiKeyDisable({
	userId,
	apiKeyId,
	reason,
	previousState,
}: LogApiKeyDisableParams) {
	return await db.auditLog.create({
		data: {
			userId,
			actionType: "api_key_disabled",
			resourceType: "api_key",
			resourceId: apiKeyId,
			metadata: {
				reason,
				...(previousState && { previousState }),
			},
		},
	});
}

export interface LogApiKeyEnableParams {
	userId: string;
	apiKeyId: string;
	reason: string;
}

/**
 * Log API key enable action to audit trail
 */
export async function logApiKeyEnable({
	userId,
	apiKeyId,
	reason,
}: LogApiKeyEnableParams) {
	return await db.auditLog.create({
		data: {
			userId,
			actionType: "api_key_enabled",
			resourceType: "api_key",
			resourceId: apiKeyId,
			metadata: {
				reason,
			},
		},
	});
}
