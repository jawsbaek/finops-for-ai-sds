# Decision Architecture - finops-for-ai

**Author:** Issac
**Date:** 2025-10-31
**Project Level:** 2
**Target Scale:** MVP - AI Cost Management Platform

---

## Executive Summary

finops-for-ai 프로젝트는 **T3 Stack (Next.js 16 + tRPC + Prisma + NextAuth)** 기반의 AI 비용 관리 플랫폼입니다. Vercel에 배포되며, Neon PostgreSQL을 사용하고, AWS KMS 기반 보안으로 민감한 API 자격증명을 보호합니다.

핵심 차별화 요소는 두 가지 Novel Patterns입니다:
1. **비용-가치 연결**: 단순 비용 추적이 아닌, 프로젝트 성과와 함께 분석하여 "비용 대비 가치" 계산
2. **프로젝트 기반 API 키 격리**: 태그 대신 프로젝트별 API 키 격리로 비용 자동 귀속 및 팀 레벨 집계

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
| **API Pattern** | tRPC | 11.7.1 | All | T3 Stack 제공, 엔드투엔드 타입 안전 |
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
| 1.2 | `src/lib/services/openai/cost-collector.ts`, `src/app/api/cron/daily-batch/` | Vercel Cron, OpenAI SDK, Prisma |
| 1.3 | `src/lib/services/openai/context-tracker.ts`, `src/server/api/routers/project.ts` | Novel Pattern 1 (비용-가치) |
| 1.4 | `src/app/api/cron/poll-threshold/`, `src/lib/services/email/`, `src/lib/services/slack/` | Vercel Cron, Resend, Slack |
| 1.5 | `src/server/api/routers/cost.ts`, Prisma middleware | tRPC, Prisma |
| 1.6 | `src/app/api/cron/weekly-report/`, `src/lib/services/reporting/`, `src/lib/services/email/templates/` | Vercel Cron, Resend, React Email |
| 1.7 | `src/lib/services/encryption/api-key-manager.ts`, `src/server/api/routers/project.ts` | Novel Pattern 2 (프로젝트 기반 귀속) |
| 1.8 | `src/app/(dashboard)/`, `src/components/charts/`, `src/components/dashboard/` | Next.js, Recharts, Tailwind |
| 1.9 | `__tests__/e2e/`, `__tests__/unit/`, Vercel Analytics, Sentry | Playwright, Vitest, Monitoring |

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
- **OpenAI**: REST API (`https://api.openai.com/v1/usage`)
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

### Pattern 2: 프로젝트 기반 API 키 격리 (Project-Based API Key Isolation)

**목적**: 태그 대신 프로젝트별 API 키 격리로 비용 자동 귀속 및 팀 레벨 집계

**핵심 설계:**
- **프로젝트가 API 키 소유**: 각 프로젝트가 독립적으로 API 키 관리
- **프로젝트 멤버십**: 명시적 접근 제어 (ProjectMember 모델)
- **팀 레벨 긴급 제어**: 팀 관리자는 모든 프로젝트 API 키 비활성화 가능
- **비용 집계**: 프로젝트 → 팀 자동 집계

**컴포넌트:**

1. **API Key Manager** (`src/lib/services/encryption/api-key-manager.ts`)
   ```typescript
   import { KMSClient, GenerateDataKeyCommand, DecryptCommand } from '@aws-sdk/client-kms';
   import crypto from 'crypto';

   class ApiKeyManager {
     private kms: KMSClient;

     async encryptApiKey(plainKey: string, projectId: string): Promise<{
       encryptedKey: string;
       encryptedDataKey: string;
     }> {
       // 1. KMS에서 Data Key 생성
       const { Plaintext: dataKey, CiphertextBlob: encryptedDataKey } =
         await this.kms.send(new GenerateDataKeyCommand({
           KeyId: process.env.AWS_KMS_CMK_ID,
           KeySpec: 'AES_256',
         }));

       // 2. Data Key로 API 키 암호화 (AES-256-GCM)
       const cipher = crypto.createCipheriv('aes-256-gcm', dataKey, iv);
       const encryptedKey = cipher.update(plainKey, 'utf8', 'hex') + cipher.final('hex');

       // 3. DB 저장 (프로젝트에 귀속)
       await prisma.apiKey.create({
         data: {
           projectId,
           encryptedKey,
           encryptedDataKey: encryptedDataKey.toString('base64'),
           iv: iv.toString('hex'),
         },
       });

       return { encryptedKey, encryptedDataKey: encryptedDataKey.toString('base64') };
     }

     async decryptApiKey(apiKeyId: string): Promise<string> {
       const record = await prisma.apiKey.findUnique({ where: { id: apiKeyId } });

       // 1. KMS에 암호화된 Data Key 전송 → 평문 Data Key 획득
       const { Plaintext: dataKey } = await this.kms.send(new DecryptCommand({
         CiphertextBlob: Buffer.from(record.encryptedDataKey, 'base64'),
       }));

       // 2. Data Key로 API 키 복호화
       const decipher = crypto.createDecipheriv('aes-256-gcm', dataKey, Buffer.from(record.iv, 'hex'));
       return decipher.update(record.encryptedKey, 'hex', 'utf8') + decipher.final('utf8');
     }
   }
   ```

2. **Project Access Control** (`src/server/api/routers/project.ts`)
   ```typescript
   // 프로젝트 멤버 또는 팀 관리자 확인
   async function ensureProjectAccess(userId: string, projectId: string) {
     const project = await prisma.project.findUnique({
       where: { id: projectId },
       include: {
         members: { where: { userId } },
         team: { include: { members: { where: { userId } } } }
       }
     });

     const isProjectMember = project.members.length > 0;
     const isTeamAdmin = project.team.members.some(m =>
       m.userId === userId && (m.role === 'admin' || m.role === 'owner')
     );

     return { isProjectMember, isTeamAdmin, project };
   }

   // API 키 생성 (프로젝트 멤버만)
   generateApiKey: protectedProcedure
     .input(z.object({ projectId: z.string(), provider: z.string(), apiKey: z.string() }))
     .mutation(async ({ input, ctx }) => {
       const { isProjectMember } = await ensureProjectAccess(ctx.session.user.id, input.projectId);
       if (!isProjectMember) throw new TRPCError({ code: 'FORBIDDEN' });

       return await apiKeyManager.encryptApiKey(input.apiKey, input.projectId);
     }),

   // API 키 비활성화 (프로젝트 멤버 또는 팀 관리자)
   disableApiKey: protectedProcedure
     .input(z.object({ apiKeyId: z.string() }))
     .mutation(async ({ input, ctx }) => {
       const apiKey = await prisma.apiKey.findUnique({
         where: { id: input.apiKeyId },
         include: { project: true }
       });

       const { isProjectMember, isTeamAdmin } = await ensureProjectAccess(
         ctx.session.user.id, apiKey.projectId
       );

       if (!isProjectMember && !isTeamAdmin) {
         throw new TRPCError({ code: 'FORBIDDEN' });
       }

       return await prisma.apiKey.update({
         where: { id: input.apiKeyId },
         data: { isActive: false }
       });
     }),
   ```

3. **Cost Attribution Engine** (`src/lib/services/openai/cost-collector.ts`)
   ```typescript
   async function collectDailyCosts(): Promise<void> {
     // 1. 모든 활성 API 키 가져오기 (프로젝트별)
     const apiKeys = await prisma.apiKey.findMany({
       where: { isActive: true },
       include: { project: true }
     });

     for (const apiKeyRecord of apiKeys) {
       // 2. API 키 복호화
       const plainApiKey = await apiKeyManager.decryptApiKey(apiKeyRecord.id);

       // 3. OpenAI API에서 사용 내역 수집
       const usage = await fetchOpenAIUsage(plainApiKey, yesterday);

       // 4. project_id로 자동 귀속 (태그 불필요)
       await prisma.costData.createMany({
         data: usage.map(u => ({
           projectId: apiKeyRecord.projectId,  // 프로젝트에 귀속
           apiKeyId: apiKeyRecord.id,
           provider: 'openai',
           service: 'gpt',
           model: u.model,
           tokens: u.tokens,
           cost: u.cost,
           date: yesterday,
         })),
       });
     }
   }
   ```

4. **Team Cost Aggregation** (`src/server/api/routers/cost.ts`)
   ```typescript
   // 팀별 비용은 프로젝트 비용을 집계
   getCostByTeam: protectedProcedure
     .input(z.object({ teamId: z.string() }))
     .query(async ({ input }) => {
       // 팀의 모든 프로젝트 가져오기
       const projects = await prisma.project.findMany({
         where: { teamId: input.teamId },
         select: { id: true }
       });

       const projectIds = projects.map(p => p.id);

       // 프로젝트별 비용 집계
       const costs = await prisma.costData.groupBy({
         by: ['date'],
         where: { projectId: { in: projectIds } },
         _sum: { cost: true }
       });

       return costs;
     }),
   ```

5. **Isolation Advisor** (`src/app/(dashboard)/architecture/page.tsx`)
   - OpenAI: "프로젝트별 API 키 분리" 권고 (이미 구현됨)
   - AWS: "프로젝트별 AWS 계정 또는 IAM Role 분리" 권고
   - Azure: "프로젝트별 리소스 그룹 격리" 권고
   - 교육 콘텐츠: "왜 태그보다 격리가 좋은가?"

**데이터 흐름:**
```
프로젝트 생성
  → 생성자가 첫 번째 프로젝트 멤버로 자동 추가
  → 프로젝트 멤버가 OpenAI API 키 등록
  → AWS KMS로 암호화 후 저장 (project_id 연결)
  → 프로젝트가 해당 키 사용
  → 일일 배치 Cron (매일 오전 9시)
  → Cost Collector가 API 키별 비용 수집
  → api_key_id → project_id 매핑으로 자동 귀속
  → 팀 레벨 보고 시 프로젝트 비용 자동 집계
  → 태그 없이 프로젝트 및 팀별 비용 집계 완료
```

**권한 모델:**
- **프로젝트 멤버**: API 키 등록, 조회, 비활성화 가능
- **팀 관리자**: 모든 프로젝트 API 키 조회 및 긴급 비활성화 가능
- **프로젝트 멤버십**: ProjectMember 모델로 명시적 관리

**영향받는 Epic:** Epic 1 (Story 1.7), Epic 2 (Story 2.1, 2.3)

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
  - ✅ `users`, `projects`, `api_keys`, `cost_data`
  - ❌ `Users`, `Project`, `apiKeys`

- **컬럼**: `snake_case`
  - ✅ `user_id`, `created_at`, `api_key_encrypted`
  - ❌ `userId`, `createdAt`, `apiKeyEncrypted`

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
  ├── cost-collector.ts
  └── __tests__/
      └── cost-collector.test.ts
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
  () => fetchOpenAIUsage(apiKey, date),
  {
    retries: 3,
    minTimeout: 1000,
    maxTimeout: 5000,
    onRetry: (err, attempt) => {
      logger.warn({ err, attempt }, 'Retrying OpenAI API call');
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

  // 3. 실행
  await collectDailyCosts();

  // 4. 로그 기록
  await prisma.cronLog.create({
    data: { jobName: 'daily-batch', date: today },
  });

  return Response.json({ message: 'Success' });
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
bunx prisma migrate dev --name add_cloud_credentials_table

# 명명: snake_case 동사
# ✅ add_cloud_credentials_table
# ✅ update_cost_data_indexes
# ❌ AddCloudCredentials
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
  feat: 비용 임계값 알림 추가
  fix: KMS 암호화 버그 수정
  chore: Prisma 스키마 업데이트
  docs: 아키텍처 문서 업데이트
  test: E2E 테스트 추가
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

// 팀 (Story 1.7)
model Team {
  id         String   @id @default(cuid())
  name       String
  created_at DateTime @default(now())

  // Relations
  members    TeamMember[]
  projects   Project[]

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

// API 키 (Story 1.7, 2.1 - KMS 암호화)
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

// 프로젝트 (Story 1.3)
model Project {
  id          String   @id @default(cuid())
  name        String
  description String?
  team_id     String
  created_at  DateTime @default(now())

  // Relations
  team      Team             @relation(fields: [team_id], references: [id])
  members   ProjectMember[]
  api_keys  ApiKey[]
  cost_data CostData[]
  metrics   ProjectMetrics?

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

// 비용 데이터 (Story 1.2, 2.2)
model CostData {
  id          String   @id @default(cuid())
  project_id  String
  api_key_id  String
  provider    String   // "openai" | "aws" | "azure"
  service     String   // "gpt-4" | "SageMaker" | "Azure OpenAI"
  model       String?  // OpenAI 모델명
  tokens      Int?     // OpenAI only
  cost        Decimal  @db.Decimal(10,2)
  date        DateTime @db.Date
  snapshot_id String?  // OpenAI snapshot ID

  // Novel Pattern 1: Context
  task_type   String?  // "chat" | "embedding" | "fine-tuning"
  user_intent String?  // 사용자가 입력한 의도

  created_at  DateTime @default(now())

  project Project @relation(fields: [project_id], references: [id], onDelete: Restrict)
  api_key ApiKey  @relation(fields: [api_key_id], references: [id])

  @@index([project_id, date])
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

### Example Router: Project

```typescript
// src/server/api/routers/project.ts
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';

export const projectRouter = createTRPCRouter({
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
- **Encrypted Data**: API 자격증명, 클라우드 credentials

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
bunx prisma migrate dev --name add_new_table

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
NFR004 요구사항 (AES-256 암호화). API 자격증명 보안이 중요. 초기 제안은 Node.js crypto 모듈이었으나 사용자가 KMS 기반 요청.

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

### ADR-007: Novel Pattern - 프로젝트 기반 API 키 격리

**날짜**: 2025-11-02 (2025-10-31 초안, 2025-11-02 개정)
**상태**: Accepted

**컨텍스트**:
태그 기반 비용 귀속은 사용자 규율 의존, 실패 확률 높음. PRD는 자동 귀속 요구 (FR007, FR010).
초기에는 팀별 API 키를 고려했으나, 실제 사용 패턴에서는 팀 내 프로젝트별로 다른 API 키를 사용하는 것이 더 자연스러움.

**결정**:
프로젝트별 API 키 격리 기반 자동 귀속 + 팀 레벨 집계

**근거**:
- 프로젝트별 고유 OpenAI API 키 발급 (더 세밀한 격리)
- `api_keys.project_id` 외래 키로 자동 연결
- 일일 배치에서 API 키로 프로젝트 식별
- 팀 비용은 프로젝트 비용 자동 집계
- 태그 불필요
- 프로젝트 멤버십 기반 명시적 접근 제어

**구현**:
- AWS KMS로 API 키 암호화 저장
- Cost Collector가 `api_key_id` → `project_id` 매핑
- ProjectMember 모델로 프로젝트 접근 제어
- 팀 관리자는 모든 프로젝트 API 키 긴급 비활성화 가능
- Isolation Advisor가 클라우드 계정/리소스 분리 권고

**확장성**:
- Epic 2에서 AWS/Azure도 동일 패턴 적용 (프로젝트별 계정/리소스 그룹 분리)
- 프로젝트 멤버 역할 확장 가능 (현재는 평등한 멤버십)

**마이그레이션**:
- Breaking change: 모든 기존 팀 API 키 삭제
- 팀 멤버를 모든 프로젝트에 자동 추가
- 사용자가 프로젝트별로 API 키 재등록 필요

---

_Generated by BMAD Decision Architecture Workflow v1.3.2_
_Date: 2025-10-31_
_For: Issac_
_Project: finops-for-ai (Level 2)_
