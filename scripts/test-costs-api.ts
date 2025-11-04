#!/usr/bin/env bun
/**
 * Test Script: OpenAI Costs API Connection
 *
 * Tests the connection to OpenAI Costs API for a specific team:
 * 1. Fetches team's Admin API Key
 * 2. Decrypts the key
 * 3. Calls OpenAI Costs API
 * 4. Validates response
 *
 * Usage:
 *   bun run scripts/test-costs-api.ts <teamId>
 */

import pino from "pino";
import { collectDailyCostsV2 } from "~/lib/services/openai/cost-collector-v2";

const logger = pino({ name: "test-costs-api" });

async function testCostsAPI(teamId: string) {
	logger.info({ teamId }, "Testing Costs API for team");

	try {
		// Use yesterday's date for testing
		const yesterday = new Date();
		yesterday.setDate(yesterday.getDate() - 1);

		logger.info(
			{ date: yesterday.toISOString().split("T")[0] },
			"Fetching costs for date",
		);

		// Collect costs using the v2 collector
		const costs = await collectDailyCostsV2(teamId, yesterday);

		// Calculate summary
		const totalCost = costs.reduce((sum, c) => sum + c.cost, 0);
		const uniqueProjects = new Set(costs.map((c) => c.projectId));
		const uniqueLineItems = new Set(costs.map((c) => c.lineItem));

		logger.info(
			{
				teamId,
				recordCount: costs.length,
				totalCost: totalCost.toFixed(2),
				uniqueProjects: uniqueProjects.size,
				uniqueLineItems: uniqueLineItems.size,
			},
			"✅ Costs API test successful",
		);

		// Show breakdown by line item
		console.log("\n📊 Cost Breakdown by Line Item:");
		const lineItemCosts = new Map<string, number>();
		for (const cost of costs) {
			const lineItem = cost.lineItem ?? "Unknown";
			lineItemCosts.set(
				lineItem,
				(lineItemCosts.get(lineItem) ?? 0) + cost.cost,
			);
		}

		for (const [lineItem, cost] of lineItemCosts.entries()) {
			console.log(`  ${lineItem}: $${cost.toFixed(2)}`);
		}

		console.log(`\n💰 Total Cost: $${totalCost.toFixed(2)}`);
		console.log(`📦 Projects: ${uniqueProjects.size}`);
		console.log(`📋 Records: ${costs.length}`);

		return costs;
	} catch (error) {
		logger.error({ teamId, error }, "❌ Costs API test failed");
		throw error;
	}
}

// Main execution function
async function main() {
	const teamId = process.argv[2];

	if (!teamId) {
		console.error("Usage: bun run scripts/test-costs-api.ts <teamId>");
		process.exit(1);
	}

	try {
		await testCostsAPI(teamId);
		process.exit(0);
	} catch (error) {
		console.error("\n❌ Test failed:");
		console.error(error instanceof Error ? error.message : String(error));
		process.exit(1);
	}
}

// Execute main function
main().catch((error) => {
	logger.error({ error }, "Script failed");
	console.error(error);
	process.exit(1);
});
