# Story 1.16: 성능 최적화 - react-hook-form

**Status:** 📋 TODO

**Priority:** 🟢 LOW

---

## User Story

**As a** 개발자,
**I want** react-hook-form을 사용하여 폼 성능을 최적화하여,
**So that** 불필요한 리렌더링을 줄이고 사용자 경험을 개선할 수 있다.

---

## Context

**Code Review 발견 사항 (PR #26):**

### Issue: 폼 상태 관리 최적화 (LOW)

**현재 상태:**
```typescript
// src/app/(dashboard)/projects/[id]/settings/page.tsx
const [thresholdValue, setThresholdValue] = useState<string>("");
const [selectedMetric, setSelectedMetric] = useState<string>("");

// 매 입력마다 컴포넌트 전체가 리렌더링됨
<Input
  id="threshold-value"
  type="number"
  value={thresholdValue}
  onChange={(e) => setThresholdValue(e.target.value)}
/>
```

**문제점:**
- 각 입력 필드마다 개별 useState 사용
- 입력할 때마다 컴포넌트 전체 리렌더링
- 폼 검증 로직이 수동으로 관리됨
- 에러 처리가 일관성 없음

**성능 영향:**
- 복잡한 폼에서 타이핑 지연 발생 가능
- 불필요한 리렌더링으로 배터리 소모 증가
- 검증 로직 중복

**해결 방법:**
- react-hook-form 도입
- 제어되지 않는 입력(uncontrolled inputs) 사용
- 내장 검증 기능 활용
- 성능 최적화된 폼 제출 처리

---

## Acceptance Criteria

### 필수 요구사항

#### 1. react-hook-form 설정
- [ ] react-hook-form 설치
- [ ] zod 스키마 검증 통합
- [ ] 기본 폼 구성 설정

#### 2. Settings 페이지 리팩토링
- [ ] 알림 임계값 설정 폼을 react-hook-form으로 마이그레이션
- [ ] 폼 검증 로직을 zod 스키마로 이동
- [ ] 에러 메시지 표시를 FormMessage 컴포넌트로 통합

#### 3. 다른 폼들에 적용
- [ ] 팀 생성 폼 (teams/page.tsx)
- [ ] 프로젝트 생성 폼 (projects/_components/project-list-client.tsx)
- [ ] 로그인 폼 (app/(auth)/login/page.tsx)
- [ ] 회원가입 폼 (app/(auth)/signup/page.tsx)

#### 4. 성능 측정
- [ ] 리렌더링 횟수 측정 (React DevTools Profiler)
- [ ] 타이핑 입력 지연 측정
- [ ] 최적화 전후 비교 문서 작성

---

## Technical Implementation

### 1. 프로젝트 설정

```bash
bun add react-hook-form @hookform/resolvers zod
```

### 2. Zod 스키마 정의

**src/lib/validations/alert.ts** (NEW FILE):
```typescript
import { z } from "zod";

export const alertThresholdSchema = z.object({
  metric: z.enum(["COST", "USAGE", "ERROR_RATE"], {
    required_error: "측정 항목을 선택해주세요",
  }),
  threshold: z
    .number({
      required_error: "임계값을 입력해주세요",
      invalid_type_error: "숫자를 입력해주세요",
    })
    .positive("0보다 큰 숫자를 입력해주세요")
    .max(1000000, "임계값이 너무 큽니다"),
  notificationEmail: z
    .string()
    .email("유효한 이메일 주소를 입력해주세요")
    .optional(),
});

export type AlertThresholdInput = z.infer<typeof alertThresholdSchema>;
```

### 3. Settings 페이지 리팩토링

**Before:**
```typescript
// src/app/(dashboard)/projects/[id]/settings/page.tsx
const [thresholdValue, setThresholdValue] = useState<string>("");
const [selectedMetric, setSelectedMetric] = useState<string>("");

const handleSetThreshold = () => {
  if (!thresholdValue || Number.parseFloat(thresholdValue) <= 0) {
    toast.error("0보다 큰 숫자를 입력해주세요");
    return;
  }

  setThreshold.mutate({
    projectId: project.id,
    metric: selectedMetric as "COST" | "USAGE" | "ERROR_RATE",
    threshold: Number.parseFloat(thresholdValue),
  });
};
```

**After:**
```typescript
// src/app/(dashboard)/projects/[id]/settings/page.tsx
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { alertThresholdSchema, type AlertThresholdInput } from "@/lib/validations/alert";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const form = useForm<AlertThresholdInput>({
  resolver: zodResolver(alertThresholdSchema),
  defaultValues: {
    metric: "COST",
    threshold: 0,
  },
});

const onSubmit = (data: AlertThresholdInput) => {
  setThreshold.mutate({
    projectId: project.id,
    metric: data.metric,
    threshold: data.threshold,
  });
};

return (
  <Form {...form}>
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <FormField
        control={form.control}
        name="metric"
        render={({ field }) => (
          <FormItem>
            <FormLabel>측정 항목</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="측정 항목 선택" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="COST">비용</SelectItem>
                <SelectItem value="USAGE">사용량</SelectItem>
                <SelectItem value="ERROR_RATE">에러율</SelectItem>
              </SelectContent>
            </Select>
            <FormDescription>
              알림을 받을 측정 항목을 선택하세요
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="threshold"
        render={({ field }) => (
          <FormItem>
            <FormLabel>임계값</FormLabel>
            <FormControl>
              <Input
                type="number"
                placeholder="100"
                {...field}
                onChange={(e) => field.onChange(e.target.valueAsNumber)}
              />
            </FormControl>
            <FormDescription>
              알림을 받을 임계값을 설정하세요
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <Button
        type="submit"
        disabled={setThreshold.isPending || !form.formState.isValid}
      >
        {setThreshold.isPending && (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        )}
        알림 설정
      </Button>
    </form>
  </Form>
);
```

### 4. 팀 생성 폼 리팩토링

**src/lib/validations/team.ts** (NEW FILE):
```typescript
import { z } from "zod";

export const createTeamSchema = z.object({
  name: z
    .string()
    .min(1, "팀명을 입력해주세요")
    .max(100, "팀명은 100자 이하여야 합니다"),
  monthlyBudget: z
    .number({
      invalid_type_error: "숫자를 입력해주세요",
    })
    .positive("0보다 큰 숫자를 입력해주세요")
    .optional(),
});

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
```

**src/app/(dashboard)/teams/page.tsx**:
```typescript
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { createTeamSchema, type CreateTeamInput } from "@/lib/validations/team";

const form = useForm<CreateTeamInput>({
  resolver: zodResolver(createTeamSchema),
  defaultValues: {
    name: "",
    monthlyBudget: undefined,
  },
});

const onSubmit = (data: CreateTeamInput) => {
  createTeam.mutate({
    name: data.name,
    monthlyBudget: data.monthlyBudget,
  });
};

// Form JSX similar to Settings example above
```

### 5. 성능 측정

**Before (useState):**
```typescript
// 매 타이핑마다 리렌더링
// Input value "1" → 컴포넌트 리렌더링
// Input value "10" → 컴포넌트 리렌더링
// Input value "100" → 컴포넌트 리렌더링
// Total: 3 renders for "100"
```

**After (react-hook-form):**
```typescript
// 제어되지 않는 입력으로 리렌더링 최소화
// Input value "1" → no render
// Input value "10" → no render
// Input value "100" → no render
// Submit → 1 render for validation
// Total: 1 render for "100" + submit
```

**성능 개선:**
- 리렌더링 횟수: ~70% 감소
- 타이핑 입력 지연: 제거
- 메모리 사용량: ~20% 감소 (불필요한 상태 제거)

---

## Test Cases

### 단위 테스트

```typescript
// __tests__/unit/validations/alert.test.ts
import { alertThresholdSchema } from "@/lib/validations/alert";

describe("Alert Threshold Validation", () => {
  it("should accept valid threshold", () => {
    const result = alertThresholdSchema.safeParse({
      metric: "COST",
      threshold: 100,
    });

    expect(result.success).toBe(true);
  });

  it("should reject negative threshold", () => {
    const result = alertThresholdSchema.safeParse({
      metric: "COST",
      threshold: -10,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("0보다 큰");
    }
  });

  it("should reject zero threshold", () => {
    const result = alertThresholdSchema.safeParse({
      metric: "COST",
      threshold: 0,
    });

    expect(result.success).toBe(false);
  });

  it("should accept optional notification email", () => {
    const result = alertThresholdSchema.safeParse({
      metric: "COST",
      threshold: 100,
      notificationEmail: "test@example.com",
    });

    expect(result.success).toBe(true);
  });

  it("should reject invalid email", () => {
    const result = alertThresholdSchema.safeParse({
      metric: "COST",
      threshold: 100,
      notificationEmail: "invalid-email",
    });

    expect(result.success).toBe(false);
  });
});
```

### E2E 테스트

```typescript
// __tests__/e2e/form-validation.spec.ts
import { expect, test } from "@playwright/test";
import { setupTestUser } from "./helpers";

test.describe("Form Validation with react-hook-form", () => {
  test("should show validation error for empty team name", async ({ page }) => {
    await setupTestUser(page);
    await page.goto("/teams");
    await page.click('[data-testid="create-team-button"]');

    // Try to submit without filling name
    await page.click('[data-testid="confirm-create-team"]');

    // Should show validation error
    const errorMessage = page.locator('text=/팀명을 입력해주세요/i');
    await expect(errorMessage).toBeVisible();
  });

  test("should show validation error for zero threshold", async ({ page }) => {
    await setupTestUser(page);

    // Create team and project
    await page.goto("/teams");
    await page.click('[data-testid="create-team-button"]');
    await page.fill('input[id="name"]', "Test Team");
    await page.click('[data-testid="confirm-create-team"]');

    await page.goto("/projects");
    await page.click('[data-testid="create-project-button"]');
    await page.fill('input[id="name"]', "Test Project");
    await page.click('[data-testid="confirm-create-project"]');

    await page.waitForURL(/\/projects\/[^/]+$/, { timeout: 10000 });
    const currentUrl = page.url();
    const projectId = currentUrl.split("/projects/")[1]?.split("/")[0];
    await page.goto(`/projects/${projectId}/settings`);

    // Try to set zero threshold
    await page.fill('input[name="threshold"]', "0");
    await page.click('button[type="submit"]');

    // Should show validation error
    const errorMessage = page.locator('text=/0보다 큰/i');
    await expect(errorMessage).toBeVisible();
  });

  test("should disable submit button when form is invalid", async ({ page }) => {
    await setupTestUser(page);
    await page.goto("/teams");
    await page.click('[data-testid="create-team-button"]');

    // Submit button should be disabled when form is invalid
    const submitButton = page.locator('[data-testid="confirm-create-team"]');
    await expect(submitButton).toBeDisabled();

    // Fill in name
    await page.fill('input[id="name"]', "Test Team");

    // Submit button should be enabled
    await expect(submitButton).toBeEnabled();
  });
});
```

### 성능 테스트

```typescript
// __tests__/performance/form-renders.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { useState } from "react";

describe("Form Performance", () => {
  it("should minimize re-renders with react-hook-form", () => {
    let renderCount = 0;

    function FormWithHookForm() {
      renderCount++;
      const { register } = useForm();

      return (
        <form>
          <input {...register("name")} data-testid="input" />
        </form>
      );
    }

    const { rerender } = render(<FormWithHookForm />);
    const input = screen.getByTestId("input");

    const initialRenderCount = renderCount;

    // Type 10 characters
    for (let i = 0; i < 10; i++) {
      fireEvent.change(input, { target: { value: `test${i}` } });
    }

    // Should not cause additional renders
    expect(renderCount).toBe(initialRenderCount);
  });

  it("should cause re-renders with useState", () => {
    let renderCount = 0;

    function FormWithUseState() {
      renderCount++;
      const [value, setValue] = useState("");

      return (
        <form>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            data-testid="input"
          />
        </form>
      );
    }

    const { rerender } = render(<FormWithUseState />);
    const input = screen.getByTestId("input");

    const initialRenderCount = renderCount;

    // Type 10 characters
    for (let i = 0; i < 10; i++) {
      fireEvent.change(input, { target: { value: `test${i}` } });
    }

    // Should cause 10 additional renders
    expect(renderCount).toBe(initialRenderCount + 10);
  });
});
```

---

## Definition of Done

- [ ] react-hook-form 및 @hookform/resolvers 설치 완료
- [ ] Zod 스키마 검증 통합 완료
- [ ] Settings 페이지 폼 리팩토링 완료
- [ ] 팀 생성 폼 리팩토링 완료
- [ ] 프로젝트 생성 폼 리팩토링 완료
- [ ] 로그인/회원가입 폼 리팩토링 완료
- [ ] 모든 폼 검증 로직이 zod 스키마로 이동됨
- [ ] 단위 테스트 작성 및 통과
- [ ] E2E 테스트 업데이트 및 통과
- [ ] 성능 측정 문서 작성 (리렌더링 횟수 비교)
- [ ] 타입 안정성 확보 (모든 폼 입력에 타입 정의)
- [ ] 기존 기능 동작 확인 (회귀 테스트)

---

## Dependencies

**Blocked By:**
- None

**Blocks:**
- None

---

## Technical Notes

### react-hook-form 장점

1. **성능 최적화**
   - 제어되지 않는 입력(uncontrolled inputs) 사용
   - 불필요한 리렌더링 최소화
   - 입력 값이 DOM에만 저장되고 React 상태를 거치지 않음

2. **더 나은 개발자 경험**
   - 타입 안전성 (TypeScript 완벽 지원)
   - Zod 스키마와 완벽한 통합
   - 폼 상태 관리 자동화 (dirty, touched, errors)

3. **코드 간소화**
   - 반복적인 boilerplate 제거
   - 검증 로직 중앙화
   - 에러 처리 일관성

### 마이그레이션 전략

1. **Phase 1**: Settings 페이지만 마이그레이션 (가장 복잡한 폼)
2. **Phase 2**: 다른 대시보드 폼들 (팀, 프로젝트)
3. **Phase 3**: 인증 폼들 (로그인, 회원가입)

각 Phase마다:
- E2E 테스트 업데이트
- 성능 측정
- 회귀 테스트

### Zod vs 다른 검증 라이브러리

**Zod 선정 이유:**
- TypeScript-first 설계
- 타입 추론 자동화
- react-hook-form과 완벽한 통합
- 경량 (bundle size 작음)
- 활발한 커뮤니티

**대안:**
- Yup: 더 오래됨, 더 큰 번들 크기
- Joi: Node.js 환경에 최적화, 브라우저에는 과도함

### 성능 고려사항

**언제 react-hook-form을 사용해야 하나?**
- ✅ 3개 이상의 입력 필드가 있는 폼
- ✅ 복잡한 검증 로직이 필요한 폼
- ✅ 동적 필드가 있는 폼

**언제 useState가 더 나을까?**
- 1-2개의 간단한 입력 필드
- 검증이 필요 없는 경우
- 즉각적인 상태 업데이트가 필요한 경우 (예: 검색 필터)

---

## Estimation

**Story Points:** 5

**Time Estimate:**
- 설정 및 Zod 스키마 생성: 2시간
- Settings 페이지 리팩토링: 3시간
- 다른 폼들 리팩토링: 4시간
- 테스트 업데이트: 2시간
- 성능 측정 및 문서: 1시간
- **Total:** ~12시간

---

## References

- [react-hook-form Documentation](https://react-hook-form.com/)
- [Zod Documentation](https://zod.dev/)
- [React Hook Form + Zod Guide](https://react-hook-form.com/get-started#SchemaValidation)
- [Performance Comparison](https://react-hook-form.com/faqs#PerformanceofReactHookForm)
- [PR #26 Code Review](https://github.com/jawsbaek/finops-for-ai-sds/pull/26)
