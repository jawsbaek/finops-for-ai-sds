import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Test user credentials
 */
export interface TestUser {
	id: string;
	email: string;
	password: string;
	name: string;
}

/**
 * Generate unique test user credentials
 */
export function generateTestUser(): TestUser {
	const uniqueId = randomUUID().slice(0, 8);
	return {
		id: uniqueId,
		email: `test-${uniqueId}@example.com`,
		password: "SecurePass123!",
		name: `Test User ${uniqueId}`,
	};
}

/**
 * Sign up a new user and wait for redirect to dashboard
 */
export async function signupUser(page: Page, user: TestUser): Promise<void> {
	await page.goto("/signup");
	await page.fill('input[name="name"]', user.name);
	await page.fill('input[name="email"]', user.email);
	await page.fill('input[name="password"]', user.password);

	await Promise.all([
		page.waitForURL(/\/dashboard/, { timeout: 30000 }),
		page.click('button[type="submit"]'),
	]);

	// Verify dashboard loaded successfully
	await expect(page.locator("h2").first()).toContainText(/Welcome to FinOps/, {
		timeout: 10000,
	});
}

/**
 * Create a new team
 */
export async function createTeam(page: Page, teamName: string): Promise<void> {
	await page.goto("/teams");
	await page.click(
		'button:has-text("팀 생성"), button:has-text("Create Team")',
	);

	// Fill team creation form
	await page.waitForSelector("input#name");
	await page.fill("input#name", teamName);

	// Wait for create button and click
	const createButton = page.locator('button:has-text("생성")').last();
	await createButton.waitFor({ state: "visible" });
	await expect(createButton).toBeEnabled({ timeout: 5000 });
	await createButton.click();

	// Wait for navigation to team detail page
	await page.waitForURL(/\/teams\/[^/]+$/, { timeout: 15000 });

	// Verify team page loaded
	await expect(page.locator("h2").first()).toContainText(teamName, {
		timeout: 10000,
	});
}

/**
 * Create a new project
 */
export async function createProject(
	page: Page,
	projectName: string,
	description = "Test project description",
): Promise<void> {
	await page.goto("/projects");
	await page.click('button:has-text("새 프로젝트")');

	// Fill project creation form
	await page.waitForSelector("input#name");
	await page.fill("input#name", projectName);
	await page.fill("textarea#description", description);

	// Wait for create button and click
	const createButton = page.locator('button:has-text("생성")').last();
	await createButton.waitFor({ state: "visible" });
	await expect(createButton).toBeEnabled({ timeout: 5000 });
	await createButton.click();

	// Wait for navigation to project detail page
	await page.waitForURL(/\/projects\/[^/]+$/, { timeout: 15000 });

	// Verify project page loaded
	await expect(page.locator("h2").first()).toContainText(projectName, {
		timeout: 10000,
	});
}

/**
 * Navigate to a page and verify it loaded
 */
export async function navigateAndVerify(
	page: Page,
	path: string,
	headingPattern: string | RegExp,
): Promise<void> {
	await page.goto(path);
	await expect(page.locator("h2").first()).toContainText(headingPattern);
}

/**
 * Setup test user with signup (use at the start of tests)
 */
export async function setupTestUser(page: Page): Promise<TestUser> {
	const user = generateTestUser();
	await signupUser(page, user);
	return user;
}

/**
 * Check if element exists on page
 */
export async function elementExists(
	page: Page,
	selector: string,
): Promise<boolean> {
	return (await page.locator(selector).count()) > 0;
}
