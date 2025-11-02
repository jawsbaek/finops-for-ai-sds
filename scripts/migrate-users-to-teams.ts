#!/usr/bin/env bun

/**
 * User to Team Migration Script
 *
 * Creates default teams for existing users who don't have any team membership.
 * This is a one-time migration to fix users created before the auto-team feature.
 *
 * Usage:
 *   # Dry run (preview only)
 *   bun run scripts/migrate-users-to-teams.ts
 *
 *   # Actually run the migration
 *   bun run scripts/migrate-users-to-teams.ts --execute
 */

import { db } from "../src/server/db";

const DRY_RUN = !process.argv.includes("--execute");

interface UserWithoutTeam {
	id: string;
	email: string;
	name: string | null;
}

async function main() {
	console.log("🔍 User to Team Migration Script\n");

	if (DRY_RUN) {
		console.log("⚠️  DRY RUN MODE - No changes will be made");
		console.log("   Run with --execute to apply changes\n");
	} else {
		console.log("🚀 EXECUTION MODE - Changes will be applied\n");
	}

	// Find all users without team memberships
	console.log("📊 Finding users without teams...");
	const usersWithoutTeams = await db.user.findMany({
		where: {
			teamMemberships: {
				none: {},
			},
		},
		select: {
			id: true,
			email: true,
			name: true,
		},
	});

	if (usersWithoutTeams.length === 0) {
		console.log("✅ All users already have teams. Nothing to migrate.");
		process.exit(0);
	}

	console.log(
		`\n📋 Found ${usersWithoutTeams.length} user(s) without teams:\n`,
	);

	for (const user of usersWithoutTeams) {
		const teamName = `${user.name || user.email.split("@")[0]}'s Team`;
		console.log(`   • ${user.email} → "${teamName}"`);
	}

	if (DRY_RUN) {
		console.log("\n⏸️  Dry run complete. Use --execute to apply changes.");
		process.exit(0);
	}

	// Execute migration
	console.log("\n🔄 Starting migration...\n");

	let successCount = 0;
	let errorCount = 0;

	for (const user of usersWithoutTeams) {
		const teamName = `${user.name || user.email.split("@")[0]}'s Team`;

		try {
			await db.team.create({
				data: {
					name: teamName,
					members: {
						create: {
							userId: user.id,
							role: "owner",
						},
					},
				},
			});

			console.log(`   ✅ ${user.email} → Team created`);
			successCount++;
		} catch (error) {
			console.error(`   ❌ ${user.email} → Failed:`, error);
			errorCount++;
		}
	}

	// Summary
	console.log(`\n${"=".repeat(50)}`);
	console.log("📊 Migration Summary");
	console.log("=".repeat(50));
	console.log(`✅ Success: ${successCount}`);
	console.log(`❌ Failed:  ${errorCount}`);
	console.log(`📊 Total:   ${usersWithoutTeams.length}`);
	console.log(`${"=".repeat(50)}\n`);

	if (errorCount > 0) {
		console.error("⚠️  Some migrations failed. Please check the errors above.");
		process.exit(1);
	} else {
		console.log("🎉 Migration completed successfully!");
		process.exit(0);
	}
}

// Run the migration
main()
	.catch((error) => {
		console.error("\n❌ Migration failed with error:");
		console.error(error);
		process.exit(1);
	})
	.finally(async () => {
		await db.$disconnect();
	});
