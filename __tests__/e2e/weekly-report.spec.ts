import { expect, test } from "@playwright/test";
import { elementExists, navigateAndVerify, setupTestUser } from "./helpers";

/**
 * E2E Test: 주간 리포트 UI 플로우 검증
 *
 * Note: 현재 구현의 UI 플로우와 접근성을 검증하는 단순화된 테스트
 * 실제 backend 통합 및 리포트 생성 기능은 별도 통합 테스트에서 검증
 */

test.describe("Weekly Report", () => {
	test("should access reports page and verify UI elements", async ({
		page,
	}) => {
		// Setup test user
		await setupTestUser(page);

		// Navigate to reports page and verify
		await navigateAndVerify(
			page,
			"/reports",
			/주간 리포트 아카이브|Weekly.*Report/i,
		);

		// Check for empty state message (likely no reports yet)
		if (await elementExists(page, "text=/리포트가 없습니다|No reports/i")) {
			const emptyState = page.locator("text=/리포트가 없습니다|No reports/i");
			await expect(emptyState).toBeVisible();
		}
	});

	test("should verify report page shows appropriate content", async ({
		page,
	}) => {
		// Setup test user
		await setupTestUser(page);

		// Navigate to reports page
		await page.goto("/reports");

		// Verify page structure
		await expect(page.locator("h2").first()).toBeVisible();

		// Check for loading indicator or content
		const hasLoading = await elementExists(page, '[class*="animate-spin"]');
		const hasContent = await elementExists(
			page,
			"text=/리포트|Report|효율|efficiency/i",
		);

		// Either loading indicator or content should be present
		expect(hasLoading || hasContent).toBeTruthy();
	});

	test("should verify navigation between dashboard and reports", async ({
		page,
	}) => {
		// Setup test user
		await setupTestUser(page);

		// Test navigation between dashboard and reports
		await navigateAndVerify(page, "/reports", /주간 리포트/);
		await navigateAndVerify(page, "/dashboard", /Welcome to FinOps/);
		await navigateAndVerify(page, "/reports", /주간 리포트/);
	});

	test("should verify reports page doesn't have errors", async ({ page }) => {
		// Setup test user
		await setupTestUser(page);

		// Collect console errors
		const consoleLogs: string[] = [];
		page.on("console", (msg) => {
			if (msg.type() === "error") {
				consoleLogs.push(msg.text());
			}
		});

		// Navigate to reports page
		await page.goto("/reports");

		// Wait for page to fully load
		await page.waitForLoadState("networkidle");

		// Verify page loaded successfully (has heading)
		await expect(page.locator("h2").first()).toBeVisible();

		// Check for critical console errors (optional - may have some warnings)
		const criticalErrors = consoleLogs.filter((log) =>
			log.includes("Uncaught"),
		);
		expect(criticalErrors.length).toBe(0);
	});
});
