import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as openaiValidator from "./openai-validator";
import {
	type ValidationResult,
	validateProviderProjectId,
	validateProviderProjectIdFormat,
} from "./validation";

describe("validateProviderProjectIdFormat", () => {
	describe("OpenAI", () => {
		it("should accept valid OpenAI project IDs", () => {
			expect(validateProviderProjectIdFormat("openai", "proj_abc123")).toBe(
				true,
			);
			expect(
				validateProviderProjectIdFormat("openai", "proj_XYZ-789_test"),
			).toBe(true);
		});

		it("should reject invalid OpenAI project IDs", () => {
			expect(validateProviderProjectIdFormat("openai", "project_123")).toBe(
				false,
			);
			expect(validateProviderProjectIdFormat("openai", "proj_")).toBe(false);
			expect(validateProviderProjectIdFormat("openai", "abc123")).toBe(false);
		});
	});

	describe("Anthropic", () => {
		it("should accept valid Anthropic workspace IDs", () => {
			expect(
				validateProviderProjectIdFormat("anthropic", "workspace_123"),
			).toBe(true);
			expect(validateProviderProjectIdFormat("anthropic", "ws_abc-xyz")).toBe(
				true,
			);
		});

		it("should reject invalid Anthropic workspace IDs", () => {
			expect(validateProviderProjectIdFormat("anthropic", "invalid")).toBe(
				false,
			);
			expect(validateProviderProjectIdFormat("anthropic", "proj_abc")).toBe(
				false,
			);
		});
	});

	describe("AWS", () => {
		it("should accept valid AWS project IDs", () => {
			expect(validateProviderProjectIdFormat("aws", "my-project-123")).toBe(
				true,
			);
			expect(validateProviderProjectIdFormat("aws", "aws_test_id")).toBe(true);
		});

		it("should reject invalid AWS project IDs", () => {
			expect(validateProviderProjectIdFormat("aws", "project@123")).toBe(false);
		});
	});

	describe("Azure", () => {
		it("should accept valid Azure project IDs", () => {
			expect(validateProviderProjectIdFormat("azure", "my-project-123")).toBe(
				true,
			);
			expect(validateProviderProjectIdFormat("azure", "azure_test_id")).toBe(
				true,
			);
		});

		it("should reject invalid Azure project IDs", () => {
			expect(validateProviderProjectIdFormat("azure", "project@123")).toBe(
				false,
			);
		});
	});

	describe("Unsupported provider", () => {
		it("should return false for unknown providers", () => {
			expect(validateProviderProjectIdFormat("unknown", "anything")).toBe(
				false,
			);
		});
	});
});

describe("validateProviderProjectId", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("OpenAI", () => {
		it("should validate OpenAI project ID successfully", async () => {
			// Use vi.spyOn to mock the validateOpenAIProjectId function
			const spy = vi
				.spyOn(openaiValidator, "validateOpenAIProjectId")
				.mockResolvedValue({ valid: true });

			const result = await validateProviderProjectId(
				"openai",
				"sk-admin-test",
				"org-123",
				"proj_valid",
			);

			expect(result.valid).toBe(true);
			expect(result.error).toBeUndefined();
			expect(spy).toHaveBeenCalledWith("sk-admin-test", "proj_valid");
		});

		it("should return error for invalid OpenAI project ID", async () => {
			// Use vi.spyOn to mock the validateOpenAIProjectId function
			const spy = vi
				.spyOn(openaiValidator, "validateOpenAIProjectId")
				.mockResolvedValue({
					valid: false,
					error: "Invalid OpenAI project ID",
				});

			const result = await validateProviderProjectId(
				"openai",
				"sk-admin-test",
				"org-123",
				"proj_invalid",
			);

			expect(result.valid).toBe(false);
			expect(result.error).toBe("Invalid OpenAI project ID");
			expect(spy).toHaveBeenCalledWith("sk-admin-test", "proj_invalid");
		});
	});

	describe("Anthropic", () => {
		it("should return not implemented error", async () => {
			const result = await validateProviderProjectId(
				"anthropic",
				"api-key",
				"org-123",
				"workspace_test",
			);

			expect(result.valid).toBe(false);
			expect(result.error).toContain(
				"Anthropic validation not yet implemented",
			);
		});
	});

	describe("AWS", () => {
		it("should return not implemented error", async () => {
			const result = await validateProviderProjectId(
				"aws",
				"api-key",
				"org-123",
				"aws-project",
			);

			expect(result.valid).toBe(false);
			expect(result.error).toContain("AWS validation not yet implemented");
		});
	});

	describe("Azure", () => {
		it("should return not implemented error", async () => {
			const result = await validateProviderProjectId(
				"azure",
				"api-key",
				"org-123",
				"azure-project",
			);

			expect(result.valid).toBe(false);
			expect(result.error).toContain("Azure validation not yet implemented");
		});
	});

	describe("Unknown provider", () => {
		it("should return unsupported provider error", async () => {
			const result = await validateProviderProjectId(
				"unknown",
				"api-key",
				"org-123",
				"project-id",
			);

			expect(result.valid).toBe(false);
			expect(result.error).toBe("Unsupported provider");
		});
	});
});
