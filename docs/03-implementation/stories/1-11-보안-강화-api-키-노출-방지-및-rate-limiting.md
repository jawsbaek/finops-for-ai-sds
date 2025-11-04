# Story 1.11: 보안 강화 - API 키 노출 방지 및 Rate Limiting

**Status:** 📋 TODO

**Priority:** 🔴 CRITICAL

---

## User Story

**As a** 보안 관리자,
**I want** API 키 노출 위험을 제거하고 민감한 작업에 rate limiting을 적용하여,
**So that** 시스템이 보안 공격과 남용으로부터 보호될 수 있다.

---

## Context

**Code Review 발견 사항 (Story 1.10):**

### Issue #1: API 키 노출 위험 (CRITICAL)
**문제:**
```typescript
// src/server/api/routers/project.ts
return apiKeys.map((key) => ({
  id: key.id,
  provider: key.provider,
  encryptedKey: key.encryptedKey,  // ⚠️ 암호화된 키 전체를 클라이언트에 전송
  isActive: key.isActive,
  createdAt: key.createdAt,
}));
```

**위험:**
- 암호화된 키가 클라이언트에 노출되면 XSS 공격으로 탈취 가능
- last4 표시를 위해 클라이언트에서 복호화를 시도할 수 있음
- 보안 베스트 프랙티스 위반

**해결 방법:**
- DB 스키마에 `last4` 필드 추가
- API 키 생성 시 last4 계산하여 저장
- 클라이언트에는 last4만 전송

### Issue #2: Rate Limiting 미구현 (HIGH)
**문제:**
- API 키 생성, 차단, 삭제 등 민감한 mutation에 rate limit 없음
- 무차별 대입 공격(brute force)에 취약
- DoS 공격 가능성

**해결 방법:**
- tRPC middleware에 Upstash Ratelimit 통합
- IP 기반 + User ID 기반 dual rate limiting
- 민감한 작업: 10 req/min per user
- 일반 조회: 100 req/min per user

### Issue #3: XSS 방지 강화 (MEDIUM)
**문제:**
- 사용자 입력(사유, 프로젝트명 등)이 sanitization 없이 저장
- Stored XSS 공격 가능성

**해결 방법:**
- DOMPurify 또는 sanitize-html로 입력 정제
- 출력 시 React의 기본 escaping에 의존하되 DB 저장 전에도 정제

---

## Acceptance Criteria

### 1. API 키 Last4 필드 추가
- [ ] Prisma schema에 `ApiKey.last4` 필드 추가 (String, indexed)
- [ ] Migration 생성 및 실행
- [ ] 기존 API 키에 대해 last4 역계산 migration script 작성
- [ ] `generateApiKey` mutation 수정: API 키 생성 시 last4 계산하여 저장
- [ ] `getApiKeys` query 수정: encryptedKey 제거, last4만 반환
- [ ] 프론트엔드에서 last4 사용하도록 수정 (타입 업데이트)
- [ ] 테스트: encryptedKey가 클라이언트 응답에 없는지 확인

### 2. Rate Limiting 구현
- [ ] Upstash Redis 설정 (또는 로컬 Redis for dev)
- [ ] `@upstash/ratelimit` 패키지 설치
- [ ] tRPC context에 rate limiter 추가
- [ ] Rate limiting middleware 작성:
  - Sensitive mutations: 10 req/min per user
  - Normal queries: 100 req/min per user
  - IP-based fallback for unauthenticated requests
- [ ] 다음 procedures에 rate limiting 적용:
  - `project.generateApiKey` (10/min)
  - `project.disableApiKey` (10/min)
  - `project.enableApiKey` (10/min)
  - `project.deleteApiKey` (10/min)
  - `project.addMember` (10/min)
  - `project.removeMember` (10/min)
- [ ] Rate limit 초과 시 명확한 한국어 에러 메시지 반환
- [ ] 프론트엔드에서 429 에러 처리 (toast 알림)

### 3. Input Sanitization 추가
- [ ] `sanitize-html` 또는 `dompurify` 패키지 설치
- [ ] Zod schema에 sanitization transform 추가
- [ ] 다음 필드 sanitize:
  - API 키 차단/삭제 사유
  - 프로젝트명
  - 사용자 입력 메타데이터
- [ ] XSS 테스트: `<script>alert('xss')</script>` 입력 시 무효화 확인

### 4. 보안 테스트
- [ ] Rate limiting 테스트: 10회 연속 API 키 생성 시도 시 차단 확인
- [ ] Last4 노출 테스트: 네트워크 탭에서 encryptedKey 없는지 확인
- [ ] XSS 테스트: 악의적 스크립트 입력 시 무효화 확인
- [ ] 보안 스캔: `npm audit` 및 Snyk 스캔 통과

---

## Prerequisites

- Story 1.10 (프로젝트 멤버 및 API 키 관리 UI)

---

## Technical Implementation

### 1. Database Schema Update

```prisma
// prisma/schema.prisma
model ApiKey {
  id           String   @id @default(cuid())
  provider     String
  encryptedKey String
  last4        String   @db.VarChar(4)  // ✅ NEW
  isActive     Boolean  @default(true)
  projectId    String
  project      Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([projectId])
  @@index([last4])  // ✅ NEW: For quick lookup
}
```

**Migration Script:**
```typescript
// scripts/migrate-api-key-last4.ts
import { db } from "@/server/db";
import { decrypt } from "@/lib/encryption";

async function migrateLast4() {
  const apiKeys = await db.apiKey.findMany();

  for (const key of apiKeys) {
    try {
      const decrypted = await decrypt(key.encryptedKey);
      const last4 = decrypted.slice(-4);

      await db.apiKey.update({
        where: { id: key.id },
        data: { last4 },
      });

      console.log(`Updated API key ${key.id} with last4: ${last4}`);
    } catch (error) {
      console.error(`Failed to migrate API key ${key.id}:`, error);
    }
  }
}

migrateLast4().catch(console.error);
```

### 2. Rate Limiting Implementation

```typescript
// src/server/api/ratelimit.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
});

export const rateLimits = {
  // Sensitive mutations: 10 requests per minute
  sensitive: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "1 m"),
    analytics: true,
    prefix: "ratelimit:sensitive",
  }),

  // Normal operations: 100 requests per minute
  normal: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, "1 m"),
    analytics: true,
    prefix: "ratelimit:normal",
  }),
};
```

```typescript
// src/server/api/trpc.ts
import { rateLimits } from "./ratelimit";

const rateLimitMiddleware = (type: "sensitive" | "normal") =>
  middleware(async ({ ctx, next }) => {
    const identifier = ctx.session?.user?.id ?? ctx.headers.get("x-forwarded-for") ?? "anonymous";

    const { success, limit, remaining, reset } = await rateLimits[type].limit(identifier);

    if (!success) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `요청 한도를 초과했습니다. ${Math.ceil((reset - Date.now()) / 1000)}초 후 다시 시도해주세요.`,
      });
    }

    return next({
      ctx: {
        ...ctx,
        rateLimit: { limit, remaining, reset },
      },
    });
  });

export const sensitiveProcedure = protectedProcedure.use(rateLimitMiddleware("sensitive"));
export const normalProcedure = protectedProcedure.use(rateLimitMiddleware("normal"));
```

**Usage in Router:**
```typescript
// src/server/api/routers/project.ts
import { sensitiveProcedure } from "../trpc";

export const projectRouter = createTRPCRouter({
  generateApiKey: sensitiveProcedure  // ✅ Changed from protectedProcedure
    .input(z.object({
      projectId: z.string(),
      provider: z.enum(["openai"]),
      apiKey: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      // ... implementation
      const last4 = input.apiKey.slice(-4);  // ✅ Calculate last4

      const newKey = await db.apiKey.create({
        data: {
          provider: input.provider,
          encryptedKey: encrypted,
          last4,  // ✅ Store last4
          projectId: input.projectId,
        },
      });

      return newKey;
    }),
});
```

### 3. Input Sanitization

```typescript
// src/lib/sanitize.ts
import sanitizeHtml from "sanitize-html";

export function sanitizeInput(input: string): string {
  return sanitizeHtml(input, {
    allowedTags: [],  // No HTML tags allowed
    allowedAttributes: {},
    disallowedTagsMode: "recursiveEscape",
  }).trim();
}
```

```typescript
// src/server/api/routers/project.ts
import { sanitizeInput } from "@/lib/sanitize";

disableApiKey: sensitiveProcedure
  .input(z.object({
    apiKeyId: z.string(),
    reason: z.string().min(1).transform(sanitizeInput),  // ✅ Sanitize
  }))
  .mutation(async ({ ctx, input }) => {
    // ... implementation uses sanitized input.reason
  }),
```

### 4. Frontend 429 Error Handling

```typescript
// src/app/(dashboard)/projects/[id]/page.tsx
const generateApiKey = api.project.generateApiKey.useMutation({
  onSuccess: async () => {
    // ... existing code
  },
  onError: (error) => {
    if (error.data?.code === "TOO_MANY_REQUESTS") {
      toast.error(error.message);  // "요청 한도를 초과했습니다. N초 후 다시 시도해주세요."
    } else {
      toast.error("API 키 생성 중 오류가 발생했습니다.");
    }
  },
});
```

---

## Testing Checklist

### Unit Tests
- [ ] `sanitizeInput()` 함수 테스트 (XSS 패턴)
- [ ] Rate limiter 단위 테스트 (시간 기반 mocking)

### Integration Tests
- [ ] API 키 생성 시 last4 저장 확인
- [ ] API 키 조회 시 encryptedKey 미포함 확인
- [ ] Rate limit 초과 시 429 에러 확인
- [ ] Sanitized input이 DB에 저장되는지 확인

### Security Tests
- [ ] Burp Suite 또는 OWASP ZAP으로 XSS 스캔
- [ ] Rate limiting bypass 시도 (다중 IP, 세션 등)
- [ ] `npm audit` 및 `snyk test` 통과

---

## Performance Impact

- **Database**: last4 필드 추가 → 4 bytes per row (minimal)
- **Redis**: Rate limit 체크 → ~1-2ms per request (acceptable)
- **Sanitization**: ~0.1-0.5ms per input (negligible)

**Total overhead**: < 5ms per request (acceptable for security gain)

---

## Environment Variables

```env
# .env
UPSTASH_REDIS_URL=https://your-redis-url.upstash.io
UPSTASH_REDIS_TOKEN=your-redis-token

# For local development (optional)
REDIS_URL=redis://localhost:6379
```

---

## Rollout Plan

1. **Phase 1**: Database migration (last4 field)
2. **Phase 2**: Backend code update (last4 calculation)
3. **Phase 3**: Redis setup + rate limiting
4. **Phase 4**: Input sanitization
5. **Phase 5**: Security testing
6. **Phase 6**: Production deployment

---

## Success Metrics

- [ ] 0 API key exposures in network traffic
- [ ] Rate limiting blocks > 95% of brute force attempts
- [ ] XSS payloads sanitized in 100% of cases
- [ ] `npm audit` shows 0 critical/high vulnerabilities

---

## Related Stories

- **Story 1.10**: 프로젝트 멤버 및 API 키 관리 UI (기반)
- **Story 1.12**: 성능 최적화 (rate limiting과 함께 적용)
- **Story 1.13**: 국제화 및 데이터 무결성 (에러 메시지 한국어화)
