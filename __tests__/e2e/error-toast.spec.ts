import { expect, test } from "@playwright/test";
import { setupTestUser } from "./helpers";

/**
 * Error Toast Verification Tests
 *
 * Verifies that error toasts appear when API calls fail
 */

test.describe("Error Toast Handling", () => {
	test("should show error toast when login fails", async ({ page }) => {
		await page.goto("/login");

		// Fill in invalid credentials
		await page.fill('input[name="email"]', "invalid@example.com");
		await page.fill('input[name="password"]', "wrongpassword123");

		// Submit the form
		await page.click('button[type="submit"]');

		// Wait for the error toast to appear
		const toast = page.locator('[data-sonner-toast][data-type="error"]');
		await expect(toast).toBeVisible({ timeout: 5000 });

		// Verify the error message contains expected text
		await expect(toast).toContainText(/로그인 실패|Invalid/i);
	});

	test("should show error toast when signup fails with existing email", async ({
		page,
	}) => {
		// First, setup a test user
		await setupTestUser(page);

		// Logout
		await page.goto("/login");

		// Go to signup page
		await page.goto("/signup");

		// Try to signup with the same email
		await page.fill('input[name="name"]', "Test User");
		await page.fill('input[name="email"]', "test@example.com");
		await page.fill('input[name="password"]', "testpassword123");

		// Submit the form
		await page.click('button[type="submit"]');

		// Wait for the error toast to appear
		const toast = page.locator('[data-sonner-toast][data-type="error"]');
		await expect(toast).toBeVisible({ timeout: 5000 });

		// Verify the error message
		await expect(toast).toContainText(/회원가입 실패|Failed/i);
	});

	test("should show error toast when team creation fails", async ({ page }) => {
		// Setup test user
		await setupTestUser(page);

		// Navigate to teams page
		await page.goto("/teams");

		// Open the create team dialog
		await page.click('button:has-text("새 팀 생성")');

		// Mock API to return error
		await page.route("**/api/trpc/team.create*", (route) => {
			route.fulfill({
				status: 500,
				contentType: "application/json",
				body: JSON.stringify({
					error: {
						message: "Team creation failed - test error",
						code: "INTERNAL_SERVER_ERROR",
					},
				}),
			});
		});

		// Try to create a team (leave name empty to trigger client-side validation first)
		await page.fill('input[id="name"]', "Test Team");
		await page.click('button:has-text("생성")');

		// Wait for the error toast to appear
		const toast = page.locator('[data-sonner-toast][data-type="error"]');
		await expect(toast).toBeVisible({ timeout: 5000 });

		// Verify the error message
		await expect(toast).toContainText(/팀 생성 실패|failed/i);
	});

	test("should show error toast when project creation fails", async ({
		page,
	}) => {
		// Setup test user and create a team first
		await setupTestUser(page);
		await page.goto("/teams");
		await page.click('button:has-text("새 팀 생성")');
		await page.fill('input[id="name"]', "Test Team");
		await page.click('button:has-text("생성")');
		await page.waitForTimeout(1000);

		// Navigate to projects page
		await page.goto("/projects");

		// Open create project dialog
		await page.click('button:has-text("새 프로젝트")');

		// Mock API to return error
		await page.route("**/api/trpc/project.create*", (route) => {
			route.fulfill({
				status: 500,
				contentType: "application/json",
				body: JSON.stringify({
					error: {
						message: "Project creation failed - test error",
						code: "INTERNAL_SERVER_ERROR",
					},
				}),
			});
		});

		// Try to create a project
		await page.fill('input[id="name"]', "Test Project");
		await page.click('button:has-text("생성")');

		// Wait for the error toast to appear
		const toast = page.locator('[data-sonner-toast][data-type="error"]');
		await expect(toast).toBeVisible({ timeout: 5000 });

		// Verify the error message
		await expect(toast).toContainText(/프로젝트 생성 실패|failed/i);
	});

	test("should show error toast when API key generation fails", async ({
		page,
	}) => {
		// Setup test user, team, and project
		await setupTestUser(page);

		// Create team
		await page.goto("/teams");
		await page.click('button:has-text("새 팀 생성")');
		await page.fill('input[id="name"]', "Test Team");
		await page.click('button:has-text("생성")');
		await page.waitForTimeout(1000);

		// Create project
		await page.goto("/projects");
		await page.click('button:has-text("새 프로젝트")');
		await page.fill('input[id="name"]', "Test Project");
		await page.click('button:has-text("생성")');
		await page.waitForTimeout(1000);

		// Mock API to return error for API key generation
		await page.route("**/api/trpc/project.generateApiKey*", (route) => {
			route.fulfill({
				status: 500,
				contentType: "application/json",
				body: JSON.stringify({
					error: {
						message: "API key generation failed - test error",
						code: "INTERNAL_SERVER_ERROR",
					},
				}),
			});
		});

		// Try to add an API key
		await page.click('button:has-text("API 키 추가")');
		await page.fill(
			'input[placeholder*="sk-"]',
			"sk-test-invalid-key-for-testing",
		);
		await page.click('button:has-text("추가")');

		// Wait for the error toast to appear
		const toast = page.locator('[data-sonner-toast][data-type="error"]');
		await expect(toast).toBeVisible({ timeout: 5000 });

		// Verify the error message
		await expect(toast).toContainText(/API 키 추가 실패|failed/i);
	});

	test("should show error toast when alert threshold setting fails", async ({
		page,
	}) => {
		// Setup test user, team, and project
		await setupTestUser(page);

		// Create team
		await page.goto("/teams");
		await page.click('button:has-text("새 팀 생성")');
		await page.fill('input[id="name"]', "Test Team");
		await page.click('button:has-text("생성")');
		await page.waitForTimeout(1000);

		// Create project
		await page.goto("/projects");
		await page.click('button:has-text("새 프로젝트")');
		await page.fill('input[id="name"]', "Test Project");
		await page.click('button:has-text("생성")');
		await page.waitForTimeout(2000);

		// Get the project ID from URL and navigate to settings
		const projectId = page.url().split("/projects/")[1];
		await page.goto(`/projects/${projectId}/settings`);

		// Mock API to return error
		await page.route("**/api/trpc/alert.setThreshold*", (route) => {
			route.fulfill({
				status: 500,
				contentType: "application/json",
				body: JSON.stringify({
					error: {
						message: "Threshold setting failed - test error",
						code: "INTERNAL_SERVER_ERROR",
					},
				}),
			});
		});

		// Try to set threshold
		await page.fill('input[id="threshold-value"]', "100");
		await page.click('button[type="submit"]');

		// Wait for the error toast to appear
		const toast = page.locator('[data-sonner-toast][data-type="error"]');
		await expect(toast).toBeVisible({ timeout: 5000 });

		// Verify the error message
		await expect(toast).toContainText(/설정 실패|failed/i);
	});
});
