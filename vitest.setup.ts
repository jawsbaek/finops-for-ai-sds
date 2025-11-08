import { vi } from "vitest";
import "@testing-library/jest-dom/vitest";

/**
 * Environment variables are now set in vitest.env.ts
 * which runs BEFORE any module imports, ensuring env.js validation passes.
 */

// Mock pino logger to suppress logs during tests
vi.mock("pino", () => ({
	default: () => ({
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
	}),
}));

// Mock next-auth to avoid module resolution issues
vi.mock("next-auth", () => ({
	default: vi.fn(),
}));

vi.mock("next-auth/next", () => ({
	default: vi.fn(),
}));
