/**
 * Vitest Environment Setup
 *
 * This file sets environment variables BEFORE any module imports happen.
 * This is critical because src/env.js validates environment variables at import time.
 *
 * Execution order:
 * 1. vitest.env.ts runs first → sets env vars
 * 2. vitest.setup.ts runs second → other setup (mocks, etc.)
 * 3. Test files load → env.js sees env vars → validation passes ✅
 */

// Database
process.env.DATABASE_URL =
	"postgresql://test:test@localhost:5432/test?schema=public";

// Auth
process.env.AUTH_SECRET = "test-secret-key-for-testing";
process.env.AUTH_DISCORD_ID = "test-discord-id";
process.env.AUTH_DISCORD_SECRET = "test-discord-secret";
process.env.NEXTAUTH_URL = "http://localhost:3000";

// CAPTCHA (NEW - causing current failures)
process.env.NEXT_PUBLIC_CAP_SITE_KEY = "test-site-key-1234567890abcdef";
process.env.CAP_SECRET_KEY = "test-secret-key-32-chars-12345678";
process.env.CAP_DIFFICULTY = "100000";
process.env.CAP_BYPASS = "true"; // Enable bypass mode for tests

// AWS/KMS (optional but good to set)
process.env.AWS_REGION = "us-east-1";
process.env.AWS_ACCESS_KEY_ID = "test-access-key";
process.env.AWS_SECRET_ACCESS_KEY = "test-secret-key";
process.env.AWS_KMS_KEY_ID = "test-kms-key-id";
