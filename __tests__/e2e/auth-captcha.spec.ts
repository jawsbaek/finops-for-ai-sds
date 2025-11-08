import { expect, test } from "@playwright/test";
import { generateTestUser } from "./helpers";

/**
 * Authentication Flow E2E Tests with CAPTCHA Integration
 *
 * Tests the complete authentication flow including:
 * - Signup with CAPTCHA
 * - Login with CAPTCHA
 * - Error handling for invalid credentials
 * - CAPTCHA bypass in test mode
 */

test.describe("Authentication with CAPTCHA", () => {
	test.beforeEach(async ({ page }) => {
		// Mock Cap.js API endpoints to avoid real proof-of-work computation in tests
		// This simulates the CAPTCHA flow without actual SHA-256 computation

		// Mock challenge endpoint
		await page.route("**/api/cap/challenge", (route) => {
			route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					success: true,
					token: "test-challenge-token",
					challenges: Array(50).fill(new Array(32).fill(0)),
					challengeDifficulty: 50,
					expiresMs: 600000,
				}),
			});
		});

		// Mock redeem endpoint
		await page.route("**/api/cap/redeem", (route) => {
			route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					success: true,
					token: "test-captcha-token-verified",
				}),
			});
		});
	});

	test("successful signup with CAPTCHA", async ({ page }) => {
		const user = generateTestUser();

		// Navigate to signup page
		await page.goto("/signup");
		await expect(page).toHaveTitle(/FinOps for AI/);

		// Verify signup form is visible
		await expect(
			page.locator('input[name="name"], input[id="name"]'),
		).toBeVisible();
		await expect(
			page.locator('input[name="email"], input[type="email"]'),
		).toBeVisible();
		await expect(
			page.locator('input[name="password"], input[type="password"]'),
		).toBeVisible();

		// Fill signup form
		await page.fill('input[name="name"], input[id="name"]', user.name);
		await page.fill('input[name="email"], input[type="email"]', user.email);
		await page.fill(
			'input[name="password"], input[type="password"]',
			user.password,
		);

		// Submit form (CAPTCHA will be triggered automatically)
		const submitButton = page.locator('button[type="submit"]');
		await expect(submitButton).toBeEnabled();

		// Click submit and wait for navigation
		await Promise.all([
			page.waitForURL(/\/dashboard/, { timeout: 30000 }),
			submitButton.click(),
		]);

		// Verify successful redirect to dashboard
		await expect(page).toHaveURL(/\/dashboard/);

		// Verify dashboard content loaded
		await expect(page.locator("h2").first()).toContainText(
			/Welcome to FinOps/,
			{
				timeout: 10000,
			},
		);
	});

	test("successful login with CAPTCHA", async ({ page }) => {
		const user = generateTestUser();

		// First, signup the user
		await page.goto("/signup");
		await page.fill('input[name="name"], input[id="name"]', user.name);
		await page.fill('input[name="email"], input[type="email"]', user.email);
		await page.fill(
			'input[name="password"], input[type="password"]',
			user.password,
		);
		await Promise.all([
			page.waitForURL(/\/dashboard/, { timeout: 30000 }),
			page.click('button[type="submit"]'),
		]);

		// Logout (via navigation to login or API call)
		await page.goto("/api/auth/signout");
		await page.waitForLoadState("networkidle");

		// Now test login
		await page.goto("/login");
		await expect(page).toHaveTitle(/FinOps for AI/);

		// Verify login form is visible
		await expect(
			page.locator('input[name="email"], input[type="email"]'),
		).toBeVisible();
		await expect(
			page.locator('input[name="password"], input[type="password"]'),
		).toBeVisible();

		// Fill login form
		await page.fill('input[name="email"], input[type="email"]', user.email);
		await page.fill(
			'input[name="password"], input[type="password"]',
			user.password,
		);

		// Submit form (CAPTCHA will be triggered automatically)
		const submitButton = page.locator('button[type="submit"]');
		await expect(submitButton).toBeEnabled();

		// Click submit and wait for navigation
		await Promise.all([
			page.waitForURL(/\/dashboard/, { timeout: 30000 }),
			submitButton.click(),
		]);

		// Verify successful redirect to dashboard
		await expect(page).toHaveURL(/\/dashboard/);
		await expect(page.locator("h2").first()).toContainText(
			/Welcome to FinOps/,
			{
				timeout: 10000,
			},
		);
	});

	test("login with invalid credentials shows error", async ({ page }) => {
		await page.goto("/login");

		// Fill with invalid credentials
		await page.fill(
			'input[name="email"], input[type="email"]',
			"nonexistent@example.com",
		);
		await page.fill(
			'input[name="password"], input[type="password"]',
			"WrongPassword123!",
		);

		// Submit form
		const submitButton = page.locator('button[type="submit"]');
		await submitButton.click();

		// Wait for error message (adjust selector based on your error display)
		// Common patterns: toast notification, alert, error text
		const errorMessage = page.locator(
			"text=/Invalid credentials|이메일 또는 비밀번호|incorrect|잘못된/i",
		);

		// Verify error appears within 5 seconds
		await expect(errorMessage.first()).toBeVisible({ timeout: 5000 });
	});

	test("signup with existing email shows error", async ({ page }) => {
		const user = generateTestUser();

		// First signup
		await page.goto("/signup");
		await page.fill('input[name="name"], input[id="name"]', user.name);
		await page.fill('input[name="email"], input[type="email"]', user.email);
		await page.fill(
			'input[name="password"], input[type="password"]',
			user.password,
		);
		await Promise.all([
			page.waitForURL(/\/dashboard/, { timeout: 30000 }),
			page.click('button[type="submit"]'),
		]);

		// Logout
		await page.goto("/api/auth/signout");
		await page.waitForLoadState("networkidle");

		// Try to signup again with same email
		await page.goto("/signup");
		await page.fill('input[name="name"], input[id="name"]', "Another User");
		await page.fill('input[name="email"], input[type="email"]', user.email);
		await page.fill(
			'input[name="password"], input[type="password"]',
			"AnotherPass123!",
		);
		await page.click('button[type="submit"]');

		// Verify error message
		const errorMessage = page.locator(
			"text=/already exists|이미 존재|duplicate|중복/i",
		);
		await expect(errorMessage.first()).toBeVisible({ timeout: 5000 });
	});

	test("CAPTCHA loading state during signup", async ({ page }) => {
		const user = generateTestUser();

		// Navigate to signup page
		await page.goto("/signup");

		// Fill form
		await page.fill('input[name="name"], input[id="name"]', user.name);
		await page.fill('input[name="email"], input[type="email"]', user.email);
		await page.fill(
			'input[name="password"], input[type="password"]',
			user.password,
		);

		// Intercept the redeem call to delay it and verify loading state
		let resolveRedeem: (value: unknown) => void;
		const redeemPromise = new Promise((resolve) => {
			resolveRedeem = resolve;
		});

		await page.route("**/api/cap/redeem", async (route) => {
			// Delay response to see loading state
			await new Promise((resolve) => setTimeout(resolve, 1000));
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					success: true,
					token: "test-captcha-token-verified",
				}),
			});
			resolveRedeem(true);
		});

		// Click submit button
		const submitButton = page.locator('button[type="submit"]');
		await submitButton.click();

		// Verify button shows loading state
		// Common patterns: disabled, loading text, spinner
		await expect(submitButton).toBeDisabled({ timeout: 2000 });

		// Wait for CAPTCHA to complete
		await redeemPromise;

		// Verify redirect to dashboard
		await page.waitForURL(/\/dashboard/, { timeout: 30000 });
	});

	test("navigation between login and signup pages", async ({ page }) => {
		// Start at login page
		await page.goto("/login");
		await expect(page).toHaveURL(/\/login/);

		// Find and click signup link
		const signupLink = page.locator('a[href="/signup"], a:has-text("Sign up")');
		await signupLink.click();

		// Verify navigation to signup
		await expect(page).toHaveURL(/\/signup/);
		await expect(page.locator('input[name="name"]')).toBeVisible();

		// Find and click login link
		const loginLink = page.locator('a[href="/login"], a:has-text("Sign in")');
		await loginLink.click();

		// Verify navigation back to login
		await expect(page).toHaveURL(/\/login/);
	});

	test("protected route redirects to login", async ({ page }) => {
		// Try to access protected route without authentication
		await page.goto("/dashboard");

		// Should redirect to login page
		await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
	});

	test("authenticated user can access protected routes", async ({ page }) => {
		const user = generateTestUser();

		// Signup
		await page.goto("/signup");
		await page.fill('input[name="name"], input[id="name"]', user.name);
		await page.fill('input[name="email"], input[type="email"]', user.email);
		await page.fill(
			'input[name="password"], input[type="password"]',
			user.password,
		);
		await Promise.all([
			page.waitForURL(/\/dashboard/, { timeout: 30000 }),
			page.click('button[type="submit"]'),
		]);

		// Verify access to various protected routes
		const protectedRoutes = ["/dashboard", "/projects", "/teams", "/reports"];

		for (const route of protectedRoutes) {
			await page.goto(route);
			// Should not redirect to login
			await expect(page).toHaveURL(new RegExp(route), { timeout: 5000 });
		}
	});
});
