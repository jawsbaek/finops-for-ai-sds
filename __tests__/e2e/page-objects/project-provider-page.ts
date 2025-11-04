/**
 * Project Provider Settings Page Object
 *
 * Page object model for project AI provider registration and management
 */

import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import type { ProviderInfo } from "../helpers/multi-org-helpers";

/**
 * Project Provider Settings Page Object
 *
 * Provides methods to interact with AI provider registration in project settings
 */
export class ProjectProviderPage {
	constructor(private page: Page) {}

	/**
	 * Navigate to project settings page
	 *
	 * @param projectId - Project ID
	 */
	async navigate(projectId: string): Promise<void> {
		await this.page.goto(`/projects/${projectId}/settings`);
		await this.page.waitForLoadState("networkidle");

		// Verify we're on the right page
		await expect(this.page).toHaveTitle(/Project Settings/i);
	}

	/**
	 * Select AI provider from dropdown
	 *
	 * @param provider - AI provider
	 */
	async selectProvider(provider: string): Promise<void> {
		await this.page.selectOption(
			'[data-testid="ai-provider-form"] select[name="provider"]',
			provider,
		);

		// Wait for organization dropdown to populate
		await this.page.waitForTimeout(500);
	}

	/**
	 * Select organization from dropdown
	 *
	 * @param orgId - Organization ID
	 */
	async selectOrganization(orgId: string): Promise<void> {
		await this.page.selectOption(
			'[data-testid="ai-provider-form"] select[name="organizationId"]',
			orgId,
		);
	}

	/**
	 * Enter AI project ID
	 *
	 * @param projectId - AI Project ID
	 */
	async enterProjectId(projectId: string): Promise<void> {
		await this.page.fill(
			'[data-testid="ai-provider-form"] input[name="aiProjectId"]',
			projectId,
		);
	}

	/**
	 * Wait for validation to complete
	 *
	 * @returns True if validation passed, false if failed
	 */
	async waitForValidation(): Promise<boolean> {
		try {
			await expect(
				this.page.locator(
					'[data-testid="validation-indicator"][data-status="valid"]',
				),
			).toBeVisible({ timeout: 10000 });
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Submit AI provider registration
	 */
	async submitRegistration(): Promise<void> {
		await this.page.click(
			'[data-testid="ai-provider-form"] button[type="submit"]',
		);

		// Wait for success toast
		await expect(
			this.page.locator("text=/Provider registered successfully/i"),
		).toBeVisible({ timeout: 10000 });

		// Wait for toast to disappear
		await this.page.waitForTimeout(1000);
	}

	/**
	 * Register complete AI provider (convenience method)
	 *
	 * @param provider - AI provider
	 * @param orgId - Organization ID
	 * @param projectId - AI Project ID
	 */
	async registerProvider(
		provider: string,
		orgId: string,
		projectId: string,
	): Promise<void> {
		await this.selectProvider(provider);
		await this.selectOrganization(orgId);
		await this.enterProjectId(projectId);

		const isValid = await this.waitForValidation();
		expect(isValid).toBeTruthy();

		await this.submitRegistration();
	}

	/**
	 * Unlink AI provider from project
	 */
	async unlinkProvider(): Promise<void> {
		// Click unlink button
		await this.page.locator('[data-testid="unlink-provider-button"]').click();

		// Confirm in dialog
		await this.page
			.locator('[data-testid="confirm-unlink"]')
			.click({ timeout: 5000 });

		// Wait for success toast
		await expect(
			this.page.locator("text=/Provider unlinked successfully/i"),
		).toBeVisible({ timeout: 10000 });

		// Wait for toast to disappear
		await this.page.waitForTimeout(1000);
	}

	/**
	 * Get current AI provider info
	 *
	 * @returns Provider info or null if not registered
	 */
	async getCurrentProvider(): Promise<ProviderInfo | null> {
		// Check if provider display exists
		const displayCount = await this.page
			.locator('[data-testid="ai-provider-display"]')
			.count();

		if (displayCount === 0) {
			return null;
		}

		const display = this.page.locator('[data-testid="ai-provider-display"]');

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
	 * Verify AI provider is registered
	 *
	 * @param expectedProvider - Expected provider name
	 * @param expectedOrg - Expected organization ID or display name
	 */
	async verifyProviderRegistered(
		expectedProvider: string,
		expectedOrg: string,
	): Promise<void> {
		// Wait for provider display card
		await this.page.waitForSelector('[data-testid="ai-provider-display"]', {
			state: "visible",
		});

		const display = this.page.locator('[data-testid="ai-provider-display"]');

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
	 * Verify no provider is registered (form should be visible)
	 */
	async verifyNoProviderRegistered(): Promise<void> {
		await expect(
			this.page.locator('[data-testid="ai-provider-form"]'),
		).toBeVisible();

		const displayCount = await this.page
			.locator('[data-testid="ai-provider-display"]')
			.count();
		expect(displayCount).toBe(0);
	}

	/**
	 * Verify validation error is shown
	 *
	 * @param expectedError - Expected error message (regex)
	 */
	async verifyValidationError(expectedError: RegExp): Promise<void> {
		await expect(
			this.page.locator('[data-testid="validation-error"]'),
		).toHaveText(expectedError);
	}

	/**
	 * Verify warning is shown (e.g., admin key deleted)
	 */
	async verifyWarningShown(): Promise<void> {
		await expect(
			this.page.locator('[data-testid="provider-warning"]'),
		).toBeVisible();
	}

	/**
	 * Verify info message is shown (e.g., no admin keys available)
	 */
	async verifyInfoMessage(expectedMessage: RegExp): Promise<void> {
		await expect(this.page.locator('[data-testid="provider-info"]')).toHaveText(
			expectedMessage,
		);
	}
}
