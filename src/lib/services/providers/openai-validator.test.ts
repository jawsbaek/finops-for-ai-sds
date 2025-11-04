import { describe, expect, it, vi } from "vitest";
import {
	fetchOpenAIOrganizationId,
	validateOpenAIProjectId,
} from "./openai-validator";

describe("fetchOpenAIOrganizationId", () => {
	it("should fetch organization ID from OpenAI API", async () => {
		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				data: [{ id: "org_abc123", name: "Test Org" }],
			}),
		});

		const orgId = await fetchOpenAIOrganizationId("sk-admin-test");

		expect(orgId).toBe("org_abc123");
		expect(fetch).toHaveBeenCalledWith(
			"https://api.openai.com/v1/organizations",
			expect.objectContaining({
				headers: expect.objectContaining({
					Authorization: "Bearer sk-admin-test",
				}),
			}),
		);
	});

	it("should throw error if API request fails", async () => {
		global.fetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 401,
			text: async () => "Unauthorized",
		});

		await expect(fetchOpenAIOrganizationId("invalid-key")).rejects.toThrow(
			"Unable to fetch organization",
		);
	});

	it("should throw error if no organizations found", async () => {
		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ data: [] }),
		});

		await expect(fetchOpenAIOrganizationId("sk-admin-test")).rejects.toThrow(
			"No organizations found for this API key",
		);
	});
});

describe("validateOpenAIProjectId", () => {
	it("should return valid for accessible project", async () => {
		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ data: [] }),
		});

		const result = await validateOpenAIProjectId(
			"sk-admin-test",
			"proj_abc123",
		);

		expect(result.valid).toBe(true);
		expect(fetch).toHaveBeenCalledWith(
			"https://api.openai.com/v1/organization/projects/proj_abc123/api_keys?limit=1",
			expect.any(Object),
		);
	});

	it("should return invalid for 404 response", async () => {
		global.fetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 404,
		});

		const result = await validateOpenAIProjectId(
			"sk-admin-test",
			"proj_invalid",
		);

		expect(result.valid).toBe(false);
		expect(result.error).toBe("Project ID not found in your organization");
	});

	it("should return invalid for 403 response", async () => {
		global.fetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 403,
		});

		const result = await validateOpenAIProjectId(
			"sk-admin-test",
			"proj_forbidden",
		);

		expect(result.valid).toBe(false);
		expect(result.error).toBe(
			"Admin API Key does not have access to this project",
		);
	});

	it("should return invalid for 500 response with generic error message", async () => {
		global.fetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 500,
			text: async () => "Internal Server Error",
		});

		const result = await validateOpenAIProjectId("sk-admin-test", "proj_test");

		expect(result.valid).toBe(false);
		expect(result.error).toBe(
			"Unable to validate project ID. Please check your API key permissions and try again.",
		);
	});

	it("should return invalid for 429 rate limit with generic error message", async () => {
		global.fetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 429,
			text: async () => "Rate limit exceeded",
		});

		const result = await validateOpenAIProjectId("sk-admin-test", "proj_test");

		expect(result.valid).toBe(false);
		expect(result.error).toBe(
			"Unable to validate project ID. Please check your API key permissions and try again.",
		);
	});
});
