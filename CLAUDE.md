# Claude Code - FinOps for AI Project Guidelines

This document defines coding standards, testing practices, and architectural patterns for AI assistants working on the FinOps for AI platform.

## Table of Contents

1. [Project Overview](#project-overview)
2. [Tech Stack & Architecture](#tech-stack--architecture)
3. [Testing Guidelines](#testing-guidelines)
4. [Code Style & Standards](#code-style--standards)
5. [Security Best Practices](#security-best-practices)
6. [Common Patterns](#common-patterns)

---

## Project Overview

**FinOps for AI** is a financial operations platform for managing and monitoring AI workload costs. Built with the T3 Stack (Next.js, tRPC, Prisma, TypeScript).

### Key Features
- **AI Provider Management**: Integration with OpenAI, Anthropic, and other LLM providers
- **Cost Tracking**: Real-time monitoring and alerting for AI API usage
- **Team Management**: Multi-tenant architecture with team-based access control
- **API Key Security**: Encrypted storage using AWS KMS envelope encryption
- **Rate Limiting**: Upstash Redis-based rate limiting
- **Bot Protection**: Cap.js proof-of-work CAPTCHA

### Project Structure
```
src/
├── app/              # Next.js App Router pages and API routes
├── components/       # Reusable React components
├── env.js           # Environment variable validation (T3 Env)
├── lib/             # Utility functions and shared logic
│   ├── captcha/     # CAPTCHA integration
│   ├── i18n/        # Internationalization (Korean/English)
│   ├── logger/      # Pino structured logging
│   └── services/    # Business logic services
├── server/          # Server-side code
│   ├── api/         # tRPC routers and procedures
│   └── db/          # Prisma client
├── styles/          # Global CSS and Tailwind config
└── trpc/            # tRPC client configuration
```

---

## Tech Stack & Architecture

### Core Technologies
- **Runtime**: Bun 1.3.2+
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript 5.6+
- **API Layer**: tRPC v11
- **Database**: PostgreSQL (via Prisma)
- **Styling**: Tailwind CSS 4.x
- **UI Components**: Radix UI
- **Testing**: Vitest 4.x + Playwright
- **Linting**: Biome

### Architecture Patterns

#### tRPC Procedures
All API endpoints use tRPC procedures with input validation:

```typescript
// src/server/api/routers/example.ts
export const exampleRouter = createTRPCRouter({
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return await ctx.db.example.findUnique({
        where: { id: input.id },
      });
    }),
});
```

#### Middleware Patterns
- **Authentication**: `protectedProcedure` requires valid session
- **CAPTCHA**: `withCaptcha()` middleware for bot protection
- **Rate Limiting**: Applied at both tRPC and API route levels

#### Database Access
- Always use Prisma client (`ctx.db`)
- Use transactions for multi-step operations
- Include proper error handling

---

## Testing Guidelines

### Test Execution

**ALWAYS use Vitest through Bun:**
```bash
✅ bun run test           # Correct
✅ vitest                 # Also correct
❌ bun test              # WRONG - uses Bun's native runner
```

### Testing Philosophy

1. **Test behavior, not implementation**
2. **Write tests BEFORE fixes** (TDD when fixing bugs)
3. **Use descriptive test names** that explain the scenario
4. **Keep tests isolated** - no shared state between tests
5. **Mock at boundaries** - database, external APIs, file system

### Vitest Best Practices

#### ⚠️ CRITICAL: vi.mock() Usage Rules

**Default Rule: Use vi.spyOn() instead of vi.mock()**

```typescript
// ❌ WRONG - Don't use vi.mock() for regular functions
import { describe, it, vi } from "vitest";

vi.mock("~/lib/some-module", () => ({
  someFunction: vi.fn(),
}));

// ✅ CORRECT - Use vi.spyOn()
import { describe, it, vi } from "vitest";
import * as someModule from "~/lib/some-module";

describe("My Test", () => {
  it("should mock function", () => {
    const spy = vi.spyOn(someModule, "someFunction")
      .mockReturnValue("mocked");

    // Test code

    expect(spy).toHaveBeenCalled();
  });
});
```

**Exception: Full Module Mocking (env, db)**

Only use `vi.mock()` for modules that have side effects on import (like `env.js` which validates environment variables):

```typescript
// ✅ CORRECT - vi.mock() for modules with import-time side effects
// Use vi.hoisted() to create mock values before hoisting
const mockEnv = vi.hoisted(() => ({
  DATABASE_URL: "postgresql://test",
  CAP_BYPASS: true,
}));

// ALWAYS add this comment explaining the exception
// Using vi.mock() for env module (CLAUDE.md exception: env validates on import)
vi.mock("~/env", () => ({
  env: mockEnv,
}));

import { env } from "~/env";
```

**Why this matters:**
- `vi.mock()` is hoisted to top of file
- In Bun runtime, `vi` isn't defined at module level
- `vi.hoisted()` runs before hoisting to create mock values

#### Logger Mocking

Logger is globally mocked in `vitest.setup.ts`. For test-specific verification:

```typescript
import * as loggerModule from "~/lib/logger";

describe("My Test", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(loggerModule.logger, "warn")
      .mockImplementation(() => {});
    errorSpy = vi.spyOn(loggerModule.logger, "error")
      .mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should log warnings", () => {
    // Test code
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({ /* log context */ }),
      "Expected message"
    );
  });
});
```

#### Database Mocking

```typescript
// Use vi.hoisted() for database mocks
const mockFindUnique = vi.hoisted(() => vi.fn());
const mockCreate = vi.hoisted(() => vi.fn());

// Using vi.mock() for db module (CLAUDE.md exception: db imports env which validates on import)
vi.mock("~/server/db", () => ({
  db: {
    user: {
      findUnique: mockFindUnique,
      create: mockCreate,
    },
  },
}));

import { db } from "~/server/db";

describe("User Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create user", async () => {
    mockCreate.mockResolvedValue({ id: "1", email: "test@example.com" });

    const user = await db.user.create({
      data: { email: "test@example.com" },
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: { email: "test@example.com" },
    });
    expect(user).toEqual({ id: "1", email: "test@example.com" });
  });
});
```

#### Fake Timers

```typescript
describe("Scheduled Task", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("should execute after delay", async () => {
    const mockFn = vi.fn();

    setTimeout(mockFn, 5000);

    await vi.advanceTimersByTimeAsync(5000);

    expect(mockFn).toHaveBeenCalled();
  });
});
```

#### External API Mocking

```typescript
describe("External API Call", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should fetch data", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ data: "test" }),
    } as Response);

    // Test code

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.example.com/data",
      expect.objectContaining({
        method: "GET",
      })
    );
  });
});
```

#### Testing Summary

| Scenario | Pattern | Example |
|----------|---------|---------|
| Function mocking | `vi.spyOn()` | `logger.warn`, `fetch` |
| Module with import side effects | `vi.hoisted()` + `vi.mock()` | `env`, `db` |
| Global mocking | `vitest.setup.ts` | `pino`, `next-auth` |

**Always:**
- ✅ Call `vi.restoreAllMocks()` in `afterEach()`
- ✅ Use `vi.clearAllMocks()` in `beforeEach()` when needed
- ✅ Add explanatory comments when using `vi.mock()`

---

## Code Style & Standards

### TypeScript

#### Type Safety
```typescript
// ✅ GOOD - Explicit types for function parameters and returns
export async function getUserById(userId: string): Promise<User | null> {
  return await db.user.findUnique({ where: { id: userId } });
}

// ❌ BAD - Implicit any
export async function getUserById(userId) {
  return await db.user.findUnique({ where: { id: userId } });
}
```

#### Avoid Type Assertions
```typescript
// ❌ BAD - Type assertion bypasses validation
const body = (await request.json()) as { email: string };

// ✅ GOOD - Use Zod validation
const schema = z.object({ email: z.string().email() });
const body = schema.parse(await request.json());
```

### Zod Input Validation

**ALWAYS validate API inputs with Zod schemas:**

```typescript
// tRPC procedure
export const userRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        email: z.string().email(),
        name: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // input is type-safe
      return await ctx.db.user.create({ data: input });
    }),
});

// API route
const requestSchema = z.object({
  token: z.string().min(1),
  solutions: z.array(z.array(z.number())),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400 }
    );
  }

  const result = requestSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Invalid request", details: result.error.flatten() },
      { status: 400 }
    );
  }

  // result.data is type-safe
}
```

### Error Handling

```typescript
// ✅ GOOD - Comprehensive error handling
try {
  const result = await riskyOperation();
  logger.info({ result }, "Operation completed");
  return result;
} catch (error) {
  logger.error(
    { error: error instanceof Error ? error.message : String(error) },
    "Operation failed"
  );
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Failed to complete operation",
    cause: error,
  });
}

// ❌ BAD - Swallowing errors
try {
  await riskyOperation();
} catch (error) {
  // Silent failure
}
```

### Logging

Use structured logging with Pino:

```typescript
import { logger } from "~/lib/logger";

// ✅ GOOD - Structured context
logger.info(
  {
    userId: user.id,
    action: "api_key_created",
    projectId: project.id,
  },
  "API key created successfully"
);

// ❌ BAD - String interpolation
logger.info(`API key created for user ${user.id}`);
```

### React Components

```typescript
// ✅ GOOD - Descriptive prop types
interface ProjectCardProps {
  project: {
    id: string;
    name: string;
    description: string | null;
  };
  onDelete?: (projectId: string) => void;
}

export function ProjectCard({ project, onDelete }: ProjectCardProps) {
  return (
    <div>
      <h3>{project.name}</h3>
      {project.description && <p>{project.description}</p>}
      {onDelete && (
        <button onClick={() => onDelete(project.id)}>Delete</button>
      )}
    </div>
  );
}
```

---

## Security Best Practices

### Environment Variables

**NEVER bypass validation:**

```typescript
// src/env.js
export const env = createEnv({
  server: {
    // ✅ GOOD - Production validation
    CAP_BYPASS: z.coerce
      .boolean()
      .default(false)
      .refine(
        (bypass) => {
          if (process.env.NODE_ENV === "production" && bypass) {
            return false;
          }
          return true;
        },
        {
          message: "SECURITY ERROR: CAP_BYPASS must be false in production",
        }
      ),
  },
});
```

### API Key Security

```typescript
// ✅ GOOD - Encrypted storage
import { encryptApiKey } from "~/lib/services/encryption/kms-envelope";

const encryptedKey = await encryptApiKey(rawApiKey);
await db.apiKey.create({
  data: {
    encryptedValue: encryptedKey,
    // Never store raw keys
  },
});

// ❌ BAD - Storing raw keys
await db.apiKey.create({
  data: {
    value: rawApiKey, // SECURITY RISK
  },
});
```

### Input Sanitization

```typescript
import { sanitizeInput } from "~/lib/sanitize";

// ✅ GOOD - Sanitize user input
const sanitizedName = sanitizeInput(input.name, { maxLength: 100 });

// ❌ BAD - Direct database insertion
await db.project.create({
  data: { name: input.name }, // Potential XSS
});
```

### Rate Limiting

```typescript
import { rateLimits } from "~/server/api/ratelimit";

// ✅ GOOD - Apply rate limiting
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
  const { success } = await rateLimits.normal.limit(ip);

  if (!success) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429 }
    );
  }

  // Process request
}
```

---

## Common Patterns

### tRPC Context

Access user session and database in procedures:

```typescript
export const exampleRouter = createTRPCRouter({
  protected: protectedProcedure
    .query(async ({ ctx }) => {
      // ctx.session.user is guaranteed to exist
      const userId = ctx.session.user.id;

      // ctx.db is Prisma client
      return await ctx.db.user.findUnique({
        where: { id: userId },
      });
    }),
});
```

### CAPTCHA Protection

```typescript
export const sensitiveRouter = createTRPCRouter({
  sensitiveAction: protectedProcedure
    .input(
      z.object({
        data: z.string(),
        captchaToken: z.string(),
      })
    )
    .use(withCaptcha()) // Verify CAPTCHA token
    .mutation(async ({ ctx, input }) => {
      // CAPTCHA verified, safe to proceed
    }),
});
```

### Internationalization

```typescript
// Server-side
import { getTranslations } from "~/lib/i18n/server";

const t = await getTranslations();
const message = t("auth.login.success");

// Client-side
import { useTranslations } from "~/lib/i18n";

export function LoginForm() {
  const t = useTranslations();
  return <button>{t("auth.login.button")}</button>;
}
```

### File Organization

```typescript
// Feature-based organization
src/lib/services/
├── encryption/
│   ├── api-key-manager.ts
│   ├── kms-envelope.ts
│   └── __tests__/
│       ├── api-key-manager.test.ts
│       └── kms-envelope.test.ts
├── email/
│   ├── resend-client.ts
│   └── __tests__/
│       └── resend-client.test.ts
└── monitoring/
    ├── threshold-monitor.ts
    └── __tests__/
        └── threshold-monitor.test.ts
```

---

## Development Workflow

### Pre-commit Hooks (Lefthook)

Automatically runs on commit:
- **Biome**: Linting and formatting
- **Color validation**: Ensures Tailwind color system usage
- **Prisma formatting**: Formats schema files

### Pre-push Hooks

Automatically runs on push:
- **Tests**: All Vitest tests must pass
- **Type check**: TypeScript compilation must succeed

### Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Required variables:
DATABASE_URL="postgresql://..."
AUTH_SECRET="..."           # Generate: openssl rand -base64 32
AUTH_DISCORD_ID="..."
AUTH_DISCORD_SECRET="..."
CAP_SECRET_KEY="..."        # Min 32 chars
NEXT_PUBLIC_CAP_SITE_KEY="..."
```

---

## Performance Considerations

### Database Queries

```typescript
// ✅ GOOD - Select only needed fields
const users = await db.user.findMany({
  select: {
    id: true,
    email: true,
    name: true,
  },
});

// ❌ BAD - Select all fields including relations
const users = await db.user.findMany({
  include: {
    projects: {
      include: {
        apiKeys: true,
        costRecords: true,
      },
    },
  },
});
```

### React Performance

```typescript
// ✅ GOOD - Memoize expensive computations
const sortedProjects = useMemo(
  () => projects.sort((a, b) => a.name.localeCompare(b.name)),
  [projects]
);

// ✅ GOOD - Cache Cap.js instance
const capInstanceRef = useRef<Cap | null>(null);

if (!capInstanceRef.current) {
  capInstanceRef.current = new Cap({ apiEndpoint: "/api/cap" });
}
```

---

## Deployment

### Serverless Considerations

**File-based storage doesn't work in serverless:**

```typescript
// ❌ BAD - File system storage in serverless
new Cap({
  tokens_store_path: "./.cap-tokens", // Ephemeral filesystem
});

// ✅ GOOD - Database-backed storage (future implementation)
new Cap({
  storage: new DatabaseStorage(db),
});
```

### Environment Variables

Ensure all required variables are set in Vercel:
- Database credentials
- Authentication secrets
- API keys (encrypted)
- Feature flags (`CAP_BYPASS=false` in production)

---

## Quick Reference

### Common Commands

```bash
# Development
bun run dev                  # Start dev server (Turbo mode)
bun run db:push             # Push schema to database
bun run db:studio           # Open Prisma Studio

# Testing
bun run test                # Run unit tests
bun run test:coverage       # Run with coverage
bun run test:e2e            # Run Playwright E2E tests

# Linting & Type Checking
bun run check               # Biome check
bun run check:write         # Biome fix
bun run typecheck           # TypeScript check

# Build
bun run build               # Production build
bun run preview             # Build and preview
```

### File Patterns

| Purpose | Location | Pattern |
|---------|----------|---------|
| API Routes | `src/app/api/**/route.ts` | Next.js API routes |
| tRPC Routers | `src/server/api/routers/*.ts` | tRPC procedures |
| UI Components | `src/components/*.tsx` | React components |
| Utilities | `src/lib/*.ts` | Shared utilities |
| Tests | `**/__tests__/*.test.ts` | Vitest tests |
| E2E Tests | `**/__tests__/e2e/*.spec.ts` | Playwright tests |

---

## Summary Checklist

When writing code for this project:

- [ ] Use TypeScript strict mode - no `any` types
- [ ] Validate all inputs with Zod schemas
- [ ] Use structured logging with Pino
- [ ] Apply rate limiting to public endpoints
- [ ] Add CAPTCHA to sensitive operations
- [ ] Encrypt sensitive data (API keys)
- [ ] Write tests using `vi.spyOn()` (not `vi.mock()`)
- [ ] Run `bun run test` before committing
- [ ] Follow Biome formatting standards
- [ ] Use i18n for all user-facing text
- [ ] Document complex logic with JSDoc comments

---

**Last Updated**: 2025-11-08
**Project Version**: 0.1.0
