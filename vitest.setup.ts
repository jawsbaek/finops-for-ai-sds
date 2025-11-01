import { beforeAll, vi } from "vitest";

// Mock environment variables for tests
beforeAll(() => {
	process.env.DATABASE_URL =
		"postgresql://test:test@localhost:5432/test?schema=public";
	process.env.NEXTAUTH_SECRET = "test-secret-key-for-testing";
	process.env.NEXTAUTH_URL = "http://localhost:3000";
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
