#!/usr/bin/env bun

/**
 * Test Data Seed Script
 *
 * Creates sample data for integration testing:
 * - Test users with teams
 * - Projects with metrics
 * - API keys
 * - Sample cost data
 *
 * Usage:
 *   # Seed test data
 *   bun run scripts/seed-test-data.ts
 *
 *   # Clean all test data
 *   bun run scripts/seed-test-data.ts --clean
 */

import bcrypt from "bcrypt";
import { db } from "../src/server/db";

const BCRYPT_ROUNDS = 10;

interface TestUser {
	email: string;
	password: string;
	name: string;
	teamName: string;
	budget?: number;
}

const TEST_USERS: TestUser[] = [
	{
		email: "test1@example.com",
		password: "test1234",
		name: "테스트 사용자 1",
		teamName: "AI 개발팀",
		budget: 1000,
	},
	{
		email: "test2@example.com",
		password: "test1234",
		name: "테스트 사용자 2",
		teamName: "데이터 분석팀",
		budget: 500,
	},
	{
		email: "test3@example.com",
		password: "test1234",
		name: "테스트 사용자 3",
		teamName: "프로덕트팀",
	},
];

async function cleanTestData() {
	console.log("🧹 Cleaning test data...\n");

	// Delete users by email pattern
	const testEmails = TEST_USERS.map((u) => u.email);

	// Find test users
	const testUsers = await db.user.findMany({
		where: { email: { in: testEmails } },
		select: { id: true, email: true },
	});

	if (testUsers.length === 0) {
		console.log("✅ No test data found to clean.");
		return;
	}

	console.log(`Found ${testUsers.length} test users to delete:`);
	for (const user of testUsers) {
		console.log(`   - ${user.email}`);
	}

	// Delete users (cascade will handle teams, projects, etc.)
	await db.user.deleteMany({
		where: { id: { in: testUsers.map((u) => u.id) } },
	});

	console.log(`\n✅ Cleaned ${testUsers.length} test users and related data.`);
}

async function seedTestData() {
	console.log("🌱 Seeding test data...\n");

	let createdCount = 0;
	let skippedCount = 0;

	for (const testUser of TEST_USERS) {
		// Check if user already exists
		const existing = await db.user.findUnique({
			where: { email: testUser.email },
		});

		if (existing) {
			console.log(`⏭️  ${testUser.email} - Already exists, skipping`);
			skippedCount++;
			continue;
		}

		// Hash password
		const passwordHash = await bcrypt.hash(testUser.password, BCRYPT_ROUNDS);

		// Create user with team
		const user = await db.user.create({
			data: {
				email: testUser.email,
				passwordHash,
				name: testUser.name,
				teamMemberships: {
					create: {
						role: "owner",
						team: {
							create: {
								name: testUser.teamName,
								budget: testUser.budget,
							},
						},
					},
				},
			},
			include: {
				teamMemberships: {
					include: {
						team: true,
					},
				},
			},
		});

		console.log(
			`✅ ${testUser.email} - User & Team created (${user.teamMemberships[0]?.team.name})`,
		);
		createdCount++;

		// Create sample project for the team
		const teamId = user.teamMemberships[0]?.teamId;
		if (teamId) {
			const project = await db.project.create({
				data: {
					name: `샘플 프로젝트 - ${testUser.name}`,
					description: "통합 테스트용 샘플 프로젝트입니다.",
					teamId,
					metrics: {
						create: {
							successCount: Math.floor(Math.random() * 100),
							feedbackScore: 3 + Math.random() * 2, // 3-5
						},
					},
				},
			});

			console.log(`   📁 Project created: ${project.name}`);
		}
	}

	console.log(`\n${"=".repeat(50)}`);
	console.log("📊 Seed Summary");
	console.log("=".repeat(50));
	console.log(`✅ Created: ${createdCount} users`);
	console.log(`⏭️  Skipped: ${skippedCount} (already exist)`);
	console.log("=".repeat(50));

	if (createdCount > 0) {
		console.log("\n💡 Test Credentials:");
		console.log("   Email: test1@example.com");
		console.log("   Password: test1234");
		console.log("\n   (All test users use password: test1234)");
	}
}

async function main() {
	const isCleanMode = process.argv.includes("--clean");

	console.log("🧪 Test Data Seed Script\n");

	if (isCleanMode) {
		await cleanTestData();
	} else {
		await seedTestData();
	}
}

// Run the script
main()
	.catch((error) => {
		console.error("\n❌ Seed script failed with error:");
		console.error(error);
		process.exit(1);
	})
	.finally(async () => {
		await db.$disconnect();
	});
