# Story 1.2: OpenAI Costs API 비용 일일 배치 수집 시스템

Status: draft

## Story

As a FinOps 관리자,
I want 매일 자동으로 OpenAI Costs API에서 organization 비용 데이터를 수집하여,
so that 팀 전체의 AI 지출을 실시간으로 파악하고 프로젝트별로 분석할 수 있다.

## Acceptance Criteria

1. Team의 Admin API Key로 Costs API 호출 성공 (organization-level)
2. project_ids 파라미터로 team의 프로젝트 필터링
3. Pagination 지원 (has_more, next_page 처리)
4. Time bucket aggregation 데이터 파싱 (bucketStartTime, bucketEndTime, lineItem)
5. openai_project_id → internal project_id 매핑
6. CostData 테이블 저장 (apiVersion='costs_v1', unique_cost_bucket constraint)
7. 매일 오전 9시 KST Vercel Cron 실행

## Tasks / Subtasks

- [ ] Task 1: cost-collector-v2.ts 생성 및 Costs API Client 구현 (AC: #1, #2, #3, #4)
  - [ ] src/lib/services/openai/cost-collector-v2.ts 생성
  - [ ] fetchOpenAICosts 함수 구현 (단일 페이지 조회)
  - [ ] fetchOpenAICostsComplete 함수 구현 (pagination loop)
  - [ ] Costs API 응답 타입 정의 (CostBucket, CostResult, CostsAPIResponse)
  - [ ] URL 파라미터 생성 로직 (start_time, end_time, bucket_width=1d, group_by, project_ids[])
  - [ ] Retry 로직 with exponential backoff (3회 재시도)
  - [ ] Pino logger 통합 (에러/성공 로깅)

- [ ] Task 2: collectDailyCostsV2 함수 구현 (AC: #1, #2, #4, #5)
  - [ ] Team의 Admin API Key 조회 (OrganizationApiKey 테이블)
  - [ ] KMS 복호화 통합 (getKMSEncryption().decrypt)
  - [ ] Team의 모든 프로젝트 조회 (where openaiProjectId IS NOT NULL)
  - [ ] OpenAI Project ID 배열 생성
  - [ ] Project ID 매핑 Map 생성 (Map<openaiProjectId, internalProjectId>)
  - [ ] Costs API 호출 및 응답 파싱
  - [ ] Unix timestamp → DateTime 변환 (bucketStartTime, bucketEndTime)
  - [ ] CollectedCostDataV2 타입으로 데이터 변환

- [ ] Task 3: storeCostDataV2 함수 구현 (AC: #6)
  - [ ] Batch insert 로직 (createMany with skipDuplicates)
  - [ ] CostData 필드 매핑 (Costs API 전용 필드 포함)
  - [ ] apiVersion='costs_v1' 설정
  - [ ] unique_cost_bucket constraint 활용
  - [ ] Error handling 및 retry

- [ ] Task 4: Vercel Cron Job 엔드포인트 업데이트 (AC: #7)
  - [ ] src/app/api/cron/daily-batch/route.ts 업데이트
  - [ ] 모든 활성 팀 조회 (organizationApiKey.isActive = true)
  - [ ] 팀별 순차 처리 (collectDailyCostsV2 호출)
  - [ ] Rate limiting (팀 간 지연 추가)
  - [ ] 전체 데이터 집계 후 storeCostDataV2 호출
  - [ ] Cron log 기록

- [ ] Task 5: Unit Tests (Vitest + MSW)
  - [ ] Costs API response parsing 테스트
  - [ ] Pagination handling 테스트 (has_more, next_page)
  - [ ] Project ID mapping edge cases 테스트
  - [ ] Empty response 처리 테스트
  - [ ] Error handling 테스트 (401, 403, 500)

- [ ] Task 6: Integration Test
  - [ ] Cron job 수동 트리거 테스트
  - [ ] KMS 복호화 통합 테스트
  - [ ] Database 저장 검증 (apiVersion='costs_v1' 확인)
  - [ ] 중복 제거 테스트 (unique_cost_bucket)

## Dev Notes

### OpenAI Costs API Overview

**Endpoint:**
```
GET https://api.openai.com/v1/organization/costs
```

**Authentication:**
- Requires OpenAI Organization **Admin API Key** (NOT project-level key)
- Team 레벨에서 관리 (OrganizationApiKey 테이블)

**Query Parameters:**
```typescript
interface CostsAPIParams {
  start_time: number;        // Unix timestamp (required)
  end_time?: number;         // Unix timestamp (optional)
  bucket_width: "1d" | "1h"; // Time bucket size (default: 1d)
  group_by?: string;         // Comma-separated: "line_item", "project_id"
  project_ids?: string[];    // Filter by OpenAI Project IDs
  limit?: number;            // Max 180 buckets per page (default: 7)
  page?: string;             // Pagination cursor (next_page from previous response)
}
```

**Response Structure:**
```typescript
interface CostsAPIResponse {
  object: "page";
  data: CostBucket[];        // Array of time buckets
  has_more: boolean;         // More data available?
  next_page: string | null;  // Pagination cursor
}

interface CostBucket {
  object: "bucket";
  start_time: number;        // Unix seconds
  end_time: number;          // Unix seconds
  results: CostResult[];     // Aggregated costs in this bucket
}

interface CostResult {
  object: "organization.costs.result";
  amount: {
    value: number;           // Cost in dollars (e.g., 1.23)
    currency: string;        // "usd"
  };
  line_item: string | null;  // e.g., "Image models", "GPT-4"
  project_id: string | null; // e.g., "proj_abc123..."
}
```

**Key Differences from Usage API:**
- ✅ Organization-level visibility (모든 프로젝트 한 번에 조회)
- ✅ Time-bucketed aggregation (세밀한 시간 구간별 집계)
- ✅ Project ID filtering (project_ids 파라미터)
- ❌ 모델별 세부 정보 없음 (line_item 수준 집계)
- ❌ 토큰 수 정보 없음 (비용만)
- ⚠️ 8-24시간 데이터 지연 (실시간 아님)

### Architecture Patterns and Constraints

**Novel Pattern 2 (Updated for Costs API):**
- Team-level Admin API Key + Project ID filtering
- `OrganizationApiKey` (1:1 with Team)
- `Project.openaiProjectId` (OpenAI Project ID 등록)
- Admin Key로 전체 organization 비용 조회 후 project_ids로 필터링
- openai_project_id → internal project_id 매핑으로 자동 귀속

**Data Flow:**
```
매일 오전 9시 KST (Vercel Cron)
  → GET /api/cron/daily-batch
  → CRON_SECRET 검증
  → Idempotency 체크 (cron_logs 테이블)
  → 모든 활성 팀 조회 (teams with organizationApiKey.isActive = true)
  → For each team:
      → OrganizationApiKey 조회 및 KMS 복호화
      → Team의 모든 프로젝트 조회 (where openaiProjectId IS NOT NULL)
      → OpenAI Project IDs 배열 생성
      → Costs API 호출:
          - URL: https://api.openai.com/v1/organization/costs
          - Params: start_time, end_time, bucket_width=1d, group_by=line_item,project_id, project_ids[]
          - Pagination: has_more, next_page 처리
      → Response: CostBucket[] (각 버킷마다 CostResult[] 포함)
      → For each bucket:
          → For each result:
              → openai_project_id → internal project_id 매핑
              → cost_data 테이블 저장:
                  - apiVersion='costs_v1'
                  - bucketStartTime, bucketEndTime, lineItem, currency
                  - date = bucketStartTime (호환성)
              → skipDuplicates=true (unique_cost_bucket constraint)
  → Cron log 기록
  → Success 응답
```

**Vercel Cron Jobs** (ADR-003):
- 스케줄: 매일 오전 9시 KST (UTC+9) = 0 0 * * * UTC
- Idempotency: cron_logs 테이블로 중복 실행 방지
- 최대 실행 시간: 5분 (Vercel Pro)
- Best-effort 실행 (정확한 시간 보장 안 됨)

**AWS KMS Envelope Encryption** (ADR-002):
- KMS CMK로 Data Key 생성
- Data Key로 Admin API 키 AES-256-GCM 암호화
- 저장: encrypted_key, encrypted_data_key, iv
- 복호화 비용: $0.03/10,000 requests (월 $0.01 예상)

**Performance:**
- Prisma createMany batch insert (한 번에 최대 1,000개)
- KMS 복호화 결과 메모리 캐싱 (Cron job 실행 중)
- Database 인덱스: cost_data(project_id, bucket_start_time), cost_data(api_version)

**Error Handling:**
- OpenAI Costs API: Retry 3회, exponential backoff (1s, 2s, 4s)
- KMS API: Retry 3회
- 최종 실패 시: Sentry 에러 로깅 + 관리자 이메일
- 팀별 에러 격리 (한 팀 실패해도 다른 팀 계속 처리)

### Source Tree Components to Touch

```
finops-for-ai/
├── src/
│   ├── app/
│   │   └── api/
│   │       └── cron/
│   │           └── daily-batch/
│   │               └── route.ts              # UPDATE: Costs API v2 호출
│   ├── lib/
│   │   └── services/
│   │       └── openai/
│   │           └── cost-collector-v2.ts     # NEW: Costs API 클라이언트
│   └── server/
│       └── db/
│           └── schema.prisma                 # UPDATE: CostData 확장
└── scripts/
    ├── validate-openai-setup.ts              # NEW: Admin Key 검증
    └── test-costs-api.ts                     # NEW: Costs API 테스트
```

**Key Files to Create:**
1. `src/lib/services/openai/cost-collector-v2.ts` - Costs API 클라이언트 및 수집 로직
2. `scripts/validate-openai-setup.ts` - Team → Admin Key → Projects 관계 검증
3. `scripts/test-costs-api.ts` - Costs API 연동 테스트

**Files to Update:**
- `src/app/api/cron/daily-batch/route.ts` - Costs API v2 수집기 호출
- `prisma/schema.prisma` - CostData 모델 확장 (bucketStartTime, lineItem, apiVersion)

**Files to Reuse:**
- `src/lib/services/encryption/kms-envelope.ts` - KMS decrypt 메서드
- `src/lib/utils/retry.ts` - Retry logic with exponential backoff
- `src/server/db.ts` - Prisma client

### Technical Implementation Details

#### 1. Costs API Client (cost-collector-v2.ts)

**Complete Implementation:**

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
  // 🆕 Multi-Provider Metadata
  providerMetadata?: {
    organizationId?: string | null;
    aiProjectId?: string | null;
  };
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

#### 2. Updated Prisma Schema

```prisma
model CostData {
  id         String   @id @default(cuid())
  projectId  String   @map("project_id")

  // Deprecated: Usage API 전용 필드 (마이그레이션 후 nullable 처리)
  apiKeyId   String?  @map("api_key_id")
  snapshotId String?  @map("snapshot_id")
  tokens     Int?
  model      String?

  // 공통 필드
  provider   String   // 'openai', 'aws', 'azure'
  service    String   // Usage API: 'gpt-4', Costs API: line_item
  cost       Decimal  @db.Decimal(10, 2)
  date       DateTime @db.Date // Usage API: 단일 날짜, Costs API: bucketStartTime에서 변환

  // NEW: Costs API 전용 필드
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
  @@index([apiVersion]) // NEW: API 버전별 쿼리용
  @@map("cost_data")
}

// NEW: Team-level OpenAI Organization Admin API Key
model OrganizationApiKey {
  id               String   @id @default(cuid())
  teamId           String   @unique @map("team_id")
  provider         String   // 'openai'

  // KMS Envelope Encryption
  encryptedKey     String   @map("encrypted_key") @db.Text
  encryptedDataKey String   @map("encrypted_data_key") @db.Text
  iv               String

  last4            String   @db.VarChar(4)
  isActive         Boolean  @default(true) @map("is_active")
  keyType          String   @default("admin") @map("key_type")

  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")

  team Team @relation(fields: [teamId], references: [id], onDelete: Cascade)

  @@index([teamId])
  @@index([provider, isActive])
  @@map("organization_api_keys")
}

// Updated: Project model with OpenAI Project ID
model Project {
  id          String   @id @default(cuid())
  teamId      String   @map("team_id")
  name        String
  description String?

  // NEW: OpenAI Project ID (Costs API 필터링용)
  openaiProjectId String? @unique @map("openai_project_id") // e.g., "proj_abc123"

  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  team       Team            @relation(fields: [teamId], references: [id], onDelete: Cascade)
  members    ProjectMember[]
  apiKeys    ApiKey[]        // Deprecated: 기존 Usage API용
  costData   CostData[]
  metrics    ProjectMetrics?
  costAlerts CostAlert[]

  @@index([teamId])
  @@index([openaiProjectId]) // NEW
  @@map("projects")
}
```

### Testing Strategy

**Unit Tests (Vitest):**

1. **Costs API Response Parsing**
   ```typescript
   describe("fetchOpenAICosts", () => {
     it("should parse Costs API response correctly", async () => {
       // Mock response with CostBucket[]
       // Verify CostResult parsing
     });

     it("should handle empty results", async () => {
       // Mock response with empty data array
       // Verify graceful handling
     });
   });
   ```

2. **Pagination Handling**
   ```typescript
   describe("fetchOpenAICostsComplete", () => {
     it("should fetch all pages when has_more is true", async () => {
       // Mock 3 pages of responses
       // Verify all buckets collected
     });

     it("should stop when has_more is false", async () => {
       // Mock single page response
       // Verify no additional requests
     });
   });
   ```

3. **Project ID Mapping**
   ```typescript
   describe("collectDailyCostsV2", () => {
     it("should map OpenAI Project ID to internal project ID", async () => {
       // Mock projects with openaiProjectId
       // Mock Costs API response with project_id
       // Verify correct mapping
     });

     it("should skip unknown OpenAI Project IDs", async () => {
       // Mock Costs API response with unknown project_id
       // Verify warning logged and record skipped
     });
   });
   ```

**Integration Tests:**

1. **Cron Job Manual Trigger**
   ```bash
   curl -X GET http://localhost:3000/api/cron/daily-batch \
     -H "Authorization: Bearer ${CRON_SECRET}"
   ```
   - Verify 200 response
   - Check database for new CostData records with apiVersion='costs_v1'
   - Verify cron_logs entry created

2. **KMS Decryption Integration**
   ```typescript
   it("should decrypt Admin API Key and call Costs API", async () => {
     // Real KMS encryption/decryption
     // Real Costs API call (or MSW mock)
     // Verify successful data collection
   });
   ```

3. **Database Storage Validation**
   ```typescript
   it("should store Costs API data with correct schema", async () => {
     // Call storeCostDataV2
     // Query CostData table
     // Verify bucketStartTime, lineItem, apiVersion fields
   });
   ```

### Testing Scenarios

**Scenario 1: Successful Collection**
- ✅ Team has active Admin API Key
- ✅ Projects have OpenAI Project IDs
- ✅ Costs API returns data
- ✅ Data stored with apiVersion='costs_v1'

**Scenario 2: No Admin API Key**
- ❌ Team missing OrganizationApiKey
- ✅ Warning logged
- ✅ Empty array returned
- ✅ No database writes

**Scenario 3: No Projects with OpenAI Project ID**
- ✅ Team has Admin API Key
- ❌ All projects missing openaiProjectId
- ✅ Warning logged
- ✅ Empty array returned

**Scenario 4: Pagination (Multiple Pages)**
- ✅ Costs API returns has_more=true
- ✅ System fetches next_page
- ✅ All buckets aggregated
- ✅ Correct total record count

**Scenario 5: Unknown OpenAI Project ID**
- ✅ Costs API returns project_id not in our system
- ✅ Warning logged
- ✅ Record skipped
- ✅ Other records processed normally

**Scenario 6: Duplicate Prevention**
- ✅ Same bucket data collected twice
- ✅ skipDuplicates=true prevents duplicate insert
- ✅ unique_cost_bucket constraint enforced

**Scenario 7: KMS Decryption Failure**
- ❌ KMS decrypt fails (invalid CMK, network error)
- ✅ Retry 3 times with exponential backoff
- ✅ Error logged to Sentry
- ✅ Team skipped, other teams continue

**Scenario 8: Costs API Error**
- ❌ 401 Unauthorized (invalid Admin Key)
- ❌ 403 Forbidden (insufficient permissions)
- ❌ 500 Internal Server Error
- ✅ Retry 3 times
- ✅ Error logged with context
- ✅ Team skipped, other teams continue

### Project Structure Notes

**Alignment with Architecture:**
- Cost collector v2 위치: `src/lib/services/openai/` (architecture.md Project Structure 준수)
- Costs API 타입: TypeScript interfaces in cost-collector-v2.ts
- Database models: Prisma schema (OrganizationApiKey, CostData 확장)

**Novel Pattern 2 (Updated for Costs API):**
- Team-level Admin API Key (OrganizationApiKey 테이블)
- Project-level OpenAI Project ID (Project.openaiProjectId 필드)
- Costs API organization-level 조회 → project_ids 필터링
- openai_project_id → internal project_id 매핑으로 자동 귀속
- 태그 불필요 (아키텍처 기반 격리)

**Dependencies:**
- Story 1.1: Prisma schema, KMS infrastructure
- Story 1.7: Admin API Key registration, Project ID management

### Learnings from Story 1.7

**From Story 1.7 (Dependency):**
- **OrganizationApiKey Available**: Team-level Admin API Key registered and encrypted
- **Project.openaiProjectId Available**: Projects have OpenAI Project IDs registered
- **Validation Logic**: Project ID validated via Costs API test call
- **Precondition Enforcement**: UI prevents Project ID registration without Admin Key

**Integration Points:**
- `teamRouter.registerAdminApiKey` ensures OrganizationApiKey exists
- `projectRouter.registerOpenAIProjectId` ensures openaiProjectId populated
- `projectRouter.validateOpenAIProjectId` verifies Project ID accessible via Admin Key

**Error Scenarios Handled by Story 1.7:**
- Admin Key missing → collectDailyCostsV2 returns empty array (graceful)
- Project ID missing → project filtered out (where openaiProjectId IS NOT NULL)
- Invalid Project ID → validation fails at registration time (prevents bad data)

### References

- [Source: docs/epics-v2.md#Story-1.2] - Story acceptance criteria and business requirements
- [Source: docs/migration/costs-api-migration-plan.md#Section-3.1] - Complete cost-collector-v2.ts implementation
- [Source: docs/architecture.md#Novel-Pattern-2] - Team-level Admin Key + Project ID filtering pattern
- [Source: docs/architecture.md#Decision-Summary] - ADR-003 (Vercel Cron Jobs), ADR-002 (AWS KMS), ADR-009 (Costs API Migration)
- [Source: docs/PRD.md#Functional-Requirements] - FR001 (일일 배치 수집), FR007-C (Costs API 프로젝트 필터링), NFR004 (AES-256 암호화)
- [Source: docs/stories/1-7-팀-admin-api-키-등록-및-프로젝트-id-관리.md] - Admin API Key and Project ID registration (prerequisite)
- [Source: docs/migration/BREAKING_CHANGES.md] - Usage API → Costs API 전환 세부사항

## Dev Agent Record

### Context Reference

- docs/stories/1-2-openai-costs-api-비용-일일-배치-수집-시스템-v2.context.xml (to be created)

### Agent Model Used

Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

### Completion Notes List

**Implementation Summary:**
- 🆕 Complete rewrite for OpenAI Costs API migration
- 🆕 Organization-level cost collection with Team Admin API Key
- 🆕 Project ID filtering via project_ids parameter
- 🆕 Pagination support (has_more, next_page)
- 🆕 Time bucket aggregation (bucketStartTime, bucketEndTime, lineItem)
- 🆕 API version tracking (apiVersion='costs_v1')

**Key Architectural Changes:**
1. **Data Source**: Usage API → Costs API
2. **Authentication**: Project-level API Key → Team-level Admin API Key
3. **Data Structure**: 모델별 세부 데이터 → 시간 버킷 집계 데이터
4. **Granularity**: 토큰 수준 → line_item 수준
5. **Scope**: 프로젝트별 조회 → organization 전체 조회 + 필터링

**Acceptance Criteria Mapping:**
- ✅ AC #1: Team Admin API Key로 Costs API 호출 (OrganizationApiKey 테이블)
- ✅ AC #2: project_ids 파라미터로 프로젝트 필터링
- ✅ AC #3: Pagination 지원 (fetchOpenAICostsComplete 함수)
- ✅ AC #4: Time bucket 데이터 파싱 (bucketStartTime, bucketEndTime, lineItem)
- ✅ AC #5: openai_project_id → internal project_id 매핑 (projectIdMap)
- ✅ AC #6: CostData 저장 (apiVersion='costs_v1', unique_cost_bucket)
- ✅ AC #7: 매일 오전 9시 KST Vercel Cron (vercel.json 재사용)

**Dependencies:**
- Story 1.1: Prisma schema, KMS encryption infrastructure
- Story 1.7: Admin API Key registration, Project ID management (CRITICAL)

**Testing Strategy:**
- 8 comprehensive testing scenarios defined
- Unit tests: Costs API parsing, pagination, Project ID mapping
- Integration tests: Cron job, KMS decryption, database storage
- Error handling: 7 failure scenarios with graceful degradation

**Known Limitations:**
- 8-24시간 데이터 지연 (Costs API 특성)
- 모델별 세부 정보 없음 (line_item 집계 수준)
- 토큰 수 정보 없음 (비용만)

### File List

**Created Files:**
- docs/stories/1-2-openai-costs-api-비용-일일-배치-수집-시스템-v2.md - Complete Costs API version

**Files to be Created (Implementation):**
- src/lib/services/openai/cost-collector-v2.ts - Costs API client and collection logic
- scripts/validate-openai-setup.ts - Team → Admin Key → Projects validation
- scripts/test-costs-api.ts - Costs API integration test

**Files to be Updated (Implementation):**
- src/app/api/cron/daily-batch/route.ts - Call cost-collector-v2 instead of v1
- prisma/schema.prisma - Add CostData Costs API fields
- src/lib/constants.ts - Add Costs API constants

**Referenced Files:**
- src/lib/services/encryption/kms-envelope.ts - KMS decryption (reuse)
- src/lib/utils/retry.ts - Retry logic (reuse)
- src/server/db.ts - Prisma client (reuse)
