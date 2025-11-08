# Cost Optimization Simulator & Weekly Tips - Feature Design

**Date**: 2025-01-08
**Author**: Issac
**Status**: Draft
**Priority**: High (Cost Awareness Culture - Top Priority)

---

## Executive Summary

**Problem**: 팀원들이 비용을 의식하지 않고 AI API를 사용하여 예상치 못한 비용 급증 발생

**Solution**:
1. **비용 시뮬레이터** - 개발자가 "만약 이렇게 바꾸면?" 실험 가능한 인터랙티브 도구
2. **주간 최적화 팁** - 주간 리포트에 자동으로 절감 기회 Top 3 제시

**Expected Impact**:
- 비용 인식 개선: 팀원들이 자발적으로 비용 효율적 선택
- 예상 비용 절감: 15-30% (시뮬레이터 활용 시)
- 행동 변화 측정: Feature D (Impact Measurement)와 연계

---

## Background & Motivation

### User Pain Points (Identified Priority: C → D → B → A)

**C. Cost Awareness Culture** (최우선)
- 개발자들이 GPT-4 vs GPT-3.5 비용 차이를 모름
- 프롬프트 최적화가 비용에 미치는 영향 불명확
- "시도해보기 전에는 효과를 모르겠다" → 실험 장벽

**D. Impact Measurement** (2순위)
- 비용 절감 액션을 취했을 때 실제 효과 측정 어려움
- 시뮬레이터로 "예상 효과"를 미리 보여줌으로써 동기 부여

**B. Multi-Provider Support** (3순위 - 향후 확장)
- 현재: OpenAI만 지원
- 향후: Anthropic, AWS Bedrock 등 확장 시 시뮬레이터 재사용 가능

### Related Work

- **Story 1.2**: OpenAI Costs API 비용 수집 (데이터 소스)
- **Story 1.3**: 비용-가치 컨텍스트 기록 (Novel Pattern 1)
- **Story 1.6**: 주간 리포트 생성 (통합 지점)
- **Story 1.8**: 긴급 조치용 대시보드 (UI 확장)

### Novel Aspects

1. **What-if Analysis for AI Costs**: 기존 FinOps 도구는 "과거 비용 분석"만 제공, 우리는 "미래 비용 예측"
2. **Rule-based Tips Engine**: AI 모델 없이도 효과적인 패턴 감지
3. **Integration with Weekly Report**: Push 방식으로 팁 전달 (대시보드 방문 불필요)

---

## Goals & Non-Goals

### Goals

**Phase 1 (이번 설계)**:
- ✅ 프로젝트별 비용 시뮬레이터 구현 (5가지 시나리오)
- ✅ 주간 리포트에 최적화 팁 자동 추가
- ✅ 과거 30일 실제 데이터 기반 예측

**Phase 2 (향후)**:
- 🔮 개인별 비용 대시보드 (API 키별 추적)
- 🔮 AI Cost Coach (챗봇 형태)
- 🔮 Multi-provider 시뮬레이션

### Non-Goals

**명시적 제외**:
- ❌ 실시간 비용 피드백 (SDK 래퍼 필요, 복잡도 높음)
- ❌ 자동 최적화 실행 (사용자가 직접 결정해야 함)
- ❌ ML 기반 예측 (규칙 기반으로 충분)
- ❌ 개인별 리더보드 (Phase 1 제외, 협업 저해 우려)

---

## Design Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    User Interface Layer                      │
├─────────────────────────────────────────────────────────────┤
│  프로젝트 상세 페이지                                          │
│  └─ "비용 최적화" 탭                                          │
│     ├─ 현재 비용 요약 (30일)                                  │
│     ├─ 시뮬레이터 패널                                        │
│     │  ├─ 시나리오 선택 (5가지)                               │
│     │  ├─ 파라미터 조정 (슬라이더)                            │
│     │  └─ "시뮬레이션 실행" 버튼                              │
│     └─ 결과 시각화                                           │
│        ├─ Before/After 차트                                  │
│        ├─ 예상 절감액 ($)                                    │
│        └─ 신뢰도 표시                                        │
├─────────────────────────────────────────────────────────────┤
│                      API Layer (tRPC)                        │
├─────────────────────────────────────────────────────────────┤
│  optimizationRouter                                          │
│  ├─ simulate()        # 시뮬레이션 실행                      │
│  └─ saveSimulation()  # 히스토리 저장 (선택)                │
├─────────────────────────────────────────────────────────────┤
│                    Service Layer                             │
├─────────────────────────────────────────────────────────────┤
│  cost-simulator.ts                                           │
│  ├─ simulateCostOptimization()                              │
│  └─ calculateScenario()  # 시나리오별 로직                   │
│                                                              │
│  tip-generator.ts                                            │
│  ├─ generateWeeklyTips()                                    │
│  └─ detectPatterns()     # 패턴 감지                        │
├─────────────────────────────────────────────────────────────┤
│                    Data Layer                                │
├─────────────────────────────────────────────────────────────┤
│  CostData (Prisma)                                           │
│  ├─ 30일 비용 데이터 (line_item별)                          │
│  └─ apiVersion='costs_v1'                                    │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

**시뮬레이터 실행 플로우**:
```
1. User: 시나리오 선택 ("GPT-4 → GPT-3.5 전환")
   ↓
2. Frontend: 파라미터 입력 (전환 비율 100%)
   ↓
3. tRPC: optimizationRouter.simulate() 호출
   ↓
4. Service: simulateCostOptimization()
   - 30일 비용 데이터 조회 (db.costData.findMany)
   - line_item별 비용 분해
   - 시나리오 계산 (GPT-4 비용 × 0.1)
   - 결과 반환
   ↓
5. Frontend: Before/After 차트 렌더링
   - 현재 비용: $1,000/월
   - 예상 비용: $370/월
   - 절감액: $630/월 (63%)
```

**주간 팁 생성 플로우**:
```
1. Cron Job: 매주 월요일 오전 9시 (Vercel Cron)
   ↓
2. weekly-report.ts: generateWeeklyReport() 실행
   ↓
3. tip-generator.ts: generateWeeklyTips(teamId) 호출
   - 7일 비용 데이터 조회
   - 패턴 감지 (규칙 기반)
     * GPT-4 과다 사용?
     * 프롬프트 비효율?
     * 캐싱 미사용?
   - Top 3 팁 선정 (절감액 순)
   ↓
4. React Email: 리포트 템플릿에 팁 섹션 렌더링
   ↓
5. Resend API: 이메일 발송
```

---

## Detailed Design

### 1. Cost Simulator Service

**파일**: `src/lib/services/optimization/cost-simulator.ts`

```typescript
import { db } from "~/server/db";

export interface SimulationScenario {
  type: 'model_switch' | 'prompt_optimize' | 'caching' | 'batching' | 'sampling';
  parameters: Record<string, number | string>;
}

export interface SimulationResult {
  currentCost: number;
  projectedCost: number;
  savingsAmount: number;
  savingsPercent: number;
  breakdown: {
    lineItem: string;
    currentCost: number;
    projectedCost: number;
  }[];
  confidence: 'high' | 'medium' | 'low';
}

export async function simulateCostOptimization(
  projectId: string,
  scenario: SimulationScenario
): Promise<SimulationResult> {
  // 1. 최근 30일 비용 데이터 조회
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const costData = await db.costData.findMany({
    where: {
      projectId,
      date: { gte: thirtyDaysAgo },
      apiVersion: 'costs_v1',
    },
    select: {
      lineItem: true,
      cost: true,
    },
  });

  // 2. Line item별 비용 집계
  const costByLineItem = costData.reduce((acc, item) => {
    const lineItem = item.lineItem ?? 'unknown';
    acc[lineItem] = (acc[lineItem] ?? 0) + Number(item.cost);
    return acc;
  }, {} as Record<string, number>);

  // 3. 시나리오별 계산
  const breakdown = Object.entries(costByLineItem).map(([lineItem, cost]) => {
    const projectedCost = calculateScenario(lineItem, cost, scenario);
    return { lineItem, currentCost: cost, projectedCost };
  });

  const currentCost = breakdown.reduce((sum, item) => sum + item.currentCost, 0);
  const projectedCost = breakdown.reduce((sum, item) => sum + item.projectedCost, 0);
  const savingsAmount = currentCost - projectedCost;
  const savingsPercent = (savingsAmount / currentCost) * 100;

  // 4. 신뢰도 계산
  const confidence = calculateConfidence(costData.length, scenario.type);

  return {
    currentCost,
    projectedCost,
    savingsAmount,
    savingsPercent,
    breakdown,
    confidence,
  };
}

function calculateScenario(
  lineItem: string,
  cost: number,
  scenario: SimulationScenario
): number {
  switch (scenario.type) {
    case 'model_switch':
      // GPT-4 → GPT-3.5: 10배 저렴
      if (lineItem.includes('GPT-4')) {
        return cost * 0.1;
      }
      return cost;

    case 'prompt_optimize':
      // 프롬프트 길이 단축률 (예: 50% 단축)
      const reductionRate = Number(scenario.parameters.reductionRate ?? 0.5);
      return cost * (1 - reductionRate);

    case 'caching':
      // 캐시 적중률 (예: 50% 캐싱)
      const hitRate = Number(scenario.parameters.hitRate ?? 0.5);
      return cost * (1 - hitRate);

    case 'batching':
      // 배치 API 할인 (50% 절감)
      return cost * 0.5;

    case 'sampling':
      // Temperature 낮추면 토큰 감소 (예: 20% 감소)
      const tokenReduction = Number(scenario.parameters.tokenReduction ?? 0.2);
      return cost * (1 - tokenReduction);

    default:
      return cost;
  }
}

function calculateConfidence(
  dataPoints: number,
  scenarioType: string
): 'high' | 'medium' | 'low' {
  // 데이터 포인트가 많을수록 신뢰도 높음
  if (dataPoints > 100) return 'high';
  if (dataPoints > 30) return 'medium';
  return 'low';
}
```

### 2. Optimization tRPC Router

**파일**: `src/server/api/routers/optimization.ts`

```typescript
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { simulateCostOptimization } from "~/lib/services/optimization/cost-simulator";
import { TRPCError } from "@trpc/server";

export const optimizationRouter = createTRPCRouter({
  simulate: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        scenario: z.object({
          type: z.enum(['model_switch', 'prompt_optimize', 'caching', 'batching', 'sampling']),
          parameters: z.record(z.union([z.number(), z.string()])),
        }),
      })
    )
    .query(async ({ ctx, input }) => {
      // 1. 프로젝트 접근 권한 확인
      const project = await ctx.db.project.findUnique({
        where: { id: input.projectId },
        include: {
          team: {
            include: {
              members: {
                where: { userId: ctx.session.user.id },
              },
            },
          },
        },
      });

      if (!project || project.team.members.length === 0) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: '프로젝트 접근 권한이 없습니다',
        });
      }

      // 2. 시뮬레이션 실행
      const result = await simulateCostOptimization(
        input.projectId,
        input.scenario
      );

      return result;
    }),

  // 시뮬레이션 히스토리 저장 (선택 사항)
  saveSimulation: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        scenarioName: z.string().max(100),
        result: z.object({
          currentCost: z.number(),
          projectedCost: z.number(),
          savingsAmount: z.number(),
          savingsPercent: z.number(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Future: SimulationHistory 테이블에 저장
      // 나중에 "과거 시뮬레이션 vs 실제 결과" 비교 가능
      return { success: true };
    }),
});
```

**Router 등록**: `src/server/api/root.ts`

```typescript
import { optimizationRouter } from "~/server/api/routers/optimization";

export const appRouter = createCallerFactory(createTRPCRouter)({
  // ... 기존 routers
  optimization: optimizationRouter,
});
```

### 3. Frontend: Optimization Page

**파일**: `src/app/(dashboard)/projects/[id]/optimization/page.tsx`

```typescript
"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { api } from "~/trpc/react";
import { ScenarioSelector } from "~/components/optimization/scenario-selector";
import { SimulationResult } from "~/components/optimization/simulation-result";
import { Button } from "~/components/ui/button";

export default function OptimizationPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [selectedScenario, setSelectedScenario] = useState<{
    type: string;
    parameters: Record<string, number | string>;
  } | null>(null);

  const { data: result, isLoading, refetch } = api.optimization.simulate.useQuery(
    {
      projectId,
      scenario: selectedScenario!,
    },
    {
      enabled: selectedScenario !== null,
    }
  );

  const handleSimulate = () => {
    if (selectedScenario) {
      refetch();
    }
  };

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-8">비용 최적화 시뮬레이터</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: 시나리오 선택 */}
        <ScenarioSelector
          onScenarioChange={setSelectedScenario}
        />

        {/* Right: 결과 표시 */}
        <div>
          <Button
            onClick={handleSimulate}
            disabled={!selectedScenario || isLoading}
            className="mb-4"
          >
            {isLoading ? "계산 중..." : "시뮬레이션 실행"}
          </Button>

          {result && <SimulationResult result={result} />}
        </div>
      </div>
    </div>
  );
}
```

### 4. Weekly Tip Generator

**파일**: `src/lib/services/optimization/tip-generator.ts`

```typescript
import { db } from "~/server/db";

export interface OptimizationTip {
  title: string;
  description: string;
  potentialSavings: number;
  actionItems: string[];
  priority: 'high' | 'medium' | 'low';
}

export async function generateWeeklyTips(
  teamId: string
): Promise<OptimizationTip[]> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // 1. 지난 7일 팀 비용 데이터 조회
  const costData = await db.costData.findMany({
    where: {
      teamId,
      date: { gte: sevenDaysAgo },
      apiVersion: 'costs_v1',
    },
    select: {
      lineItem: true,
      cost: true,
      projectId: true,
    },
  });

  const tips: OptimizationTip[] = [];

  // 2. 패턴 감지: GPT-4 과다 사용
  const gpt4Cost = costData
    .filter(item => item.lineItem?.includes('GPT-4'))
    .reduce((sum, item) => sum + Number(item.cost), 0);

  const totalCost = costData.reduce((sum, item) => sum + Number(item.cost), 0);

  if (gpt4Cost / totalCost > 0.7) {
    tips.push({
      title: 'GPT-4 사용량 과다 감지',
      description: `전체 비용의 ${Math.round((gpt4Cost / totalCost) * 100)}%가 GPT-4입니다. GPT-3.5로 전환 시 최대 ${Math.round(gpt4Cost * 0.9)}달러 절감 가능합니다.`,
      potentialSavings: gpt4Cost * 0.9,
      actionItems: [
        'GPT-3.5 Turbo로 전환 가능한 작업 검토',
        '시뮬레이터에서 전환 효과 확인',
        'A/B 테스트로 품질 검증',
      ],
      priority: 'high',
    });
  }

  // 3. 패턴 감지: 프롬프트 비효율 (미래 구현)
  // 평균 토큰 수가 5,000 이상인 경우

  // 4. 패턴 감지: 캐싱 미사용 (미래 구현)
  // 동일 쿼리 반복 호출 감지

  // 5. Top 3 선정 (절감액 기준)
  return tips
    .sort((a, b) => b.potentialSavings - a.potentialSavings)
    .slice(0, 3);
}
```

**주간 리포트 통합**: `src/lib/services/reporting/weekly-report.ts` 수정

```typescript
import { generateWeeklyTips } from "~/lib/services/optimization/tip-generator";

export async function generateWeeklyReport(teamId: string) {
  // ... 기존 코드 ...

  // NEW: 최적화 팁 생성
  const tips = await generateWeeklyTips(teamId);

  // React Email 템플릿에 tips 전달
  const emailHtml = await renderWeeklyReportEmail({
    // ... 기존 데이터
    optimizationTips: tips,
  });

  // Resend API 발송
  await resend.emails.send({
    from: "FinOps <report@finops-ai.com>",
    to: teamEmails,
    subject: `[FinOps] 주간 비용 리포트 - ${formattedDate}`,
    html: emailHtml,
  });
}
```

---

## Database Schema Changes

**현재 스키마로 충분** - 새 테이블 불필요

기존 `CostData` 테이블 활용:
- `lineItem`: 모델별 비용 분해
- `apiVersion='costs_v1'`: Costs API 데이터
- `date`: 시계열 분석
- `projectId`, `teamId`: 권한 확인

**선택 사항 (Phase 2)**: `SimulationHistory` 테이블
```prisma
model SimulationHistory {
  id             String   @id @default(cuid())
  projectId      String   @map("project_id")
  userId         String   @map("user_id")
  scenarioType   String   @map("scenario_type")
  scenarioName   String   @map("scenario_name")
  parameters     Json
  result         Json
  createdAt      DateTime @default(now()) @map("created_at")

  project Project @relation(fields: [projectId], references: [id])
  user    User    @relation(fields: [userId], references: [id])

  @@index([projectId, createdAt])
  @@map("simulation_history")
}
```

---

## UI/UX Design

### Scenario Selector Component

5가지 시나리오 카드:

```
┌────────────────────────────────────────────┐
│  🔄 모델 변경                               │
│  GPT-4 → GPT-3.5 전환 시 절감액?            │
│  [선택]                                    │
└────────────────────────────────────────────┘

┌────────────────────────────────────────────┐
│  ✂️ 프롬프트 최적화                         │
│  프롬프트 길이 단축 시 절감액?               │
│  [선택]                                    │
└────────────────────────────────────────────┘

┌────────────────────────────────────────────┐
│  💾 캐싱 도입                               │
│  동일 쿼리 캐싱 시 절감액?                   │
│  [선택]                                    │
└────────────────────────────────────────────┘

... (배치 처리, 샘플링 변경)
```

**선택 시 파라미터 입력**:
```
모델 변경 시나리오 선택됨
────────────────────────
전환 비율: [========90%=]
(현재 GPT-4 사용량의 90%를 GPT-3.5로 전환)

[시뮬레이션 실행]
```

### Simulation Result Component

Before/After 비교:

```
현재 비용 (최근 30일)
─────────────────────
GPT-4:         $700
GPT-3.5:       $200
Embeddings:    $100
─────────────────────
총합:          $1,000/월


예상 비용 (전환 후)
─────────────────────
GPT-4:         $70   (-90%)
GPT-3.5:       $830  (+315%)
Embeddings:    $100  (변화 없음)
─────────────────────
총합:          $1,000 → $900/월

💰 예상 절감액: $100/월 (10%)
📊 신뢰도: 높음 (120개 데이터 포인트)

액션 아이템:
✓ 1. 비핵심 작업 GPT-3.5 전환 검토
✓ 2. A/B 테스트로 품질 검증
✓ 3. 1주일 모니터링 후 전면 적용
```

### Weekly Report Email Template

기존 리포트에 섹션 추가:

```html
<!-- 기존 내용: Top 3 프로젝트, Bottom 3 프로젝트 -->

<!-- NEW: 최적화 팁 섹션 -->
<h2>💡 이번 주 절감 기회 Top 3</h2>

<div style="background: #f0f9ff; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
  <h3>1. GPT-4 사용량 과다 감지</h3>
  <p>전체 비용의 73%가 GPT-4입니다. GPT-3.5로 전환 시 최대 $630 절감 가능합니다.</p>
  <p><strong>예상 절감액: $630/월</strong></p>
  <ul>
    <li>GPT-3.5 Turbo로 전환 가능한 작업 검토</li>
    <li>시뮬레이터에서 전환 효과 확인</li>
    <li>A/B 테스트로 품질 검증</li>
  </ul>
  <a href="https://finops-ai.com/projects/abc/optimization" style="...">
    시뮬레이터에서 확인하기 →
  </a>
</div>

<!-- Tip 2, Tip 3 ... -->
```

---

## Testing Strategy

### Unit Tests

**`cost-simulator.test.ts`**:
```typescript
describe('Cost Simulator', () => {
  it('should calculate model switch scenario correctly', async () => {
    const result = await simulateCostOptimization('project-1', {
      type: 'model_switch',
      parameters: {},
    });

    expect(result.savingsPercent).toBeGreaterThan(0);
    expect(result.confidence).toBe('high');
  });

  it('should handle zero cost data gracefully', async () => {
    // Mock empty cost data
    // Expect: result with zero savings
  });
});
```

**`tip-generator.test.ts`**:
```typescript
describe('Tip Generator', () => {
  it('should detect GPT-4 overuse pattern', async () => {
    const tips = await generateWeeklyTips('team-1');

    expect(tips).toHaveLength(3);
    expect(tips[0].priority).toBe('high');
  });

  it('should return empty array when no patterns detected', async () => {
    // Mock optimal cost data
    const tips = await generateWeeklyTips('team-2');

    expect(tips).toHaveLength(0);
  });
});
```

### Integration Tests

**`optimization-router.test.ts`**:
```typescript
describe('Optimization Router', () => {
  it('should simulate cost optimization', async () => {
    const caller = createCaller({ session: mockSession, db: mockDb });

    const result = await caller.optimization.simulate({
      projectId: 'project-1',
      scenario: {
        type: 'model_switch',
        parameters: {},
      },
    });

    expect(result).toHaveProperty('savingsAmount');
  });

  it('should reject unauthorized access', async () => {
    // Test FORBIDDEN error
  });
});
```

### E2E Tests (Playwright)

**`optimization-flow.spec.ts`**:
```typescript
test('사용자가 비용 시뮬레이션을 실행할 수 있다', async ({ page }) => {
  // 1. 로그인
  await page.goto('/login');
  await page.fill('[name=email]', 'test@example.com');
  await page.fill('[name=password]', 'password');
  await page.click('button[type=submit]');

  // 2. 프로젝트 상세 페이지 → 최적화 탭
  await page.goto('/projects/abc/optimization');

  // 3. 시나리오 선택
  await page.click('text=모델 변경');

  // 4. 파라미터 조정
  await page.fill('[name=conversionRate]', '90');

  // 5. 시뮬레이션 실행
  await page.click('text=시뮬레이션 실행');

  // 6. 결과 확인
  await expect(page.locator('text=예상 절감액')).toBeVisible();
  await expect(page.locator('text=$')).toBeVisible();
});
```

---

## Performance Considerations

### Query Optimization

**비용 데이터 조회 최적화**:
```typescript
// ✅ GOOD - 필요한 필드만 select
const costData = await db.costData.findMany({
  where: {
    projectId,
    date: { gte: thirtyDaysAgo },
    apiVersion: 'costs_v1',
  },
  select: {
    lineItem: true,
    cost: true,
  },
});

// ❌ BAD - 모든 필드 조회
const costData = await db.costData.findMany({
  where: { projectId },
});
```

**Index 추가** (이미 존재):
```prisma
model CostData {
  // ...
  @@index([projectId, date])
  @@index([teamId, date])
  @@index([apiVersion])
}
```

### Caching

**React Query 캐싱**:
```typescript
// 시뮬레이션 결과는 5분간 캐싱
const { data } = api.optimization.simulate.useQuery(
  { projectId, scenario },
  {
    staleTime: 5 * 60 * 1000, // 5분
    cacheTime: 10 * 60 * 1000, // 10분
  }
);
```

### Rate Limiting

시뮬레이터는 연산 비용이 높으므로 rate limit 적용:

```typescript
// src/server/api/routers/optimization.ts
import { rateLimits } from "~/server/api/ratelimit";

export const optimizationRouter = createTRPCRouter({
  simulate: protectedProcedure
    .use(async ({ ctx, next }) => {
      const ip = ctx.headers.get("x-forwarded-for") ?? "anonymous";
      const { success } = await rateLimits.normal.limit(ip);

      if (!success) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: '시뮬레이션 요청이 너무 많습니다. 잠시 후 다시 시도하세요.',
        });
      }

      return next();
    })
    .input(/* ... */)
    .query(/* ... */),
});
```

---

## Security Considerations

### Input Validation

모든 파라미터 Zod 검증:

```typescript
const scenarioSchema = z.object({
  type: z.enum(['model_switch', 'prompt_optimize', 'caching', 'batching', 'sampling']),
  parameters: z.record(z.union([z.number(), z.string()])).refine(
    (params) => {
      // 파라미터 범위 검증
      if (params.reductionRate) {
        const rate = Number(params.reductionRate);
        return rate >= 0 && rate <= 1;
      }
      return true;
    },
    { message: '파라미터 값이 유효하지 않습니다' }
  ),
});
```

### Authorization

프로젝트 접근 권한 확인:

```typescript
// 1. 프로젝트 존재 여부
// 2. 사용자가 해당 팀 멤버인지
// 3. 프로젝트가 해당 팀에 속하는지

const project = await ctx.db.project.findUnique({
  where: { id: input.projectId },
  include: {
    team: {
      include: {
        members: {
          where: { userId: ctx.session.user.id },
        },
      },
    },
  },
});

if (!project || project.team.members.length === 0) {
  throw new TRPCError({ code: 'FORBIDDEN' });
}
```

---

## Rollout Plan

### Phase 1: Core Simulator (Week 1-2)

**Week 1**:
- [ ] `cost-simulator.ts` 구현
- [ ] `optimization.ts` tRPC router 구현
- [ ] Unit tests 작성
- [ ] Integration tests 작성

**Week 2**:
- [ ] Optimization page UI 구현
- [ ] ScenarioSelector 컴포넌트
- [ ] SimulationResult 컴포넌트
- [ ] E2E tests 작성

### Phase 2: Weekly Tips (Week 3)

- [ ] `tip-generator.ts` 구현
- [ ] `weekly-report.ts` 통합
- [ ] React Email 템플릿 수정
- [ ] 테스트 및 검증

### Phase 3: Polish & Launch (Week 4)

- [ ] 사용자 피드백 수집 (내부 테스트)
- [ ] UI/UX 개선
- [ ] 성능 최적화
- [ ] 문서 작성
- [ ] 프로덕션 배포

---

## Success Metrics

### Quantitative Metrics

1. **사용률**:
   - 시뮬레이터 월간 활성 사용자 수
   - 시뮬레이션 실행 횟수
   - 평균 시뮬레이션 세션 시간

2. **행동 변화**:
   - 시뮬레이션 후 실제 변경 수행률
   - 주간 팁 읽음률 (이메일 오픈율)
   - 팁 실행률 (클릭 → 시뮬레이터 방문)

3. **비용 절감**:
   - 시뮬레이션 예상 절감액 vs 실제 절감액
   - 평균 절감률 (%)
   - 총 절감 금액 ($)

### Qualitative Metrics

1. **사용자 만족도**:
   - 시뮬레이터 유용성 설문 (1-5점)
   - 주간 팁 유용성 설문 (1-5점)
   - 사용자 인터뷰 피드백

2. **문화 변화**:
   - "비용을 의식하게 되었다" 응답률
   - 팀 내 비용 논의 빈도 증가
   - 비용 효율적 선택 사례 수집

### Target Goals (3개월)

- ✅ 시뮬레이터 월간 활성 사용자 50명 이상
- ✅ 주간 팁 클릭률 20% 이상
- ✅ 실제 비용 절감 사례 10건 이상
- ✅ 평균 비용 절감률 15% 이상

---

## Future Enhancements

### Phase 2 (향후 3-6개월)

1. **개인별 비용 대시보드**
   - API 키별 비용 추적
   - 개인 리더보드 (선택적)
   - 개인 최적화 팁

2. **AI Cost Coach (챗봇)**
   - 자연어로 질문 ("왜 이번 주 비용이 늘었어?")
   - GPT-4 기반 답변 생성
   - 맞춤형 최적화 제안

3. **Multi-Provider Simulation**
   - Anthropic Claude 시뮬레이션
   - AWS Bedrock 시뮬레이션
   - Provider 간 비교 ("OpenAI vs Anthropic")

4. **Advanced Patterns**
   - ML 기반 이상 감지
   - 계절성 분석 (월말 급증 등)
   - 팀 간 벤치마킹

### Phase 3 (6-12개월)

1. **자동 최적화 제안**
   - "이 프롬프트를 이렇게 바꾸면?" 구체적 제안
   - Code diff 형태로 제시
   - 원클릭 적용 (PR 자동 생성)

2. **Cost-Aware IDE Extension**
   - VS Code 확장
   - 코드 작성 중 실시간 비용 표시
   - 최적화 제안 인라인 표시

---

## Open Questions

1. **시뮬레이션 히스토리 저장 여부?**
   - 저장 시: 과거 예측 vs 실제 결과 비교 가능
   - 미저장 시: 구현 간단, 스토리지 절약
   - **결정 필요**: Phase 1에서 제외하고 Phase 2에서 검토

2. **팁 생성 알고리즘 확장?**
   - 현재: 규칙 기반 (GPT-4 과다 사용)
   - 향후: ML 기반 패턴 감지?
   - **결정 필요**: 규칙 기반으로 시작, 데이터 쌓이면 ML 검토

3. **시뮬레이터 결과 공유 기능?**
   - "이 시뮬레이션을 팀원에게 공유"
   - 링크 생성 → Slack/이메일로 전송
   - **결정 필요**: Phase 2에서 검토

---

## References

### Related Documents

- **PRD**: `docs/01-planning/PRD.md` - FR002, FR003 (비용-가치 연결)
- **Epic 1**: `docs/01-planning/epics.md` - Story 1.6 (주간 리포트)
- **Architecture**: `docs/01-planning/architecture.md` - Novel Pattern 1
- **Tech Spec**: `docs/01-planning/tech-spec-epic-1.md` - Service Layer

### External Resources

- OpenAI Pricing: https://openai.com/pricing
- Recharts Documentation: https://recharts.org
- React Email: https://react.email
- Vercel Cron: https://vercel.com/docs/cron-jobs

---

## Appendix

### Scenario Calculation Details

**1. Model Switch (GPT-4 → GPT-3.5)**:
- GPT-4: $0.03/1K tokens (input), $0.06/1K tokens (output)
- GPT-3.5 Turbo: $0.003/1K tokens (input), $0.006/1K tokens (output)
- 절감률: ~90% (10배 차이)

**2. Prompt Optimize**:
- 가정: 프롬프트 길이 50% 단축 → 토큰 50% 감소
- 실제: 출력 토큰은 변하지 않을 수 있음 (보수적 예측 필요)

**3. Caching**:
- 가정: 동일 쿼리 50% 캐싱 → 비용 50% 감소
- 실제: 캐시 적중률은 워크로드에 따라 다름

**4. Batching**:
- OpenAI Batch API: 50% 할인
- 제약: 24시간 처리 시간, 비동기 처리만 가능

**5. Sampling (Temperature)**:
- 가정: Temperature 낮추면 토큰 감소 (덜 창의적 = 짧은 응답)
- 실제: 효과는 워크로드에 따라 다름

---

**End of Design Document**

_Created: 2025-01-08_
_Author: Issac_
_Version: 1.0 (Draft)_
