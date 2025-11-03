/**
 * Unit tests for Input Sanitization
 *
 * Tests XSS prevention and input cleaning for user-provided data
 */

import { describe, expect, it } from "vitest";
import { sanitizeInput } from "../sanitize";

describe("Input Sanitization", () => {
	describe("sanitizeInput", () => {
		it("should remove script tags", () => {
			const malicious = '<script>alert("xss")</script>Hello';
			const result = sanitizeInput(malicious);

			expect(result).not.toContain("<script>");
			expect(result).not.toContain("</script>");
			expect(result).not.toContain("alert");
		});

		it("should remove all HTML tags", () => {
			const input = "<div>Hello <span>World</span></div>";
			const result = sanitizeInput(input);

			expect(result).toBe("Hello World");
			expect(result).not.toContain("<");
			expect(result).not.toContain(">");
		});

		it("should handle multiple script injection attempts", () => {
			const malicious =
				'<script>alert("xss")</script><img src=x onerror=alert("xss")>';
			const result = sanitizeInput(malicious);

			expect(result).not.toContain("<script>");
			expect(result).not.toContain("<img");
			expect(result).not.toContain("onerror");
			expect(result).not.toContain("alert");
		});

		it("should preserve plain text content", () => {
			const plainText = "This is a normal reason for disabling the API key";
			const result = sanitizeInput(plainText);

			expect(result).toBe(plainText);
		});

		it("should trim whitespace", () => {
			const input = "  Hello World  ";
			const result = sanitizeInput(input);

			expect(result).toBe("Hello World");
		});

		it("should handle empty strings", () => {
			const result = sanitizeInput("");

			expect(result).toBe("");
		});

		it("should handle strings with only whitespace", () => {
			const result = sanitizeInput("   ");

			expect(result).toBe("");
		});

		it("should remove event handlers", () => {
			const malicious = '<a href="#" onclick="stealData()">Click me</a>';
			const result = sanitizeInput(malicious);

			expect(result).not.toContain("onclick");
			expect(result).not.toContain("stealData");
			expect(result).not.toContain("<a");
		});

		it("should remove iframe tags", () => {
			const malicious = '<iframe src="evil.com"></iframe>Normal text';
			const result = sanitizeInput(malicious);

			expect(result).not.toContain("<iframe");
			expect(result).not.toContain("evil.com");
			expect(result).toContain("Normal text");
		});

		it("should handle encoded scripts", () => {
			const malicious = "&lt;script&gt;alert('xss')&lt;/script&gt;";
			const result = sanitizeInput(malicious);

			// Should not contain script tag after decoding and sanitization
			expect(result).not.toContain("script");
		});

		it("should remove style tags", () => {
			const malicious = "<style>body { display: none; }</style>Text";
			const result = sanitizeInput(malicious);

			expect(result).not.toContain("<style>");
			expect(result).not.toContain("display");
			expect(result).toContain("Text");
		});

		it("should handle mixed content", () => {
			const input = "Valid reason: <b>security</b> concerns";
			const result = sanitizeInput(input);

			expect(result).toBe("Valid reason: security concerns");
		});

		it("should handle special characters safely", () => {
			const input = "Cost exceeded by 50% & security issues @ 2024";
			const result = sanitizeInput(input);

			expect(result).toBe("Cost exceeded by 50% & security issues @ 2024");
		});

		it("should handle unicode characters", () => {
			const input = "API 키가 손상되었습니다 🔒";
			const result = sanitizeInput(input);

			expect(result).toBe("API 키가 손상되었습니다 🔒");
		});

		it("should prevent SQL injection patterns", () => {
			const malicious = "'; DROP TABLE users; --";
			const result = sanitizeInput(malicious);

			// Should preserve the text but strip any HTML
			expect(result).toBe("'; DROP TABLE users; --");
		});
	});
});
