# OpenAI Costs API 마이그레이션 계획

**Date:** 2025-01-04
**Status:** Draft
**Owner:** Development Team
**Epic:** Epic 1 - OpenAI 비용 관리 시스템

---

## Executive Summary

현재 시스템을 OpenAI Usage API (`/v1/usage`)에서 **OpenAI Costs API** (`/v1/organization/costs`)로 전환합니다.

**핵심 변경 사항:**
- Team 레벨에서 **Admin API Key** 관리
- Project 레벨에서 **OpenAI Project ID** 등록
- Costs API의 시간 버킷 기반 집계 데이터 구조 채택
- 모델/토큰 세부 정보 → line_item 기반 집계로 전환

**예상 소요 시간:** 3-5일 (개발 + 테스트 + 마이그레이션)

---

## 1. 현황 분석

### 1.1 현재 데이터 플로우

```
[OpenAI Usage API]
    ↓ (프로젝트별 API Key)
[cost-collector.ts]
    ↓ (모델별, 토큰별 상세 데이터)
[CostData 테이블]
    ↓ (projectId로 저장)
[tRPC costRouter]
    ↓ (Team 레벨 집계)
[Dashboard UI]
```

**문제점:**
- ❌ Usage API는 프로젝트 수준 API 키 사용 (조직 전체 비용 불가)
- ❌ API 엔드포인트가 Costs API와 완전히 다름
- ❌ 데이터 구조 불일치 (모델별 세부 vs. 집계 데이터)

### 1.2 목표 데이터 플로우

```
[OpenAI Costs API]
    ↓ (Team의 Admin API Key)
    ↓ (project_ids 파라미터로 필터링)
[cost-collector-v2.ts]
    ↓ (시간 버킷별, line_item별 집계 데이터)
[CostData 테이블 (확장)]
    ↓ (projectId + bucketTime + lineItem)
[tRPC costRouter (업데이트)]
    ↓ (Team/Project 레벨 집계)
[Dashboard UI (기존 유지)]
```

---

## 2. 데이터베이스 스키마 변경

### 2.1 Team 모델 확장 - Admin API Key 추가

**새로운 테이블: `OrganizationApiKey`**

```prisma
// Team 레벨의 OpenAI Organization Admin API Key 관리
model OrganizationApiKey {
  id               String   @id @default(cuid())
  teamId           String   @unique @map("team_id") // 1 Team : 1 Admin Key
  provider         String   // 'openai' (향후 확장 대비)

  // KMS Envelope Encryption (기존 ApiKey 패턴 재사용)
  encryptedKey     String   @map("encrypted_key") @db.Text
  encryptedDataKey String   @map("encrypted_data_key") @db.Text
  iv               String   // Initialization vector

  // 보안 및 메타데이터
  last4            String   @db.VarChar(4) // 마지막 4자리 (UI 표시용)
  isActive         Boolean  @default(true) @map("is_active")
  keyType          String   @default("admin") @map("key_type") // 'admin' | 'service_account'

  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")

  team Team @relation(fields: [teamId], references: [id], onDelete: Cascade)

  @@index([teamId])
  @@index([provider, isActive])
  @@map("organization_api_keys")
}
```

**Team 모델 업데이트:**

```prisma
model Team {
  id        String   @id @default(cuid())
  name      String
  ownerId   String?  @map("owner_id")
  budget    Decimal? @db.Decimal(10, 2)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  members           TeamMember[]
  projects          Project[]
  organizationApiKey OrganizationApiKey? // 🆕 1:1 관계

  @@index([ownerId])
  @@map("teams")
}
```

### 2.2 Project 모델 확장 - OpenAI Project ID 추가

```prisma
model Project {
  id          String   @id @default(cuid())
  teamId      String   @map("team_id")
  name        String
  description String?

  // 🆕 OpenAI Project ID (Costs API 필터링용)
  openaiProjectId String? @unique @map("openai_project_id") // e.g., "proj_abc123"

  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  team       Team            @relation(fields: [teamId], references: [id], onDelete: Cascade)
  members    ProjectMember[]
  apiKeys    ApiKey[]        // ⚠️ Deprecated: 기존 Usage API용 (마이그레이션 후 제거 검토)
  costData   CostData[]
  metrics    ProjectMetrics?
  costAlerts CostAlert[]

  @@index([teamId])
  @@index([openaiProjectId]) // 🆕 빠른 조회용
  @@map("projects")
}
```

### 2.3 CostData 모델 확장 - Costs API 지원

```prisma
model CostData {
  id         String   @id @default(cuid())
  projectId  String   @map("project_id")

  // ⚠️ Deprecated: Usage API 전용 필드 (마이그레이션 후 nullable 처리)
  apiKeyId   String?  @map("api_key_id")
  snapshotId String?  @map("snapshot_id")
  tokens     Int?
  model      String?

  // 공통 필드
  provider   String   // 'openai', 'aws', 'azure'
  service    String   // Usage API: 'gpt-4', Costs API: line_item
  cost       Decimal  @db.Decimal(10, 2)
  date       DateTime @db.Date // Usage API: 단일 날짜, Costs API: bucketStartTime에서 변환

  // 🆕 Costs API 전용 필드
  bucketStartTime DateTime? @map("bucket_start_time") // Unix timestamp → DateTime
  bucketEndTime   DateTime? @map("bucket_end_time")
  lineItem        String?   @map("line_item") // e.g., "Image models", "GPT-4"
  currency        String?   @default("usd")

  // API 버전 트래킹 (데이터 출처 구분)
  apiVersion String @default("usage_v1") @map("api_version") // 'usage_v1' | 'costs_v1'

  // Novel Pattern 1: Context (기존 유지)
  taskType   String? @map("task_type")
  userIntent String? @map("user_intent")

  createdAt DateTime @default(now()) @map("created_at")

  project Project @relation(fields: [projectId], references: [id])
  apiKey  ApiKey? @relation(fields: [apiKeyId], references: [id])

  // 중복 제거 전략 변경
  @@unique([projectId, bucketStartTime, bucketEndTime, lineItem, apiVersion], name: "unique_cost_bucket")
  @@unique([apiKeyId, date, snapshotId], name: "unique_usage_snapshot") // 기존 Usage API용 (유지)
  @@index([projectId, date])
  @@index([apiVersion]) // 🆕 API 버전별 쿼리용
  @@map("cost_data")
}
```

### 2.4 마이그레이션 SQL

```sql
-- Step 1: OrganizationApiKey 테이블 생성
CREATE TABLE "organization_api_keys" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "team_id" TEXT NOT NULL UNIQUE,
  "provider" TEXT NOT NULL,
  "encrypted_key" TEXT NOT NULL,
  "encrypted_data_key" TEXT NOT NULL,
  "iv" TEXT NOT NULL,
  "last4" VARCHAR(4) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "key_type" TEXT NOT NULL DEFAULT 'admin',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "organization_api_keys_team_id_fkey"
    FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "organization_api_keys_team_id_idx" ON "organization_api_keys"("team_id");
CREATE INDEX "organization_api_keys_provider_is_active_idx" ON "organization_api_keys"("provider", "is_active");

-- Step 2: Project에 openai_project_id 추가
ALTER TABLE "projects" ADD COLUMN "openai_project_id" TEXT;
CREATE UNIQUE INDEX "projects_openai_project_id_key" ON "projects"("openai_project_id");
CREATE INDEX "projects_openai_project_id_idx" ON "projects"("openai_project_id");

-- Step 3: CostData 확장
ALTER TABLE "cost_data"
  ADD COLUMN "bucket_start_time" TIMESTAMP(3),
  ADD COLUMN "bucket_end_time" TIMESTAMP(3),
  ADD COLUMN "line_item" TEXT,
  ADD COLUMN "currency" TEXT DEFAULT 'usd',
  ADD COLUMN "api_version" TEXT NOT NULL DEFAULT 'usage_v1';

-- Step 4: 기존 필드 nullable 처리 (향후 마이그레이션)
ALTER TABLE "cost_data" ALTER COLUMN "api_key_id" DROP NOT NULL;
ALTER TABLE "cost_data" ALTER COLUMN "snapshot_id" DROP NOT NULL;

-- Step 5: 새로운 unique constraint 추가
CREATE UNIQUE INDEX "cost_data_unique_cost_bucket"
  ON "cost_data"("project_id", "bucket_start_time", "bucket_end_time", "line_item", "api_version");

-- Step 6: API 버전별 인덱스 추가
CREATE INDEX "cost_data_api_version_idx" ON "cost_data"("api_version");
```

---

## 3. API 변경 사항

### 3.1 새로운 Cost Collector (Costs API)

**파일:** `src/lib/services/openai/cost-collector-v2.ts`

```typescript
import pino from "pino";
import { COST_COLLECTION } from "~/lib/constants";
import { retryWithBackoff } from "~/lib/utils/retry";
import { db } from "~/server/db";
import { getKMSEncryption } from "../encryption/kms-envelope";

const logger = pino({ name: "openai-cost-collector-v2" });

// OpenAI Costs API response types
interface CostAmount {
  value: number;
  currency: string;
}

interface CostResult {
  object: "organization.costs.result";
  amount: CostAmount;
  line_item: string | null;
  project_id: string | null;
}

interface CostBucket {
  object: "bucket";
  start_time: number; // Unix seconds
  end_time: number;   // Unix seconds
  results: CostResult[];
}

interface CostsAPIResponse {
  object: "page";
  data: CostBucket[];
  has_more: boolean;
  next_page: string | null;
}

/**
 * Fetch costs from OpenAI Costs API
 *
 * @param adminApiKey - Decrypted Admin API Key (Team 레벨)
 * @param startTime - Unix timestamp (시작 시간)
 * @param endTime - Unix timestamp (종료 시간, 선택)
 * @param projectIds - 필터링할 OpenAI Project IDs (선택)
 * @param limit - 버킷 수 제한 (기본 7, 최대 180)
 * @param page - 페이지네이션 커서
 */
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
  url.searchParams.set("bucket_width", "1d"); // 일별 버킷
  url.searchParams.set("limit", limit.toString());

  if (endTime) {
    url.searchParams.set("end_time", endTime.toString());
  }

  if (page) {
    url.searchParams.set("page", page);
  }

  // group_by 파라미터로 line_item과 project_id 집계
  url.searchParams.set("group_by", "line_item,project_id");

  // 특정 프로젝트만 필터링
  if (projectIds && projectIds.length > 0) {
    projectIds.forEach(id => {
      url.searchParams.append("project_ids", id);
    });
  }

  logger.info({ url: url.toString() }, "Fetching OpenAI Costs API");

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${adminApiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI Costs API error (${response.status}): ${errorText}`);
  }

  return (await response.json()) as CostsAPIResponse;
}

/**
 * Fetch all costs with pagination support
 */
async function fetchOpenAICostsComplete(
  adminApiKey: string,
  startTime: number,
  endTime?: number,
  projectIds?: string[],
): Promise<CostBucket[]> {
  const allBuckets: CostBucket[] = [];
  let currentPage: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const response = await retryWithBackoff(
      () => fetchOpenAICosts(adminApiKey, startTime, endTime, projectIds, 180, currentPage),
      { context: "OpenAI Costs API fetch" },
    );

    allBuckets.push(...response.data);

    logger.info(
      {
        bucketsInPage: response.data.length,
        totalBuckets: allBuckets.length,
        hasMore: response.has_more,
      },
      "Fetched OpenAI costs page",
    );

    if (response.has_more && response.next_page) {
      currentPage = response.next_page;
    } else {
      hasMore = false;
    }
  }

  return allBuckets;
}

export interface CollectedCostDataV2 {
  projectId: string;
  provider: string;
  service: string; // line_item value
  cost: number; // in dollars
  bucketStartTime: Date;
  bucketEndTime: Date;
  lineItem: string | null;
  currency: string;
  apiVersion: "costs_v1";
  // Optional context (Novel Pattern 1)
  taskType?: string;
  userIntent?: string;
}

/**
 * Collect daily costs for a team using Costs API
 *
 * @param teamId - Team ID to collect costs for
 * @param targetDate - Date to collect costs for (defaults to yesterday)
 */
export async function collectDailyCostsV2(
  teamId: string,
  targetDate?: Date,
): Promise<CollectedCostDataV2[]> {
  const date = targetDate ?? new Date(Date.now() - COST_COLLECTION.DATA_DELAY_HOURS * 60 * 60 * 1000);

  // 해당 날짜의 시작/종료 Unix timestamp
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const startTime = Math.floor(startOfDay.getTime() / 1000);
  const endTime = Math.floor(endOfDay.getTime() / 1000);

  logger.info({ teamId, date: date.toISOString().split("T")[0] }, "Starting Costs API collection");

  // 1. Team의 Admin API Key 조회
  const orgApiKey = await db.organizationApiKey.findUnique({
    where: {
      teamId,
      provider: "openai",
      isActive: true,
    },
  });

  if (!orgApiKey) {
    logger.warn({ teamId }, "No active Admin API key found for team");
    return [];
  }

  // 2. Admin API Key 복호화
  const decryptedKey = await retryWithBackoff(
    () =>
      getKMSEncryption().decrypt(
        orgApiKey.encryptedKey,
        orgApiKey.encryptedDataKey,
        orgApiKey.iv,
      ),
    { context: "KMS decryption" },
  );

  // 3. Team의 모든 프로젝트 조회 (OpenAI Project ID가 있는 것만)
  const projects = await db.project.findMany({
    where: {
      teamId,
      openaiProjectId: { not: null },
    },
    select: {
      id: true,
      openaiProjectId: true,
    },
  });

  if (projects.length === 0) {
    logger.warn({ teamId }, "No projects with OpenAI Project ID found");
    return [];
  }

  const projectIdMap = new Map(
    projects.map(p => [p.openaiProjectId!, p.id])
  );
  const openaiProjectIds = Array.from(projectIdMap.keys());

  logger.info({ teamId, projectCount: projects.length }, "Fetching costs for projects");

  // 4. Costs API 호출 (project_ids 필터링)
  const costBuckets = await fetchOpenAICostsComplete(
    decryptedKey,
    startTime,
    endTime,
    openaiProjectIds,
  );

  // 5. 데이터 변환
  const allCostData: CollectedCostDataV2[] = [];

  for (const bucket of costBuckets) {
    const bucketStartTime = new Date(bucket.start_time * 1000);
    const bucketEndTime = new Date(bucket.end_time * 1000);

    for (const result of bucket.results) {
      // OpenAI Project ID → 우리 시스템의 Project ID 매핑
      const internalProjectId = result.project_id
        ? projectIdMap.get(result.project_id)
        : null;

      if (!internalProjectId) {
        logger.warn(
          { openaiProjectId: result.project_id },
          "Unknown OpenAI Project ID, skipping",
        );
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

/**
 * Store collected cost data (Costs API version)
 */
export async function storeCostDataV2(
  costDataRecords: CollectedCostDataV2[],
): Promise<number> {
  if (costDataRecords.length === 0) {
    logger.info("No cost data to store");
    return 0;
  }

  logger.info({ recordsCount: costDataRecords.length }, "Storing cost data (Costs API)");

  const batchSize = COST_COLLECTION.BATCH_SIZE;
  let totalCreated = 0;

  for (let i = 0; i < costDataRecords.length; i += batchSize) {
    const batch = costDataRecords.slice(i, i + batchSize);

    const result = await db.costData.createMany({
      data: batch.map((record) => ({
        projectId: record.projectId,
        apiKeyId: null, // Costs API는 Admin Key 사용, 프로젝트 API 키 불필요
        provider: record.provider,
        service: record.service,
        model: null, // Costs API는 모델 정보 없음
        tokens: null, // Costs API는 토큰 정보 없음
        cost: record.cost,
        date: record.bucketStartTime, // 버킷 시작 시간을 date로 사용
        snapshotId: null, // Costs API는 snapshot_id 없음
        bucketStartTime: record.bucketStartTime,
        bucketEndTime: record.bucketEndTime,
        lineItem: record.lineItem,
        currency: record.currency,
        apiVersion: record.apiVersion,
        taskType: record.taskType ?? null,
        userIntent: record.userIntent ?? null,
      })),
      skipDuplicates: true, // unique_cost_bucket constraint 활용
    });

    totalCreated += result.count;
    logger.info({ batchIndex: i / batchSize, created: result.count }, "Batch inserted");
  }

  logger.info({ totalCreated }, "Cost data storage completed");

  return totalCreated;
}
```

### 3.2 Cron Job 업데이트

**파일:** `src/app/api/cron/daily-batch/route.ts`

기존 Usage API 수집기를 호출하는 대신, 새로운 Costs API 수집기를 호출하도록 변경:

```typescript
import { collectDailyCostsV2, storeCostDataV2 } from "~/lib/services/openai/cost-collector-v2";

// ... (기존 인증 로직 유지)

export async function GET(request: NextRequest) {
  try {
    // ... (CRON_SECRET 검증, Idempotency 체크)

    // 모든 활성 팀 조회
    const activeTeams = await db.team.findMany({
      where: {
        organizationApiKey: {
          isActive: true,
        },
      },
      select: {
        id: true,
        name: true,
      },
    });

    logger.info({ teamCount: activeTeams.length }, "Found active teams with Admin API keys");

    const allCostData = [];

    // 팀별 순차 처리
    for (const team of activeTeams) {
      try {
        const costData = await collectDailyCostsV2(team.id);
        allCostData.push(...costData);
      } catch (error) {
        logger.error(
          { teamId: team.id, error: error instanceof Error ? error.message : String(error) },
          "Failed to collect costs for team",
        );
        // 에러 발생해도 다른 팀 계속 처리
      }

      // Rate limiting
      if (activeTeams.length > 1) {
        await new Promise(resolve => setTimeout(resolve, COST_COLLECTION.RATE_LIMIT_DELAY_MS));
      }
    }

    // 데이터 저장
    const createdCount = await storeCostDataV2(allCostData);

    logger.info({ createdCount }, "Daily batch completed");

    return NextResponse.json({
      success: true,
      recordsCreated: createdCount,
    });
  } catch (error) {
    // ... (에러 핸들링)
  }
}
```

---

## 4. tRPC Router 업데이트

### 4.1 새로운 프로시저 추가

**파일:** `src/server/api/routers/team.ts` (신규 또는 확장)

```typescript
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { encryptApiKey, validateApiKey } from "~/lib/services/encryption/api-key-manager";

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
      if (!validateApiKey(input.apiKey, "openai")) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid OpenAI Admin API key format",
        });
      }

      // 3. KMS 암호화
      const { ciphertext, encryptedDataKey, iv } = await encryptApiKey(input.apiKey);

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
          keyType: "admin",
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

      // 5. Audit log 생성
      await ctx.db.auditLog.create({
        data: {
          userId,
          actionType: "admin_api_key_registered",
          resourceType: "organization_api_key",
          resourceId: adminKey.id,
          metadata: {
            teamId: input.teamId,
            last4,
          },
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

**파일:** `src/server/api/routers/project.ts` (확장)

```typescript
export const projectRouter = createTRPCRouter({
  // ... (기존 프로시저 유지)

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
      const projectMember = await ctx.db.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId: input.projectId,
            userId,
          },
        },
        include: {
          project: {
            include: {
              team: {
                include: {
                  members: {
                    where: { userId },
                  },
                },
              },
            },
          },
        },
      });

      if (!projectMember) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not a member of this project",
        });
      }

      // 2. 팀에 Admin API Key가 등록되어 있는지 확인
      const team = projectMember.project.team;
      const adminKey = await ctx.db.organizationApiKey.findUnique({
        where: { teamId: team.id },
      });

      if (!adminKey || !adminKey.isActive) {
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

      // 5. Audit log
      await ctx.db.auditLog.create({
        data: {
          userId,
          actionType: "openai_project_id_registered",
          resourceType: "project",
          resourceId: updated.id,
          metadata: {
            openaiProjectId: input.openaiProjectId,
            teamId: team.id,
          },
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
   *
   * 이 프로시저는 사용자가 입력한 OpenAI Project ID가
   * 실제로 팀의 Admin API Key에 접근 가능한지 검증합니다.
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
});
```

---

## 5. UI 변경 사항

### 5.1 Team Settings 페이지 - Admin API Key 등록

**파일:** `src/app/(dashboard)/teams/[id]/settings/page.tsx` (신규)

```typescript
"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Alert, AlertDescription } from "~/components/ui/alert";

export default function TeamSettingsPage({ params }: { params: { id: string } }) {
  const [apiKey, setApiKey] = useState("");
  const { data: adminKeyStatus, refetch } = api.team.getAdminApiKeyStatus.useQuery({
    teamId: params.id,
  });

  const registerMutation = api.team.registerAdminApiKey.useMutation({
    onSuccess: () => {
      setApiKey("");
      refetch();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    registerMutation.mutate({ teamId: params.id, apiKey });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Team Settings</h1>
        <p className="text-muted-foreground">Manage team-level OpenAI configuration</p>
      </div>

      <div className="rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">OpenAI Admin API Key</h2>

        {adminKeyStatus ? (
          <Alert>
            <AlertDescription>
              Admin API Key registered (ends with {adminKeyStatus.last4})
              <br />
              Status: {adminKeyStatus.isActive ? "Active" : "Inactive"}
            </AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <AlertDescription>
              No Admin API Key registered. Register one to enable Costs API data collection.
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <Label htmlFor="apiKey">Admin API Key</Label>
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-admin-..."
            />
            <p className="text-xs text-muted-foreground mt-1">
              This key must have admin permissions for your OpenAI organization
            </p>
          </div>

          <Button type="submit" disabled={registerMutation.isPending}>
            {adminKeyStatus ? "Update" : "Register"} Admin API Key
          </Button>
        </form>
      </div>
    </div>
  );
}
```

### 5.2 Project Settings 페이지 - OpenAI Project ID 등록

**파일:** `src/app/(dashboard)/projects/[id]/settings/page.tsx` (확장)

```typescript
"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Alert, AlertDescription } from "~/components/ui/alert";

export default function ProjectSettingsPage({ params }: { params: { id: string } }) {
  const [openaiProjectId, setOpenaiProjectId] = useState("");

  const { data: project, refetch } = api.project.getById.useQuery({ id: params.id });
  const { data: adminKeyStatus } = api.team.getAdminApiKeyStatus.useQuery({
    teamId: project?.teamId ?? "",
  }, {
    enabled: !!project?.teamId,
  });

  const registerMutation = api.project.registerOpenAIProjectId.useMutation({
    onSuccess: () => {
      setOpenaiProjectId("");
      refetch();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    registerMutation.mutate({ projectId: params.id, openaiProjectId });
  };

  return (
    <div className="space-y-6">
      {/* ... 기존 설정 섹션 ... */}

      <div className="rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">OpenAI Project ID</h2>

        {!adminKeyStatus?.isActive && (
          <Alert variant="warning">
            <AlertDescription>
              Your team must register an Admin API Key before adding Project IDs.
            </AlertDescription>
          </Alert>
        )}

        {project?.openaiProjectId ? (
          <Alert>
            <AlertDescription>
              OpenAI Project ID: <code className="font-mono">{project.openaiProjectId}</code>
            </AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <AlertDescription>
              No OpenAI Project ID registered. Add one to track costs via Costs API.
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <Label htmlFor="openaiProjectId">OpenAI Project ID</Label>
            <Input
              id="openaiProjectId"
              value={openaiProjectId}
              onChange={(e) => setOpenaiProjectId(e.target.value)}
              placeholder="proj_abc123..."
              disabled={!adminKeyStatus?.isActive}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Find this in your OpenAI project settings
            </p>
          </div>

          <Button
            type="submit"
            disabled={registerMutation.isPending || !adminKeyStatus?.isActive}
          >
            {project?.openaiProjectId ? "Update" : "Register"} Project ID
          </Button>
        </form>
      </div>
    </div>
  );
}
```

---

## 6. 검증 및 관계 확인 로직

### 6.1 데이터 정합성 검증 스크립트

**파일:** `scripts/validate-openai-setup.ts`

```typescript
import { db } from "~/server/db";
import { getKMSEncryption } from "~/lib/services/encryption/kms-envelope";
import pino from "pino";

const logger = pino({ name: "validate-openai-setup" });

/**
 * Validate Team → Admin API Key → Projects 관계
 */
async function validateTeamSetup(teamId: string): Promise<{
  valid: boolean;
  issues: string[];
}> {
  const issues: string[] = [];

  // 1. Team 존재 확인
  const team = await db.team.findUnique({
    where: { id: teamId },
    include: {
      organizationApiKey: true,
      projects: true,
    },
  });

  if (!team) {
    issues.push(`Team ${teamId} not found`);
    return { valid: false, issues };
  }

  // 2. Admin API Key 존재 및 활성화 확인
  if (!team.organizationApiKey) {
    issues.push(`Team ${team.name} has no Admin API Key`);
  } else if (!team.organizationApiKey.isActive) {
    issues.push(`Team ${team.name} Admin API Key is inactive`);
  }

  // 3. Admin API Key 복호화 테스트
  if (team.organizationApiKey) {
    try {
      const kms = getKMSEncryption();
      await kms.decrypt(
        team.organizationApiKey.encryptedKey,
        team.organizationApiKey.encryptedDataKey,
        team.organizationApiKey.iv,
      );
      logger.info({ teamId }, "Admin API Key decryption successful");
    } catch (error) {
      issues.push(`Failed to decrypt Admin API Key: ${error}`);
    }
  }

  // 4. Projects with OpenAI Project ID 확인
  const projectsWithId = team.projects.filter(p => p.openaiProjectId);
  if (projectsWithId.length === 0) {
    issues.push(`Team ${team.name} has no projects with OpenAI Project ID`);
  }

  logger.info({
    teamId,
    teamName: team.name,
    hasAdminKey: !!team.organizationApiKey,
    projectCount: team.projects.length,
    projectsWithOpenAIId: projectsWithId.length,
  }, "Team validation completed");

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Validate all teams
 */
async function validateAllTeams() {
  const teams = await db.team.findMany({
    select: { id: true, name: true },
  });

  logger.info({ teamCount: teams.length }, "Validating all teams");

  for (const team of teams) {
    const result = await validateTeamSetup(team.id);

    if (!result.valid) {
      logger.warn({ teamId: team.id, teamName: team.name, issues: result.issues }, "Team validation failed");
    } else {
      logger.info({ teamId: team.id, teamName: team.name }, "Team validation passed");
    }
  }
}

// CLI 실행
if (require.main === module) {
  validateAllTeams()
    .then(() => process.exit(0))
    .catch(error => {
      logger.error({ error }, "Validation script failed");
      process.exit(1);
    });
}
```

실행:
```bash
bun run scripts/validate-openai-setup.ts
```

### 6.2 Costs API 연결 테스트

**파일:** `scripts/test-costs-api.ts`

```typescript
import { collectDailyCostsV2 } from "~/lib/services/openai/cost-collector-v2";
import pino from "pino";

const logger = pino({ name: "test-costs-api" });

async function testCostsAPI(teamId: string) {
  logger.info({ teamId }, "Testing Costs API for team");

  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const costs = await collectDailyCostsV2(teamId, yesterday);

    logger.info({
      teamId,
      recordCount: costs.length,
      totalCost: costs.reduce((sum, c) => sum + c.cost, 0),
      uniqueProjects: new Set(costs.map(c => c.projectId)).size,
    }, "Costs API test successful");

    return costs;
  } catch (error) {
    logger.error({ teamId, error }, "Costs API test failed");
    throw error;
  }
}

// CLI 실행
if (require.main === module) {
  const teamId = process.argv[2];
  if (!teamId) {
    console.error("Usage: bun run scripts/test-costs-api.ts <teamId>");
    process.exit(1);
  }

  testCostsAPI(teamId)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
```

실행:
```bash
bun run scripts/test-costs-api.ts <team-id>
```

---

## 7. 마이그레이션 타임라인

### Phase 1: 스키마 및 기본 인프라 (Day 1)
- ✅ Prisma 스키마 업데이트
- ✅ 마이그레이션 SQL 실행
- ✅ `OrganizationApiKey` 모델 생성
- ✅ `Project.openaiProjectId` 필드 추가
- ✅ `CostData` 확장 (Costs API 필드)

### Phase 2: API 수집기 구현 (Day 2)
- ✅ `cost-collector-v2.ts` 구현
- ✅ Costs API 클라이언트 구현
- ✅ 페이지네이션 및 재시도 로직
- ✅ Unit 테스트 작성

### Phase 3: tRPC Router 및 인증 (Day 2-3)
- ✅ `teamRouter` 확장 (Admin API Key 등록)
- ✅ `projectRouter` 확장 (OpenAI Project ID 등록)
- ✅ 권한 검증 로직 (owner/admin만)
- ✅ Audit log 통합

### Phase 4: UI 구현 (Day 3)
- ✅ Team Settings 페이지 (Admin Key 등록)
- ✅ Project Settings 페이지 (Project ID 등록)
- ✅ 관계 검증 UI 피드백
- ✅ 에러 핸들링 및 토스트 알림

### Phase 5: Cron Job 업데이트 (Day 4)
- ✅ `daily-batch/route.ts` Costs API 전환
- ✅ 기존 Usage API 수집 병행 (하이브리드 모드)
- ✅ Feature flag로 전환 제어
- ✅ 에러 알림 업데이트

### Phase 6: 검증 및 테스트 (Day 4-5)
- ✅ 검증 스크립트 실행
- ✅ Costs API 테스트 스크립트
- ✅ E2E 테스트 업데이트
- ✅ Production 배포 전 체크리스트

### Phase 7: 데이터 마이그레이션 및 전환 (Day 5)
- ✅ 기존 Usage API 데이터 보존
- ✅ Costs API로 신규 데이터 수집 시작
- ✅ 두 API 데이터 비교 검증
- ✅ Usage API 단계적 폐기 (선택)

---

## 8. Rollback 계획

### 8.1 Rollback 시나리오

**문제 발생 시:**
1. Costs API 인증 실패 (Admin Key 권한 부족)
2. 데이터 수집 실패율 > 50%
3. 비용 데이터 불일치 (Usage API vs. Costs API)

### 8.2 Pre-Migration Backup Checklist

**마이그레이션 전 필수 백업:**

```bash
# 1. 데이터베이스 백업 (production)
pg_dump -h <db_host> -U <db_user> -d <db_name> -F c -b -v -f backup_pre_migration_$(date +%Y%m%d_%H%M%S).dump

# 2. 환경 변수 백업
# Vercel dashboard에서 Environment Variables 전체 export
# 또는 CLI로:
vercel env pull .env.production.backup

# 3. Git 커밋 SHA 기록
echo "Current commit: $(git rev-parse HEAD)" > rollback_info.txt
git log -1 --format="%H %s %ci" >> rollback_info.txt

# 4. 현재 Cost Collection 설정 백업
# DB에서 현재 OrganizationApiKey와 Project.openaiProjectId 상태 스냅샷
psql -h <db_host> -U <db_user> -d <db_name> -c "\COPY (SELECT id, team_id, provider, is_active FROM organization_api_keys) TO 'api_keys_backup.csv' CSV HEADER"
psql -h <db_host> -U <db_user> -d <db_name> -c "\COPY (SELECT id, name, openai_project_id FROM projects WHERE openai_project_id IS NOT NULL) TO 'projects_backup.csv' CSV HEADER"
```

### 8.3 Rollback Procedure (Step-by-Step)

**Phase 1: Immediate Stop (5 minutes)**

```bash
# 1. Vercel Cron Job 비활성화 (UI 또는 CLI)
# Dashboard → Settings → Cron Jobs → Disable cost collection

# 2. Feature Flag로 신규 데이터 수집 중단
vercel env add ENABLE_MULTI_ORG_COST_COLLECTION false

# 3. 현재 배포 중단 (필요 시)
vercel rollback <deployment-url>
```

**Phase 2: Code Rollback (10 minutes)**

```bash
# 4. Git으로 이전 안정 버전 복원
git revert <migration-commit-sha>
# 또는 전체 롤백:
git reset --hard <pre-migration-commit-sha>

# 5. 배포 (Vercel)
git push origin main --force

# 6. 배포 완료 확인
vercel --prod
```

**Phase 3: Database Cleanup (15 minutes)**

```bash
# 7. Costs API 데이터 임시 비활성화 (삭제하지 않고 마킹)
psql -h <db_host> -U <db_user> -d <db_name> << EOF
-- Costs API 데이터에 rollback 플래그 추가
UPDATE cost_data
SET api_version = 'costs_v1_rollback'
WHERE api_version = 'costs_v1';

-- OrganizationApiKey 비활성화
UPDATE organization_api_keys
SET is_active = false
WHERE provider = 'openai';

-- Project OpenAI ID 임시 제거 (백업됨)
UPDATE projects
SET openai_project_id = NULL
WHERE openai_project_id IS NOT NULL;
EOF

# 8. 백업 데이터 복원 확인
# api_keys_backup.csv와 projects_backup.csv가 있는지 확인
ls -lh *_backup.csv
```

**Phase 4: Legacy API 복원 (20 minutes)**

```bash
# 9. Usage API 엔드포인트 재활성화
# 코드에서 feature flag 또는 환경 변수 확인
vercel env add ENABLE_COSTS_API false
vercel env add ENABLE_USAGE_API true

# 10. Legacy cost collector 재배포
# cost-collector.ts (Usage API 버전)가 정상 작동하는지 수동 테스트
bun run src/cron/cost-collection-test.ts

# 11. Vercel Cron Job 재활성화 (Legacy 버전)
# Dashboard → Settings → Cron Jobs → Enable
```

**Phase 5: Validation (10 minutes)**

```bash
# 12. UI 정상 작동 확인
curl https://<production-url>/api/trpc/cost.getTeamCosts

# 13. Sentry 에러율 확인
# Dashboard → Issues → Last 1 hour error rate < 1%

# 14. Cost collection 로그 확인
vercel logs --follow --since 10m
```

### 8.4 Data Recovery Procedure

**백업에서 데이터 복원이 필요한 경우:**

```bash
# 1. 전체 데이터베이스 복원 (최후 수단)
pg_restore -h <db_host> -U <db_user> -d <db_name> -v backup_pre_migration_<timestamp>.dump

# 2. 특정 테이블만 복원
pg_restore -h <db_host> -U <db_user> -d <db_name> -t organization_api_keys backup_pre_migration_<timestamp>.dump
pg_restore -h <db_host> -U <db_user> -d <db_name> -t projects backup_pre_migration_<timestamp>.dump

# 3. CSV 백업에서 복원
psql -h <db_host> -U <db_user> -d <db_name> -c "\COPY organization_api_keys FROM 'api_keys_backup.csv' CSV HEADER"
psql -h <db_host> -U <db_user> -d <db_name> -c "\COPY projects (id, name, openai_project_id) FROM 'projects_backup.csv' CSV HEADER"
```

### 8.5 Downtime Expectations

| Phase | Expected Downtime | Impact |
|-------|-------------------|--------|
| Phase 1: Immediate Stop | 0 min | UI continues working with cached data |
| Phase 2: Code Rollback | 2-5 min | UI 접속 가능, cost collection 일시 중단 |
| Phase 3: DB Cleanup | 0 min | Background operation |
| Phase 4: Legacy API 복원 | 0 min | Gradual restoration |
| Phase 5: Validation | 0 min | Monitoring only |
| **Total** | **2-5 minutes** | Minimal user impact |

### 8.6 Backward Compatibility 전략

스키마 설계 시 **additive-only** 원칙:
- ✅ 새 필드는 모두 `nullable` 또는 `default` 값
- ✅ 기존 필드 삭제 안 함 (deprecated 마킹만)
- ✅ Unique constraint는 API 버전별로 분리

이렇게 하면 Usage API와 Costs API를 **동시에 사용 가능**하며, 롤백 시에도 데이터 손실 없음.

### 8.7 Post-Rollback Actions

```bash
# 1. 팀에 알림
# Slack/Email로 rollback 사실과 원인 공유

# 2. 문제 원인 분석 회의 스케줄링
# Migration failure postmortem

# 3. Costs API 재시도 계획 수립
# 문제 해결 후 재시도 타임라인 결정

# 4. 백업 파일 아카이빙
mv *_backup.* /backups/archive/$(date +%Y%m%d)/
```

---

## 9. 성공 지표 (Success Metrics)

### 9.1 마이그레이션 성공 조건

| 지표 | 목표 | 측정 방법 |
|------|------|-----------|
| Admin API Key 등록률 | 80% of teams | `SELECT COUNT(*) FROM organization_api_keys WHERE is_active = true` |
| Project ID 등록률 | 70% of projects | `SELECT COUNT(*) FROM projects WHERE openai_project_id IS NOT NULL` |
| Costs API 수집 성공률 | > 95% | Cron job 로그 분석 |
| 데이터 정합성 | 100% | Usage API vs. Costs API 비용 비교 (±5% 허용) |
| UI 에러율 | < 1% | Sentry error rate |

### 9.2 모니터링 대시보드

**Vercel Analytics + Custom Metrics:**
- Daily cost collection success rate
- API key validation failures
- Project ID mapping errors
- Cost data discrepancies (Usage vs. Costs API)

---

## 10. FAQ 및 트러블슈팅

### Q1: Admin API Key는 어디서 받나요?
**A:** OpenAI Organization Settings → API Keys → Create Admin Key
- 주의: Service Account Key와 다름
- 권한: `Organization Admin` 필요

### Q2: 기존 Usage API 데이터는 어떻게 되나요?
**A:**
- 기존 데이터는 `apiVersion='usage_v1'`로 보존
- 새 데이터는 `apiVersion='costs_v1'`로 구분
- 대시보드는 두 버전 모두 집계

### Q3: Project ID는 어떻게 찾나요?
**A:**
OpenAI Dashboard → Projects → Settings → Project ID
- 형식: `proj_abc123...`
- 각 프로젝트마다 고유 ID 존재

### Q4: Costs API와 Usage API 데이터가 다르면?
**A:**
- Costs API는 **조직 수준 집계**, Usage API는 **프로젝트 수준 상세**
- 데이터 지연 시간 차이 (8-24시간)
- Line item 매핑이 모델명과 1:1 대응 안 될 수 있음

### Q5: 하이브리드 모드로 운영 가능한가요?
**A:**
가능합니다.
- Feature flag: `ENABLE_COSTS_API=true/false`
- 두 API 동시 수집 후 비교 검증
- 점진적 전환 권장

---

## 11. 참고 문서

- [OpenAI Costs API Documentation](https://platform.openai.com/docs/api-reference/costs)
- [OpenAI Usage API Documentation](https://platform.openai.com/docs/api-reference/usage)
- [Architecture Decision Record - Costs API Migration](./adr/costs-api-migration.md)
- [Prisma Schema Changes](../prisma/schema.prisma)

---

**End of Migration Plan**
