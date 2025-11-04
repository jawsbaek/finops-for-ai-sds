/**
 * Multi-Organization E2E Test Helper Functions
 *
 * Provides reusable helper functions for multi-org testing:
 * - Admin key registration
 * - Admin key management (list, delete)
 * - AI provider registration for projects
 * - Verification utilities
 */

import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Admin Key information returned from UI
 */
export interface AdminKey {
	provider: string;
	organizationId: string;
	displayName?: string;
	last4: string;
	isActive: boolean;
}

/**
 * AI Provider information
 */
export interface ProviderInfo {
	provider: string;
	organizationId: string;
	aiProjectId: string;
}

/**
 * Register an admin API key for a team
 *
 * @param page - Playwright page instance
 * @param provider - AI provider ('openai', 'anthropic', 'aws', 'azure')
 * @param apiKey - The admin API key
 * @param orgId - Organization ID (optional for OpenAI - will auto-detect)
 * @param displayName - User-friendly display name (optional)
 *
 * @example
 * await registerAdminKey(page, 'openai', 'sk-admin-test123');
 * await registerAdminKey(page, 'openai', 'sk-admin-test456', 'org-custom', 'Production Org');
 */
export async function registerAdminKey(
	page: Page,
	provider: "openai" | "anthropic" | "aws" | "azure",
	apiKey: string,
	orgId?: string,
	displayName?: string,
): Promise<void> {
	// Wait for form to be visible
	await page.waitForSelector('[data-testid="admin-key-form"]', {
		state: "visible",
	});

	// Select provider
	await page.selectOption(
		'[data-testid="admin-key-form"] select[name="provider"]',
		provider,
	);

	// Enter API key
	await page.fill(
		'[data-testid="admin-key-form"] input[name="apiKey"]',
		apiKey,
	);

	// Enter organization ID if provided
	if (orgId) {
		await page.fill(
			'[data-testid="admin-key-form"] input[name="organizationId"]',
			orgId,
		);
	}

	// Enter display name if provided
	if (displayName) {
		await page.fill(
			'[data-testid="admin-key-form"] input[name="displayName"]',
			displayName,
		);
	}

	// Submit form
	await page.click('[data-testid="admin-key-form"] button[type="submit"]');

	// Wait for success toast
	await expect(
		page.locator("text=/Admin API Key registered successfully/i"),
	).toBeVisible({ timeout: 10000 });

	// Wait for toast to disappear
	await page.waitForTimeout(1000);
}

/**
 * Get list of registered admin keys from UI
 *
 * @param page - Playwright page instance
 * @returns Array of admin key information
 *
 * @example
 * const keys = await getAdminKeys(page);
 * expect(keys).toHaveLength(2);
 * expect(keys[0].provider).toBe('openai');
 */
export async function getAdminKeys(page: Page): Promise<AdminKey[]> {
	const keys: AdminKey[] = [];

	// Wait for admin keys list
	await page.waitForSelector('[data-testid="admin-key-list"]', {
		state: "visible",
		timeout: 5000,
	});

	// Get all admin key cards
	const cards = await page.locator('[data-testid^="admin-key-card-"]').all();

	for (const card of cards) {
		const provider = await card.getAttribute("data-provider");
		const organizationId = await card.getAttribute("data-organization-id");
		const last4 = await card.getAttribute("data-last4");
		const isActive = (await card.getAttribute("data-is-active")) === "true";

		// Try to get display name if present
		const displayNameElement = card.locator('[data-testid="display-name"]');
		const displayName =
			(await displayNameElement.count()) > 0
				? await displayNameElement.textContent()
				: undefined;

		if (provider && organizationId && last4) {
			keys.push({
				provider,
				organizationId,
				displayName: displayName ?? undefined,
				last4,
				isActive,
			});
		}
	}

	return keys;
}

/**
 * Delete an admin key
 *
 * @param page - Playwright page instance
 * @param provider - AI provider
 * @param orgId - Organization ID
 *
 * @example
 * await deleteAdminKey(page, 'openai', 'org-abc123');
 */
export async function deleteAdminKey(
	page: Page,
	provider: string,
	orgId: string,
): Promise<void> {
	// Find the admin key card
	const card = page.locator(
		`[data-testid="admin-key-card-${provider}-${orgId}"]`,
	);

	// Click delete button
	await card.locator('[data-testid="delete-button"]').click();

	// Confirm deletion in dialog
	await page.locator('[data-testid="confirm-delete"]').click({ timeout: 5000 });

	// Wait for success toast
	await expect(
		page.locator("text=/Admin key deleted successfully/i"),
	).toBeVisible({ timeout: 10000 });

	// Wait for toast to disappear
	await page.waitForTimeout(1000);
}

/**
 * Toggle admin key active/inactive status
 *
 * @param page - Playwright page instance
 * @param provider - AI provider
 * @param orgId - Organization ID
 *
 * @example
 * await toggleAdminKey(page, 'openai', 'org-abc123');
 */
export async function toggleAdminKey(
	page: Page,
	provider: string,
	orgId: string,
): Promise<void> {
	// Find the admin key card
	const card = page.locator(
		`[data-testid="admin-key-card-${provider}-${orgId}"]`,
	);

	// Click toggle button
	await card.locator('[data-testid="toggle-button"]').click();

	// Wait for success toast
	await expect(page.locator("text=/Status updated successfully/i")).toBeVisible(
		{ timeout: 10000 },
	);

	// Wait for toast to disappear
	await page.waitForTimeout(1000);
}

/**
 * Register AI provider for a project
 *
 * @param page - Playwright page instance (must be on project settings page)
 * @param provider - AI provider
 * @param orgId - Organization ID
 * @param projectId - AI Project ID
 *
 * @example
 * await registerAIProvider(page, 'openai', 'org-abc123', 'proj_test123');
 */
export async function registerAIProvider(
	page: Page,
	provider: string,
	orgId: string,
	projectId: string,
): Promise<void> {
	// Wait for AI provider form
	await page.waitForSelector('[data-testid="ai-provider-form"]', {
		state: "visible",
	});

	// Select provider
	await page.selectOption(
		'[data-testid="ai-provider-form"] select[name="provider"]',
		provider,
	);

	// Wait for organization dropdown to populate
	await page.waitForTimeout(500);

	// Select organization
	await page.selectOption(
		'[data-testid="ai-provider-form"] select[name="organizationId"]',
		orgId,
	);

	// Enter project ID
	await page.fill(
		'[data-testid="ai-provider-form"] input[name="aiProjectId"]',
		projectId,
	);

	// Wait for validation to complete
	await expect(
		page.locator('[data-testid="validation-indicator"][data-status="valid"]'),
	).toBeVisible({ timeout: 10000 });

	// Submit form
	await page.click('[data-testid="ai-provider-form"] button[type="submit"]');

	// Wait for success toast
	await expect(
		page.locator("text=/Provider registered successfully/i"),
	).toBeVisible({ timeout: 10000 });

	// Wait for toast to disappear
	await page.waitForTimeout(1000);
}

/**
 * Verify AI provider registration
 *
 * @param page - Playwright page instance (must be on project settings page)
 * @param expectedProvider - Expected provider name
 * @param expectedOrg - Expected organization ID or display name
 *
 * @example
 * await verifyProviderRegistration(page, 'OpenAI', 'Production Org');
 */
export async function verifyProviderRegistration(
	page: Page,
	expectedProvider: string,
	expectedOrg: string,
): Promise<void> {
	// Wait for provider display card
	await page.waitForSelector('[data-testid="ai-provider-display"]', {
		state: "visible",
	});

	const display = page.locator('[data-testid="ai-provider-display"]');

	// Verify provider
	await expect(display.locator('[data-testid="provider-name"]')).toHaveText(
		new RegExp(expectedProvider, "i"),
	);

	// Verify organization
	await expect(
		display.locator('[data-testid="organization-name"]'),
	).toContainText(expectedOrg);
}

/**
 * Get current AI provider info from project settings
 *
 * @param page - Playwright page instance (must be on project settings page)
 * @returns Provider info or null if not registered
 *
 * @example
 * const provider = await getCurrentProvider(page);
 * expect(provider?.provider).toBe('openai');
 */
export async function getCurrentProvider(
	page: Page,
): Promise<ProviderInfo | null> {
	// Check if provider display exists
	const displayCount = await page
		.locator('[data-testid="ai-provider-display"]')
		.count();

	if (displayCount === 0) {
		return null;
	}

	const display = page.locator('[data-testid="ai-provider-display"]');

	const provider = await display.getAttribute("data-provider");
	const organizationId = await display.getAttribute("data-organization-id");
	const aiProjectId = await display.getAttribute("data-ai-project-id");

	if (!provider || !organizationId || !aiProjectId) {
		return null;
	}

	return {
		provider,
		organizationId,
		aiProjectId,
	};
}

/**
 * Unlink AI provider from project
 *
 * @param page - Playwright page instance (must be on project settings page)
 *
 * @example
 * await unlinkAIProvider(page);
 */
export async function unlinkAIProvider(page: Page): Promise<void> {
	// Click unlink button
	await page.locator('[data-testid="unlink-provider-button"]').click();

	// Confirm in dialog
	await page.locator('[data-testid="confirm-unlink"]').click({ timeout: 5000 });

	// Wait for success toast
	await expect(
		page.locator("text=/Provider unlinked successfully/i"),
	).toBeVisible({ timeout: 10000 });

	// Wait for toast to disappear
	await page.waitForTimeout(1000);
}
