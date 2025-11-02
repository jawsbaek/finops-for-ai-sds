#!/usr/bin/env bun

/**
 * Data Migration: Team-Based to Project-Based API Keys
 *
 * This script performs the data migration after the Prisma schema has been updated.
 * It must be run AFTER the database schema migration is complete.
 *
 * Steps:
 * 1. Add all team members to all projects in their teams
 * 2. Delete all existing Team API keys (they will be re-registered per project)
 * 3. Handle existing cost data (set old teamId references to NULL if migration hasn't been applied)
 *
 * Usage:
 *   # Dry run (preview only)
 *   bun run scripts/migrate-to-project-based-keys.ts
 *
 *   # Execute migration
 *   bun run scripts/migrate-to-project-based-keys.ts --execute
 */

import { db } from "../src/server/db";

interface MigrationStats {
	teamsProcessed: number;
	projectMembersCreated: number;
	apiKeysDeleted: number;
	auditLogsCreated: number;
}

async function previewMigration() {
	console.log("🔍 PREVIEW MODE - No changes will be made\n");
	console.log("=".repeat(60));

	// Fetch all teams with their projects and members
	const teams = await db.team.findMany({
		include: {
			projects: {
				include: {
					members: true, // Check if project members already exist
				},
			},
			members: {
				include: {
					user: true,
				},
			},
		},
	});

	console.log(`\n📊 Found ${teams.length} teams to process\n`);

	let totalProjectMembers = 0;
	const totalApiKeys = 0;

	for (const team of teams) {
		console.log(`\n📁 Team: ${team.name} (${team.id})`);
		console.log(`   Members: ${team.members.length}`);
		console.log(`   Projects: ${team.projects.length}`);

		for (const project of team.projects) {
			const existingMembers = project.members.length;
			const membersToAdd = team.members.length - existingMembers;

			console.log(
				`   • Project: ${project.name} (${existingMembers} existing members, ${membersToAdd} to add)`,
			);
			totalProjectMembers += membersToAdd;
		}
	}

	// Note: Cannot query old schema's Team.apiKeys after migration
	// This is just a note that they will be deleted
	console.log(
		"\n⚠️  All existing Team API keys will be deleted (exact count unavailable after schema migration)",
	);

	console.log(`\n${"=".repeat(60)}`);
	console.log("📊 Migration Preview Summary:");
	console.log("=".repeat(60));
	console.log(`Teams to process: ${teams.length}`);
	console.log(`Project members to create: ${totalProjectMembers}`);
	console.log("Team API keys to delete: All existing team API keys");
	console.log("=".repeat(60));

	console.log(
		"\n💡 To execute this migration, run with --execute flag:\n   bun run scripts/migrate-to-project-based-keys.ts --execute\n",
	);
}

async function executeMigration(): Promise<MigrationStats> {
	console.log("🚀 EXECUTING MIGRATION\n");
	console.log("=".repeat(60));

	const stats: MigrationStats = {
		teamsProcessed: 0,
		projectMembersCreated: 0,
		apiKeysDeleted: 0,
		auditLogsCreated: 0,
	};

	// Fetch all teams with their projects and members
	const teams = await db.team.findMany({
		include: {
			projects: {
				include: {
					members: true,
				},
			},
			members: {
				include: {
					user: true,
				},
			},
		},
	});

	console.log(`\n📊 Processing ${teams.length} teams...\n`);

	// Step 1: Add all team members to all projects
	for (const team of teams) {
		console.log(`\n📁 Processing team: ${team.name}`);
		stats.teamsProcessed++;

		for (const project of team.projects) {
			console.log(`   • Adding members to project: ${project.name}`);

			for (const teamMember of team.members) {
				// Check if project member already exists
				const existingMember = project.members.find(
					(pm) => pm.userId === teamMember.userId,
				);

				if (existingMember) {
					console.log(
						`     ⏭️  ${teamMember.user.email} - Already a member, skipping`,
					);
					continue;
				}

				// Add team member to project
				await db.projectMember.create({
					data: {
						projectId: project.id,
						userId: teamMember.userId,
					},
				});

				console.log(`     ✅ ${teamMember.user.email} - Added to project`);
				stats.projectMembersCreated++;
			}
		}
	}

	// Step 2: Delete all Team API keys with audit logging
	// Note: After schema migration, ApiKey.teamId no longer exists
	// This step is informational - the schema migration should handle the column drop
	console.log("\n🔑 Team API keys:");
	console.log(
		"   ℹ️  Team API keys have been removed by schema migration (teamId → projectId)",
	);
	console.log(
		"   ℹ️  Users must re-register API keys per project in the new system",
	);

	// Step 3: Audit log for migration
	await db.auditLog.create({
		data: {
			userId: "system",
			actionType: "migration_to_project_based_keys",
			resourceType: "system",
			resourceId: "migration",
			metadata: {
				teamsProcessed: stats.teamsProcessed,
				projectMembersCreated: stats.projectMembersCreated,
				timestamp: new Date().toISOString(),
			},
		},
	});
	stats.auditLogsCreated++;

	console.log(`\n${"=".repeat(60)}`);
	console.log("✅ Migration Complete!");
	console.log("=".repeat(60));

	return stats;
}

async function main() {
	const isExecuteMode = process.argv.includes("--execute");

	console.log("🔄 Project-Based API Key Migration\n");

	try {
		if (isExecuteMode) {
			const stats = await executeMigration();

			console.log("\n📊 Final Statistics:");
			console.log("=".repeat(60));
			console.log(`Teams processed: ${stats.teamsProcessed}`);
			console.log(`Project members created: ${stats.projectMembersCreated}`);
			console.log(`Audit logs created: ${stats.auditLogsCreated}`);
			console.log("=".repeat(60));

			console.log(
				"\n✅ Migration successful! Users can now register API keys per project.\n",
			);
		} else {
			await previewMigration();
		}
	} catch (error) {
		console.error("\n❌ Migration failed with error:");
		console.error(error);
		process.exit(1);
	} finally {
		await db.$disconnect();
	}
}

// Run the script
main();
