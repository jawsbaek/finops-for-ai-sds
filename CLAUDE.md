# Claude Code - Project Guidelines

이 문서는 Claude Code가 이 프로젝트에서 코드를 작성할 때 따라야 할 가이드라인과 베스트 프랙티스를 정의합니다.

## Vitest Testing Best Practices

### ⚠️ vi.mock() 사용 금지 (CRITICAL)

**절대 `vi.mock()`을 사용하지 마세요!** 대신 `vi.spyOn()`을 사용하세요.

#### 문제점

1. **Hoisting 문제**: `vi.mock()`은 파일 최상단으로 자동 hoisting되지만, Bun 런타임에서는 `vi`가 정의되지 않아 "vi.mock is not a function" 에러 발생
2. **Import 순서 문제**: `vi.mock()`을 imports 전에 배치해도 `vi`가 아직 import되지 않아 작동하지 않음
3. **Globals 설정 무효**: `vitest.config.ts`에 `globals: true`가 있어도 module-level에서는 `vi`를 사용할 수 없음

#### ✅ 올바른 방법: vi.spyOn() 사용

```typescript
// ❌ 잘못된 방법 - vi.mock() 사용
import { describe, expect, it, vi } from "vitest";

vi.mock("./some-module", () => ({
  someFunction: vi.fn(),
}));

import { someFunction } from "./some-module";

// ✅ 올바른 방법 - vi.spyOn() 사용
import { afterEach, describe, expect, it, vi } from "vitest";
import * as someModule from "./some-module";

describe("My Test Suite", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should work correctly", () => {
    const spy = vi.spyOn(someModule, "someFunction").mockReturnValue("mocked");

    // Test code here

    expect(spy).toHaveBeenCalled();
  });
});
```

### Logger 모킹

Logger는 `vitest.setup.ts`에서 전역으로 모킹되어 있습니다. 개별 테스트에서 logger 호출을 검증해야 할 경우:

```typescript
import { describe, expect, it, vi } from "vitest";
import * as loggerModule from "~/lib/logger";

describe("My Test", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(loggerModule.logger, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(loggerModule.logger, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should log warnings", () => {
    // Test code
    expect(warnSpy).toHaveBeenCalledWith(/* expected args */);
  });
});
```

### Database 모킹

데이터베이스를 import하면 env 검증이 트리거되므로, 전체 db 모듈을 모킹해야 합니다.
이 경우 **`vi.hoisted()`와 `vi.mock()` 조합**을 사용하세요:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// vi.hoisted로 모크 함수를 먼저 생성
const mockFindMany = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());

// vi.mock으로 모듈 전체를 모킹
vi.mock("~/server/db", () => ({
  db: {
    user: {
      findMany: mockFindMany,
      update: mockUpdate,
    },
  },
}));

import { db } from "~/server/db";

describe("Database Test", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should query database", async () => {
    mockFindMany.mockResolvedValue([
      { id: "1", name: "Test User" }
    ]);

    // Test code using db.user.findMany()

    expect(mockFindMany).toHaveBeenCalled();
  });
});
```

**왜 vi.hoisted를 사용하나요?**
- `vi.mock()`은 파일 최상단으로 hoisting됨
- 하지만 `vi.fn()`을 직접 사용하면 hoisting 시점에 `vi`가 없어서 에러 발생
- `vi.hoisted()`는 hoisting 전에 실행되어 mock 함수를 생성할 수 있게 해줌

### Fake Timers

✅ **정상 작동**: 이 프로젝트는 `bun run test` 명령어로 vitest를 실행하므로 fake timers가 정상 작동합니다.

⚠️ **주의**: `bun test` (Bun 네이티브 러너)가 아닌 `bun run test` (vitest)를 사용하세요!

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("Timer Test", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("should work with timers", async () => {
    const mockFn = vi.fn();

    setTimeout(mockFn, 1000);

    await vi.advanceTimersByTimeAsync(1000);

    expect(mockFn).toHaveBeenCalled();
  });
});
```

**테스트 실행 명령어**:
- ✅ `bun run test` - vitest 사용 (fake timers 지원)
- ✅ `vitest` - 직접 vitest 실행
- ❌ `bun test` - Bun 네이티브 러너 (fake timers 미지원)

### 외부 라이브러리 모킹

외부 라이브러리(Resend, fetch 등)를 모킹할 때도 동일한 원칙 적용:

```typescript
import { describe, expect, it, vi } from "vitest";

describe("API Test", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should call external API", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ data: "test" }),
    } as Response);

    // Test code

    expect(fetchSpy).toHaveBeenCalled();
  });
});
```

### Setup 파일에서 전역 모킹

반복적으로 모킹이 필요한 모듈은 `vitest.setup.ts`에 추가:

```typescript
// vitest.setup.ts
import { beforeAll, vi } from "vitest";

vi.mock("pino", () => ({
  default: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));
```

## 요약

### 일반적인 경우 (함수/메서드 모킹)
1. ✅ **`vi.spyOn()` 사용** - 특정 함수나 메서드를 모킹할 때
2. ✅ **`afterEach()`에서 `vi.restoreAllMocks()` 호출**

### 특별한 경우 (전체 모듈 모킹 필요 시)
1. ✅ **`vi.hoisted()` + `vi.mock()` 조합 사용** - db, env 등 전체 모듈을 모킹해야 할 때
2. ✅ **import 순서**: vitest import → vi.hoisted → vi.mock → 실제 모듈 import

### 공통 규칙
1. ✅ **테스트 실행**: `bun run test` 사용 (vitest)
2. ❌ **사용 금지**: `bun test` (Bun 네이티브 러너)
3. ✅ **전역 모킹**: `vitest.setup.ts`에서 처리

이 가이드라인을 따르면 테스트가 안정적이고 예측 가능하게 작동합니다.

### 패턴 선택 가이드

| 상황 | 사용할 패턴 | 예시 |
|------|------------|------|
| 특정 함수 모킹 | `vi.spyOn()` | logger.warn, fetch |
| 전체 모듈 모킹 (import 시 부작용 있음) | `vi.hoisted()` + `vi.mock()` | db, env |
| 전역적으로 모킹 | `vitest.setup.ts`에 vi.mock | pino, next-auth |
