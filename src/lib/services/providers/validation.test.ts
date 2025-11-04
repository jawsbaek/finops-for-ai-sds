import { describe, expect, it } from "vitest";
import { validateProviderProjectIdFormat } from "./validation";

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
	});

	describe("Unsupported provider", () => {
		it("should return false for unknown providers", () => {
			expect(validateProviderProjectIdFormat("unknown", "anything")).toBe(
				false,
			);
		});
	});
});
