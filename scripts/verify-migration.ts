#!/usr/bin/env bun

import { db } from "../src/server/db";

async function verifyMigration() {
	console.log("🔍 Verifying Migration Results\n");

	// Check project members
	const projectMembers = await db.projectMember.findMany({
		include: {
			user: { select: { email: true } },
			project: { select: { name: true } },
		},
	});

	console.log("📊 Project Members:");
	for (const pm of projectMembers) {
		console.log(`  ✓ ${pm.user.email} → ${pm.project.name}`);
	}

	// Check API keys
	const apiKeys = await db.apiKey.findMany({
		select: {
			id: true,
			provider: true,
			isActive: true,
			project: { select: { name: true } },
		},
	});

	console.log(`\n🔑 API Keys (${apiKeys.length} total):`);
	for (const key of apiKeys) {
		console.log(
			`  • ${key.provider} (${key.isActive ? "Active" : "Inactive"}) → ${key.project.name}`,
		);
	}

	// Check audit log
	const auditLog = await db.auditLog.findFirst({
		where: { actionType: "migration_to_project_based_keys" },
		orderBy: { createdAt: "desc" },
	});

	console.log(
		`\n📝 Migration Audit Log: ${auditLog ? "✅ Created" : "❌ Not found"}`,
	);
	if (auditLog) {
		console.log(`   Timestamp: ${auditLog.createdAt.toISOString()}`);
	}

	await db.$disconnect();
}

verifyMigration().catch(console.error);
