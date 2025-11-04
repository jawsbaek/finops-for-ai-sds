#!/usr/bin/env bun
/**
 * Validation Script: Team → Admin API Key → Projects Setup
 *
 * DEPRECATED: This script is outdated and needs to be updated for multi-org support.
 * TODO: Update for multi-org schema (Phase 4 - UI Refactoring)
 *
 * Validates the complete setup for OpenAI Costs API:
 * 1. Team has active Admin API Key
 * 2. Admin API Key can be decrypted
 * 3. Team has projects with OpenAI Project IDs
 * 4. Relationships are correctly configured
 *
 * Usage:
 *   bun run scripts/validate-openai-setup.ts [teamId]
 */

// @ts-nocheck - Temporarily disabled until multi-org migration complete

import pino from "pino";
import { getKMSEncryption } from "~/lib/services/encryption/kms-envelope";
import { db } from "~/server/db";

const logger = pino({ name: "validate-openai-setup" });

interface ValidationResult {
	valid: boolean;
	issues: string[];
}

/**
 * Validate Team → Admin API Key → Projects relationship
 */
async function validateTeamSetup(teamId: string): Promise<ValidationResult> {
	const issues: string[] = [];

	// 1. Team exists check
	const team = await db.team.findUnique({
		where: { id: teamId },
		include: {
			organizationApiKey: true,
			projects: true,
		},
	});

	if (!team) {
		issues.push(`Team ${teamId} not found`);
		return { valid: false, issues };
	}

	logger.info({ teamId, teamName: team.name }, "Validating team setup");

	// 2. Admin API Key exists and is active
	if (!team.organizationApiKey) {
		issues.push(`Team "${team.name}" has no Admin API Key registered`);
	} else if (!team.organizationApiKey.isActive) {
		issues.push(`Team "${team.name}" Admin API Key is inactive`);
	}

	// 3. Admin API Key decryption test
	if (team.organizationApiKey) {
		try {
			const kms = getKMSEncryption();
			await kms.decrypt(
				team.organizationApiKey.encryptedKey,
				team.organizationApiKey.encryptedDataKey,
				team.organizationApiKey.iv,
			);
			logger.info({ teamId }, "✓ Admin API Key decryption successful");
		} catch (error) {
			issues.push(
				`Failed to decrypt Admin API Key: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	// 4. Projects with OpenAI Project ID
	const projectsWithId = team.projects.filter((p) => p.openaiProjectId);
	if (projectsWithId.length === 0) {
		issues.push(
			`Team "${team.name}" has no projects with OpenAI Project ID registered`,
		);
	}

	// 5. Summary
	logger.info(
		{
			teamId,
			teamName: team.name,
			hasAdminKey: !!team.organizationApiKey,
			adminKeyActive: team.organizationApiKey?.isActive ?? false,
			totalProjects: team.projects.length,
			projectsWithOpenAIId: projectsWithId.length,
		},
		"Team validation summary",
	);

	// Log projects with OpenAI Project IDs
	if (projectsWithId.length > 0) {
		for (const project of projectsWithId) {
			logger.info(
				{
					projectId: project.id,
					projectName: project.name,
					openaiProjectId: project.openaiProjectId,
				},
				"✓ Project configured for Costs API",
			);
		}
	}

	return {
		valid: issues.length === 0,
		issues,
	};
}

/**
 * Validate all teams
 */
async function validateAllTeams() {
	const teams = await db.team.findMany({
		select: { id: true, name: true },
	});

	logger.info({ teamCount: teams.length }, "Validating all teams");

	let validTeams = 0;
	let invalidTeams = 0;

	for (const team of teams) {
		const result = await validateTeamSetup(team.id);

		if (!result.valid) {
			logger.warn(
				{ teamId: team.id, teamName: team.name, issues: result.issues },
				"❌ Team validation failed",
			);
			invalidTeams++;
		} else {
			logger.info(
				{ teamId: team.id, teamName: team.name },
				"✅ Team validation passed",
			);
			validTeams++;
		}

		console.log(""); // Empty line for readability
	}

	logger.info(
		{ validTeams, invalidTeams, totalTeams: teams.length },
		"Validation complete",
	);

	return { validTeams, invalidTeams };
}

// Main execution function
async function main() {
	const teamId = process.argv[2];

	if (teamId) {
		// Validate specific team
		logger.info({ teamId }, "Validating specific team");
		const result = await validateTeamSetup(teamId);

		if (result.valid) {
			console.log("\n✅ Team validation passed");
			process.exit(0);
		} else {
			console.log("\n❌ Team validation failed:");
			for (const issue of result.issues) {
				console.log(`  - ${issue}`);
			}
			process.exit(1);
		}
	} else {
		// Validate all teams
		const { validTeams, invalidTeams } = await validateAllTeams();

		if (invalidTeams === 0) {
			console.log(`\n✅ All ${validTeams} teams validated successfully`);
			process.exit(0);
		} else {
			console.log(
				`\n⚠️  ${invalidTeams} team(s) failed validation (${validTeams} passed)`,
			);
			process.exit(1);
		}
	}
}

// Execute main function
main().catch((error) => {
	logger.error({ error }, "Script failed");
	console.error(error);
	process.exit(1);
});
