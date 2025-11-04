# Documentation Rewrite Checklist - Costs API Migration

**Date:** 2025-01-04
**Migration Plan:** [costs-api-migration-plan.md](./costs-api-migration-plan.md)
**Breaking Changes:** [BREAKING_CHANGES.md](./BREAKING_CHANGES.md)
**Status:** Draft

---

## Overview

This checklist provides a **section-by-section** breakdown of all documentation rewrites needed to sync with the Costs API migration. Each document is divided into specific sections with clear update instructions.

**Approach:** Complete Rewrite
**Principle:** Remove all Usage API references, establish Costs API as the primary design
**Timeline:** 3 days (8 documents, ~2-4 hours each)

---

## Phase 1: Core Architecture (Day 1)

### 1. architecture.md (CRITICAL - 4 hours)

**Priority:** P0 (Must complete first - all other docs depend on this)

#### Section 1.1: Executive Summary
- [ ] **Lines 10-18**: Rewrite Novel Pattern 2 description
  - **OLD:** "프로젝트 기반 API 키 격리: 태그 대신 프로젝트별 API 키 격리로 비용 자동 귀속"
  - **NEW:** "팀 기반 Admin API 키 + 프로젝트 ID 필터링: Team-level OpenAI Organization Admin Key로 Costs API 호출, Project IDs로 프로젝트별 비용 필터링"

#### Section 1.2: Decision Summary Table
- [ ] **Line 46**: Update **API Pattern** row
  - Decision: "tRPC" → "tRPC + OpenAI Costs API (v1/organization/costs)"
  - Rationale: Add "Costs API provides organization-level aggregated data with project_id filtering"

#### Section 1.3: Epic to Architecture Mapping
- [ ] **Lines 153-166 (Epic 1 table)**: Update Story 1.2, 1.7 rows
  - **Story 1.2**:
    - OLD: `cost-collector.ts`, OpenAI SDK
    - NEW: `cost-collector-v2.ts`, Costs API (`/v1/organization/costs`), pagination support
  - **Story 1.7**:
    - OLD: `api-key-manager.ts`, `src/server/api/routers/project.ts`
    - NEW: `src/server/api/routers/team.ts` (registerAdminApiKey), `src/server/api/routers/project.ts` (registerOpenAIProjectId)

#### Section 1.4: Novel Pattern Designs
- [ ] **Lines 345-663 (Pattern 2 section)**: COMPLETE REWRITE
  - **NEW Section Title:** "Pattern 2: Team-level Admin Key + Project ID Filtering (Team-Based Cost Attribution)"
  - **NEW Purpose:** "Organization-level cost visibility with project-level filtering via OpenAI Project IDs"
  - **NEW Components:**
    1. **OrganizationApiKey Manager** (team-level, KMS encrypted)
    2. **Project ID Registry** (Project.openaiProjectId)
    3. **Costs API Client** (cost-collector-v2.ts with pagination)
    4. **Project ID Validation** (verify Project ID belongs to Admin Key's organization)
    5. **Team Cost Aggregation** (sum all projects under team)
  - **NEW Data Flow:**
    ```
    Team created
      → Team admin registers OpenAI Organization Admin API Key (Team Settings)
      → KMS encrypts → OrganizationApiKey table
      → Project created under team
      → Project admin registers OpenAI Project ID (Project Settings)
      → System validates Project ID via Costs API test call
      → Daily Cron (9am KST)
        → Cost Collector V2 loads team's Admin Key
        → Calls Costs API with project_ids[] filter
        → Maps openai_project_id → internal project_id
        → Stores in CostData with apiVersion='costs_v1'
      → Team-level dashboard aggregates all projects automatically
    ```
  - **NEW Permissions Model:**
    - Team Admin: Register/update Admin API Key, view all project costs
    - Project Member: Register/update Project ID, view own project costs
    - Validation: Project ID must be accessible via team's Admin Key

#### Section 1.5: Data Architecture (Prisma Schema)
- [ ] **Lines 994-1208**: Update Core Models
  - **ADD** (after Line 1042 - Team model):
    ```prisma
    // Team-level OpenAI Organization Admin API Key (Story 1.7)
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
    ```
  - **UPDATE Line 1076-1088 (Project model)**: Add openaiProjectId
    ```prisma
    model Project {
      // ... existing fields ...
      openaiProjectId String? @unique @map("openai_project_id") // NEW

      // ... relations ...

      @@index([openaiProjectId]) // NEW
    }
    ```
  - **UPDATE Lines 1121-1144 (CostData model)**: Add Costs API fields
    ```prisma
    model CostData {
      // ... existing fields ...

      // Costs API specific (NEW)
      bucketStartTime DateTime? @map("bucket_start_time")
      bucketEndTime   DateTime? @map("bucket_end_time")
      lineItem        String?   @map("line_item")
      currency        String?   @default("usd")
      apiVersion      String    @default("usage_v1") @map("api_version") // 'usage_v1' | 'costs_v1'

      // ... relations ...

      @@unique([projectId, bucketStartTime, bucketEndTime, lineItem, apiVersion], name: "unique_cost_bucket") // NEW
      @@index([apiVersion]) // NEW
    }
    ```

#### Section 1.6: API Contracts (tRPC Routers)
- [ ] **Lines 1233-1303 (Project Router)**: ADD new procedures
  ```typescript
  // After existing procedures, add:

  registerOpenAIProjectId: protectedProcedure
    .input(z.object({
      projectId: z.string(),
      openaiProjectId: z.string().regex(/^proj_[a-zA-Z0-9_-]+$/)
    }))
    .mutation(async ({ input, ctx }) => {
      // 1. Verify team has active Admin Key
      // 2. Check openaiProjectId uniqueness
      // 3. Update project.openaiProjectId
      // 4. Audit log
    }),

  validateOpenAIProjectId: protectedProcedure
    .input(z.object({
      teamId: z.string(),
      openaiProjectId: z.string()
    }))
    .mutation(async ({ input, ctx }) => {
      // Test Costs API call with Admin Key + Project ID filter
      // Returns { valid: boolean, error?: string }
    })
  ```
- [ ] **ADD NEW SECTION** (after Line 1303): Team Router Extensions
  ```typescript
  // src/server/api/routers/team.ts (NEW)
  export const teamRouter = createTRPCRouter({
    registerAdminApiKey: protectedProcedure
      .input(z.object({
        teamId: z.string(),
        apiKey: z.string().min(20)
      }))
      .mutation(async ({ input, ctx }) => {
        // 1. Verify team ownership/admin role
        // 2. Validate API key format
        // 3. KMS encrypt
        // 4. Upsert OrganizationApiKey
        // 5. Audit log
      }),

    getAdminApiKeyStatus: protectedProcedure
      .input(z.object({ teamId: z.string() }))
      .query(async ({ input, ctx }) => {
        // Returns { id, last4, isActive, keyType, createdAt }
      })
  });
  ```

#### Section 1.7: ADR Updates
- [ ] **Lines 1806-1858 (ADR-007)**: MAJOR REVISION
  - **Update Date:** "2025-01-04 (2025-11-02 revision)"
  - **Status:** "Superseded by Costs API Migration" or "Accepted (Revised)"
  - **Add Migration Context:**
    ```markdown
    **마이그레이션 (2025-01-04):**
    Initial design used project-level API keys. Migrating to team-level Admin Keys + Project ID filtering to support OpenAI Costs API, which requires organization-level authentication.

    **변경 사항:**
    - API Key 소유: Project → Team (OrganizationApiKey)
    - 프로젝트 식별: API Key → OpenAI Project ID
    - 데이터 출처: Usage API → Costs API
    - 집계 방식: 세밀한 토큰 데이터 → 시간 버킷 집계 데이터
    ```

- [ ] **ADD NEW ADR** (after Line 2010): ADR-009: OpenAI Costs API Migration
  ```markdown
  ### ADR-009: OpenAI Costs API Migration

  **날짜**: 2025-01-04
  **상태**: Accepted

  **컨텍스트**:
  OpenAI Usage API (`/v1/usage`)는 project-level API keys만 지원하며, organization-level cost visibility를 제공하지 않음.
  Costs API (`/v1/organization/costs`)는 organization-level Admin Key로 모든 프로젝트 비용을 조회하고 project_ids로 필터링 가능.

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
  - Feature flag: ENABLE_COSTS_API
  - 두 API 병행 운영 가능 (apiVersion으로 구분)
  - Breaking Changes 문서 참조: [BREAKING_CHANGES.md](./migration/BREAKING_CHANGES.md)
  ```

---

### 2. tech-spec-epic-1.md (CRITICAL - 4 hours)

**Priority:** P0 (Epic 1 implementation spec)

#### Section 2.1: Overview
- [ ] **Lines 12-14**: Update Epic description
  - ADD: "...including **Team-level Admin API Key management** and **OpenAI Project ID registration** to support Costs API integration."

#### Section 2.2: Objectives and Scope
- [ ] **Lines 19-27 (In Scope)**: Update Story 1.2, 1.7
  - **Story 1.2**: "OpenAI API 비용 일일 배치 수집" → "**OpenAI Costs API** 비용 일일 배치 수집 (organization-level, project_ids filtering)"
  - **Story 1.7**: "팀별 API 키 생성 및 자동 귀속" → "**팀 Admin API 키 등록 및 프로젝트 ID 관리**"

#### Section 2.3: Services and Modules Table
- [ ] **Lines 69-79**: UPDATE OpenAI Cost Collector row
  - **Responsibility**: "OpenAI API 사용량 일일 수집" → "**OpenAI Costs API** organization 비용 일일 수집 (pagination 지원)"
  - **Inputs**: "API Keys, Date" → "**Admin API Key, Project IDs[], Start Time, End Time**"
  - **Outputs**: "Cost Records" → "**Cost Buckets (time-aggregated, line_item grouped)**"
  - **Owner Story**: "Story 1.2"

- [ ] **Lines 69-79**: UPDATE API Key Manager row
  - **Responsibility**: "API 키 암호화/복호화 (KMS)" → "**Admin API 키 및 Project ID 관리 (KMS)**"
  - **Inputs**: "Plain API Key, Team ID" → "**Plain Admin API Key, Team ID / OpenAI Project ID, Project ID**"
  - **Owner Story**: "Story 1.5, 1.7" → "**Story 1.5, 1.7, 1.10**"

- [ ] **ADD NEW ROW** (after API Key Manager):
  ```markdown
  | **Project ID Validator** | OpenAI Project ID 소속 검증 | Team ID, OpenAI Project ID | Validation Result | Story 1.7 |
  ```

#### Section 2.4: Data Models and Contracts
- [ ] **Lines 85-208**: MAJOR UPDATE - Apply Prisma schema changes from architecture.md Section 1.5
  - ADD OrganizationApiKey model (after Team model)
  - UPDATE Project model (add openaiProjectId)
  - UPDATE CostData model (add Costs API fields)
  - UPDATE Key Relationships section (lines 210-214):
    ```markdown
    **Key Relationships:**
    - Team 1:1 OrganizationApiKey (team-level admin key) **[NEW]**
    - Team 1:N Project (프로젝트 소속)
    - Project 1:N CostData (프로젝트별 비용, openaiProjectId 매핑) **[UPDATED]**
    - CostData.apiVersion로 Usage API vs Costs API 구분 **[NEW]**
    ```

#### Section 2.5: APIs and Interfaces
- [ ] **Lines 241-284 (Project Router)**: ADD new procedures from architecture.md Section 1.6

- [ ] **ADD NEW SECTION** (after Line 284): Team Router
  - Copy team router code from architecture.md Section 1.6

#### Section 2.6: Workflows and Sequencing
- [ ] **Lines 374-388 (Workflow 1: 일일 비용 수집)**: COMPLETE REWRITE
  ```markdown
  **Workflow 1: 일일 비용 수집 (Story 1.2) - Costs API Version**

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
  ```

- [ ] **Lines 439-465 (Workflow 5: 비용-가치 컨텍스트 기록)**: UPDATE
  - **Line 441-443**: ADD "Team Admin이 Admin API Key 등록" step (before 프로젝트 생성)
  - **Line 444**: ADD "프로젝트 생성 후 OpenAI Project ID 등록" step

#### Section 2.7: Acceptance Criteria
- [ ] **Lines 634-639 (Story 1.2 AC)**: REWRITE
  ```markdown
  ### Story 1.2: OpenAI Costs API 비용 일일 배치 수집 시스템
  1. ✅ 시스템은 매일 오전 9시 KST에 **Costs API**를 호출하여 전일 비용 데이터를 가져와야 한다 (FR001)
  2. ✅ 수집된 데이터는 cost_data 테이블에 저장되어야 한다 (**bucketStartTime, bucketEndTime, lineItem, apiVersion='costs_v1'**)
  3. ✅ 홈 화면에 "어제 총 비용" 및 "이번 주 총 비용"이 표시되어야 한다 (**Costs API 데이터 기준**)
  4. ✅ 데이터 수집 실패 시 관리자에게 이메일 알림이 발송되어야 한다
  5. ✅ **Admin API 자격증명은 AES-256으로 암호화되어 저장되어야 한다 (NFR004, OrganizationApiKey 테이블)**
  ```

- [ ] **Lines 669-674 (Story 1.7 AC)**: COMPLETE REWRITE
  ```markdown
  ### Story 1.7: 팀 Admin API 키 등록 및 프로젝트 ID 관리
  1. ✅ Team Settings 페이지에서 OpenAI Organization **Admin API Key**를 등록할 수 있어야 한다 (FR007)
  2. ✅ Admin API Key는 KMS Envelope Encryption으로 암호화되어 **OrganizationApiKey** 테이블에 저장되어야 한다
  3. ✅ Project Settings 페이지에서 **OpenAI Project ID** (proj_xxx)를 등록할 수 있어야 한다
  4. ✅ 시스템은 Project ID가 team의 Admin Key로 접근 가능한지 **검증**해야 한다 (Costs API 테스트 호출)
  5. ✅ 비용 데이터 수집 시 **openai_project_id → internal project_id 매핑**으로 자동 귀속되어야 한다
  ```

#### Section 2.8: Traceability Mapping Table
- [ ] **Lines 694-738**: UPDATE Story 1.2, 1.7 rows
  - **1.2.1**: Component → `cost-collector-v2.ts`
  - **1.2.2**: Data Models → Add "bucketStartTime, lineItem, apiVersion"
  - **1.2.5**: Security → Add "OrganizationApiKey encryption"
  - **1.7.1**: API → `teamRouter.registerAdminApiKey`
  - **1.7.2**: Services → "Admin API Key Manager + Project ID Validator"
  - **1.7.3**: Workflows → "Costs API v2 Collector (project_ids filtering)"
  - **1.7.5**: UX → "Team Settings (Admin Key), Project Settings (Project ID)"

#### Section 2.9: Risks, Assumptions, Open Questions
- [ ] **Lines 744-766 (Risks)**: UPDATE Risk 1
  - **OLD Title**: "OpenAI API 사용량 데이터 지연 (8-24시간)"
  - **NEW Title**: "**Costs API** 데이터 지연 (8-24시간) 및 집계 수준"
  - **ADD 완화 항목**: "line_item 집계로 인해 모델별 세부 데이터 손실 가능 (향후 Usage API 병행 수집 고려)"

- [ ] **ADD NEW RISK** (after Risk 4):
  ```markdown
  **Risk 5: OpenAI Project ID 변경 또는 삭제**
  - **설명**: 사용자가 OpenAI Dashboard에서 Project ID를 변경하거나 삭제하면 비용 수집 실패
  - **영향**: Story 1.2, 1.7 - 해당 프로젝트 비용 데이터 누락
  - **완화**:
    - Costs API 호출 실패 시 Sentry 알림
    - UI에 "Project ID 유효성 재검증" 버튼 제공
    - 에러 발생 프로젝트 자동 비활성화 (관리자 확인 후 재활성화)
  ```

- [ ] **Lines 777-791 (Assumptions)**: ADD new assumption
  ```markdown
  **Assumption 5: Team은 Organization Admin API Key 1개만 사용**
  - **근거**: OrganizationApiKey 모델 unique constraint (teamId)
  - **검증**: Team Settings UI에서 1:1 관계 강제
  ```

---

## Phase 2: Product Requirements (Day 2)

### 3. PRD.md (HIGH - 2 hours)

**Priority:** P1

#### Section 3.1: Functional Requirements
- [ ] **Lines 44-48 (FR001-FR003)**: ADD clarification
  - **FR001**: "OpenAI API 사용량" → "**OpenAI Costs API** 비용 데이터"
  - ADD footnote: "※ Costs API는 organization-level 집계 데이터 제공 (8-24시간 지연)"

- [ ] **Lines 56-57 (FR007)**: MAJOR UPDATE
  ```markdown
  **아키텍처 기반 귀속 (Architecture-based Attribution)**
  - FR007: 시스템은 팀별로 **OpenAI Organization Admin API Key**를 등록하고 관리할 수 있어야 한다
  - **FR007-B (NEW)**: 시스템은 프로젝트별로 **OpenAI Project ID**를 등록하고, Admin Key로 접근 가능한지 검증해야 한다
  - **FR007-C (NEW)**: 비용 수집 시 Admin Key + Project IDs 필터링으로 프로젝트별 비용을 자동 귀속해야 한다 (태그 불필요)
  ```

#### Section 3.2: User Journeys
- [ ] **Lines 128-161 (Primary Journey)**: UPDATE Step 2, 3
  - **Step 2 (상황 파악)**:
    - ADD: "주간 리포트에서 해당 프로젝트의 **OpenAI Project ID** 확인"
  - **Step 3 (즉시 차단)**:
    - OLD: "대시보드에서 '마케팅팀 API 키 비활성화' 버튼 클릭"
    - NEW: "대시보드에서 '**팀 Admin API 키 비활성화**' 버튼 클릭 (전체 팀 프로젝트 중단) 또는 '**프로젝트 Project ID 제거**' (해당 프로젝트만 제외)"

- [ ] **ADD NEW JOURNEY** (after Line 167): Admin Key Setup Journey
  ```markdown
  ### Secondary Journey: Admin API Key 및 Project ID 설정 (Initial Setup)

  **사용자**: FinOps 관리자 (이지훈)
  **목표**: 새 팀의 비용 추적을 위해 OpenAI 연동 설정
  **빈도**: 팀 생성 시 1회 (이후 프로젝트 추가마다 Project ID 등록)

  **여정 흐름**:

  1. **팀 생성** (5분 소요)
     - 이지훈이 "새 팀 생성" 클릭 → "마케팅팀" 입력
     - 시스템이 팀 생성 후 Team Settings 페이지로 리다이렉트

  2. **Admin API Key 등록** (3분 소요)
     - Team Settings → "OpenAI Admin API Key" 섹션
     - OpenAI Dashboard에서 Organization Admin Key 발급 (별도 창)
     - Key 복사 후 입력 (sk-admin-...)
     - "등록" 클릭 → KMS 암호화 후 저장 완료
     - 성공 메시지: "Admin API Key가 등록되었습니다 (ends with ...abc1)"

  3. **프로젝트 생성 및 Project ID 등록** (5분 소요)
     - "새 프로젝트 생성" → "chatbot-experiment" 입력
     - Project Settings → "OpenAI Project ID" 섹션
     - 안내 메시지: "팀의 Admin API Key로 접근 가능한 Project ID를 입력하세요"
     - OpenAI Dashboard에서 Project ID 복사 (proj_abc123...)
     - Project ID 입력 후 "등록" 클릭
     - 시스템이 Costs API로 유효성 검증 (2-3초)
     - 성공 메시지: "Project ID가 등록되었습니다. 내일부터 비용 데이터가 수집됩니다."

  4. **첫 번째 비용 데이터 확인** (다음 날)
     - 다음 날 오전 9시: 일일 배치 실행
     - 프로젝트 대시보드에서 전일 비용 확인
     - Costs API 데이터 기반 차트 표시

  **결과**:
  - ✅ 총 13분 만에 팀-프로젝트 연동 완료
  - ✅ 태그 설정 없이 자동 비용 귀속
  - ✅ Organization-level visibility 확보

  **핵심 터치포인트**:
  - FR007: Team-level Admin API Key 등록
  - FR007-B: Project-level OpenAI Project ID 등록 및 검증
  - FR001: Costs API 일일 배치 수집
  ```

#### Section 3.3: Epic List
- [ ] **Lines 222-239 (Epic 1)**: UPDATE 핵심 기능 목록
  - **Line 229**: "프로젝트 인프라 설정" → "프로젝트 인프라 설정 (Costs API 지원)"
  - **Line 230**: "OpenAI API 비용 일일 배치 수집" → "**OpenAI Costs API** 비용 일일 배치 수집 (organization-level)"
  - **Line 234**: "팀별 API 키 관리 (자동 귀속)" → "**팀 Admin API 키 등록 및 프로젝트 ID 관리** (Costs API 필터링)"

---

### 4. epics.md (HIGH - 2 hours)

**Priority:** P1

#### Section 4.1: Epic 1 Story List
- [ ] **Story 1.2**: REWRITE description and tasks
  ```markdown
  ### Story 1.2: OpenAI Costs API 비용 일일 배치 수집 시스템

  **As a** FinOps 관리자
  **I want** 매일 자동으로 OpenAI Costs API에서 organization 비용 데이터를 수집
  **So that** 팀 전체의 AI 지출을 실시간으로 파악하고 프로젝트별로 분석할 수 있다

  **우선순위**: Must Have
  **예상 시간**: 4시간
  **의존성**: Story 1.1 (인프라), Story 1.7 (Admin API Key)

  #### Acceptance Criteria
  1. Team의 Admin API Key로 Costs API 호출 성공 (organization-level)
  2. project_ids 파라미터로 team의 프로젝트 필터링
  3. Pagination 지원 (has_more, next_page)
  4. Time bucket aggregation 데이터 파싱 (bucketStartTime, bucketEndTime, lineItem)
  5. openai_project_id → internal project_id 매핑
  6. CostData 테이블 저장 (apiVersion='costs_v1', unique_cost_bucket constraint)
  7. 매일 오전 9시 KST Vercel Cron 실행

  #### Implementation Tasks
  - [ ] `src/lib/services/openai/cost-collector-v2.ts` 생성
  - [ ] Costs API client 구현 (fetchOpenAICosts, fetchOpenAICostsComplete)
  - [ ] Pagination 로직 (while loop, next_page)
  - [ ] Time bucket → CostData 변환 (CollectedCostDataV2 타입)
  - [ ] Project ID 매핑 (Map<openaiProjectId, internalProjectId>)
  - [ ] `storeCostDataV2` 함수 (createMany with skipDuplicates)
  - [ ] `src/app/api/cron/daily-batch/route.ts` 업데이트 (v2 호출)
  - [ ] Unit tests (Vitest + MSW)
  - [ ] Integration test (Cron job 수동 트리거)
  ```

- [ ] **Story 1.7**: COMPLETE REWRITE
  ```markdown
  ### Story 1.7: 팀 Admin API 키 등록 및 프로젝트 ID 관리

  **As a** Team Admin
  **I want** OpenAI Organization Admin API Key를 등록하고 프로젝트별 Project ID를 관리
  **So that** Costs API로 organization 전체 비용을 조회하고 프로젝트별로 필터링할 수 있다

  **우선순위**: Must Have
  **예상 시간**: 6시간
  **의존성**: Story 1.1 (KMS 인프라)

  #### Acceptance Criteria
  1. Team Settings 페이지에 "Admin API Key" 등록 UI 구현
  2. Admin API Key KMS 암호화 후 OrganizationApiKey 테이블 저장
  3. Project Settings 페이지에 "OpenAI Project ID" 등록 UI 구현
  4. Project ID 형식 검증 (regex: /^proj_[a-zA-Z0-9_-]+$/)
  5. Project ID 유효성 검증 (Costs API test call with Admin Key)
  6. Project ID uniqueness 검증 (다른 프로젝트에서 이미 사용 중이면 reject)
  7. Team에 Admin Key 없으면 Project ID 등록 불가 (precondition)
  8. Audit log 기록 (admin_api_key_registered, openai_project_id_registered)

  #### Implementation Tasks

  **Backend (tRPC):**
  - [ ] `src/server/api/routers/team.ts` 확장
    - [ ] `registerAdminApiKey` procedure (KMS encryption)
    - [ ] `getAdminApiKeyStatus` procedure
  - [ ] `src/server/api/routers/project.ts` 확장
    - [ ] `registerOpenAIProjectId` procedure
    - [ ] `validateOpenAIProjectId` procedure (Costs API test)
  - [ ] Prisma schema migration (OrganizationApiKey, Project.openaiProjectId)
  - [ ] KMS encryption service 재사용 (api-key-manager.ts)

  **Frontend (UI):**
  - [ ] `src/app/(dashboard)/teams/[id]/settings/page.tsx` 생성
    - [ ] Admin API Key 입력 폼 (password type)
    - [ ] Key status 표시 (last4, isActive)
    - [ ] 등록/업데이트 버튼
  - [ ] `src/app/(dashboard)/projects/[id]/settings/page.tsx` 확장
    - [ ] OpenAI Project ID 입력 폼
    - [ ] Precondition 체크 (Admin Key 존재 여부)
    - [ ] 유효성 검증 로딩 상태 (2-3초)
    - [ ] 에러 핸들링 (invalid format, access denied, duplicate)

  **Testing:**
  - [ ] Unit tests (KMS encryption, Project ID regex)
  - [ ] Integration tests (tRPC procedures)
  - [ ] E2E tests (Admin Key 등록 → Project ID 등록 flow)
  - [ ] Validation script (`scripts/validate-openai-setup.ts`)
  ```

- [ ] **ADD NEW STORY** (after Story 1.7): Story 1.7.1 (optional, if needed)
  ```markdown
  ### Story 1.7.1: Costs API 데이터 검증 및 모니터링 (Optional)

  **As a** Platform Engineer
  **I want** Costs API 수집 데이터의 정합성을 검증
  **So that** Usage API와 Costs API 데이터 차이를 모니터링하고 이상 징후를 조기 발견할 수 있다

  **우선순위**: Should Have
  **예상 시간**: 2시간

  #### Acceptance Criteria
  1. `scripts/test-costs-api.ts` 스크립트 구현 (manual trigger)
  2. Costs API vs Usage API 비용 비교 리포트 생성
  3. 데이터 불일치 시 Slack 알림
  4. Vercel Dashboard에 Costs API 수집 성공률 메트릭 표시

  #### Implementation Tasks
  - [ ] `scripts/test-costs-api.ts` 생성 (CLI tool)
  - [ ] Cost comparison logic (tolerance: ±5%)
  - [ ] Monitoring dashboard (Vercel Analytics + Custom Metrics)
  ```

---

## Phase 3: Implementation Guides (Day 3)

### 5. SETUP.md (MEDIUM - 1 hour)

**Priority:** P2

#### Section 5.1: Environment Variables
- [ ] **ADD** (after AWS KMS variables):
  ```markdown
  # OpenAI Costs API (Team-level Admin Key는 DB에 암호화 저장, 여기는 테스트용)
  OPENAI_ADMIN_API_KEY=sk-admin-... # (Optional) 개발 환경 테스트용
  ```

#### Section 5.2: Database Setup
- [ ] **ADD** (after prisma migrate):
  ```bash
  # OrganizationApiKey 및 Project.openaiProjectId 필드 추가
  bunx prisma migrate dev --name add_costs_api_support
  ```

#### Section 5.3: Initial Data Setup
- [ ] **ADD NEW SECTION**: Admin API Key Registration Guide
  ```markdown
  ### 3. OpenAI Admin API Key 등록

  #### 3.1. OpenAI Dashboard에서 Admin Key 발급
  1. https://platform.openai.com/settings/organization/api-keys 접속
  2. "Create new secret key" → Key type: **Admin** 선택
  3. Key 복사 (sk-admin-...)

  #### 3.2. 시스템에 Admin Key 등록

  **Option A: UI 사용 (권장)**
  1. 로그인 후 Team Settings 페이지 이동
  2. "OpenAI Admin API Key" 섹션에서 key 입력
  3. "등록" 클릭 → KMS 암호화 후 저장

  **Option B: CLI 스크립트 사용**
  ```bash
  bun run scripts/register-admin-key.ts <team-id> <admin-api-key>
  ```

  #### 3.3. Project ID 등록
  1. OpenAI Dashboard → Projects → 원하는 프로젝트 선택
  2. Settings → Project ID 복사 (proj_abc123...)
  3. finops-for-ai Project Settings → "OpenAI Project ID" 입력
  4. "등록" 클릭 → 유효성 검증 (2-3초)

  #### 3.4. 검증
  ```bash
  # Admin Key 복호화 테스트
  bun run scripts/validate-openai-setup.ts <team-id>

  # Costs API 호출 테스트
  bun run scripts/test-costs-api.ts <team-id>
  ```
  ```

#### Section 5.4: Verification
- [ ] **UPDATE** (existing verification section):
  ```markdown
  ### 5. 검증 스크립트

  ```bash
  # 1. OrganizationApiKey 암호화 검증
  bun run scripts/validate-openai-setup.ts

  # 2. Costs API 연동 테스트
  bun run scripts/test-costs-api.ts <team-id>

  # 3. 일일 배치 수동 실행 (Costs API v2)
  curl -X GET http://localhost:3000/api/cron/daily-batch \
    -H "Authorization: Bearer ${CRON_SECRET}"

  # 4. 수집된 데이터 확인 (apiVersion 필터)
  bunx prisma studio
  # → cost_data 테이블에서 api_version='costs_v1' 확인
  ```
  ```

---

### 6. stories/1-2-openai-api-비용-일일-배치-수집-시스템.md (HIGH - 2 hours)

**Priority:** P1

#### Full Rewrite
- [ ] **REPLACE ENTIRE FILE** with Costs API version
  - Title: "Story 1.2: OpenAI **Costs API** 비용 일일 배치 수집 시스템"
  - User Story: Update to reflect organization-level collection
  - Acceptance Criteria: Copy from epics.md Section 4.1 (Story 1.2)
  - Implementation Tasks: Copy from epics.md Section 4.1
  - Technical Details:
    - API Endpoint: `/v1/organization/costs`
    - Parameters: `start_time, end_time, bucket_width=1d, group_by=line_item,project_id, project_ids[], limit, page`
    - Response Structure: `{ data: CostBucket[], has_more, next_page }`
  - Code Snippets: Copy from migration plan (cost-collector-v2.ts)
  - Testing Strategy: Update to Costs API scenarios

---

### 7. stories/1-7-팀별-api-키-생성-및-자동-귀속.md (CRITICAL - 3 hours)

**Priority:** P0

#### Full Rewrite
- [ ] **REPLACE ENTIRE FILE** with Admin Key + Project ID version
  - New Title: "Story 1.7: 팀 Admin API 키 등록 및 프로젝트 ID 관리"
  - User Story: Copy from epics.md Section 4.1 (Story 1.7)
  - Acceptance Criteria: Copy from epics.md Section 4.1
  - Implementation Tasks: Copy from epics.md Section 4.1
  - UI Mockups:
    - Team Settings page (Admin Key input)
    - Project Settings page (Project ID input)
  - Validation Logic:
    - Admin Key format: `sk-admin-...` or `sk-proj-...` (with admin scope)
    - Project ID format: `/^proj_[a-zA-Z0-9_-]+$/`
    - Costs API test call code snippet
  - Error Handling:
    - "Admin Key not found" (precondition failure)
    - "Project ID already registered" (uniqueness)
    - "Access denied" (Admin Key lacks permission for Project ID)
  - Security Considerations:
    - KMS encryption flow diagram
    - Audit log schema

---

### 8. stories/1-10-*.md (if exists) (HIGH - 1 hour)

**Priority:** P1

#### Check and Update
- [ ] Find Story 1.10 file: `find docs/stories -name "*1-10*"`
- [ ] If exists:
  - Update to reflect team-level Admin Key context
  - Add Project ID management to member workflows
  - Update authorization checks (team admin vs project member)
- [ ] If not exists:
  - Create new story file based on architecture.md ADR-008

---

## Cross-Cutting Updates

### 9. All Story Context Files (*.context.xml)

- [ ] **stories/1-2-*.context.xml**: ADD Costs API references
  - Update `<external-apis>` section with Costs API endpoint
  - Add OrganizationApiKey model
  - Update cost-collector.ts → cost-collector-v2.ts

- [ ] **stories/1-4-*.context.xml**: UPDATE (if mentions Usage API)
  - Replace Usage API data structure with Costs API buckets

- [ ] **stories/1-7-*.context.xml**: MAJOR UPDATE
  - Add OrganizationApiKey model
  - Add Project.openaiProjectId field
  - Update team router, project router references

---

## Validation Checklist

### Terminology Consistency
- [ ] Search and replace "Usage API" → "Costs API" (except in migration/BREAKING_CHANGES.md)
- [ ] Search "프로젝트별 API 키" → verify if should be "팀 Admin API 키"
- [ ] Search "api_keys" table → verify if should be "organization_api_keys"

### Code Path Consistency
- [ ] All references to `cost-collector.ts` → check if should be `cost-collector-v2.ts`
- [ ] All `team.generateApiKey` → check if should be `team.registerAdminApiKey`
- [ ] All `project.createApiKey` → check if should be `project.registerOpenAIProjectId`

### Data Model Consistency
- [ ] All Prisma schema blocks match architecture.md Section 1.5
- [ ] All API contracts match architecture.md Section 1.6
- [ ] All workflows match tech-spec-epic-1.md Section 2.6

### Cross-References
- [ ] All migration notes link to `/docs/migration/BREAKING_CHANGES.md`
- [ ] All ADRs reference correct version dates
- [ ] All story files match epics.md descriptions

---

## Timeline Estimation

| Phase | Documents | Est. Time | Dependencies |
|-------|-----------|-----------|--------------|
| **Day 1** | architecture.md, tech-spec-epic-1.md | 8 hours | None (start here) |
| **Day 2** | PRD.md, epics.md, SETUP.md | 5 hours | Phase 1 complete |
| **Day 3** | Story files (1-2, 1-7, 1-10), context files | 6 hours | Phase 2 complete |
| **Validation** | Cross-references, terminology | 2 hours | All phases complete |
| **TOTAL** | 8 documents + context files | ~21 hours | 3 days (parallel work possible) |

---

## Success Criteria

- [ ] All 8 core documents updated
- [ ] Zero references to "Usage API" (except migration docs)
- [ ] All Prisma schemas identical across docs
- [ ] All tRPC contracts identical across docs
- [ ] All workflows reference cost-collector-v2.ts
- [ ] All stories reference OrganizationApiKey and Project.openaiProjectId
- [ ] All cross-references valid (no broken links)
- [ ] Terminology 100% consistent

---

## Notes for AI Agent

**When executing this checklist:**
1. Start with architecture.md (foundational)
2. Use exact code snippets from migration plan where applicable
3. Maintain markdown formatting (headers, code blocks, tables)
4. Preserve existing line numbers in comments for traceability
5. Add "MIGRATION NOTE" callout boxes in each document
6. Update last modified date in each document header
7. Create git commit after each document: `docs: sync {filename} with Costs API migration`

**Quality Gates:**
- Each section rewrite should be self-contained (can be reviewed independently)
- Code snippets must be syntactically valid TypeScript/Prisma
- All links must resolve (check with `find docs -name "*.md" | xargs grep -E "\[.*\]\(.*\)"`)
- Terminology must be consistent (run search-replace validation)

---

_Checklist Generated: 2025-01-04_
_For Migration: Costs API (Usage API → Costs API)_
_Total Sections: 47 individual updates across 8 documents_
