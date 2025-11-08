# Story 1.20: CAPTCHA 통합 - 봇 및 자동화 공격 방어

**Status:** 📝 TODO

**Priority:** 🔴 CRITICAL

---

## User Story

**As a** 보안 관리자,
**I want** 인증 및 민감한 관리 작업에 CAPTCHA(Cap.js)를 적용하여,
**So that** 봇, 자동화 스크립트, 무차별 대입 공격으로부터 시스템을 보호할 수 있다.

---

## Context

### 현재 보안 상황
- ✅ **Story 1.11**: Rate Limiting (Upstash) - 구현 완료
- ✅ **Story 1.11**: Input Sanitization - 구현 완료
- ❌ **CAPTCHA**: 미구현 - 봇 공격에 취약

### 보안 Gap 분석

**Gap #1: 인증 엔드포인트 무차별 대입 공격**
- 로그인, 회원가입에 Rate Limiting만 적용됨
- 분산 IP를 사용한 봇 공격 시 우회 가능
- 계정 탈취 및 스팸 가입 위험

**Gap #2: 민감한 관리 작업의 자동화 공격**
- Admin API Key 등록/삭제가 Rate Limiting만으로 보호됨
- 손상된 세션을 통한 자동화 공격 가능
- 대량 API Key 생성/삭제로 서비스 마비 가능

**Gap #3: Rate Limiting의 한계**
- IP 기반: VPN/Proxy로 우회 가능
- User ID 기반: 여러 계정 생성으로 우회 가능
- Computational cost가 없어 봇이 쉽게 시도 가능

### Cap.js 선택 이유

**1. Privacy-First**
- Google reCAPTCHA: 사용자 추적, 개인정보 수집
- hCaptcha: 외부 서비스 의존성
- **Cap.js**: Zero telemetry, 완전한 프라이버시

**2. Performance**
- **20KB** (reCAPTCHA: ~500KB, hCaptcha: ~5MB)
- WebAssembly 기반 SHA-256 PoW
- 서버 부하 최소화

**3. UX**
- Invisible 모드 지원 (백그라운드 PoW)
- 이미지 퍼즐 불필요
- 접근성 우수

**4. Architecture**
- Standalone server 불필요 (Docker 제외)
- Next.js에 쉽게 통합 가능
- Zero external dependencies

---

## Architecture: 3-Layer Defense

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: Client-side PoW (Cap Widget)                        │
│ - User browser performs SHA-256 proof-of-work                │
│ - Bots face computational barrier                            │
│ - 20KB WebAssembly widget                                    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 2: Server-side Verification (Cap Server Library)       │
│ - Next.js API/tRPC validates Cap token                       │
│ - Forged tokens rejected                                     │
│ - Zero external service dependency                           │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: Rate Limiting (Upstash - Existing)                  │
│ - Final defense against DDoS                                 │
│ - Even legitimate users rate-limited if excessive            │
└─────────────────────────────────────────────────────────────┘
```

---

## Acceptance Criteria

### 1. Cap.js 패키지 설치 및 설정
- [ ] `@captcha/client` 패키지 설치 (Widget)
- [ ] `@captcha/server` 패키지 설치 (Verification)
- [ ] `.env` 파일에 Cap 설정 추가:
  ```env
  CAP_SECRET_KEY=<generate-32-byte-hex>
  CAP_SITE_KEY=<same-as-secret-for-simple-setup>
  CAP_DIFFICULTY=100000  # PoW difficulty (조정 가능)
  ```
- [ ] 테스트 환경에서 Cap 초기화 확인

### 2. 클라이언트 사이드 통합 (A그룹: 인증)
- [ ] `src/lib/captcha/widget.tsx` 작성: React hook으로 Cap widget 래핑
- [ ] 로그인 페이지에 Cap widget 추가:
  - `src/app/(auth)/login/page.tsx`
  - Invisible 모드 사용 (버튼 클릭 시 자동 PoW)
- [ ] 회원가입 페이지에 Cap widget 추가:
  - `src/app/(auth)/signup/page.tsx`
  - Invisible 모드 사용
- [ ] Cap token을 tRPC mutation input에 포함
- [ ] 로딩 상태 표시 (PoW 계산 중)

### 3. 클라이언트 사이드 통합 (B그룹: 민감한 관리 작업)
- [ ] Admin API Key 등록 다이얼로그에 Cap widget 추가:
  - `src/app/_components/admin-keys/AdminKeyManager.tsx`
- [ ] Admin API Key 삭제 확인 다이얼로그에 Cap widget 추가
- [ ] Project API Key 삭제 확인 다이얼로그에 Cap widget 추가:
  - `src/app/_components/projects/ApiKeyManager.tsx`
- [ ] 모든 민감한 작업에 Cap token 포함

### 4. 서버 사이드 검증 (tRPC Middleware)
- [ ] `src/server/api/captcha.ts` 작성: Cap token 검증 로직
- [ ] tRPC middleware 작성: `captchaMiddleware`
  - Token 유효성 검증
  - PoW 난이도 확인
  - 재사용 방지 (nonce 체크)
- [ ] `captchaProcedure` 생성: `protectedProcedure` + `captchaMiddleware`
- [ ] 다음 procedures에 적용:
  - `authRouter.signup`
  - `authRouter.login`
  - `teamRouter.registerAdminApiKey`
  - `teamRouter.deleteAdminApiKey`
  - `teamRouter.toggleAdminApiKey`
  - `projectRouter.disableApiKey`
  - `projectRouter.deleteApiKey`

### 5. Zod Schema 업데이트
- [ ] 모든 보호 대상 mutation의 input schema에 `captchaToken` 추가:
  ```typescript
  z.object({
    // existing fields...
    captchaToken: z.string().min(1, "CAPTCHA token is required"),
  })
  ```

### 6. 에러 처리 및 UX
- [ ] CAPTCHA 검증 실패 시 명확한 한국어 에러 메시지:
  - "보안 검증에 실패했습니다. 다시 시도해주세요."
- [ ] PoW 계산 중 로딩 인디케이터 표시
- [ ] CAPTCHA 만료 시 자동 재시도 로직
- [ ] 프론트엔드 toast 알림 통합

### 7. 테스트 환경 설정
- [ ] 테스트 환경에서 CAPTCHA 우회 옵션 제공:
  ```typescript
  // vitest.setup.ts
  if (process.env.NODE_ENV === "test") {
    process.env.CAP_BYPASS = "true";
  }
  ```
- [ ] E2E 테스트에서 CAPTCHA 자동 통과 설정

---

## Technical Implementation

### 1. 패키지 설치

```bash
bun add @captcha/client @captcha/server
```

### 2. 환경 변수 설정

```env
# .env
# Cap.js Configuration
CAP_SECRET_KEY=<openssl rand -hex 32>
CAP_SITE_KEY=<same-as-secret-for-simple-setup>
CAP_DIFFICULTY=100000  # Adjust based on desired PoW time (~1-2s)
CAP_BYPASS=false  # Set to "true" in test environment
```

```typescript
// src/env.js
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    // ... existing fields
    CAP_SECRET_KEY: z.string().min(32),
    CAP_DIFFICULTY: z.coerce.number().int().positive().default(100000),
    CAP_BYPASS: z.coerce.boolean().default(false),
  },
  client: {
    // ... existing fields
    NEXT_PUBLIC_CAP_SITE_KEY: z.string().min(1),
  },
  runtimeEnv: {
    // ... existing mappings
    CAP_SECRET_KEY: process.env.CAP_SECRET_KEY,
    CAP_DIFFICULTY: process.env.CAP_DIFFICULTY,
    CAP_BYPASS: process.env.CAP_BYPASS,
    NEXT_PUBLIC_CAP_SITE_KEY: process.env.NEXT_PUBLIC_CAP_SITE_KEY,
  },
});
```

### 3. 클라이언트 사이드 Widget Hook

```typescript
// src/lib/captcha/useCaptcha.tsx
"use client";

import { useCallback, useState } from "react";
import { createCaptcha } from "@captcha/client";

interface UseCaptchaReturn {
  isLoading: boolean;
  execute: () => Promise<string>;
  error: string | null;
}

export function useCaptcha(): UseCaptchaReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const captcha = createCaptcha({
        siteKey: process.env.NEXT_PUBLIC_CAP_SITE_KEY!,
        mode: "invisible", // Background PoW
      });

      const token = await captcha.execute();
      return token;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "CAPTCHA 검증 중 오류가 발생했습니다.";
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { isLoading, execute, error };
}
```

### 4. 서버 사이드 검증 로직

```typescript
// src/server/api/captcha.ts
import { verifyCaptcha } from "@captcha/server";
import { env } from "~/env";

export async function verifyCaptchaToken(token: string): Promise<boolean> {
  // Test bypass
  if (env.CAP_BYPASS) {
    console.warn("CAPTCHA bypassed (test mode)");
    return true;
  }

  try {
    const result = await verifyCaptcha({
      token,
      secretKey: env.CAP_SECRET_KEY,
      minDifficulty: env.CAP_DIFFICULTY,
    });

    return result.verified;
  } catch (error) {
    console.error("CAPTCHA verification error:", error);
    return false;
  }
}
```

### 5. tRPC Middleware

```typescript
// src/server/api/trpc.ts
import { verifyCaptchaToken } from "./captcha";

const captchaMiddleware = middleware(async ({ ctx, rawInput, next }) => {
  // Extract captchaToken from input
  const input = rawInput as { captchaToken?: string };

  if (!input?.captchaToken) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "CAPTCHA token is required",
    });
  }

  const isValid = await verifyCaptchaToken(input.captchaToken);

  if (!isValid) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "보안 검증에 실패했습니다. 다시 시도해주세요.",
    });
  }

  // Remove captchaToken from input before passing to procedure
  const { captchaToken, ...cleanInput } = input;

  return next({
    ctx,
    rawInput: cleanInput,
  });
});

// Combine with rate limiting
export const captchaProcedure = protectedProcedure
  .use(rateLimitMiddleware("sensitive"))
  .use(captchaMiddleware);
```

### 6. Router 업데이트

```typescript
// src/server/api/routers/auth.ts
import { captchaProcedure } from "~/server/api/trpc";

export const authRouter = createTRPCRouter({
  signup: captchaProcedure  // ✅ Changed from publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(8),
        name: z.string().optional(),
        captchaToken: z.string().min(1),  // ✅ NEW
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { email, password, name } = input;
      // captchaToken already validated by middleware
      // ... existing implementation
    }),

  login: captchaProcedure  // ✅ Changed from publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string(),
        captchaToken: z.string().min(1),  // ✅ NEW
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { email, password } = input;
      // ... existing implementation
    }),
});
```

```typescript
// src/server/api/routers/team.ts
import { captchaProcedure } from "~/server/api/trpc";

export const teamRouter = createTRPCRouter({
  registerAdminApiKey: captchaProcedure  // ✅ Changed from sensitiveProcedure
    .input(
      z.object({
        teamId: z.string(),
        provider: z.enum(["openai", "anthropic", "aws", "azure"]),
        apiKey: z.string().min(20),
        organizationId: z.string().optional(),
        displayName: z.string().max(100).optional(),
        captchaToken: z.string().min(1),  // ✅ NEW
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // ... existing implementation
    }),

  deleteAdminApiKey: captchaProcedure  // ✅ Changed from sensitiveProcedure
    .input(
      z.object({
        teamId: z.string(),
        provider: z.enum(["openai", "anthropic", "aws", "azure"]),
        organizationId: z.string(),
        captchaToken: z.string().min(1),  // ✅ NEW
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // ... existing implementation
    }),

  toggleAdminApiKey: captchaProcedure  // ✅ Changed from sensitiveProcedure
    .input(
      z.object({
        teamId: z.string(),
        provider: z.enum(["openai", "anthropic", "aws", "azure"]),
        organizationId: z.string(),
        isActive: z.boolean(),
        captchaToken: z.string().min(1),  // ✅ NEW
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // ... existing implementation
    }),
});
```

```typescript
// src/server/api/routers/project.ts
import { captchaProcedure } from "~/server/api/trpc";

export const projectRouter = createTRPCRouter({
  disableApiKey: captchaProcedure  // ✅ Changed from sensitiveProcedure
    .input(
      z.object({
        apiKeyId: z.string(),
        reason: z.string().min(1).max(500).transform(sanitizeInput),
        captchaToken: z.string().min(1),  // ✅ NEW
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // ... existing implementation
    }),

  deleteApiKey: captchaProcedure  // ✅ Changed from sensitiveProcedure
    .input(
      z.object({
        apiKeyId: z.string(),
        reason: z.string().min(1).max(500).transform(sanitizeInput),
        captchaToken: z.string().min(1),  // ✅ NEW
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // ... existing implementation
    }),
});
```

### 7. 프론트엔드 통합 (로그인 예시)

```typescript
// src/app/(auth)/login/page.tsx
"use client";

import { useState } from "react";
import { useCaptcha } from "~/lib/captcha/useCaptcha";
import { api } from "~/trpc/react";
import { toast } from "sonner";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { execute: executeCaptcha, isLoading: captchaLoading } = useCaptcha();

  const login = api.auth.login.useMutation({
    onSuccess: () => {
      toast.success("로그인 성공!");
      // Redirect...
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Execute CAPTCHA PoW
      const captchaToken = await executeCaptcha();

      // Submit with token
      await login.mutateAsync({
        email,
        password,
        captchaToken,
      });
    } catch (error) {
      toast.error("보안 검증에 실패했습니다.");
    }
  };

  const isLoading = login.isPending || captchaLoading;

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="이메일"
        disabled={isLoading}
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="비밀번호"
        disabled={isLoading}
      />
      <button type="submit" disabled={isLoading}>
        {isLoading ? "검증 중..." : "로그인"}
      </button>
    </form>
  );
}
```

### 8. 프론트엔드 통합 (Admin Key 등록 예시)

```typescript
// src/app/_components/admin-keys/AdminKeyManager.tsx
"use client";

import { useCaptcha } from "~/lib/captcha/useCaptcha";
import { api } from "~/trpc/react";

export function AdminKeyManager({ teamId }: { teamId: string }) {
  const { execute: executeCaptcha, isLoading: captchaLoading } = useCaptcha();

  const registerKey = api.team.registerAdminApiKey.useMutation({
    onSuccess: () => {
      toast.success("Admin API Key가 등록되었습니다.");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleRegister = async (formData: {
    provider: string;
    apiKey: string;
    organizationId?: string;
  }) => {
    try {
      const captchaToken = await executeCaptcha();

      await registerKey.mutateAsync({
        teamId,
        ...formData,
        captchaToken,
      });
    } catch (error) {
      toast.error("보안 검증에 실패했습니다.");
    }
  };

  return (
    <div>
      {/* Form UI */}
      <button onClick={() => handleRegister(formData)} disabled={captchaLoading || registerKey.isPending}>
        {captchaLoading ? "검증 중..." : "등록"}
      </button>
    </div>
  );
}
```

---

## Testing Checklist

### Unit Tests
- [ ] `verifyCaptchaToken()` 함수 테스트
  - Valid token → true
  - Invalid token → false
  - Test mode bypass 확인
- [ ] `useCaptcha()` hook 테스트 (React Testing Library)
  - Token 생성 성공
  - 에러 처리

### Integration Tests
- [ ] 로그인 시 CAPTCHA 토큰 없이 요청 → 400 에러
- [ ] 회원가입 시 CAPTCHA 토큰 검증 실패 → 403 에러
- [ ] Admin Key 등록 시 CAPTCHA + Rate Limiting 통합 확인
- [ ] 테스트 환경에서 `CAP_BYPASS=true` 시 CAPTCHA 우회 확인

### E2E Tests (Playwright)
- [ ] 로그인 플로우: CAPTCHA 자동 통과 설정
- [ ] 회원가입 플로우: CAPTCHA 자동 통과 설정
- [ ] Admin Key 등록 플로우: CAPTCHA 로딩 상태 확인

### Security Tests
- [ ] Forged CAPTCHA token 제출 → 403 에러
- [ ] CAPTCHA token 재사용 → 403 에러 (nonce 체크)
- [ ] 낮은 난이도 PoW token → 403 에러
- [ ] CAPTCHA 우회 시도 (빈 문자열, null) → 400 에러

### Performance Tests
- [ ] PoW 계산 시간 측정 (1-3초 목표)
- [ ] 서버 검증 시간 측정 (< 10ms)
- [ ] 동시 100명 로그인 시 CAPTCHA 처리 확인

---

## Performance Impact

| Component | Overhead | Impact |
|-----------|----------|--------|
| Client PoW | 1-3초 | User waits during PoW (acceptable for security) |
| Widget Load | 20KB (~0.1s) | Minimal, cached after first load |
| Server Verification | < 10ms | Negligible |
| **Total** | **1-3초** | **Acceptable for auth/sensitive ops** |

**Trade-off**: 1-3초의 사용자 대기 시간 vs. 봇 공격 방어 → **보안 우선**

---

## Rollout Plan

### Phase 1: 개발 환경 설정 (Day 1)
- [ ] Cap.js 패키지 설치
- [ ] 환경 변수 설정
- [ ] 기본 서버 검증 로직 작성

### Phase 2: 인증 엔드포인트 통합 (Day 2-3)
- [ ] 로그인 페이지 통합
- [ ] 회원가입 페이지 통합
- [ ] 서버 검증 middleware 작성
- [ ] 통합 테스트

### Phase 3: 민감한 관리 작업 통합 (Day 4-5)
- [ ] Admin Key 등록/삭제 통합
- [ ] Project API Key 관리 통합
- [ ] UI 로딩 상태 개선

### Phase 4: 테스트 및 보안 검증 (Day 6)
- [ ] Unit + Integration tests
- [ ] E2E tests
- [ ] Security tests (token forgery, replay)

### Phase 5: Staging 배포 및 검증 (Day 7)
- [ ] Staging 환경 배포
- [ ] 실제 사용 시나리오 테스트
- [ ] 성능 모니터링

### Phase 6: Production 배포 (Day 8)
- [ ] Production 배포
- [ ] 24시간 모니터링
- [ ] 에러 로그 확인

---

## Success Metrics

### Security Metrics
- [ ] **봇 차단율**: > 99% (forged/replayed tokens rejected)
- [ ] **False positive rate**: < 0.1% (legitimate users pass)
- [ ] **Brute force 방어**: 10회 이상 연속 실패 시 CAPTCHA 차단

### Performance Metrics
- [ ] **PoW 계산 시간**: 1-3초 (중앙값)
- [ ] **서버 검증 시간**: < 10ms (99th percentile)
- [ ] **Widget 로드 시간**: < 100ms (캐싱 후)

### User Experience Metrics
- [ ] **로그인 성공률**: > 99% (CAPTCHA로 인한 실패 < 1%)
- [ ] **사용자 불만**: 0건 (Invisible 모드로 UX 영향 최소화)

---

## Environment Variables (Final)

```env
# .env.example
# Cap.js CAPTCHA Configuration
CAP_SECRET_KEY=<openssl rand -hex 32>
CAP_DIFFICULTY=100000
CAP_BYPASS=false

# Public (exposed to client)
NEXT_PUBLIC_CAP_SITE_KEY=<same-as-CAP_SECRET_KEY-for-simple-setup>
```

**Production Setup:**
```bash
# Generate secret key
openssl rand -hex 32

# Set in Vercel/Production
CAP_SECRET_KEY=<generated-key>
CAP_DIFFICULTY=100000
CAP_BYPASS=false
NEXT_PUBLIC_CAP_SITE_KEY=<same-as-CAP_SECRET_KEY>
```

**Test Setup:**
```env
# .env.test
CAP_SECRET_KEY=test-key-32-chars-1234567890ab
CAP_DIFFICULTY=1000  # Lower difficulty for faster tests
CAP_BYPASS=true
NEXT_PUBLIC_CAP_SITE_KEY=test-key-32-chars-1234567890ab
```

---

## Security Considerations

### 1. Token Replay Prevention
- Cap.js 내장 nonce 체크로 토큰 재사용 방지
- 검증된 토큰은 5분 후 자동 만료

### 2. PoW Difficulty 조정
- **100,000**: 1-2초 (권장)
- **50,000**: 0.5-1초 (낮은 보안)
- **200,000**: 3-5초 (높은 보안, UX 저하)

### 3. Test Bypass 보안
- `CAP_BYPASS`는 **절대** production에서 `true`로 설정 금지
- CI/CD에서 env validation 추가:
  ```typescript
  if (process.env.NODE_ENV === "production" && env.CAP_BYPASS) {
    throw new Error("CAP_BYPASS must be false in production");
  }
  ```

### 4. Rate Limiting 순서
1. CAPTCHA 검증 (먼저)
2. Rate Limiting (나중)

**이유**: Invalid CAPTCHA token은 즉시 차단하여 Rate Limit 카운터 소비 방지

---

## Monitoring & Alerting

### Metrics to Track
```typescript
// src/lib/metrics/captcha.ts
export const captchaMetrics = {
  verificationSuccess: new Counter("captcha_verification_success"),
  verificationFailure: new Counter("captcha_verification_failure"),
  verificationDuration: new Histogram("captcha_verification_duration_ms"),
};
```

### Alerts
- **High failure rate**: > 10% CAPTCHA 실패 → Investigate bot attack
- **Slow verification**: > 50ms (99th percentile) → Server performance issue

---

## Related Stories

- **Story 1.11**: 보안 강화 - Rate Limiting (기반)
- **Story 1.13**: 국제화 - 에러 메시지 한국어화
- **Story 1.14**: 컴포넌트 테스트 - CAPTCHA UI 테스트 추가

---

## Definition of Done

- [ ] Cap.js 클라이언트 + 서버 라이브러리 설치 완료
- [ ] 로그인, 회원가입에 CAPTCHA 적용 완료
- [ ] Admin Key 등록/삭제/토글에 CAPTCHA 적용 완료
- [ ] Project API Key 삭제에 CAPTCHA 적용 완료
- [ ] 모든 테스트 통과 (Unit, Integration, E2E, Security)
- [ ] Staging 환경에서 실제 사용 시나리오 검증 완료
- [ ] Production 배포 및 24시간 모니터링 완료
- [ ] 보안 메트릭 목표 달성 (봇 차단율 > 99%)
- [ ] 성능 메트릭 목표 달성 (PoW 1-3초, 검증 < 10ms)
- [ ] 문서화 완료 (Setup guide, Troubleshooting)

---

## Notes

### Cap.js vs. Alternatives

| Feature | Cap.js | reCAPTCHA | hCaptcha |
|---------|--------|-----------|----------|
| Privacy | ✅ Zero tracking | ❌ Google tracking | ⚠️ Limited tracking |
| Size | ✅ 20KB | ❌ ~500KB | ❌ ~5MB |
| UX | ✅ PoW (no puzzles) | ⚠️ Puzzles | ⚠️ Puzzles |
| Dependency | ✅ Self-hosted | ❌ Google CDN | ❌ External service |
| Cost | ✅ Free | ⚠️ Free tier limited | ⚠️ Paid for enterprise |

**Decision**: Cap.js는 프라이버시, 성능, UX 측면에서 최선의 선택

### Future Enhancements (Out of Scope)

- [ ] Adaptive difficulty (봇 감지 시 난이도 자동 증가)
- [ ] Machine learning 기반 anomaly detection
- [ ] Honeypot fields 추가
- [ ] Device fingerprinting 통합
