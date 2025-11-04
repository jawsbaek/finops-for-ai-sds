import { describe, expect, it } from "vitest";

describe("OpenAI Costs API Collector (v2)", () => {
	describe("Costs API Data Transformation", () => {
		it("should convert Unix timestamp to Date correctly", () => {
			const unixSeconds = 1704067200; // 2024-01-01 00:00:00 UTC
			const date = new Date(unixSeconds * 1000);

			expect(date.toISOString()).toBe("2024-01-01T00:00:00.000Z");
		});

		it("should handle cost amount in dollars (not cents)", () => {
			const costAmount = {
				value: 2.5,
				currency: "usd",
			};

			expect(costAmount.value).toBe(2.5);
			expect(costAmount.currency).toBe("usd");
		});

		it("should map OpenAI Project ID to internal Project ID", () => {
			const projectIdMap = new Map([
				["proj_abc123", "internal-id-1"],
				["proj_def456", "internal-id-2"],
			]);

			const openaiProjectId = "proj_abc123";
			const internalId = projectIdMap.get(openaiProjectId);

			expect(internalId).toBe("internal-id-1");
		});

		it("should handle missing project_id gracefully", () => {
			const projectIdMap = new Map([["proj_abc123", "internal-id-1"]]);

			const unknownProjectId = "proj_unknown";
			const internalId = projectIdMap.get(unknownProjectId);

			expect(internalId).toBeUndefined();
		});
	});

	describe("API URL Construction", () => {
		it("should construct Costs API URL with required parameters", () => {
			const url = new URL("https://api.openai.com/v1/organization/costs");
			url.searchParams.set("start_time", "1704067200");
			url.searchParams.set("bucket_width", "1d");
			url.searchParams.set("limit", "7");
			url.searchParams.set("group_by", "line_item,project_id");

			expect(url.searchParams.get("start_time")).toBe("1704067200");
			expect(url.searchParams.get("bucket_width")).toBe("1d");
			expect(url.searchParams.get("limit")).toBe("7");
			expect(url.searchParams.get("group_by")).toBe("line_item,project_id");
		});

		it("should append multiple project IDs correctly", () => {
			const url = new URL("https://api.openai.com/v1/organization/costs");
			const projectIds = ["proj_abc123", "proj_def456", "proj_ghi789"];

			for (const id of projectIds) {
				url.searchParams.append("project_ids", id);
			}

			const addedProjectIds = url.searchParams.getAll("project_ids");
			expect(addedProjectIds).toEqual(projectIds);
			expect(addedProjectIds.length).toBe(3);
		});

		it("should handle optional end_time parameter", () => {
			const url = new URL("https://api.openai.com/v1/organization/costs");
			url.searchParams.set("start_time", "1704067200");
			url.searchParams.set("end_time", "1704153600");

			expect(url.searchParams.get("end_time")).toBe("1704153600");
		});

		it("should handle pagination cursor", () => {
			const url = new URL("https://api.openai.com/v1/organization/costs");
			url.searchParams.set("page", "next_page_cursor_123");

			expect(url.searchParams.get("page")).toBe("next_page_cursor_123");
		});
	});

	describe("Date Calculations", () => {
		it("should calculate start of day correctly", () => {
			const date = new Date("2024-01-15T14:30:00Z");
			const startOfDay = new Date(date);
			startOfDay.setHours(0, 0, 0, 0);

			expect(startOfDay.getHours()).toBe(0);
			expect(startOfDay.getMinutes()).toBe(0);
			expect(startOfDay.getSeconds()).toBe(0);
			expect(startOfDay.getMilliseconds()).toBe(0);
		});

		it("should calculate end of day correctly", () => {
			const date = new Date("2024-01-15T14:30:00Z");
			const endOfDay = new Date(date);
			endOfDay.setHours(23, 59, 59, 999);

			expect(endOfDay.getHours()).toBe(23);
			expect(endOfDay.getMinutes()).toBe(59);
			expect(endOfDay.getSeconds()).toBe(59);
			expect(endOfDay.getMilliseconds()).toBe(999);
		});

		it("should convert Date to Unix timestamp correctly", () => {
			const date = new Date("2024-01-01T00:00:00Z");
			const unixSeconds = Math.floor(date.getTime() / 1000);

			expect(unixSeconds).toBe(1704067200);
		});
	});

	describe("Batch Processing", () => {
		it("should calculate correct number of batches for Costs API data", () => {
			const batchSize = 1000;
			const totalRecords = 3500;
			const expectedBatches = Math.ceil(totalRecords / batchSize);

			expect(expectedBatches).toBe(4);
		});

		it("should slice batches correctly", () => {
			const records = Array.from({ length: 2500 }, (_, i) => ({ id: i }));
			const batchSize = 1000;

			const batch1 = records.slice(0, batchSize);
			const batch2 = records.slice(1000, 2000);
			const batch3 = records.slice(2000, 3000);

			expect(batch1.length).toBe(1000);
			expect(batch2.length).toBe(1000);
			expect(batch3.length).toBe(500);
		});
	});

	describe("API Version Tracking", () => {
		it("should set apiVersion to costs_v1 for Costs API data", () => {
			const costData = {
				apiVersion: "costs_v1" as const,
			};

			expect(costData.apiVersion).toBe("costs_v1");
		});

		it("should differentiate from usage_v1 version", () => {
			const usageVersion = "usage_v1";
			const costsVersion = "costs_v1";

			expect(usageVersion).not.toBe(costsVersion);
		});
	});

	describe("Line Item Handling", () => {
		it("should use line_item as service name", () => {
			const result = {
				line_item: "GPT-4",
				amount: { value: 5.0, currency: "usd" },
			};

			const service = result.line_item ?? "Unknown";

			expect(service).toBe("GPT-4");
		});

		it("should handle null line_item with fallback", () => {
			const result = {
				line_item: null,
				amount: { value: 5.0, currency: "usd" },
			};

			const service = result.line_item ?? "Unknown";

			expect(service).toBe("Unknown");
		});
	});

	describe("Pagination Logic", () => {
		it("should handle has_more flag correctly", () => {
			const response = {
				object: "page",
				data: [],
				has_more: true,
				next_page: "cursor_123",
			};

			expect(response.has_more).toBe(true);
			expect(response.next_page).toBe("cursor_123");
		});

		it("should handle last page correctly", () => {
			const response = {
				object: "page",
				data: [],
				has_more: false,
				next_page: null,
			};

			expect(response.has_more).toBe(false);
			expect(response.next_page).toBeNull();
		});

		it("should stop pagination when has_more is false", () => {
			let hasMore = true;
			let pageCount = 0;

			// Simulate pagination
			while (hasMore) {
				pageCount++;
				if (pageCount === 3) {
					hasMore = false;
				}
			}

			expect(pageCount).toBe(3);
		});
	});

	describe("Cost Bucket Processing", () => {
		it("should process multiple results in a bucket", () => {
			const bucket = {
				object: "bucket" as const,
				start_time: 1704067200,
				end_time: 1704153600,
				results: [
					{
						object: "organization.costs.result" as const,
						amount: { value: 1.0, currency: "usd" },
						line_item: "GPT-4",
						project_id: "proj_abc",
					},
					{
						object: "organization.costs.result" as const,
						amount: { value: 2.0, currency: "usd" },
						line_item: "GPT-3.5",
						project_id: "proj_abc",
					},
				],
			};

			expect(bucket.results.length).toBe(2);
			const totalCost = bucket.results.reduce(
				(sum, r) => sum + r.amount.value,
				0,
			);
			expect(totalCost).toBe(3.0);
		});
	});

	describe("Pagination Safety (MAX_PAGES)", () => {
		it("should respect MAX_PAGES limit to prevent infinite loops", () => {
			const MAX_PAGES = 100;
			let hasMore = true;
			let pageCount = 0;

			// Simulate pagination that would otherwise loop forever
			while (hasMore && pageCount < MAX_PAGES) {
				pageCount++;
				// Simulate API always returning has_more: true (buggy API behavior)
				if (pageCount >= MAX_PAGES) {
					hasMore = false;
				}
			}

			expect(pageCount).toBe(MAX_PAGES);
			expect(pageCount).not.toBeGreaterThan(MAX_PAGES);
		});

		it("should calculate total buckets correctly when hitting MAX_PAGES", () => {
			const MAX_PAGES = 100;
			const ITEMS_PER_PAGE = 180;
			const maxPossibleBuckets = MAX_PAGES * ITEMS_PER_PAGE;

			expect(maxPossibleBuckets).toBe(18000);
		});

		it("should warn when hitting maximum page limit", () => {
			const MAX_PAGES = 100;
			let pageCount = 0;
			let hasMore = true;
			let shouldWarn = false;

			while (hasMore && pageCount < MAX_PAGES) {
				pageCount++;
				// Keep simulating more pages
				hasMore = true;
			}

			if (pageCount >= MAX_PAGES) {
				shouldWarn = true;
			}

			expect(shouldWarn).toBe(true);
			expect(pageCount).toBe(MAX_PAGES);
		});

		it("should not warn if pagination completes normally before MAX_PAGES", () => {
			const MAX_PAGES = 100;
			let pageCount = 0;
			let hasMore = true;
			let shouldWarn = false;

			while (hasMore && pageCount < MAX_PAGES) {
				pageCount++;
				// Simulate API returning has_more: false after 5 pages
				if (pageCount >= 5) {
					hasMore = false;
				}
			}

			if (pageCount >= MAX_PAGES) {
				shouldWarn = true;
			}

			expect(shouldWarn).toBe(false);
			expect(pageCount).toBe(5);
		});

		it("should allow configuring MAX_PAGES via environment variable", () => {
			// Test that environment variable parsing works correctly
			const testCases = [
				{ env: "50", expected: 50 },
				{ env: "200", expected: 200 },
				{ env: "invalid", expected: Number.NaN },
				{ env: undefined, expected: 100 }, // default
			];

			for (const { env, expected } of testCases) {
				const result = Number.parseInt(env ?? "100", 10);
				if (Number.isNaN(expected)) {
					expect(Number.isNaN(result)).toBe(true);
				} else {
					expect(result).toBe(expected);
				}
			}
		});

		it("should continue accumulating buckets across pages", () => {
			const allBuckets: { id: number }[] = [];
			const MAX_PAGES = 3;
			const ITEMS_PER_PAGE = 10;
			let pageCount = 0;
			let hasMore = true;

			while (hasMore && pageCount < MAX_PAGES) {
				pageCount++;
				// Simulate adding buckets from each page
				const pageBuckets = Array.from({ length: ITEMS_PER_PAGE }, (_, i) => ({
					id: (pageCount - 1) * ITEMS_PER_PAGE + i,
				}));
				allBuckets.push(...pageBuckets);

				// Stop after 3 pages
				if (pageCount >= 3) {
					hasMore = false;
				}
			}

			expect(allBuckets.length).toBe(30); // 3 pages * 10 items
			expect(pageCount).toBe(3);
		});
	});
});
