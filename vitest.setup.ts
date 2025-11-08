import { beforeAll, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

// Mock environment variables for tests
beforeAll(() => {
	process.env.DATABASE_URL =
		"postgresql://test:test@localhost:5432/test?schema=public";
	process.env.NEXTAUTH_SECRET = "test-secret-key-for-testing";
	process.env.NEXTAUTH_URL = "http://localhost:3000";

	// CAPTCHA environment variables
	process.env.NEXT_PUBLIC_CAP_SITE_KEY = "test-site-key-1234567890abcdef";
	process.env.CAP_SECRET_KEY = "test-secret-key-32-chars-12345678";
	process.env.CAP_DIFFICULTY = "100000";
	process.env.CAP_BYPASS = "true"; // Enable bypass mode for tests
});

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
