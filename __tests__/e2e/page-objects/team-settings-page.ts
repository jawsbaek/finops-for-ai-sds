/**
 * Team Settings Page Object
 *
 * Page object model for team settings page with multi-org admin key management
 */

import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import type { AdminKey } from "../helpers/multi-org-helpers";

/**
 * Options for registering an admin API key
 */
export interface RegisterAdminKeyOptions {
	provider: "openai" | "anthropic" | "aws" | "azure";
	apiKey: string;
	organizationId?: string;
	displayName?: string;
}

/**
 * Team Settings Page Object
 *
 * Provides methods to interact with team settings page
 */
export class TeamSettingsPage {
	constructor(private page: Page) {}

	/**
	 * Navigate to team settings page
	 *
	 * @param teamId - Team ID
	 */
	async navigate(teamId: string): Promise<void> {
		await this.page.goto(`/teams/${teamId}/settings`);
		await this.page.waitForLoadState("networkidle");

		// Verify we're on the right page
		await expect(this.page).toHaveTitle(/Team Settings/i);
	}

	/**
	 * Register an admin API key
	 *
	 * @param options - Registration options
	 */
	async registerAdminKey(options: RegisterAdminKeyOptions): Promise<void> {
		// Wait for form to be visible
		await this.page.waitForSelector('[data-testid="admin-key-form"]', {
			state: "visible",
		});

		// Select provider
		await this.page.selectOption(
			'[data-testid="admin-key-form"] select[name="provider"]',
			options.provider,
		);

		// Enter API key
		await this.page.fill(
			'[data-testid="admin-key-form"] input[name="apiKey"]',
			options.apiKey,
		);

		// Enter organization ID if provided
		if (options.organizationId) {
			await this.page.fill(
				'[data-testid="admin-key-form"] input[name="organizationId"]',
				options.organizationId,
			);
		}

		// Enter display name if provided
		if (options.displayName) {
			await this.page.fill(
				'[data-testid="admin-key-form"] input[name="displayName"]',
				options.displayName,
			);
		}

		// Submit form
		await this.page.click(
			'[data-testid="admin-key-form"] button[type="submit"]',
		);

		// Wait for success toast
		await expect(
			this.page.locator("text=/Admin API Key registered successfully/i"),
		).toBeVisible({ timeout: 10000 });

		// Wait for toast to disappear
		await this.page.waitForTimeout(1000);
	}

	/**
	 * Get list of registered admin keys
	 *
	 * @returns Array of admin key information
	 */
	async getAdminKeys(): Promise<AdminKey[]> {
		const keys: AdminKey[] = [];

		// Wait for admin keys list
		await this.page.waitForSelector('[data-testid="admin-key-list"]', {
			state: "visible",
			timeout: 5000,
		});

		// Get all admin key cards
		const cards = await this.page
			.locator('[data-testid^="admin-key-card-"]')
			.all();

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
	 * @param provider - AI provider
	 * @param orgId - Organization ID
	 */
	async deleteAdminKey(provider: string, orgId: string): Promise<void> {
		// Find the admin key card
		const card = this.page.locator(
			`[data-testid="admin-key-card-${provider}-${orgId}"]`,
		);

		// Click delete button
		await card.locator('[data-testid="delete-button"]').click();

		// Confirm deletion in dialog
		await this.page
			.locator('[data-testid="confirm-delete"]')
			.click({ timeout: 5000 });

		// Wait for success toast
		await expect(
			this.page.locator("text=/Admin key deleted successfully/i"),
		).toBeVisible({ timeout: 10000 });

		// Wait for toast to disappear
		await this.page.waitForTimeout(1000);
	}

	/**
	 * Toggle admin key active/inactive status
	 *
	 * @param provider - AI provider
	 * @param orgId - Organization ID
	 */
	async toggleAdminKey(provider: string, orgId: string): Promise<void> {
		// Find the admin key card
		const card = this.page.locator(
			`[data-testid="admin-key-card-${provider}-${orgId}"]`,
		);

		// Click toggle button
		await card.locator('[data-testid="toggle-button"]').click();

		// Wait for success toast
		await expect(
			this.page.locator("text=/Status updated successfully/i"),
		).toBeVisible({ timeout: 10000 });

		// Wait for toast to disappear
		await this.page.waitForTimeout(1000);
	}

	/**
	 * Verify admin key exists in list
	 *
	 * @param provider - AI provider
	 * @param orgId - Organization ID or display name
	 */
	async verifyAdminKeyExists(provider: string, orgId: string): Promise<void> {
		const keys = await this.getAdminKeys();
		const exists = keys.some(
			(k) =>
				k.provider === provider &&
				(k.organizationId === orgId || k.displayName === orgId),
		);

		expect(exists).toBeTruthy();
	}

	/**
	 * Verify admin key does not exist in list
	 *
	 * @param provider - AI provider
	 * @param orgId - Organization ID
	 */
	async verifyAdminKeyNotExists(
		provider: string,
		orgId: string,
	): Promise<void> {
		const keys = await this.getAdminKeys();
		const exists = keys.some(
			(k) => k.provider === provider && k.organizationId === orgId,
		);

		expect(exists).toBeFalsy();
	}

	/**
	 * Get count of registered admin keys
	 *
	 * @returns Number of admin keys
	 */
	async getAdminKeyCount(): Promise<number> {
		const keys = await this.getAdminKeys();
		return keys.length;
	}

	/**
	 * Verify empty state is shown
	 */
	async verifyEmptyState(): Promise<void> {
		await expect(
			this.page.locator('[data-testid="admin-key-empty-state"]'),
		).toBeVisible();
	}
}
