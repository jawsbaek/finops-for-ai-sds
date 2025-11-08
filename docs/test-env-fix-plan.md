# Test Environment Variable Issue - Analysis & Fix Plan

## Problem Summary

**Status:** 🔴 CRITICAL - 2 test files failing due to missing `NEXT_PUBLIC_CAP_SITE_KEY`

**Affected Files:**
- `src/lib/services/encryption/__tests__/api-key-manager.test.ts`
- `src/server/api/routers/__tests__/project-api-key-integration.test.ts`

**Error:**
```
❌ Invalid environment variables: [
  {
    code: 'invalid_type',
    expected: 'string',
    received: 'undefined',
    path: [ 'NEXT_PUBLIC_CAP_SITE_KEY' ],
    message: 'Required'
  }
]
```

---

## Root Cause Analysis

### Import Chain
```
Test File
  → kms-envelope.ts
    → env.js (validates environment variables)
      → NEXT_PUBLIC_CAP_SITE_KEY not found
        → Throws validation error
```

### Why vitest.setup.ts Doesn't Help

The issue is that `vitest.setup.ts` sets environment variables in `beforeAll()`:

```typescript
// vitest.setup.ts
beforeAll(() => {
  process.env.NEXT_PUBLIC_CAP_SITE_KEY = "test-site-key-1234567890abcdef";
  // ... other env vars
});
```

**However:**
1. **Module imports happen BEFORE `beforeAll` runs**
2. When test file imports `kms-envelope.ts`, it immediately imports `env.js`
3. `env.js` runs its validation at import time (module initialization)
4. At this point, `beforeAll` hasn't executed yet
5. Environment variables are undefined → validation fails

### Timeline
```
1. Vitest loads test file
2. Test file imports kms-envelope.ts
3. kms-envelope.ts imports env.js
4. env.js validates environment (FAILS - vars not set yet)
   ❌ Error thrown here
5. beforeAll() would run here (too late!)
```

---

## Why Our CAPTCHA Test Works

Our `captcha.test.ts` works because we use a different approach:

```typescript
// captcha.test.ts
const mockEnv = vi.hoisted(() => ({
  CAP_SECRET_KEY: "test-secret-key-32-chars-12345678",
  CAP_DIFFICULTY: 100000,
  CAP_BYPASS: true,
  NEXT_PUBLIC_CAP_SITE_KEY: "test-site-key",
}));

vi.mock("~/env", () => ({
  env: mockEnv,
}));

import * as captchaModule from "../captcha"; // Import AFTER mock
```

**Key differences:**
1. `vi.hoisted()` - Runs during hoisting phase (before module loading)
2. `vi.mock("~/env")` - Mocks the entire env module
3. Imports happen AFTER the mock is set up
4. No real env validation runs

---

## Solution Options

### Option 1: Mock env.js in Failing Tests (Quick Fix)
**Pros:**
- ✅ Minimal changes
- ✅ Follows existing pattern from `captcha.test.ts`
- ✅ Works immediately

**Cons:**
- ❌ Requires modifying each failing test file
- ❌ Doesn't scale to new tests
- ❌ Duplicated mock setup code

**Implementation:**
Add to `api-key-manager.test.ts` and `project-api-key-integration.test.ts`:
```typescript
const mockEnv = vi.hoisted(() => ({
  // All required env vars
  NEXT_PUBLIC_CAP_SITE_KEY: "test-site-key",
  CAP_SECRET_KEY: "test-secret-key-32-chars",
  // ... others
}));

vi.mock("~/env", () => ({ env: mockEnv }));
```

---

### Option 2: Set ENV Before Vitest Loads (Best Fix)
**Pros:**
- ✅ Fixes all current and future tests
- ✅ Single source of truth
- ✅ No per-test changes needed
- ✅ More realistic (uses actual env.js validation)

**Cons:**
- ❌ Requires modifying test setup
- ❌ Slightly more complex

**Implementation:**

**Step 1:** Create `vitest.env.ts` (runs BEFORE vitest.setup.ts):
```typescript
// vitest.env.ts
// This file runs BEFORE any imports, so we can set env vars early
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.NEXTAUTH_SECRET = "test-secret-key-for-testing";
process.env.NEXTAUTH_URL = "http://localhost:3000";

// CAPTCHA environment variables
process.env.NEXT_PUBLIC_CAP_SITE_KEY = "test-site-key-1234567890abcdef";
process.env.CAP_SECRET_KEY = "test-secret-key-32-chars-12345678";
process.env.CAP_DIFFICULTY = "100000";
process.env.CAP_BYPASS = "true";

// KMS/Encryption
process.env.AWS_REGION = "us-east-1";
process.env.KMS_KEY_ID = "test-kms-key-id";

// Add any other required env vars
```

**Step 2:** Update `vitest.config.ts`:
```typescript
export default defineConfig({
  test: {
    // ... existing config
    setupFiles: [
      './vitest.env.ts',    // ← Add this FIRST (sets env vars)
      './vitest.setup.ts',  // ← Then this (other setup)
    ],
  },
});
```

**Order matters:**
1. `vitest.env.ts` runs first → sets env vars
2. `vitest.setup.ts` runs second → other setup (mocks, etc.)
3. Test files load → env.js sees env vars → validation passes ✅

---

### Option 3: Make NEXT_PUBLIC_CAP_SITE_KEY Optional (Not Recommended)
**Pros:**
- ✅ Quick fix
- ✅ No test changes needed

**Cons:**
- ❌ **SECURITY RISK**: Makes production env validation weaker
- ❌ Doesn't solve root cause
- ❌ Could hide real configuration issues
- ❌ Not aligned with security best practices

**Why NOT to do this:**
```typescript
// ❌ BAD - Weakens security
NEXT_PUBLIC_CAP_SITE_KEY: z.string().optional()

// vs

// ✅ GOOD - Enforces proper configuration
NEXT_PUBLIC_CAP_SITE_KEY: z.string().min(1)
```

---

## Recommended Solution: Option 2

**Reasoning:**
1. **Comprehensive**: Fixes all tests (current + future)
2. **Maintainable**: Single place to manage test env vars
3. **Realistic**: Tests run with actual env validation
4. **Scalable**: New tests just work without modification
5. **Best Practice**: Follows Vitest's setup file ordering pattern

---

## Implementation Steps

### Phase 1: Create vitest.env.ts
```bash
# Create the env setup file
touch vitest.env.ts
```

### Phase 2: Populate All Required Env Vars
```typescript
// vitest.env.ts
// Set ALL environment variables that env.js requires
// This runs BEFORE any module imports, so env.js validation will pass

// Database
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test?schema=public";

// Auth
process.env.NEXTAUTH_SECRET = "test-secret-key-for-testing";
process.env.NEXTAUTH_URL = "http://localhost:3000";

// CAPTCHA (NEW - causing current failures)
process.env.NEXT_PUBLIC_CAP_SITE_KEY = "test-site-key-1234567890abcdef";
process.env.CAP_SECRET_KEY = "test-secret-key-32-chars-12345678";
process.env.CAP_DIFFICULTY = "100000";
process.env.CAP_BYPASS = "true";

// AWS/KMS (if required by env.js schema)
process.env.AWS_REGION = "us-east-1";
process.env.AWS_ACCESS_KEY_ID = "test-access-key";
process.env.AWS_SECRET_ACCESS_KEY = "test-secret-key";
process.env.KMS_KEY_ID = "test-kms-key-id";

// Cron (if required)
process.env.CRON_SECRET = "test-cron-secret";

// Slack (if required)
process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/test";

// Email (if required)
process.env.RESEND_API_KEY = "re_test_key";
```

### Phase 3: Update vitest.config.ts
```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: [
      "./vitest.env.ts",    // ← Add this FIRST
      "./vitest.setup.ts",  // ← Keep this SECOND
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
  },
});
```

### Phase 4: Clean Up vitest.setup.ts (Optional)
Remove duplicate env var setting from `beforeAll()` since they're now in `vitest.env.ts`:

```typescript
// vitest.setup.ts
import { beforeAll, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

// ❌ REMOVE - Now in vitest.env.ts
// beforeAll(() => {
//   process.env.NEXT_PUBLIC_CAP_SITE_KEY = "test-site-key";
//   // ...
// });

// ✅ KEEP - Logger mocks
vi.mock("pino", () => ({
  default: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ✅ KEEP - NextAuth mocks
vi.mock("next-auth", () => ({
  default: vi.fn(),
}));
```

### Phase 5: Test & Verify
```bash
# Run failing tests
bun run test src/lib/services/encryption/__tests__/api-key-manager.test.ts
bun run test src/server/api/routers/__tests__/project-api-key-integration.test.ts

# Run all tests
bun run test

# Verify no env validation errors
```

---

## Expected Outcome

**Before:**
```
❌ FAIL  src/lib/services/encryption/__tests__/api-key-manager.test.ts
❌ FAIL  src/server/api/routers/__tests__/project-api-key-integration.test.ts
Error: Invalid environment variables
```

**After:**
```
✅ PASS  src/lib/services/encryption/__tests__/api-key-manager.test.ts (15 tests)
✅ PASS  src/server/api/routers/__tests__/project-api-key-integration.test.ts (11 tests)
✅ PASS  All test suites
```

---

## Migration Path for Existing Tests

If any tests have `vi.mock("~/env")` for this reason, they can be simplified:

**Before:**
```typescript
const mockEnv = vi.hoisted(() => ({
  NEXT_PUBLIC_CAP_SITE_KEY: "test-site-key",
  // ...
}));
vi.mock("~/env", () => ({ env: mockEnv }));
```

**After:**
```typescript
// No env mocking needed! vitest.env.ts handles it
// Just import and use
import { env } from "~/env";
```

**Exception:** Keep `vi.mock("~/env")` if testing with DIFFERENT env values than defaults.

---

## Alternative: Per-Test Env Override

For tests that need specific env values (e.g., testing CAP_BYPASS=false):

```typescript
// captcha-production.test.ts
const mockEnv = vi.hoisted(() => ({
  ...process.env, // Inherit defaults from vitest.env.ts
  CAP_BYPASS: false, // Override for this test
}));

vi.mock("~/env", () => ({ env: mockEnv }));

// Test production behavior with bypass disabled
```

---

## Checklist

- [ ] Create `vitest.env.ts`
- [ ] Add all required env vars to `vitest.env.ts`
- [ ] Update `vitest.config.ts` setupFiles order
- [ ] Remove duplicate env vars from `vitest.setup.ts` (optional cleanup)
- [ ] Run failing tests to verify fix
- [ ] Run full test suite
- [ ] Update `.gitignore` if needed (vitest.env.ts should be committed)
- [ ] Document in README or testing guide

---

## Risk Assessment

**Risk Level:** 🟢 LOW

**Why:**
- Non-breaking change (only affects test environment)
- Follows Vitest best practices
- Well-established pattern in community
- Easy to revert if issues arise

**Rollback Plan:**
If this causes issues, revert vitest.config.ts and use Option 1 (per-test mocking).

---

## Timeline

**Estimated Time:** 15-30 minutes

1. Create vitest.env.ts: 5 min
2. Populate env vars: 10 min
3. Update config: 2 min
4. Test & verify: 10 min
5. Cleanup (optional): 5 min

---

## Future Considerations

### When Adding New Required Env Vars

1. Add to `src/env.js` schema
2. Add to `vitest.env.ts` with test value
3. Add to `.env.example` for developers
4. Add to deployment docs

### Test Environment Parity

Ensure `vitest.env.ts` matches production requirements:
- All vars in `env.js` server schema → required in vitest.env.ts
- All vars in `env.js` client schema → required in vitest.env.ts
- Use realistic test values (not just "test")

---

## References

- Vitest Setup Files: https://vitest.dev/config/#setupfiles
- T3 Env Documentation: https://env.t3.gg/docs/introduction
- Vitest Environment Variables: https://vitest.dev/guide/environment.html

---

**Status:** 📋 READY FOR IMPLEMENTATION
**Priority:** 🔴 HIGH (blocking pre-push hooks)
**Complexity:** 🟢 LOW
**Impact:** 🟢 POSITIVE (fixes tests, improves maintainability)
