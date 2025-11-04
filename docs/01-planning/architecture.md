# Decision Architecture - finops-for-ai

**Author:** Issac
**Date:** 2025-01-04 (Updated for Costs API Migration)
**Original Date:** 2025-10-31
**Project Level:** 2
**Target Scale:** MVP - AI Cost Management Platform

> **🔄 MIGRATION NOTE:** This document has been updated to reflect the OpenAI Costs API migration. See [BREAKING_CHANGES.md](./migration/BREAKING_CHANGES.md) for details.

---

## Executive Summary

finops-for-ai 프로젝트는 **T3 Stack (Next.js 16 + tRPC + Prisma + NextAuth)** 기반의 AI 비용 관리 플랫폼입니다. Vercel에 배포되며, Neon PostgreSQL을 사용하고, AWS KMS 기반 보안으로 민감한 API 자격증명을 보호합니다.

핵심 차별화 요소는 두 가지 Novel Patterns입니다:
1. **비용-가치 연결**: 단순 비용 추적이 아닌, 프로젝트 성과와 함께 분석하여 "비용 대비 가치" 계산
2. **팀 기반 Admin API 키 + 프로젝트 ID 필터링**: Team-level OpenAI Organization Admin Key로 Costs API 호출, OpenAI Project IDs로 프로젝트별 비용 필터링 및 팀 레벨 집계

이 아키텍처는 15개 스토리(2개 Epic)를 2-4시간 단위로 구현 가능하도록 AI 에이전트 일관성을 보장합니다.

---

## Project Initialization

**첫 번째 구현 스토리 (Story 1.1)에서 실행:**

```bash
bun create t3-app@latest finops-for-ai -- --nextAuth --prisma --trpc --tailwind --typescript
```

이 명령은 다음 아키텍처 결정을 자동으로 설정합니다:
- ✅ Next.js 16 (App Router)
- ✅ TypeScript
- ✅ tRPC v11
- ✅ Prisma ORM 6
- ✅ NextAuth v5 (Auth.js)
- ✅ Tailwind CSS
- ✅ T3 표준 프로젝트 구조

---

## Decision Summary

| Category | Decision | Version | Affects Epics | Rationale |
| -------- | -------- | ------- | ------------- | --------- |
| **Language** | TypeScript | 5.1+ | All | T3 Stack 제공, 타입 안전성 |
| **Framework** | Next.js (App Router) | 16.x | All | T3 Stack 제공, SSR/SSG 지원 |
| **API Pattern** | tRPC + OpenAI Costs API | 11.7.1 / v1 | All | T3 Stack 제공, 엔드투엔드 타입 안전 / Costs API provides organization-level aggregated data with project_id filtering |
| **ORM** | Prisma | 6.16.3 | All | T3 Stack 제공, PostgreSQL 최적화 |
| **Authentication** | NextAuth v5 (Auth.js) | 5.x | Epic 1 | T3 Stack 제공, JWT 기반 |
| **Styling** | Tailwind CSS | 3.x | All | T3 Stack 제공, 빠른 UI 개발 |
| **Deployment** | Vercel | - | All | Next.js 최적화, 자동 CI/CD |
| **Database Hosting** | Neon PostgreSQL | - | All | Vercel 공식 통합, serverless |
| **Background Jobs** | Vercel Cron Jobs | - | Epic 1, 2 | 네이티브 기능, 추가 인프라 불필요 |
| **Email Service** | Resend + React Email | - | Epic 1 | 무료 3,000통/월, Next.js 통합 |
| **Cloud SDK** | AWS SDK v3 + Azure SDK | 3.901.0 / latest | Epic 2 | 사용자 선택적 통합 |
| **Encryption** | AWS KMS | - | All | Envelope Encryption, FIPS 140-3 |
| **Charts** | Recharts | 2.x | Epic 1 | React 네이티브, SVG 기반 |
| **Data Table** | Tanstack Table | 8.x | Epic 1 | React 기반, 타입 안전 |
| **Testing (E2E)** | Playwright | latest | All | 모든 브라우저, 병렬 실행 |
| **Testing (Unit)** | Vitest | latest | All | Vite 기반, Next.js 통합 |
| **Monitoring** | Vercel Analytics + Sentry | - | All | 성능 + 에러 추적 |
| **Notifications** | Slack Webhook API | - | Epic 1 | 실시간 알림 |

---

## Project Structure

```
finops-for-ai/
├── prisma/
│   ├── schema.prisma              # DB 스키마 (Story 1.1)
│   └── migrations/                # 마이그레이션
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── (auth)/               # 인증 그룹
│   │   │   ├── login/            # Story 1.1
│   │   │   └── signup/           # Story 1.1
│   │   ├── (dashboard)/          # 대시보드 그룹
│   │   │   ├── page.tsx          # 홈 대시보드 (Story 1.8)
│   │   │   ├── projects/         # 프로젝트 상세 (Story 1.3, 1.8)
│   │   │   ├── teams/            # 팀 관리 (Story 1.7)
│   │   │   ├── settings/         # 설정 (Story 2.1)
│   │   │   ├── reports/          # 리포트 아카이브 (Story 1.6)
│   │   │   └── architecture/     # 아키텍처 권고 (Story 2.3)
│   │   ├── api/                  # API Routes
│   │   │   ├── cron/             # Vercel Cron endpoints
│   │   │   │   ├── daily-batch/  # Story 1.2, 2.2
│   │   │   │   ├── poll-threshold/ # Story 1.4
│   │   │   │   └── weekly-report/ # Story 1.6
│   │   │   └── trpc/[trpc]/      # tRPC handler
│   │   └── layout.tsx
│   ├── server/
│   │   ├── api/                  # tRPC API
│   │   │   ├── routers/
│   │   │   │   ├── auth.ts       # 인증 (Story 1.1)
│   │   │   │   ├── project.ts    # 프로젝트 (Story 1.3)
│   │   │   │   ├── team.ts       # 팀 (Story 1.7)
│   │   │   │   ├── cost.ts       # 비용 데이터 (Story 1.2)
│   │   │   │   ├── alert.ts      # 알림 (Story 1.4)
│   │   │   │   ├── cloud.ts      # 클라우드 통합 (Story 2.1, 2.2)
│   │   │   │   ├── behavior.ts   # 행동 추적 (Story 2.4)
│   │   │   │   └── feedback.ts   # 피드백 (Story 2.5)
│   │   │   ├── root.ts           # Root router
│   │   │   └── trpc.ts           # tRPC 설정
│   │   ├── auth.ts               # NextAuth 설정
│   │   └── db.ts                 # Prisma client
│   ├── lib/
│   │   ├── services/             # 비즈니스 로직
│   │   │   ├── openai/           # OpenAI 수집 (Story 1.2)
│   │   │   ├── aws/              # AWS 수집 (Story 2.2)
│   │   │   ├── azure/            # Azure 수집 (Story 2.2)
│   │   │   ├── encryption/       # KMS 암호화 (Story 1.1, 2.1)
│   │   │   ├── email/            # Resend (Story 1.4, 1.6)
│   │   │   ├── slack/            # Slack webhook (Story 1.4)
│   │   │   └── reporting/        # 리포트 생성 (Story 1.6)
│   │   ├── utils/                # 유틸리티
│   │   └── logger.ts             # Pino logger
│   ├── components/               # React 컴포넌트
│   │   ├── ui/                   # shadcn/ui 컴포넌트
│   │   ├── dialogs/              # 모달 다이얼로그 (프로젝트 관리)
│   │   │   ├── AddMemberDialog.tsx        # 멤버 추가
│   │   │   ├── AddApiKeyDialog.tsx        # API 키 추가
│   │   │   ├── ConfirmDisableKeyDialog.tsx # API 키 비활성화
│   │   │   └── ConfirmDeleteKeyDialog.tsx  # API 키 삭제
│   │   ├── charts/               # Recharts 래퍼 (Story 1.8)
│   │   ├── dashboard/            # 대시보드 컴포넌트
│   │   └── forms/                # 폼 컴포넌트
│   ├── styles/
│   │   └── globals.css           # Tailwind
│   └── env.js                    # 환경 변수 검증 (T3)
├── __tests__/                    # 테스트
│   ├── e2e/                      # Playwright
│   ├── integration/              # tRPC integration
│   └── unit/                     # Vitest unit
├── public/                       # 정적 파일
│   ├── images/
│   └── icons/
├── .env                          # 환경 변수 (gitignore)
├── .env.example
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── vercel.json                   # Cron 설정
├── playwright.config.ts
├── vitest.config.ts
└── package.json
```

---

## Epic to Architecture Mapping

### Epic 1: 프로젝트 기반 및 OpenAI 비용 관리 시스템

| Story | 아키텍처 컴포넌트 | 기술 스택 |
| ----- | ----------------- | --------- |
| 1.1 | `prisma/schema.prisma`, `src/server/auth.ts`, `src/app/(auth)/` | NextAuth, Prisma, AWS KMS |
| 1.2 | `src/lib/services/openai/cost-collector-v2.ts`, `src/app/api/cron/daily-batch/` | Vercel Cron, **Costs API (`/v1/organization/costs`)**, Pagination, Prisma |
| 1.3 | `src/lib/services/openai/context-tracker.ts`, `src/server/api/routers/project.ts` | Novel Pattern 1 (비용-가치) |
| 1.4 | `src/app/api/cron/poll-threshold/`, `src/lib/services/email/`, `src/lib/services/slack/` | Vercel Cron, Resend, Slack |
| 1.5 | `src/server/api/routers/cost.ts`, Prisma middleware | tRPC, Prisma |
| 1.6 | `src/app/api/cron/weekly-report/`, `src/lib/services/reporting/`, `src/lib/services/email/templates/` | Vercel Cron, Resend, React Email |
| 1.7 | `src/server/api/routers/team.ts` (registerAdminApiKey), `src/server/api/routers/project.ts` (registerOpenAIProjectId), `src/lib/services/encryption/api-key-manager.ts` | Novel Pattern 2 (**팀 Admin Key + 프로젝트 ID**) |
| 1.8 | `src/app/(dashboard)/`, `src/components/charts/`, `src/components/dashboard/` | Next.js, Recharts, Tailwind |
| 1.9 | `__tests__/e2e/`, `__tests__/unit/`, Vercel Analytics, Sentry | Playwright, Vitest, Monitoring |
| **1.10** | `src/server/api/routers/project.ts` (member CRUD), `src/server/api/routers/team.ts` (getMembers), `src/components/dialogs/` | **프로젝트 멤버 & API 키 관리 UI** |

### Epic 2: 클라우드 확장 및 검증 루프

| Story | 아키텍처 컴포넌트 | 기술 스택 |
| ----- | ----------------- | --------- |
| 2.1 | `src/app/(dashboard)/settings/`, `src/lib/services/aws|azure/`, `src/server/api/routers/cloud.ts` | AWS/Azure SDK, AWS KMS |
| 2.2 | `src/app/api/cron/daily-batch/`, `src/lib/services/aws|azure/cost-collector.ts` | Vercel Cron, AWS/Azure SDK |
| 2.3 | `src/app/(dashboard)/architecture/`, static markdown | Next.js static pages |
| 2.4 | `src/server/api/routers/behavior.ts`, Prisma | tRPC, Prisma |
| 2.5 | `src/server/api/routers/feedback.ts`, `src/app/(dashboard)/feedback/` | tRPC, Prisma |
| 2.6 | `src/lib/services/reporting/analytics.ts` | Data aggregation |

---

## Technology Stack Details

### Core Technologies

#### **Frontend**
- **Framework**: Next.js 16.x (App Router, React Server Components)
- **Language**: TypeScript 5.1+
- **Styling**: Tailwind CSS 3.x
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Charts**: Recharts 2.x (SVG 기반)
- **Data Tables**: @tanstack/react-table v8 (타입 안전 테이블)
- **Forms**: React Hook Form + Zod (tRPC와 스키마 공유)
- **State Management**: React Query (tRPC 내장) + React Context

#### **Backend**
- **API**: tRPC v11.7.1 (타입 안전 RPC)
- **Authentication**: NextAuth v5 (Auth.js)
- **ORM**: Prisma 6.16.3
- **Database**: Neon PostgreSQL (Serverless)
- **Background Jobs**: Vercel Cron Jobs

#### **External Services**
- **Email**: Resend (무료 3,000통/월) + React Email (템플릿)
- **Notifications**: Slack Webhook API
- **Cloud SDKs**:
  - AWS SDK v3 (`@aws-sdk/client-cost-explorer`, `@aws-sdk/client-kms`)
  - Azure SDK (`@azure/arm-costmanagement`, `@azure/identity`)
- **Encryption**: AWS KMS (Envelope Encryption)
- **Monitoring**: Vercel Analytics + Sentry
- **Logging**: Pino (JSON structured logging)

#### **Testing**
- **E2E**: Playwright (모든 브라우저, 병렬 실행)
- **Unit/Integration**: Vitest (Vite 기반)
- **Mocking**: MSW (Mock Service Worker)

#### **DevOps**
- **Hosting**: Vercel (Pro plan for Cron)
- **CI/CD**: Vercel 자동 배포 (GitHub 통합)
- **Database**: Neon (Vercel 통합)
- **Secrets**: Vercel Environment Variables + AWS Secrets Manager (KMS 키)

---

### Integration Points

**1. Frontend ↔ Backend**
- **Protocol**: tRPC (HTTP POST to `/api/trpc/[trpc]`)
- **Typing**: 자동 타입 추론 (`.useQuery()`, `.useMutation()`)
- **Authentication**: NextAuth JWT (httpOnly cookie)

**2. Backend ↔ Database**
- **Protocol**: Prisma (PostgreSQL wire protocol)
- **Connection**: Neon serverless connection string
- **Migrations**: `prisma migrate dev` (개발), `prisma migrate deploy` (프로덕션)

**3. Cron Jobs ↔ Services**
- **Invocation**: Vercel HTTP GET to `/api/cron/{endpoint}`
- **Security**: `CRON_SECRET` Bearer token 검증
- **Execution**: Direct import from `src/lib/services/`

**4. External APIs**
- **OpenAI**: REST API (`https://api.openai.com/v1/organization/costs`)
- **AWS**: SDK v3 (Cost Explorer, KMS)
- **Azure**: SDK (Cost Management API)
- **Resend**: REST API (`https://api.resend.com/emails`)
- **Slack**: Webhook POST

---

## Novel Pattern Designs

### Pattern 1: 비용-가치 연결 (Cost-Value Attribution)

**목적**: 단순 비용 추적을 넘어, 프로젝트 성과와 함께 분석하여 "비용 대비 가치" 계산

**컴포넌트:**

1. **Context Tracker** (`src/lib/services/openai/context-tracker.ts`)
   ```typescript
   class OpenAIContextTracker {
     async trackApiCall(params: {
       apiKey: string;
       model: string;
       tokens: number;
       cost: number;
       context: {
         projectId: string;
         taskType: string;
         userIntent: string;
       };
     }): Promise<void> {
       await prisma.costData.create({
         data: {
           apiKey: params.apiKey,
           model: params.model,
           tokens: params.tokens,
           cost: params.cost,
           projectId: params.context.projectId,
           taskType: params.context.taskType,
           userIntent: params.context.userIntent,
         },
       });
     }
   }
   ```

2. **Value Metrics Collector** (`src/server/api/routers/project.ts`)
   ```typescript
   updateMetrics: protectedProcedure
     .input(z.object({
       projectId: z.string(),
       successCount: z.number(),
       feedbackScore: z.number().min(1).max(5),
     }))
     .mutation(async ({ input, ctx }) => {
       return await ctx.db.projectMetrics.upsert({
         where: { projectId: input.projectId },
         update: {
           successCount: { increment: input.successCount },
           feedbackScore: input.feedbackScore,
         },
         create: { ...input },
       });
     }),
   ```

3. **Efficiency Calculator** (`src/lib/services/reporting/efficiency.ts`)
   ```typescript
   function calculateEfficiency(project: Project): number {
     const totalCost = project.costData.reduce((sum, d) => sum + d.cost, 0);
     const successCount = project.metrics.successCount;
     return successCount / totalCost; // 성공 수 / 총 비용
   }

   function rankProjects(projects: Project[]): {
     top3: Project[];
     bottom3: Project[];
   } {
     const sorted = projects.sort((a, b) =>
       calculateEfficiency(b) - calculateEfficiency(a)
     );
     return {
       top3: sorted.slice(0, 3),
       bottom3: sorted.slice(-3),
     };
   }
   ```

**데이터 흐름:**
```
OpenAI API 호출 (with context)
  → Context Tracker가 메타데이터 추가
  → cost_data 테이블 저장 (cost + context)
  → 사용자가 성과 메트릭 입력 (UI)
  → project_metrics 테이블 업데이트
  → Efficiency Calculator가 비용-가치 연결
  → 대시보드 & 주간 리포트에 Top 3 / Bottom 3 표시
```

**영향받는 Epic:** Epic 1 (Story 1.2, 1.3, 1.6, 1.8)

---

### Pattern 2: 팀 기반 Admin API 키 + 프로젝트 ID 필터링 (Team-Based Cost Attribution with Costs API)

**목적**: Organization-level cost visibility with project-level filtering via OpenAI Project IDs

**핵심 설계:**
- **팀이 Admin API 키 소유**: 각 팀이 하나의 OpenAI Organization Admin API Key 관리
- **프로젝트 ID 등록**: 각 프로젝트가 OpenAI Project ID (`proj_xxx`) 등록
- **Costs API 필터링**: Admin Key + `project_ids[]` 파라미터로 organization 전체 비용 조회 후 프로젝트별 필터링
- **비용 집계**: OpenAI Project ID → Internal Project ID 매핑 → 팀 레벨 자동 집계

**컴포넌트:**

1. **OrganizationApiKey Manager** (`src/lib/services/encryption/api-key-manager.ts`)
   ```typescript
   import { KMSClient, GenerateDataKeyCommand, DecryptCommand } from '@aws-sdk/client-kms';
   import crypto from 'crypto';

   class OrganizationApiKeyManager {
     private kms: KMSClient;

     async encryptAdminApiKey(plainKey: string, teamId: string): Promise<{
       encryptedKey: string;
       encryptedDataKey: string;
       iv: string;
       last4: string;
     }> {
       // 1. KMS에서 Data Key 생성
       const { Plaintext: dataKey, CiphertextBlob: encryptedDataKey } =
         await this.kms.send(new GenerateDataKeyCommand({
           KeyId: process.env.AWS_KMS_CMK_ID,
           KeySpec: 'AES_256',
         }));

       // 2. Data Key로 Admin API 키 암호화 (AES-256-GCM)
       const iv = crypto.randomBytes(16);
       const cipher = crypto.createCipheriv('aes-256-gcm', dataKey, iv);
       const encryptedKey = cipher.update(plainKey, 'utf8', 'hex') + cipher.final('hex');
       const authTag = cipher.getAuthTag().toString('hex');

       // 3. DB 저장 (팀에 귀속)
       await prisma.organizationApiKey.upsert({
         where: { teamId },
         update: {
           encryptedKey: encryptedKey + authTag,
           encryptedDataKey: encryptedDataKey.toString('base64'),
           iv: iv.toString('hex'),
           last4: plainKey.slice(-4),
           isActive: true,
         },
         create: {
           teamId,
           provider: 'openai',
           encryptedKey: encryptedKey + authTag,
           encryptedDataKey: encryptedDataKey.toString('base64'),
           iv: iv.toString('hex'),
           last4: plainKey.slice(-4),
           keyType: 'admin',
         },
       });

       return {
         encryptedKey: encryptedKey + authTag,
         encryptedDataKey: encryptedDataKey.toString('base64'),
         iv: iv.toString('hex'),
         last4: plainKey.slice(-4)
       };
     }

     async decryptAdminApiKey(teamId: string): Promise<string> {
       const record = await prisma.organizationApiKey.findUnique({
         where: { teamId },
       });

       if (!record) {
         throw new Error(`No admin API key found for team ${teamId}`);
       }

       // 1. KMS에 암호화된 Data Key 전송 → 평문 Data Key 획득
       const { Plaintext: dataKey } = await this.kms.send(new DecryptCommand({
         CiphertextBlob: Buffer.from(record.encryptedDataKey, 'base64'),
       }));

       // 2. Extract auth tag
       const authTag = Buffer.from(record.encryptedKey.slice(-32), 'hex');
       const encryptedText = record.encryptedKey.slice(0, -32);

       // 3. Data Key로 API 키 복호화
       const decipher = crypto.createDecipheriv('aes-256-gcm', dataKey, Buffer.from(record.iv, 'hex'));
       decipher.setAuthTag(authTag);
       return decipher.update(encryptedText, 'hex', 'utf8') + decipher.final('utf8');
     }
   }
   ```

2. **Project ID Registry** (`src/server/api/routers/project.ts`)
   ```typescript
   registerOpenAIProjectId: protectedProcedure
     .input(z.object({
       projectId: z.string(),
       openaiProjectId: z.string().regex(/^proj_[a-zA-Z0-9_-]+$/),
     }))
     .mutation(async ({ input, ctx }) => {
       const userId = ctx.session.user.id;

       // 1. 프로젝트 멤버십 확인
       const project = await ctx.db.project.findUnique({
         where: { id: input.projectId },
         include: {
           team: {
             include: {
               organizationApiKey: true,
               members: { where: { userId } },
             },
           },
           members: { where: { userId } },
         },
       });

       if (!project || (!project.members.length && !project.team.members.length)) {
         throw new TRPCError({ code: 'FORBIDDEN' });
       }

       // 2. Team에 Admin API Key 확인
       if (!project.team.organizationApiKey?.isActive) {
         throw new TRPCError({
           code: 'PRECONDITION_FAILED',
           message: 'Team must have an active Admin API Key before registering Project IDs',
         });
       }

       // 3. OpenAI Project ID 중복 확인
       const existing = await ctx.db.project.findUnique({
         where: { openaiProjectId: input.openaiProjectId },
       });

       if (existing && existing.id !== input.projectId) {
         throw new TRPCError({
           code: 'CONFLICT',
           message: 'This OpenAI Project ID is already registered',
         });
       }

       // 4. Project 업데이트
       return await ctx.db.project.update({
         where: { id: input.projectId },
         data: { openaiProjectId: input.openaiProjectId },
       });
     }),
   ```

3. **Costs API Client** (`src/lib/services/openai/cost-collector-v2.ts`)
   ```typescript
   import pino from "pino";

   const logger = pino({ name: "openai-cost-collector-v2" });

   interface CostBucket {
     object: "bucket";
     start_time: number;
     end_time: number;
     results: {
       object: "organization.costs.result";
       amount: { value: number; currency: string };
       line_item: string | null;
       project_id: string | null;
     }[];
   }

   interface CostsAPIResponse {
     object: "page";
     data: CostBucket[];
     has_more: boolean;
     next_page: string | null;
   }

   async function fetchOpenAICosts(
     adminApiKey: string,
     startTime: number,
     endTime?: number,
     projectIds?: string[],
     limit: number = 7,
     page?: string,
   ): Promise<CostsAPIResponse> {
     const url = new URL("https://api.openai.com/v1/organization/costs");

     url.searchParams.set("start_time", startTime.toString());
     url.searchParams.set("bucket_width", "1d");
     url.searchParams.set("limit", limit.toString());
     url.searchParams.set("group_by", "line_item,project_id");

     if (endTime) url.searchParams.set("end_time", endTime.toString());
     if (page) url.searchParams.set("page", page);

     if (projectIds && projectIds.length > 0) {
       projectIds.forEach(id => url.searchParams.append("project_ids", id));
     }

     const response = await fetch(url.toString(), {
       method: "GET",
       headers: {
         Authorization: `Bearer ${adminApiKey}`,
         "Content-Type": "application/json",
       },
     });

     if (!response.ok) {
       throw new Error(`Costs API error: ${response.status}`);
     }

     return await response.json() as CostsAPIResponse;
   }

   export async function collectDailyCostsV2(
     teamId: string,
     targetDate?: Date,
   ): Promise<CollectedCostDataV2[]> {
     const date = targetDate ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
     const startOfDay = new Date(date);
     startOfDay.setHours(0, 0, 0, 0);
     const endOfDay = new Date(date);
     endOfDay.setHours(23, 59, 59, 999);

     const startTime = Math.floor(startOfDay.getTime() / 1000);
     const endTime = Math.floor(endOfDay.getTime() / 1000);

     // 1. Team의 Admin API Key 조회 및 복호화
     const orgApiKey = await db.organizationApiKey.findUnique({
       where: { teamId, provider: "openai", isActive: true },
     });

     if (!orgApiKey) {
       logger.warn({ teamId }, "No active Admin API key");
       return [];
     }

     const decryptedKey = await apiKeyManager.decryptAdminApiKey(teamId);

     // 2. Team의 모든 프로젝트 조회 (OpenAI Project ID가 있는 것만)
     const projects = await db.project.findMany({
       where: { teamId, openaiProjectId: { not: null } },
       select: { id: true, openaiProjectId: true },
     });

     if (projects.length === 0) {
       logger.warn({ teamId }, "No projects with OpenAI Project ID");
       return [];
     }

     const projectIdMap = new Map(
       projects.map(p => [p.openaiProjectId!, p.id])
     );
     const openaiProjectIds = Array.from(projectIdMap.keys());

     // 3. Costs API 호출 (pagination)
     let allBuckets: CostBucket[] = [];
     let currentPage: string | undefined;
     let hasMore = true;

     while (hasMore) {
       const response = await fetchOpenAICosts(
         decryptedKey,
         startTime,
         endTime,
         openaiProjectIds,
         180,
         currentPage
       );

       allBuckets.push(...response.data);

       if (response.has_more && response.next_page) {
         currentPage = response.next_page;
       } else {
         hasMore = false;
       }
     }

     // 4. 데이터 변환
     const allCostData: CollectedCostDataV2[] = [];

     for (const bucket of allBuckets) {
       const bucketStartTime = new Date(bucket.start_time * 1000);
       const bucketEndTime = new Date(bucket.end_time * 1000);

       for (const result of bucket.results) {
         const internalProjectId = result.project_id
           ? projectIdMap.get(result.project_id)
           : null;

         if (!internalProjectId) {
           logger.warn({ openaiProjectId: result.project_id }, "Unknown project ID");
           continue;
         }

         allCostData.push({
           projectId: internalProjectId,
           provider: "openai",
           service: result.line_item ?? "Unknown",
           cost: result.amount.value,
           bucketStartTime,
           bucketEndTime,
           lineItem: result.line_item,
           currency: result.amount.currency,
           apiVersion: "costs_v1",
         });
       }
     }

     logger.info({ teamId, recordCount: allCostData.length }, "Costs API collection completed");
     return allCostData;
   }
   ```

4. **Team Cost Aggregation** (`src/server/api/routers/cost.ts`)
   ```typescript
   // 팀별 비용은 프로젝트 비용을 집계
   getCostByTeam: protectedProcedure
     .input(z.object({ teamId: z.string() }))
     .query(async ({ input, ctx }) => {
       // 팀의 모든 프로젝트 가져오기
       const projects = await ctx.db.project.findMany({
         where: { teamId: input.teamId },
         select: { id: true }
       });

       const projectIds = projects.map(p => p.id);

       // 프로젝트별 비용 집계 (Costs API 데이터만)
       const costs = await ctx.db.costData.groupBy({
         by: ['date'],
         where: {
           projectId: { in: projectIds },
           apiVersion: 'costs_v1', // Costs API 데이터만
         },
         _sum: { cost: true }
       });

       return costs;
     }),
   ```

**데이터 흐름:**
```
팀 생성
  → Team Admin이 OpenAI Organization Admin API Key 등록
  → KMS 암호화 후 OrganizationApiKey 테이블 저장
  → 프로젝트 생성
  → Project Admin이 OpenAI Project ID 등록
  → Costs API로 유효성 검증 (Admin Key + Project ID)
  → Project.openaiProjectId 업데이트
  → 일일 배치 Cron (매일 오전 9시)
  → Cost Collector V2가 팀의 Admin Key 복호화
  → 팀의 모든 프로젝트 OpenAI Project IDs 조회
  → Costs API 호출 (project_ids 필터링, pagination)
  → openai_project_id → internal project_id 매핑
  → cost_data 테이블 저장 (apiVersion='costs_v1')
  → 팀 레벨 보고 시 프로젝트 비용 자동 집계
```

**권한 모델:**
- **Team Admin**: Admin API Key 등록/업데이트, 모든 프로젝트 비용 조회
- **Project Member**: OpenAI Project ID 등록/업데이트, 자신의 프로젝트 비용 조회
- **Team Member**: 팀 전체 비용 조회 (읽기 전용)

**영향받는 Epic:** Epic 1 (Story 1.2, 1.7), Epic 2 (Story 2.3)

---

## Implementation Patterns

### NAMING PATTERNS

#### API Routes (tRPC)
- **프로시저**: `camelCase` 동사 시작
  - ✅ `getCostData`, `createProject`, `updateThreshold`
  - ❌ `get_cost_data`, `GetCostData`

- **라우터**: 단수형 명사
  - ✅ `project.ts`, `team.ts`, `cost.ts`
  - ❌ `projects.ts`, `teams.ts`

#### Database (Prisma)
- **테이블**: 복수형 소문자
  - ✅ `users`, `projects`, `organization_api_keys`, `cost_data`
  - ❌ `Users`, `Project`, `organizationApiKeys`

- **컬럼**: `snake_case`
  - ✅ `user_id`, `created_at`, `openai_project_id`
  - ❌ `userId`, `createdAt`, `openaiProjectId`

- **외래 키**: `{table}_id`
  - ✅ `team_id`, `project_id`
  - ❌ `teamId`, `fk_team`

#### Frontend Components
- **파일명**: `PascalCase.tsx`
  - ✅ `CostChart.tsx`, `ProjectCard.tsx`
  - ❌ `cost-chart.tsx`, `projectCard.tsx`

- **폴더명**: `kebab-case/`
  - ✅ `components/cost-chart/`, `components/project-card/`
  - ❌ `components/CostChart/`, `components/project_card/`

#### 환경 변수
- **형식**: `SCREAMING_SNAKE_CASE`
- **접두사**:
  ```
  DATABASE_URL
  NEXTAUTH_SECRET
  NEXTAUTH_URL
  AWS_KMS_CMK_ID
  AWS_ACCESS_KEY_ID
  AWS_SECRET_ACCESS_KEY
  AZURE_SUBSCRIPTION_ID
  AZURE_CLIENT_ID
  AZURE_CLIENT_SECRET
  RESEND_API_KEY
  SLACK_WEBHOOK_URL
  CRON_SECRET
  ```

---

### STRUCTURE PATTERNS

#### 테스트 위치
```
src/lib/services/openai/
  ├── cost-collector-v2.ts
  └── __tests__/
      └── cost-collector-v2.test.ts
```

#### 컴포넌트 구조
- **단일 파일**: 간단한 컴포넌트
- **폴더 구조**: 복잡한 컴포넌트
  ```
  components/cost-chart/
    ├── CostChart.tsx       # 메인
    ├── CostChartLegend.tsx # 서브
    ├── types.ts            # 타입
    └── index.ts            # export
  ```

#### 서비스 레이어
```
src/lib/services/{domain}/
  ├── index.ts              # Public API
  ├── {service}.ts          # 구현
  └── __tests__/            # 테스트
```

---

### FORMAT PATTERNS

#### API 응답 (tRPC)
```typescript
// 성공: 직접 반환 (tRPC가 래핑)
return { totalCost: 1234, projects: [...] };

// 에러: TRPCError throw
throw new TRPCError({
  code: 'BAD_REQUEST',
  message: '프로젝트를 찾을 수 없습니다',
});
```

#### 날짜/시간
```typescript
// DB 저장: UTC timestamptz
created_at TIMESTAMPTZ DEFAULT NOW()

// API 응답: ISO 8601 문자열
return { createdAt: date.toISOString() };

// UI 표시: date-fns + KST
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';

format(parseISO(dateString), 'yyyy-MM-dd HH:mm', { locale: ko });
```

#### 금액
```typescript
// DB: DECIMAL(10,2)
cost DECIMAL(10,2) NOT NULL

// API: 숫자 (달러)
return { cost: 123.45 };

// UI: Intl.NumberFormat
new Intl.NumberFormat('ko-KR', {
  style: 'currency',
  currency: 'USD'
}).format(cost);
// 출력: "US$123.45"
```

---

### COMMUNICATION PATTERNS

#### tRPC 프로시저
```typescript
// 공개 API (로그인 불필요)
publicProcedure.query(async () => { ... });

// 인증 필요
protectedProcedure.query(async ({ ctx }) => {
  const userId = ctx.session.user.id;
  // ...
});
```

#### Slack 알림
```typescript
{
  text: "🚨 [팀명] 비용 임계값 초과",
  blocks: [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*프로젝트*: {projectName}\n*현재 비용*: ${cost}\n*임계값*: ${threshold} (초과율: {percent}%)"
      }
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "상세 보기" },
          url: "{dashboardUrl}/projects/{projectId}"
        }
      ]
    }
  ]
}
```

#### 이메일 템플릿
```typescript
// src/lib/services/email/templates/WeeklyReport.tsx
import { Html, Head, Body, Container, Section, Text } from '@react-email/components';

export function WeeklyReportEmail({ top3, bottom3, totalCost }) {
  return (
    <Html lang="ko">
      <Head />
      <Body>
        <Container>
          <Section>
            <Text>주간 비용 리포트</Text>
            <Text>총 비용: {totalCost}</Text>
            {/* ... */}
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
```

---

### LIFECYCLE PATTERNS

#### 로딩 상태
```typescript
const { data, isLoading, isError, error } = api.project.getAll.useQuery();

if (isLoading) return <Spinner />;
if (isError) return <ErrorMessage error={error} />;
return <ProjectList projects={data} />;
```

#### 에러 복구
```typescript
// Retry: 일시적 에러만 (네트워크, 5xx)
const result = await retry(
  () => fetchOpenAICosts(adminApiKey, startTime, endTime, projectIds),
  {
    retries: 3,
    minTimeout: 1000,
    maxTimeout: 5000,
    onRetry: (err, attempt) => {
      logger.warn({ err, attempt }, 'Retrying Costs API call');
    },
  }
);

// 로깅: 모든 에러
try {
  // ...
} catch (err) {
  logger.error({ err, context }, 'Failed to process');
  Sentry.captureException(err);
  throw err;
}
```

#### Cron Job 보안
```typescript
// src/app/api/cron/daily-batch/route.ts
export async function GET(request: Request) {
  // 1. CRON_SECRET 검증
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  // 2. Idempotency 체크 (날짜 기준)
  const today = new Date().toISOString().split('T')[0];
  const existing = await prisma.cronLog.findUnique({
    where: { jobName_date: { jobName: 'daily-batch', date: today } },
  });
  if (existing) {
    return Response.json({ message: 'Already executed today' });
  }

  // 3. 실행 (Costs API v2)
  const allCostData = [];
  const activeTeams = await db.team.findMany({
    where: { organizationApiKey: { isActive: true } },
  });

  for (const team of activeTeams) {
    const costData = await collectDailyCostsV2(team.id);
    allCostData.push(...costData);
  }

  const createdCount = await storeCostDataV2(allCostData);

  // 4. 로그 기록
  await prisma.cronLog.create({
    data: { jobName: 'daily-batch', date: today },
  });

  return Response.json({ success: true, recordsCreated: createdCount });
}
```

---

### LOCATION PATTERNS

#### 환경 변수
- **로컬**: `.env` (gitignore)
- **Vercel**: Dashboard → Settings → Environment Variables
- **검증**: `src/env.js` (T3 Stack)

#### Static Assets
```
public/
  ├── images/
  │   └── logo.png
  └── icons/
      └── favicon.ico
```

#### Prisma Migrations
```bash
# 마이그레이션 생성
bunx prisma migrate dev --name add_costs_api_support

# 명명: snake_case 동사
# ✅ add_organization_api_keys
# ✅ add_openai_project_id_to_projects
# ❌ AddCostsAPISupport
```

---

### CONSISTENCY PATTERNS

#### 에러 메시지
- **사용자용**: 한국어, 친화적
  - ✅ "프로젝트를 찾을 수 없습니다"
  - ❌ "Project not found"

#### 로그 메시지
- **개발자용**: 영어, 구조화
  ```typescript
  logger.error({ userId, projectId, error }, 'Failed to fetch cost data');
  ```

#### Git Commit
- **형식**: Conventional Commits
  ```
  feat: Costs API 통합 및 Admin Key 관리
  fix: KMS 암호화 버그 수정
  chore: Prisma 스키마 업데이트 (Costs API)
  docs: architecture.md Costs API 마이그레이션 반영
  test: Costs API E2E 테스트 추가
  ```

---

## Data Architecture

### Core Models (Prisma Schema)

```prisma
// src/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// 사용자 인증 (NextAuth)
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  password_hash String
  name          String?
  created_at    DateTime  @default(now())
  updated_at    DateTime  @updatedAt

  // Relations
  sessions           Session[]
  teams              TeamMember[]
  projectMemberships ProjectMember[]

  @@map("users")
}

model Session {
  id           String   @id @default(cuid())
  session_token String   @unique
  user_id      String
  expires      DateTime

  user User @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@map("sessions")
}

// 팀 (Story 1.7) - Multi-Org Support
model Team {
  id         String   @id @default(cuid())
  name       String
  created_at DateTime @default(now())

  // Relations
  members             TeamMember[]
  projects            Project[]
  organizationApiKeys OrganizationApiKey[] // 🆕 1:N 관계 (team can have multiple org keys)

  @@map("teams")
}

model TeamMember {
  id      String @id @default(cuid())
  team_id String
  user_id String
  role    String // "admin" | "member"

  team Team @relation(fields: [team_id], references: [id], onDelete: Cascade)
  user User @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@unique([team_id, user_id])
  @@map("team_members")
}

// 🆕 Team-level Organization Admin API Key (Story 1.7) - Multi-Org Support
model OrganizationApiKey {
  id               String   @id @default(cuid())
  teamId           String   @map("team_id")  // ✅ Removed @unique - now 1:N (team can have multiple org keys)
  provider         String   // 'openai', 'anthropic', 'aws', 'azure'
  organizationId   String?  @map("organization_id") // OpenAI: org_xxx, Anthropic: workspace_xxx

  // KMS Envelope Encryption
  encryptedKey     String   @map("encrypted_key") @db.Text
  encryptedDataKey String   @map("encrypted_data_key") @db.Text
  iv               String   // Initialization vector

  // 보안 및 메타데이터
  last4            String   @db.VarChar(4) // 마지막 4자리 (UI 표시용)
  isActive         Boolean  @default(true) @map("is_active")
  keyType          String   @default("admin") @map("key_type") // 'admin' | 'service_account'
  displayName      String?  @map("display_name") // User-friendly name for UI

  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")

  team Team @relation(fields: [teamId], references: [id], onDelete: Cascade)

  @@unique([teamId, provider, organizationId], name: "unique_team_provider_org")
  @@index([teamId])
  @@index([provider, isActive])
  @@map("organization_api_keys")
}

// 🆕 Deprecated: Project-level API Keys (Usage API 전용, 마이그레이션 후 제거 검토)
model ApiKey {
  id                 String   @id @default(cuid())
  project_id         String
  provider           String   // "openai" | "aws" | "azure"
  encrypted_key      String   @db.Text
  encrypted_data_key String   @db.Text // KMS Data Key
  iv                 String   // Initialization Vector
  is_active          Boolean  @default(true)
  created_at         DateTime @default(now())

  project   Project    @relation(fields: [project_id], references: [id], onDelete: Cascade)
  cost_data CostData[]

  @@index([project_id])
  @@map("api_keys")
}

// 프로젝트 (Story 1.3, 1.7) - Multi-Provider Support
model Project {
  id          String   @id @default(cuid())
  name        String
  description String?
  team_id     String

  // 🆕 AI Provider Integration (Multi-Provider Support)
  aiProvider       String?  @map("ai_provider")        // 'openai', 'anthropic', 'aws', 'azure'
  aiOrganizationId String?  @map("ai_organization_id") // org_xxx, workspace_xxx, account_id, subscription_id
  aiProjectId      String?  @map("ai_project_id")      // proj_xxx, project_xxx, application_id

  created_at  DateTime @default(now())

  // Relations
  team      Team             @relation(fields: [team_id], references: [id])
  members   ProjectMember[]
  api_keys  ApiKey[]        // ⚠️ Deprecated: Usage API용
  cost_data CostData[]
  metrics   ProjectMetrics?

  @@unique([aiProvider, aiOrganizationId, aiProjectId], name: "unique_provider_org_project")
  @@index([team_id])
  @@index([aiProvider, aiOrganizationId])
  @@index([aiProjectId])
  @@map("projects")
}

// 프로젝트 멤버 (Novel Pattern 2 - 프로젝트 기반 접근 제어)
model ProjectMember {
  id         String   @id @default(cuid())
  project_id String
  user_id    String
  created_at DateTime @default(now())

  project Project @relation(fields: [project_id], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@unique([project_id, user_id])
  @@index([user_id])
  @@map("project_members")
}

// 프로젝트 성과 메트릭 (Novel Pattern 1)
model ProjectMetrics {
  id             String  @id @default(cuid())
  project_id     String  @unique
  success_count  Int     @default(0)
  feedback_score Float?  // 1-5 평균

  project Project @relation(fields: [project_id], references: [id], onDelete: Cascade)

  @@map("project_metrics")
}

// 비용 데이터 (Story 1.2, 2.2) - Costs API 지원
model CostData {
  id          String   @id @default(cuid())
  project_id  String

  // ⚠️ Deprecated: Usage API 전용 필드 (nullable)
  api_key_id  String?  @map("api_key_id")
  snapshot_id String?  @map("snapshot_id")
  tokens      Int?
  model       String?

  // 공통 필드
  provider    String   // "openai" | "aws" | "azure"
  service     String   // Usage API: 'gpt-4', Costs API: line_item
  cost        Decimal  @db.Decimal(10,2)
  date        DateTime @db.Date // Usage API: 단일 날짜, Costs API: bucketStartTime에서 변환

  // 🆕 Costs API 전용 필드
  bucketStartTime DateTime? @map("bucket_start_time") // Unix timestamp → DateTime
  bucketEndTime   DateTime? @map("bucket_end_time")
  lineItem        String?   @map("line_item") // e.g., "Image models", "GPT-4"
  currency        String?   @default("usd")

  // API 버전 트래킹 (데이터 출처 구분)
  apiVersion String @default("usage_v1") @map("api_version") // 'usage_v1' | 'costs_v1'

  // 🆕 Multi-Provider Metadata
  providerMetadata Json? @map("provider_metadata") // Provider-specific data: { organizationId, aiProjectId, etc. }

  // Novel Pattern 1: Context
  task_type   String?  // "chat" | "embedding" | "fine-tuning"
  user_intent String?  // 사용자가 입력한 의도

  created_at  DateTime @default(now())

  project Project @relation(fields: [project_id], references: [id], onDelete: Restrict)
  api_key ApiKey? @relation(fields: [api_key_id], references: [id])

  // 중복 제거 전략 변경
  @@unique([projectId, bucketStartTime, bucketEndTime, lineItem, apiVersion], name: "unique_cost_bucket")
  @@unique([apiKeyId, date, snapshotId], name: "unique_usage_snapshot") // 기존 Usage API용
  @@index([project_id, date])
  @@index([apiVersion]) // 🆕 API 버전별 쿼리용
  @@map("cost_data")
}

// 비용 임계값 알림 (Story 1.4)
model CostAlert {
  id              String   @id @default(cuid())
  project_id      String
  threshold_type  String   // "daily" | "weekly"
  threshold_value Decimal  @db.Decimal(10,2)
  is_active       Boolean  @default(true)
  created_at      DateTime @default(now())

  @@map("cost_alerts")
}

// 클라우드 제공사 자격증명 (Story 2.1 - KMS 암호화)
model CloudCredentials {
  id                 String   @id @default(cuid())
  team_id            String
  provider           String   // "aws" | "azure"
  encrypted_creds    String   @db.Text
  encrypted_data_key String   @db.Text
  iv                 String
  created_at         DateTime @default(now())

  @@unique([team_id, provider])
  @@map("cloud_credentials")
}

// 사용자 행동 추적 (Story 2.4)
model BehaviorLog {
  id          String   @id @default(cuid())
  user_id     String
  action_type String   // "api_key_changed" | "threshold_adjusted" | "project_stopped"
  project_id  String?
  metadata    Json?
  created_at  DateTime @default(now())

  @@index([user_id, created_at])
  @@map("behavior_logs")
}

// 피드백 (Story 2.5)
model Feedback {
  id                String   @id @default(cuid())
  user_id           String
  satisfaction      Int      // 1-5
  most_useful       String?
  improvement_needs String?
  next_features     String[] // 투표한 기능들
  created_at        DateTime @default(now())

  @@map("feedbacks")
}

// Cron Job 실행 로그 (Idempotency)
model CronLog {
  id       String   @id @default(cuid())
  job_name String
  date     String   // YYYY-MM-DD
  executed_at DateTime @default(now())

  @@unique([job_name, date])
  @@map("cron_logs")
}
```

---

## API Contracts

### tRPC Router Structure

```typescript
// src/server/api/root.ts
export const appRouter = createTRPCRouter({
  auth: authRouter,
  project: projectRouter,
  team: teamRouter,
  cost: costRouter,
  alert: alertRouter,
  cloud: cloudRouter,
  behavior: behaviorRouter,
  feedback: feedbackRouter,
});

export type AppRouter = typeof appRouter;
```

### Team Router (🆕 Costs API Support)

```typescript
// src/server/api/routers/team.ts
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { getKMSEncryption } from "~/lib/services/encryption/kms-envelope";

export const teamRouter = createTRPCRouter({
  /**
   * Register OpenAI Admin API Key for a team
   */
  registerAdminApiKey: protectedProcedure
    .input(
      z.object({
        teamId: z.string(),
        apiKey: z.string().min(20),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // 1. 팀 멤버십 확인 (owner/admin만 가능)
      const teamMember = await ctx.db.teamMember.findUnique({
        where: {
          teamId_userId: {
            teamId: input.teamId,
            userId,
          },
        },
      });

      if (!teamMember || !["owner", "admin"].includes(teamMember.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only team owners/admins can register Admin API keys",
        });
      }

      // 2. API 키 검증
      if (!input.apiKey.startsWith("sk-")) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid OpenAI Admin API key format",
        });
      }

      // 3. KMS 암호화
      const kms = getKMSEncryption();
      const { ciphertext, encryptedDataKey, iv } = await kms.encrypt(input.apiKey);

      // 4. 기존 Admin Key가 있으면 업데이트, 없으면 생성
      const last4 = input.apiKey.slice(-4);

      const adminKey = await ctx.db.organizationApiKey.upsert({
        where: { teamId: input.teamId },
        update: {
          encryptedKey: ciphertext,
          encryptedDataKey,
          iv,
          last4,
          isActive: true,
          updatedAt: new Date(),
        },
        create: {
          teamId: input.teamId,
          provider: "openai",
          encryptedKey: ciphertext,
          encryptedDataKey,
          iv,
          last4,
          isActive: true,
          keyType: "admin",
        },
      });

      return {
        success: true,
        keyId: adminKey.id,
        last4: adminKey.last4,
      };
    }),

  /**
   * Get Admin API Key status for a team
   */
  getAdminApiKeyStatus: protectedProcedure
    .input(z.object({ teamId: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // 팀 멤버십 확인
      const teamMember = await ctx.db.teamMember.findUnique({
        where: {
          teamId_userId: {
            teamId: input.teamId,
            userId,
          },
        },
      });

      if (!teamMember) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not a member of this team",
        });
      }

      const adminKey = await ctx.db.organizationApiKey.findUnique({
        where: { teamId: input.teamId },
        select: {
          id: true,
          last4: true,
          isActive: true,
          keyType: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return adminKey;
    }),
});
```

### Project Router (🆕 OpenAI Project ID Registration)

```typescript
// src/server/api/routers/project.ts
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';

export const projectRouter = createTRPCRouter({
  // ... 기존 프로시저 유지 ...

  /**
   * Register OpenAI Project ID for a project
   */
  registerOpenAIProjectId: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        openaiProjectId: z.string().regex(/^proj_[a-zA-Z0-9_-]+$/),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // 1. 프로젝트 멤버십 확인
      const project = await ctx.db.project.findUnique({
        where: { id: input.projectId },
        include: {
          members: { where: { userId } },
          team: {
            include: {
              organizationApiKey: true,
              members: { where: { userId } },
            },
          },
        },
      });

      if (!project || (!project.members.length && !project.team.members.length)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not a member of this project",
        });
      }

      // 2. 팀에 Admin API Key가 등록되어 있는지 확인
      if (!project.team.organizationApiKey?.isActive) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Team must have an active Admin API Key before registering Project IDs",
        });
      }

      // 3. OpenAI Project ID 중복 확인
      const existing = await ctx.db.project.findUnique({
        where: { openaiProjectId: input.openaiProjectId },
      });

      if (existing && existing.id !== input.projectId) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This OpenAI Project ID is already registered to another project",
        });
      }

      // 4. Project 업데이트
      const updated = await ctx.db.project.update({
        where: { id: input.projectId },
        data: {
          openaiProjectId: input.openaiProjectId,
        },
      });

      return {
        success: true,
        projectId: updated.id,
        openaiProjectId: updated.openaiProjectId,
      };
    }),

  /**
   * Validate OpenAI Project ID belongs to the team's organization
   */
  validateOpenAIProjectId: protectedProcedure
    .input(
      z.object({
        teamId: z.string(),
        openaiProjectId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // TODO: Costs API 테스트 호출로 검증
      // 실제 구현 시 Admin Key로 해당 Project ID 조회 가능 여부 확인
      return { valid: true };
    }),

  // ... 기존 프로시저 계속 ...

  // 모든 프로젝트 조회
  getAll: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.db.project.findMany({
      where: {
        team: {
          members: {
            some: { user_id: ctx.session.user.id },
          },
        },
      },
      include: {
        metrics: true,
        cost_data: {
          where: {
            date: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 최근 30일
            },
          },
        },
      },
    });
  }),

  // 프로젝트 생성
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      teamId: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      return await ctx.db.project.create({
        data: {
          name: input.name,
          description: input.description,
          team_id: input.teamId,
        },
      });
    }),

  // 성과 메트릭 업데이트 (Novel Pattern 1)
  updateMetrics: protectedProcedure
    .input(z.object({
      projectId: z.string(),
      successCount: z.number().int().min(0),
      feedbackScore: z.number().min(1).max(5).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      return await ctx.db.projectMetrics.upsert({
        where: { project_id: input.projectId },
        update: {
          success_count: { increment: input.successCount },
          feedback_score: input.feedbackScore,
        },
        create: {
          project_id: input.projectId,
          success_count: input.successCount,
          feedback_score: input.feedbackScore,
        },
      });
    }),
});
```

---

## Security Architecture

### 1. Authentication & Authorization

**NextAuth v5 (Auth.js)**
- **Strategy**: JWT (httpOnly cookie)
- **Session Duration**: 30일
- **Token Refresh**: 자동 (NextAuth)
- **Password**: bcrypt (10 rounds)

```typescript
// src/server/auth.ts
export const authOptions: NextAuthConfig = {
  providers: [
    CredentialsProvider({
      credentials: {
        email: { type: 'email' },
        password: { type: 'password' },
      },
      authorize: async (credentials) => {
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) return null;

        const isValid = await bcrypt.compare(
          credentials.password,
          user.password_hash
        );

        if (!isValid) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    session: ({ session, token }) => {
      session.user.id = token.id;
      return session;
    },
  },
};
```

### 2. Data Encryption (AWS KMS)

**Envelope Encryption Pattern**
- **Algorithm**: AES-256-GCM
- **Key Management**: AWS KMS Customer Managed Key (CMK)
- **Encrypted Data**: Admin API 자격증명, 클라우드 credentials

```typescript
// src/lib/services/encryption/kms-envelope.ts
import { KMSClient, GenerateDataKeyCommand, DecryptCommand } from '@aws-sdk/client-kms';
import crypto from 'crypto';

export class KMSEnvelopeEncryption {
  private kms: KMSClient;
  private cmkId: string;

  constructor() {
    this.kms = new KMSClient({ region: process.env.AWS_REGION });
    this.cmkId = process.env.AWS_KMS_CMK_ID!;
  }

  async encrypt(plaintext: string): Promise<{
    ciphertext: string;
    encryptedDataKey: string;
    iv: string;
  }> {
    // 1. Generate Data Key from KMS
    const { Plaintext: dataKey, CiphertextBlob: encryptedDataKey } =
      await this.kms.send(new GenerateDataKeyCommand({
        KeyId: this.cmkId,
        KeySpec: 'AES_256',
      }));

    // 2. Generate IV
    const iv = crypto.randomBytes(16);

    // 3. Encrypt plaintext with Data Key
    const cipher = crypto.createCipheriv('aes-256-gcm', dataKey!, iv);
    let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return {
      ciphertext: ciphertext + authTag, // Append auth tag
      encryptedDataKey: encryptedDataKey!.toString('base64'),
      iv: iv.toString('hex'),
    };
  }

  async decrypt(
    ciphertext: string,
    encryptedDataKey: string,
    iv: string
  ): Promise<string> {
    // 1. Decrypt Data Key with KMS
    const { Plaintext: dataKey } = await this.kms.send(new DecryptCommand({
      CiphertextBlob: Buffer.from(encryptedDataKey, 'base64'),
    }));

    // 2. Extract auth tag
    const authTag = Buffer.from(ciphertext.slice(-32), 'hex');
    const encryptedText = ciphertext.slice(0, -32);

    // 3. Decrypt ciphertext with Data Key
    const decipher = crypto.createDecipheriv('aes-256-gcm', dataKey!, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(authTag);
    let plaintext = decipher.update(encryptedText, 'hex', 'utf8');
    plaintext += decipher.final('utf8');

    return plaintext;
  }
}
```

### 3. API Security

**tRPC Middleware**
```typescript
// src/server/api/trpc.ts
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session || !ctx.session.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({
    ctx: {
      session: { ...ctx.session, user: ctx.session.user },
    },
  });
});
```

**Cron Job Security**
```typescript
// CRON_SECRET 검증
if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
  return new Response('Unauthorized', { status: 401 });
}
```

### 4. Transport Security

- **Protocol**: HTTPS (TLS 1.3) - Vercel 자동 제공
- **Headers**:
  - `Strict-Transport-Security: max-age=31536000`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`

---

## Performance Considerations

### 1. Database Optimization

**Indexes** (Prisma)
```prisma
@@index([team_id, date])  // CostData 조회 최적화
@@index([project_id, date])
@@index([apiVersion]) // Costs API vs Usage API 구분
@@index([openaiProjectId]) // Project ID 조회
@@index([user_id, created_at])  // BehaviorLog
```

**Connection Pooling** (Neon)
- Neon은 자동 connection pooling 제공
- Prisma는 single connection pool 사용

### 2. Caching Strategy

**React Query (tRPC)**
```typescript
api.project.getAll.useQuery(undefined, {
  staleTime: 5 * 60 * 1000, // 5분
  cacheTime: 10 * 60 * 1000, // 10분
});
```

**Next.js SSR Cache**
```typescript
// app/(dashboard)/page.tsx
export const revalidate = 300; // 5분마다 revalidate
```

### 3. Bundle Optimization

- **Code Splitting**: Next.js automatic
- **Tree Shaking**: Recharts는 모듈별 import
  ```typescript
  import { LineChart, Line } from 'recharts';
  ```
- **Image Optimization**: Next.js `<Image>` 컴포넌트

### 4. API Performance

**Batch Requests** (tRPC)
```typescript
const [projects, teams, costs] = await Promise.all([
  api.project.getAll.useQuery(),
  api.team.getAll.useQuery(),
  api.cost.getRecent.useQuery(),
]);
```

---

## Deployment Architecture

### Vercel Configuration

**vercel.json**
```json
{
  "crons": [
    {
      "path": "/api/cron/daily-batch",
      "schedule": "0 9 * * *"
    },
    {
      "path": "/api/cron/poll-threshold",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/cron/weekly-report",
      "schedule": "0 9 * * 1"
    }
  ],
  "env": {
    "DATABASE_URL": "@database-url",
    "NEXTAUTH_SECRET": "@nextauth-secret",
    "AWS_KMS_CMK_ID": "@aws-kms-cmk-id"
  }
}
```

### Environment Variables

**Vercel Dashboard 설정:**
```
DATABASE_URL=postgresql://...          # Neon connection string
NEXTAUTH_SECRET=...                    # openssl rand -base64 32
NEXTAUTH_URL=https://finops-for-ai.vercel.app

AWS_KMS_CMK_ID=arn:aws:kms:...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=ap-northeast-2

AZURE_SUBSCRIPTION_ID=...             # Optional (Epic 2)
AZURE_CLIENT_ID=...
AZURE_CLIENT_SECRET=...
AZURE_TENANT_ID=...

RESEND_API_KEY=...
SLACK_WEBHOOK_URL=...
CRON_SECRET=...                        # openssl rand -base64 32

NEXT_PUBLIC_SENTRY_DSN=...
SENTRY_AUTH_TOKEN=...
```

### Deployment Flow

```
git push origin main
  → GitHub webhook → Vercel
  → Build (next build)
  → Prisma generate
  → Deploy to Edge Network
  → Health check
  → Live
```

---

## Development Environment

### Prerequisites

- **Node.js**: 18.x or 20.x
- **Package Manager**: bun
- **Database**: Neon PostgreSQL (또는 로컬 PostgreSQL)
- **AWS Account**: KMS CMK 생성 필요
- **Vercel Account**: Pro plan (Cron Jobs)

### Setup Commands

```bash
# 1. 프로젝트 초기화
bun create t3-app@latest finops-for-ai -- --nextAuth --prisma --trpc --tailwind --typescript

cd finops-for-ai

# 2. 환경 변수 설정
cp .env.example .env
# .env 파일 편집 (DATABASE_URL, AWS credentials 등)

# 3. 의존성 설치
bun install

# 추가 패키지 설치
bun add @aws-sdk/client-kms @aws-sdk/client-cost-explorer
bun add resend react-email
bun add recharts
bun add @tanstack/react-table
bun add date-fns
bun add pino pino-pretty
bun add -D playwright vitest

# 4. Prisma 설정
bunx prisma generate
bunx prisma migrate dev --name init

# 5. 개발 서버 실행
bun run dev
# http://localhost:3000

# 6. Prisma Studio (DB GUI)
bunx prisma studio
# http://localhost:5555
```

### Development Workflow

```bash
# 데이터베이스 스키마 변경
bunx prisma migrate dev --name add_costs_api_support

# 타입 재생성
bunx prisma generate

# 테스트 실행
bun run test              # Vitest unit tests
bun run test:e2e          # Playwright E2E tests

# 린팅 및 포맷팅
bun run lint
bun run format

# 프로덕션 빌드 테스트
bun run build
bun run start
```

---

## Architecture Decision Records (ADRs)

### ADR-001: T3 Stack 선택

**날짜**: 2025-10-31
**상태**: Accepted

**컨텍스트**:
Level 2 프로젝트로 15개 스토리를 2-4시간 단위로 구현 가능해야 함. 타입 안전성과 개발 속도가 중요.

**결정**:
T3 Stack (Next.js + tRPC + Prisma + NextAuth + Tailwind) 채택

**근거**:
- tRPC의 엔드투엔드 타입 안전성으로 프론트-백엔드 일관성 보장
- Prisma의 타입 안전 ORM으로 DB 스키마 변경 자동 추적
- NextAuth의 인증 보일러플레이트 제거
- Tailwind로 빠른 UI 개발
- Vercel 최적화로 배포 자동화

**대안**:
- Next.js + GraphQL + TypeORM: 보일러플레이트 많음
- NestJS + React: 프론트-백엔드 분리로 타입 동기화 어려움

---

### ADR-002: AWS KMS Envelope Encryption

**날짜**: 2025-10-31
**상태**: Accepted

**컨텍스트**:
NFR004 요구사항 (AES-256 암호화). Admin API 자격증명 보안이 중요. 초기 제안은 Node.js crypto 모듈이었으나 사용자가 KMS 기반 요청.

**결정**:
AWS KMS Envelope Encryption 채택

**근거**:
- FIPS 140-3 Level 3 HSM 보호
- 키 회전 자동화
- CloudTrail 감사 로그
- IAM 기반 접근 제어
- 평문 키는 메모리에만 존재

**대안**:
- Node.js crypto 모듈: 키 관리 수동, 감사 로그 없음
- HashiCorp Vault: 추가 인프라 필요, 오버킬

**트레이드오프**:
- AWS 의존성 증가
- API 호출 비용 (복호화마다 KMS 호출)
- 하지만 보안 이점이 비용보다 큼

---

### ADR-003: Vercel Cron Jobs over BullMQ

**날짜**: 2025-10-31
**상태**: Accepted

**컨텍스트**:
일일 배치, 5분 폴링, 주간 리포트 스케줄링 필요. BullMQ는 Redis 필요.

**결정**:
Vercel Cron Jobs 채택 (Vercel Pro plan 필요)

**근거**:
- 추가 인프라 불필요 (Redis 불필요)
- Vercel 네이티브 기능
- 설정 간단 (vercel.json)
- Epic 1, 2의 모든 작업은 짧은 실행 시간 (< 10분)

**대안**:
- BullMQ + Redis: Redis 인프라 비용, 복잡도 증가
- Inngest: 서드파티 의존성, 추가 비용

**제약사항**:
- Vercel Hobby 플랜은 2개 cron, 1일 1회만 → Pro 필요
- Serverless 함수 최대 실행 시간 제약 (Pro: 5분)

---

### ADR-004: Resend over SendGrid

**날짜**: 2025-10-31
**상태**: Accepted

**컨텍스트**:
실시간 알림, 주간 리포트 이메일 발송 필요. SendGrid는 2025년 5월부터 무료 플랜 폐지.

**결정**:
Resend + React Email 채택

**근거**:
- 무료 티어: 3,000통/월 (Phase 1 충분)
- React Email로 한국어 템플릿 쉽게 제작
- Vercel/Next.js 생태계 네이티브
- Auth.js 공식 지원

**대안**:
- SendGrid: 무료 플랜 없음 (60일 체험만)
- AWS SES: 설정 복잡, Epic 2 AWS 통합 전까지 불필요

---

### ADR-005: Recharts over Chart.js

**날짜**: 2025-10-31
**상태**: Accepted

**컨텍스트**:
비용 추이 그래프, 프로젝트 비용 차트 필요 (Story 1.8).

**결정**:
Recharts 채택

**근거**:
- React 컴포넌트 기반 (선언적)
- Next.js/T3 Stack과 완벽 통합
- SVG 기반 (반응형, 접근성)
- Tailwind와 스타일링 통합 쉬움

**대안**:
- Chart.js: Canvas 기반, React 통합 번거로움
- D3.js: 강력하지만 학습 곡선 높음, 오버킬

---

### ADR-006: Novel Pattern - 비용-가치 연결

**날짜**: 2025-10-31
**상태**: Accepted

**컨텍스트**:
기존 FinOps 도구는 비용만 추적. PRD는 "비용 대비 가치" 계산 요구 (FR002, FR003).

**결정**:
Context Tracker + Value Metrics + Efficiency Calculator 패턴

**근거**:
- OpenAI API 호출 시점에 컨텍스트 기록 (프로젝트, 작업 유형)
- 사용자가 성과 메트릭 입력
- 효율성 = 성과 / 비용 계산
- 주간 리포트에 Top 3 / Bottom 3 랭킹

**구현**:
- SDK wrapper로 투명하게 메타데이터 추가
- `cost_data` 테이블에 context 컬럼 추가
- `project_metrics` 테이블로 성과 추적

---

### ADR-007: Novel Pattern - 팀 기반 Admin API 키 + 프로젝트 ID 필터링

**날짜**: 2025-01-04 (2025-11-02 초안)
**상태**: Accepted

**컨텍스트**:
초기 설계는 프로젝트별 API 키 격리였으나, OpenAI Costs API는 organization-level Admin Key를 요구함. Organization 전체 비용을 조회하되 프로젝트별로 필터링하기 위해 Admin Key + Project ID 패턴으로 전환 필요.

**결정**:
팀 레벨 Admin API 키 + 프로젝트 ID 필터링 기반 자동 귀속

**근거**:
- Organization-level cost visibility (팀 전체 비용 한 번에 조회)
- Project ID filtering으로 프로젝트별 비용 구분 유지
- Admin Key 권한 관리로 보안 강화
- Costs API의 time bucket aggregation으로 데이터 일관성 향상

**구현**:
- OrganizationApiKey 모델 (team-level, KMS encrypted)
- Project.openaiProjectId 필드
- cost-collector-v2.ts (Costs API client with pagination)
- CostData.apiVersion으로 Usage API vs Costs API 구분

**마이그레이션 컨텍스트**:
Initial design used project-level API keys. Migrating to team-level Admin Keys + Project ID filtering to support OpenAI Costs API, which requires organization-level authentication.

**변경 사항:**
- API Key 소유: Project → Team (OrganizationApiKey)
- 프로젝트 식별: API Key → OpenAI Project ID
- 데이터 출처: Usage API → Costs API
- 집계 방식: 세밀한 토큰 데이터 → 시간 버킷 집계 데이터

**트레이드오프**:
- 세밀한 토큰 데이터 손실 (line_item 집계로 대체)
- 실시간성 저하 (8-24시간 지연)
- 기존 Usage API 데이터 마이그레이션 필요

---

### ADR-008: 프로젝트 멤버 관리 및 API 키 생명주기 UI

**날짜**: 2025-11-03
**상태**: Accepted

**컨텍스트**:
ADR-007에서 프로젝트 기반 API 키 격리 패턴을 정의했으나, 실제 프로젝트 멤버 관리 및 API 키 생명주기 관리를 위한 사용자 인터페이스가 필요함. 기존 구현에는 긴급 비활성화만 존재하고, 멤버 추가/제거 및 API 키 생성/삭제 UI가 없었음.

**결정**:
프로젝트 상세 페이지에 통합된 관리 UI 구현, 모달 기반 인터랙션 채택

**근거**:

**1. 모달 기반 UX 선택**
- 페이지 내 섹션 추가 대신 다이얼로그 사용
- 중요한 작업(멤버 추가, API 키 추가)에 집중된 UX 제공
- Type-to-confirm 패턴으로 파괴적 작업(삭제, 비활성화) 보호
- 일관된 사용자 경험 (기존 ConfirmDisableKeyDialog와 동일한 패턴)

**2. 섹션 순서 재구성**
- **이전**: Stats → Charts → Emergency API Key Management → Metrics
- **변경**: Stats → Members → API Keys → Charts → Metrics
- **근거**: 관리 기능을 분석 기능보다 우선 배치, 프로젝트 설정을 먼저 확인

**3. API 키 생명주기 완전 지원**
- **추가**: generateApiKey (기존)
- **비활성화**: disableApiKey (기존)
- **재활성화**: enableApiKey (신규) - 실수로 비활성화한 키 복구
- **삭제**: deleteApiKey (신규) - 영구 삭제, audit log 보존
- **근거**: 실제 운영에서 키 복구 및 정리 필요성 높음

**4. 팀 멤버 드롭다운 패턴**
- 이메일 직접 입력 대신 팀 멤버 목록에서 선택
- 이미 추가된 멤버는 비활성화 처리
- **근거**:
  - 오타 방지
  - 팀 외부 사용자 추가 불가 (보안)
  - UX 단순화 (자동완성 불필요)

**5. 권한 모델 명확화**
- **팀 관리자 (Team admin)**:
  - 프로젝트 멤버 추가/제거 (ensureTeamAdmin)
  - 모든 프로젝트 API 키 조회 및 긴급 비활성화
- **프로젝트 멤버**:
  - API 키 추가, 비활성화, 재활성화, 삭제 (ensureProjectAccess)
  - 프로젝트 비용 데이터 조회
  - 멤버 관리 불가 (Team admin만)

---

### ADR-009: OpenAI Costs API Migration

**날짜**: 2025-01-04
**상태**: Accepted

**컨텍스트**:
OpenAI Usage API (`/v1/usage`)는 project-level API keys만 지원하며, organization-level cost visibility를 제공하지 않음. Costs API (`/v1/organization/costs`)는 organization-level Admin Key로 모든 프로젝트 비용을 조회하고 project_ids로 필터링 가능.

**결정**:
Usage API → Costs API 전환, Team-level Admin Key + Project ID 패턴 채택

**근거**:
- Organization-level cost visibility (team 전체 비용 한 번에 조회)
- Project ID filtering으로 프로젝트별 비용 구분 유지
- Time bucket aggregation으로 데이터 일관성 향상
- Admin Key 권한 관리로 보안 강화

**구현**:
- OrganizationApiKey 모델 (team-level)
- Project.openaiProjectId 필드
- cost-collector-v2.ts (Costs API client)
- CostData.apiVersion 버전 관리

**트레이드오프**:
- 세밀한 토큰 데이터 → 집계 데이터 (line_item 레벨)
- 실시간성 저하 (8-24시간 지연)
- 기존 Usage API 데이터 마이그레이션 필요

**롤백 계획**:
- Feature flag: `ENABLE_COSTS_API` environment variable
  - `"false"` (default): Uses Usage API with project-level keys
  - `"true"`: Uses Costs API with team-level Admin keys
- 두 API 병행 운영 가능 (apiVersion으로 구분)
- 문제 발생 시 즉시 롤백: `ENABLE_COSTS_API="false"` 설정
- Breaking Changes 문서 참조: [BREAKING_CHANGES.md](./migration/BREAKING_CHANGES.md)

**환경 변수 설정**:
```bash
# .env 파일
ENABLE_COSTS_API="false"  # Legacy Usage API
ENABLE_COSTS_API="true"   # New Costs API
```

**사용 예시**:
```typescript
// src/app/api/cron/daily-batch/route.ts
const useCostsAPI = env.ENABLE_COSTS_API === "true";

if (useCostsAPI) {
  // Use Costs API (organization-level)
  await collectDailyCostsV2(team.id, targetDate);
} else {
  // Use Usage API (project-level)
  await collectDailyCosts(team.id, targetDate);
}
```

---

_Generated by BMAD Decision Architecture Workflow v1.3.2_
_Date: 2025-01-04_
_Updated: 2025-01-04 (Costs API Migration Complete Rewrite)_
_For: Issac_
_Project: finops-for-ai (Level 2)_
