/**
 * Multi-Organization Mock Utilities
 *
 * Provides mock responses for multi-org E2E testing:
 * - OpenAI Costs API (multiple organizations)
 * - OpenAI Organization API (auto-detect org ID)
 * - OpenAI Project Validation API
 * - Anthropic Validation API
 */

import type { Page } from "@playwright/test";

/**
 * Mock OpenAI Costs API with multi-organization support
 *
 * @param page - Playwright page instance
 * @param orgs - Array of organizations with their projects and costs
 *
 * @example
 * await mockOpenAICostsAPI(page, [
 *   {
 *     organizationId: 'org-abc123',
 *     projects: [
 *       { projectId: 'proj_test1', cost: 25.50 },
 *       { projectId: 'proj_test2', cost: 10.25 }
 *     ]
 *   },
 *   {
 *     organizationId: 'org-def456',
 *     projects: [
 *       { projectId: 'proj_test3', cost: 50.00 }
 *     ]
 *   }
 * ]);
 */
export async function mockOpenAICostsAPI(
	page: Page,
	orgs: Array<{
		organizationId: string;
		projects: Array<{ projectId: string; cost: number }>;
	}>,
): Promise<void> {
	await page.route(
		"https://api.openai.com/v1/organization/costs**",
		(route) => {
			const url = new URL(route.request().url());
			const projectIds = url.searchParams.getAll("project_ids");

			// Filter projects by requested project_ids
			const relevantProjects = orgs.flatMap((org) =>
				org.projects
					.filter(
						(p) => projectIds.length === 0 || projectIds.includes(p.projectId),
					)
					.map((p) => ({
						object: "organization.costs.result" as const,
						amount: {
							value: p.cost,
							currency: "usd",
						},
						line_item: "gpt-4-turbo",
						project_id: p.projectId,
					})),
			);

			const now = Date.now();
			const startOfDay = new Date();
			startOfDay.setHours(0, 0, 0, 0);
			const endOfDay = new Date();
			endOfDay.setHours(23, 59, 59, 999);

			route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					object: "page",
					data: [
						{
							object: "bucket",
							start_time: Math.floor(startOfDay.getTime() / 1000),
							end_time: Math.floor(endOfDay.getTime() / 1000),
							results: relevantProjects,
						},
					],
					has_more: false,
					next_page: null,
				}),
			});
		},
	);
}

/**
 * Mock OpenAI Organization API for auto-detection
 *
 * @param page - Playwright page instance
 * @param orgId - Organization ID to return
 *
 * @example
 * await mockOpenAIOrganizationAPI(page, 'org-abc123');
 */
export async function mockOpenAIOrganizationAPI(
	page: Page,
	orgId: string,
): Promise<void> {
	await page.route("https://api.openai.com/v1/organizations", (route) => {
		route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				object: "list",
				data: [
					{
						id: orgId,
						name: "Test Organization",
						created: Math.floor(Date.now() / 1000),
						is_default: true,
					},
				],
			}),
		});
	});
}

/**
 * Mock OpenAI Project Validation API
 *
 * @param page - Playwright page instance
 * @param projectId - Project ID to validate
 * @param isValid - Whether the project ID should be valid
 *
 * @example
 * await mockOpenAIProjectValidation(page, 'proj_test123', true);
 */
export async function mockOpenAIProjectValidation(
	page: Page,
	projectId: string,
	isValid: boolean,
): Promise<void> {
	await page.route(
		`https://api.openai.com/v1/organization/projects/${projectId}/api_keys**`,
		(route) => {
			if (isValid) {
				route.fulfill({
					status: 200,
					contentType: "application/json",
					body: JSON.stringify({
						object: "list",
						data: [],
						first_id: null,
						last_id: null,
						has_more: false,
					}),
				});
			} else {
				route.fulfill({
					status: 404,
					contentType: "application/json",
					body: JSON.stringify({
						error: {
							message: "Project not found",
							type: "invalid_request_error",
							param: null,
							code: "project_not_found",
						},
					}),
				});
			}
		},
	);
}

/**
 * Mock Anthropic Validation API
 *
 * @param page - Playwright page instance
 * @param workspaceId - Workspace ID to validate
 * @param isValid - Whether the workspace ID should be valid
 *
 * @example
 * await mockAnthropicValidation(page, 'ws_test123', true);
 */
export async function mockAnthropicValidation(
	page: Page,
	workspaceId: string,
	isValid: boolean,
): Promise<void> {
	// TODO: Implement when Anthropic validation is added
	// For now, just mock a generic validation endpoint
	await page.route("https://api.anthropic.com/v1/workspaces/**", (route) => {
		if (isValid) {
			route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					id: workspaceId,
					name: "Test Workspace",
				}),
			});
		} else {
			route.fulfill({
				status: 404,
				contentType: "application/json",
				body: JSON.stringify({
					error: {
						message: "Workspace not found",
						type: "not_found_error",
					},
				}),
			});
		}
	});
}

/**
 * Setup all multi-org mocks with default values
 *
 * Convenience function to set up common mock scenarios
 *
 * @param page - Playwright page instance
 *
 * @example
 * await setupMultiOrgMocks(page);
 */
export async function setupMultiOrgMocks(page: Page): Promise<void> {
	// Mock OpenAI organization API with default org
	await mockOpenAIOrganizationAPI(page, "org-default123");

	// Mock OpenAI costs API with empty data (tests can override)
	await mockOpenAICostsAPI(page, []);

	// Mock project validation (tests can override for specific projects)
	await page.route(
		"https://api.openai.com/v1/organization/projects/**/api_keys**",
		(route) => {
			route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					object: "list",
					data: [],
					first_id: null,
					last_id: null,
					has_more: false,
				}),
			});
		},
	);
}
