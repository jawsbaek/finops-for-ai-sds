# finops-for-ai - Epic Breakdown

**Author:** Issac
**Date:** 2025-01-04 (Updated for Costs API Migration)
**Original Date:** 2025-10-31
**Project Level:** 2
**Target Scale:** MVP - AI Cost Management Platform

> **🔄 MIGRATION NOTE:** This document has been updated to reflect the OpenAI Costs API migration. Story 1.2 and Story 1.7 have been completely rewritten to support organization-level cost collection using Team Admin API Keys and Project ID filtering. See [BREAKING_CHANGES.md](./migration/BREAKING_CHANGES.md) for migration details.

---

## Overview

This document provides the detailed epic breakdown for finops-for-ai, expanding on the high-level epic list in the [PRD](./PRD.md).

Each epic includes:

- Expanded goal and value proposition
- Complete story breakdown with user stories
- Acceptance criteria for each story
- Story sequencing and dependencies

**Epic Sequencing Principles:**

- Epic 1 establishes foundational infrastructure and initial functionality
- Subsequent epics build progressively, each delivering significant end-to-end value
- Stories within epics are vertically sliced and sequentially ordered
- No forward dependencies - each story builds only on previous work

---

## Epic 1: 프로젝트 기반 및 OpenAI 비용 관리 시스템

**목표**: OpenAI Costs API 비용 추적, 실시간 폭주 방지, 행동 유도 리포트를 통해 즉각적인 가치 제공

**기간**: Week 1-8 (확장됨: 보안 강화 및 최적화 포함)

**예상 스토리 수**: 13개 (기존 9개 + 프로젝트 관리 4개)

**가치 제안**:
- 첫 주부터 OpenAI 비용 가시성 확보 (organization-level visibility)
- 2주차부터 실시간 비용 폭주 방지 가능
- 3주차부터 주간 리포트로 팀별 행동 변화 유도
- 핵심 가설 검증: "비용-가치 연결이 실제 의사결정을 개선하는가?"

**검증 기준**:
- ✅ 최소 1개 팀이 실제 비용 절감 행동 수행
- ✅ 비용 폭주 알림으로 실제 손실 방지 사례 1건 이상

---

### Story 1.1: 프로젝트 인프라 및 기본 인증 구축

**As a** 시스템 관리자,
**I want** 안전한 프로젝트 인프라와 기본 사용자 인증을 구축하고,
**So that** 팀원들이 안전하게 시스템에 접근하고 비용 데이터를 관리할 수 있다.

**Acceptance Criteria:**
1. PostgreSQL 데이터베이스가 구축되고, users, projects, api_keys 테이블이 생성되어야 한다
2. 이메일/비밀번호 기반 회원가입 및 로그인 API가 작동해야 한다 (JWT 토큰 발급)
3. 기본 웹 UI가 배포되어야 한다 (로그인 페이지, 홈 화면 뼈대)
4. HTTPS 연결이 설정되어야 한다 (TLS 1.3, NFR005)
5. CI/CD 파이프라인이 구축되어 코드 푸시 시 자동 테스트 및 배포가 되어야 한다

**Prerequisites:** 없음 (첫 번째 스토리)

**Technical Notes:**
- Stack: Node.js/Express (또는 Python/FastAPI), React/Next.js
- Database: PostgreSQL with encryption at rest
- Hosting: AWS/Azure/GCP 중 선택
- Auth: bcrypt for password hashing, JWT for session management

---

### Story 1.2: OpenAI Costs API 비용 일일 배치 수집 시스템

**As a** FinOps 관리자,
**I want** 매일 자동으로 OpenAI Costs API에서 organization 비용 데이터를 수집하여,
**So that** 팀 전체의 AI 지출을 실시간으로 파악하고 프로젝트별로 분석할 수 있다.

**우선순위:** Must Have
**예상 시간:** 4시간
**의존성:** Story 1.1 (인프라), Story 1.7 (Admin API Key)

**Acceptance Criteria:**
1. Team의 Admin API Key로 Costs API 호출 성공 (organization-level)
2. project_ids 파라미터로 team의 프로젝트 필터링
3. Pagination 지원 (has_more, next_page 처리)
4. Time bucket aggregation 데이터 파싱 (bucketStartTime, bucketEndTime, lineItem)
5. openai_project_id → internal project_id 매핑
6. CostData 테이블 저장 (apiVersion='costs_v1', unique_cost_bucket constraint)
7. 매일 오전 9시 KST Vercel Cron 실행

**Implementation Tasks:**
- [ ] `src/lib/services/openai/cost-collector-v2.ts` 생성
  - [ ] Costs API client 구현 (fetchOpenAICosts, fetchOpenAICostsComplete)
  - [ ] Pagination 로직 (while loop, next_page)
  - [ ] Time bucket → CostData 변환 (CollectedCostDataV2 타입)
- [ ] Project ID 매핑 로직 (Map<openaiProjectId, internalProjectId>)
- [ ] `storeCostDataV2` 함수 (createMany with skipDuplicates)
- [ ] `src/app/api/cron/daily-batch/route.ts` 업데이트 (v2 호출)
- [ ] Unit tests (Vitest + MSW)
  - [ ] Costs API response parsing
  - [ ] Pagination handling
  - [ ] Project ID mapping edge cases
- [ ] Integration test (Cron job 수동 트리거)

**Prerequisites:** Story 1.1 (인프라 및 데이터베이스), Story 1.7 (Admin API Key 등록)

**Technical Notes:**
- OpenAI Costs API: `/v1/organization/costs` endpoint (requires Admin API key)
- Scheduler: Vercel Cron jobs (9am KST daily)
- Error handling: Retry logic with exponential backoff
- Data structure: Time-bucketed aggregated costs with line_item grouping
- Pagination: max 180 buckets per request, uses next_page cursor

**API Details:**
```
GET https://api.openai.com/v1/organization/costs
Headers:
  Authorization: Bearer {ADMIN_API_KEY}
Query:
  start_time: Unix timestamp (전일 00:00)
  end_time: Unix timestamp (전일 23:59)
  bucket_width: 1d
  group_by: line_item,project_id
  project_ids[]: proj_abc123,proj_def456
  limit: 180
  page: {next_page_cursor}
```

---

### Story 1.3: 비용-가치 컨텍스트 기록 시스템

**As a** 프로젝트 관리자,
**I want** 각 API 호출에 대해 프로젝트명, 작업 유형, 의도를 함께 기록하여,
**So that** 단순 비용이 아닌 "무엇을 위해 지출했는가"를 이해할 수 있다.

**Acceptance Criteria:**
1. 시스템은 API 키 생성 시 프로젝트명을 필수로 입력받아야 한다 (FR007)
2. 시스템은 API 호출 로그에 컨텍스트 메타데이터를 기록할 수 있는 구조를 제공해야 한다 (FR002)
3. 프로젝트 상세 페이지에서 "총 비용"과 함께 "주요 작업 유형별 비용 분포"를 표시해야 한다
4. 사용자가 프로젝트별로 "성과 메트릭"을 입력할 수 있어야 한다 (예: 성공한 작업 수, 사용자 피드백 점수)
5. 프로젝트 상세 페이지에서 "비용 대비 성과" 차트를 표시해야 한다 (FR003)

**Prerequisites:** Story 1.2 (비용 데이터 수집)

**Technical Notes:**
- Context tracking: Custom header or SDK wrapper for OpenAI calls
- Metrics schema: Flexible JSON field for different project types
- Visualization: Simple bar chart (cost vs. success count)

---

### Story 1.4: 실시간 비용 임계값 모니터링 및 알림

**As a** FinOps 관리자,
**I want** 프로젝트별 일일/주간 비용 임계값을 설정하고 초과 시 즉시 알림을 받아,
**So that** 비용 폭주를 조기에 발견하고 신속히 대응할 수 있다.

**Acceptance Criteria:**
1. 프로젝트 설정 페이지에서 일일/주간 비용 임계값을 설정할 수 있어야 한다 (FR004)
2. 시스템은 OpenAI Costs API 비용 데이터를 5분마다 확인하여 임계값 초과 여부를 검사해야 한다
3. 임계값 초과 시 1분 이내에 Slack 및 이메일 알림을 발송해야 한다 (NFR002, FR004)
4. 알림 메시지는 "프로젝트명, 현재 비용, 임계값, 초과율"을 포함해야 한다
5. 알림 메시지에 "상세 보기" 링크가 포함되어 대시보드로 즉시 이동할 수 있어야 한다

**Prerequisites:** Story 1.2 (비용 데이터 수집)

**Technical Notes:**
- Polling frequency: Every 5 minutes via scheduled job
- Notification channels: Slack webhook, SendGrid/AWS SES for email
- Alert throttling: Max 1 alert per hour per project to avoid spam

---

### Story 1.5: 긴급 API 키 비활성화 메커니즘

**As a** FinOps 관리자,
**I want** 비용 폭주 발생 시 해당 프로젝트의 API 키를 즉시 비활성화하여,
**So that** 추가 비용 손실을 즉시 차단할 수 있다.

**Acceptance Criteria:**
1. 프로젝트 상세 페이지에 "API 키 비활성화" 버튼이 표시되어야 한다
2. 비활성화 버튼 클릭 시 확인 팝업이 표시되어야 한다 ("이 키를 사용하는 모든 애플리케이션이 중단됩니다")
3. 확인 시 시스템은 해당 API 키를 즉시 비활성화 상태로 변경해야 한다 (FR005)
4. 비활성화된 API 키 사용 시도는 시스템에서 차단되어야 한다
5. API 키 비활성화 이벤트는 audit_log 테이블에 기록되어야 한다 (누가, 언제, 왜)

**Prerequisites:** Story 1.3 (API 키 관리 기반)

**Technical Notes:**
- Implementation: Middleware to check api_key status before proxying to OpenAI
- Reactivation: Manual process requiring admin approval
- Logging: All disable/enable events for audit trail

---

### Story 1.6: 주간 리포트 생성 및 발송

**As a** 팀 리더,
**I want** 매주 자동으로 비용 효율성 리포트를 받아,
**So that** 어떤 프로젝트가 잘하고 있고 어디를 개선해야 하는지 파악할 수 있다.

**Acceptance Criteria:**
1. 시스템은 매주 월요일 오전 9시 KST에 주간 리포트를 자동 생성해야 한다 (FR006)
2. 리포트는 "가장 비용 효율적인 프로젝트 Top 3" 및 "개선 필요 프로젝트 Top 3"를 포함해야 한다
3. 각 프로젝트에 대해 "총 비용, 비용 대비 성과, 전주 대비 증감률"을 표시해야 한다
4. 리포트는 이메일로 모든 등록된 사용자에게 발송되어야 한다
5. 리포트는 웹 대시보드 "리포트 아카이브" 섹션에도 저장되어야 한다

**Prerequisites:** Story 1.3 (비용-가치 컨텍스트)

**Technical Notes:**
- Ranking algorithm: Cost efficiency = (Success count / Total cost)
- Email template: Responsive HTML with charts
- Archive: Store as JSON + rendered HTML for historical reference

---

### Story 1.7: 팀 Admin API 키 등록 및 프로젝트 ID 관리

**As a** Team Admin,
**I want** OpenAI Organization Admin API Key를 등록하고 프로젝트별 Project ID를 관리하여,
**So that** Costs API로 organization 전체 비용을 조회하고 프로젝트별로 필터링할 수 있다.

**우선순위:** Must Have
**예상 시간:** 6시간
**의존성:** Story 1.1 (KMS 인프라)

**Acceptance Criteria:**
1. Team Settings 페이지에 "Admin API Key" 등록 UI 구현
2. Admin API Key KMS 암호화 후 OrganizationApiKey 테이블 저장
3. Project Settings 페이지에 "OpenAI Project ID" 등록 UI 구현
4. Project ID 형식 검증 (regex: /^proj_[a-zA-Z0-9_-]+$/)
5. Project ID 유효성 검증 (Costs API test call with Admin Key)
6. Project ID uniqueness 검증 (다른 프로젝트에서 이미 사용 중이면 reject)
7. Team에 Admin Key 없으면 Project ID 등록 불가 (precondition)
8. Audit log 기록 (admin_api_key_registered, openai_project_id_registered)

**Implementation Tasks:**

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

**Prerequisites:** Story 1.1 (KMS 인프라)

**Technical Notes:**
- OrganizationApiKey model: team-level, unique constraint on teamId
- KMS Envelope Encryption: AES-256-GCM with AWS KMS
- Project ID validation: Test Costs API call with Admin Key + single Project ID
- Precondition enforcement: UI checks team.organizationApiKey existence before allowing Project ID registration
- Error messages: Korean language for all validation failures

**Data Models:**
```prisma
// Team-level OpenAI Organization Admin API Key
model OrganizationApiKey {
  id               String   @id @default(cuid())
  teamId           String   @unique @map("team_id")
  provider         String   // 'openai'
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

model Project {
  // ... existing fields ...
  openaiProjectId String? @unique @map("openai_project_id")

  @@index([openaiProjectId])
}
```

---

### Story 1.8: 긴급 조치용 기본 웹 대시보드

**As a** FinOps 관리자,
**I want** 비용 현황을 한눈에 파악하고 긴급 조치를 취할 수 있는 대시보드를,
**So that** 알림 받은 후 즉시 상황을 이해하고 대응할 수 있다.

**Acceptance Criteria:**
1. 홈 화면에 "전일/전주/전월 총 비용" 카드가 표시되어야 한다 (Costs API 데이터 기준)
2. 홈 화면에 "주요 프로젝트 비용 Top 5" 차트가 표시되어야 한다
3. 프로젝트 상세 페이지에 비용 추이 그래프(최근 30일)가 표시되어야 한다
4. 프로젝트 상세 페이지에서 임계값 설정 및 API 키 비활성화가 가능해야 한다
5. 대시보드 초기 로딩 시간은 3초 이내여야 한다 (NFR001)

**Prerequisites:** Story 1.7 (모든 데이터 수집 및 기능 완성)

**Technical Notes:**
- UI library: Recharts or Chart.js for visualization
- Performance: Server-side rendering + caching for fast load
- Mobile: Responsive design for tablet/mobile access
- Data source: Costs API aggregated data (apiVersion='costs_v1')

---

### Story 1.9: Epic 1 통합 테스트 및 검증

**As a** 품질 보증 엔지니어,
**I want** 모든 Epic 1 기능이 통합되어 정상 작동하는지 확인하고,
**So that** 사용자에게 안정적인 OpenAI 비용 관리 시스템을 제공할 수 있다.

**Acceptance Criteria:**
1. 엔드투엔드 시나리오 테스트가 성공해야 한다 (회원가입 → Admin Key 등록 → Project ID 등록 → 비용 수집 → 알림 → 비활성화)
2. 시스템 가동률이 99.5% 이상이어야 한다 (NFR003, 최근 7일 기준)
3. 실제 사용자 1개 팀이 파일럿 테스트를 완료하고 피드백을 제공해야 한다
4. 모든 보안 요구사항이 충족되어야 한다 (TLS 1.3, AES-256 암호화, NFR004/NFR005)
5. 검증 기준 달성: 비용 폭주 알림으로 실제 손실 방지 사례 1건 이상 기록

**Prerequisites:** Story 1.1 ~ 1.8 (모든 Epic 1 스토리)

**Technical Notes:**
- Test framework: Cypress for E2E, Jest for unit/integration
- Monitoring: Set up Datadog/New Relic for uptime tracking
- Pilot user: Recruit from internal teams or friendly customers

---

### Story 1.10: 프로젝트 멤버 및 API 키 관리 UI

**As a** 프로젝트 관리자,
**I want** 프로젝트 멤버를 추가/제거하고 API 키의 전체 생명주기를 관리할 수 있는 UI를,
**So that** 프로젝트별 접근 권한과 API 키를 효율적으로 통제할 수 있다.

**Acceptance Criteria:**
1. 프로젝트 상세 페이지에 "프로젝트 멤버" 섹션이 표시되어야 한다
2. 현재 프로젝트 멤버 목록이 카드 형태로 표시되어야 하며, 멤버 추가/제거가 가능해야 한다
3. "멤버 추가" 모달에서 팀 멤버 드롭다운으로 사용자를 선택할 수 있어야 한다 (이미 추가된 멤버는 비활성화)
4. 프로젝트 상세 페이지에 "API 키 관리" 섹션이 표시되어야 한다
5. API 키 추가 모달에서 provider 선택 및 API 키 입력이 가능해야 한다 (password 타입 마스킹)
6. OpenAI API 키는 "sk-"로 시작하는지 클라이언트 측에서 검증해야 한다
7. API 키 상태에 따라 "활성화", "차단", "영구 삭제" 버튼이 표시되어야 한다
8. 차단/삭제 시 type-to-confirm 다이얼로그(사유 입력 + 확인 텍스트 입력)가 표시되어야 한다
9. 모든 API 키 작업(생성, 차단, 활성화, 삭제)이 audit log에 기록되어야 한다
10. 모든 작업 중 로딩 상태가 명확히 표시되고, 성공/실패 시 toast 알림이 표시되어야 한다

**Prerequisites:** Story 1.7, Story 1.8

**Status:** ✅ COMPLETED (2025-11-03)

**Technical Notes:**
- Backend APIs: `project.enableApiKey`, `project.deleteApiKey`, `team.getMembers`
- Frontend Components: `AddMemberDialog`, `AddApiKeyDialog`, `ConfirmDeleteKeyDialog`
- Permission model: Team admin for member management, project member for API key management
- See detailed documentation: `docs/stories/1-10-프로젝트-멤버-및-api-키-관리-ui.md`

---

### Story 1.11: 보안 강화 - API 키 노출 방지 및 Rate Limiting

**As a** 보안 관리자,
**I want** API 키 노출 위험을 제거하고 민감한 작업에 rate limiting을 적용하여,
**So that** 시스템이 보안 공격과 남용으로부터 보호될 수 있다.

**Acceptance Criteria:**
1. Prisma schema에 `ApiKey.last4` 필드가 추가되어야 한다 (String, indexed)
2. API 키 생성 시 last4 값을 계산하여 저장해야 한다
3. API 키 조회 시 `encryptedKey`를 반환하지 않고 `last4`만 반환해야 한다
4. Upstash Redis 기반 rate limiting이 구현되어야 한다
5. 민감한 mutations(API 키 생성/차단/활성화/삭제, 멤버 추가/제거)에 10 req/min 제한이 적용되어야 한다
6. 일반 조회 operations에 100 req/min 제한이 적용되어야 한다
7. Rate limit 초과 시 명확한 한국어 에러 메시지가 반환되어야 한다
8. 모든 사용자 입력(사유, 프로젝트명 등)에 sanitization이 적용되어야 한다 (XSS 방지)
9. 보안 테스트(rate limiting, XSS, API key exposure)가 통과해야 한다

**Prerequisites:** Story 1.10

**Priority:** 🔴 CRITICAL

**Technical Notes:**
- Database migration: Add `last4` field + index
- Libraries: `@upstash/ratelimit`, `sanitize-html`
- Rate limit middleware: IP-based + User ID-based dual limiting
- See detailed documentation: `docs/stories/1-11-보안-강화-api-키-노출-방지-및-rate-limiting.md`

---

### Story 1.12: 성능 최적화 - 쿼리 최적화 및 인덱스 추가

**As a** 시스템 사용자,
**I want** 프로젝트 상세 페이지와 멤버 관리 기능이 빠르게 로드되어,
**So that** 대기 시간 없이 효율적으로 작업할 수 있다.

**Acceptance Criteria:**
1. `team.getMembers` 쿼리가 단일 쿼리로 최적화되어야 한다 (permission check 통합)
2. `project.getMembers` 쿼리가 최적화되어야 한다 (N+1 query 제거)
3. 프로젝트 상세 페이지 초기 로딩이 병렬 쿼리로 최적화되어야 한다 (query waterfall 해결)
4. Database indexes가 추가되어야 한다:
   - `ProjectMember`: `userId`, `(projectId, userId)`
   - `ApiKey`: `(projectId, isActive)`
   - `AuditLog`: `userId`, `(resourceType, resourceId)`, `actionType`, `createdAt`
5. React Query staleTime이 적절히 설정되어야 한다 (멤버: 5분, API 키: 1분)
6. 페이지 로딩 시간이 50% 이상 단축되어야 한다 (600ms → 200ms)
7. Database connection pool이 최적화되어야 한다 (connection_limit=20)
8. Prisma query logging으로 쿼리 수 감소 확인 (before: 2 queries → after: 1 query)

**Prerequisites:** Story 1.10

**Priority:** 🟡 MEDIUM

**Technical Notes:**
- Single query optimization: Fetch all data + in-memory permission check
- Indexes: Compound indexes for join queries
- Server-side prefetch: `createServerSideHelpers` for parallel data fetching
- See detailed documentation: `docs/stories/1-12-성능-최적화-쿼리-최적화-및-인덱스-추가.md`

---

### Story 1.13: 국제화 및 데이터 무결성 개선

**As a** 한국어 사용자,
**I want** 모든 에러 메시지와 시스템 메시지가 한국어로 표시되고 데이터 무결성이 보장되어,
**So that** 일관된 사용자 경험과 신뢰할 수 있는 시스템을 이용할 수 있다.

**Acceptance Criteria:**
1. `src/lib/error-messages.ts` 파일이 생성되어 모든 에러 메시지가 한국어로 관리되어야 한다
2. 모든 backend 에러 메시지가 한국어로 변환되어야 한다 (`team.ts`: 5개, `project.ts`: 12개)
3. Zod validation 에러 메시지도 한국어로 설정되어야 한다
4. Critical operations(API 키 차단/활성화/삭제)에 transaction이 적용되어야 한다
5. Audit log 생성과 실제 작업이 atomic transaction으로 실행되어야 한다
6. 모든 string 입력에 max length 제한이 설정되어야 한다 (reason: 500자, name: 100자)
7. 프론트엔드에도 동일한 validation이 적용되어 즉각적 피드백을 제공해야 한다
8. 에러 로깅이 표준화되어야 한다 (`src/lib/logger.ts` 사용)
9. 모든 에러 시나리오에서 한국어 메시지가 표시되는지 테스트되어야 한다

**Prerequisites:** Story 1.10

**Priority:** 🟢 LOW

**Technical Notes:**
- Error message constants: Centralized in `error-messages.ts`
- Transaction pattern: `db.$transaction([auditLog.create, apiKey.delete])`
- Validation: Zod schema with Korean error messages
- Frontend validation: `react-hook-form` + `zodResolver`
- See detailed documentation: `docs/stories/1-13-국제화-및-데이터-무결성-개선.md`

---

## Epic 2: 클라우드 확장 및 검증 루프

**목표**: AWS/Azure 통합으로 적용 범위 확대, 사용자 행동 측정을 통한 제품 개선 방향 확정

**기간**: Week 7-12

**예상 스토리 수**: 6개

**가치 제안**:
- OpenAI 외 AWS/Azure AI 서비스 비용 통합 관리
- 아키텍처 격리 권고로 태그 의존성 제거
- 사용자 행동 데이터 기반으로 Phase 2 우선순위 결정
- 핵심 가설 검증: "추가 클라우드 통합이 실제 가치를 더하는가?"

**검증 기준**:
- ✅ Phase 2 기능 우선순위가 사용자 투표로 결정됨
- ✅ 행동 추적 데이터로 리포트 효과성 정량화

---

### Story 2.1: 클라우드 제공사 선택 UI 및 기본 통합

**As a** 시스템 관리자,
**I want** AWS 또는 Azure 중 하나를 선택하여 통합할 수 있는 UI를,
**So that** 우리 조직이 사용하는 클라우드의 AI 비용을 추적할 수 있다.

**Acceptance Criteria:**
1. 설정 페이지에 "클라우드 제공사 선택" 섹션이 추가되어야 한다 (AWS 또는 Azure 라디오 버튼)
2. AWS 선택 시 "AWS Access Key ID, Secret Access Key, Region" 입력 필드가 표시되어야 한다
3. Azure 선택 시 "Subscription ID, Client ID, Client Secret, Tenant ID" 입력 필드가 표시되어야 한다
4. 자격증명 저장 시 AES-256으로 암호화되어야 한다 (NFR004)
5. "연결 테스트" 버튼으로 API 접근 가능 여부를 확인할 수 있어야 한다 (FR008)

**Prerequisites:** Epic 1 완료

**Technical Notes:**
- AWS SDK: boto3 (Python) or aws-sdk (Node.js)
- Azure SDK: azure-identity, azure-mgmt-costmanagement
- Validation: Call Cost Explorer API (AWS) or Cost Management API (Azure) to verify

---

### Story 2.2: AWS/Azure AI 비용 일일 배치 수집

**As a** FinOps 관리자,
**I want** 선택한 클라우드(AWS 또는 Azure)의 AI 서비스 비용을 매일 수집하여,
**So that** OpenAI와 클라우드 AI 비용을 한곳에서 확인할 수 있다.

**Acceptance Criteria:**
1. 시스템은 매일 오전 9시 KST에 선택된 클라우드의 전일 AI 서비스 비용을 수집해야 한다 (FR009)
2. AWS의 경우 SageMaker, Bedrock, Lex, Comprehend, Rekognition 비용을 수집해야 한다
3. Azure의 경우 Azure OpenAI, Cognitive Services, Machine Learning 비용을 수집해야 한다
4. 수집된 데이터는 cloud_cost_data 테이블에 저장되어야 한다 (날짜, 서비스명, 비용)
5. 홈 화면에 "전일 총 비용 (OpenAI + 클라우드)" 통합 표시가 추가되어야 한다

**Prerequisites:** Story 2.1 (클라우드 통합 기반)

**Technical Notes:**
- AWS: Cost Explorer API with service filter (8-24hr delay documented)
- Azure: Cost Management API with filter (similar delay)
- Data model: Unified schema for multi-source costs

---

### Story 2.3: 아키텍처 격리 권고 기능

**As a** 클라우드 아키텍트,
**I want** 팀별 리소스 격리 아키텍처 권고를 받아,
**So that** 태그 없이도 자동으로 비용이 팀에 귀속되도록 설계할 수 있다.

**Acceptance Criteria:**
1. "아키텍처 권고" 페이지가 추가되어야 한다
2. AWS 사용자에게 "팀별 AWS 계정 분리" 가이드를 제공해야 한다 (Organizations 사용)
3. Azure 사용자에게 "프로젝트별 리소스 그룹 격리" 가이드를 제공해야 한다
4. 각 권고에 "왜 태그보다 격리가 좋은가" 설명이 포함되어야 한다 (FR010)
5. 권고 페이지에서 "아키텍처 리뷰 요청" 버튼으로 1:1 컨설팅을 요청할 수 있어야 한다

**Prerequisites:** Story 2.2 (클라우드 비용 수집)

**Technical Notes:**
- Content: Markdown-based documentation
- Consultation: Email form to schedule architecture review
- Examples: Real-world case studies of account isolation benefits

---

### Story 2.4: 사용자 비용 절감 행동 추적 시스템

**As a** 제품 관리자,
**I want** 사용자가 실제로 비용 절감 행동을 하는지 추적하여,
**So that** 우리 제품이 실제 가치를 제공하는지 검증할 수 있다.

**Acceptance Criteria:**
1. 시스템은 다음 행동을 추적해야 한다: API 키 변경, 프로젝트 중단, 임계값 조정, 모델 변경 (FR012)
2. 각 행동에 대해 "행동 전 7일 평균 비용"과 "행동 후 7일 평균 비용"을 계산해야 한다
3. "행동 변화 리포트" 페이지에서 전체 사용자의 비용 절감 효과를 집계해야 한다
4. 주간 리포트에 "이번 주 비용 절감 행동 수" 및 "총 절감 금액"이 추가되어야 한다
5. 관리자 대시보드에서 "리포트 효과성 메트릭"을 확인할 수 있어야 한다 (읽은 사용자 중 행동한 비율)

**Prerequisites:** Story 1.6 (주간 리포트 기반)

**Technical Notes:**
- Event tracking: Log all user actions with before/after snapshots
- Analysis: 7-day window comparison for statistical significance
- Privacy: Aggregate data only for admin view, individual data for user's own view

---

### Story 2.5: 피드백 수집 및 기능 투표 UI

**As a** 제품 관리자,
**I want** 사용자로부터 직접 피드백을 수집하고 다음 필요 기능을 투표받아,
**So that** Phase 2 로드맵을 데이터 기반으로 결정할 수 있다.

**Acceptance Criteria:**
1. 대시보드 상단에 "피드백 남기기" 버튼이 추가되어야 한다
2. 피드백 폼은 "만족도(1-5점), 가장 유용한 기능, 개선 필요 사항, 다음 필요 기능" 필드를 포함해야 한다 (FR013)
3. "다음 필요 기능" 투표 페이지가 추가되어야 한다 (Phase 2 후보 기능 목록에서 선택)
4. 투표 결과는 관리자 대시보드에서 "기능별 득표 수 및 순위"로 표시되어야 한다
5. "사용자 인터뷰 예약" 버튼으로 Calendly 등 일정 조율 도구와 연동되어야 한다

**Prerequisites:** Epic 1 완료 (사용자가 제품을 경험한 후)

**Technical Notes:**
- Survey tool: Custom form or integrate with Typeform/Google Forms
- Voting: Simple upvote system with user authentication
- Interview scheduling: Calendly embed or similar tool

---

### Story 2.6: Phase 1C 검증 및 Phase 2 로드맵 결정

**As a** 제품 관리자,
**I want** Phase 1 전체 데이터를 분석하고 Phase 2 우선순위를 결정하여,
**So that** 사용자 니즈에 기반한 다음 개발 계획을 수립할 수 있다.

**Acceptance Criteria:**
1. 검증 리포트가 생성되어야 한다: 총 사용자 수, 활성 사용자 수, 총 비용 절감 금액, 비용 폭주 방지 사례 수
2. Phase 1 검증 기준이 충족되었는지 확인해야 한다 (Epic 1, Epic 2 검증 기준)
3. 기능 투표 결과 기반 Phase 2 우선순위가 문서화되어야 한다 (Top 5 기능 선정)
4. 사용자 인터뷰 인사이트가 요약되어야 한다 (주요 페인 포인트, 요청 사항)
5. Phase 2 PRD 작성을 위한 핸드오프 문서가 생성되어야 한다

**Prerequisites:** Story 2.4, 2.5 (행동 추적 및 피드백 수집 완료)

**Technical Notes:**
- Analysis period: Full 12 weeks of Phase 1 data
- Report format: Executive summary + detailed metrics + user quotes
- Handoff: Document template for next PRD cycle

---

## Story Guidelines Reference

**Story Format:**

```
**Story [EPIC.N]: [Story Title]**

As a [user type],
I want [goal/desire],
So that [benefit/value].

**Acceptance Criteria:**
1. [Specific testable criterion]
2. [Another specific criterion]
3. [etc.]

**Prerequisites:** [Dependencies on previous stories, if any]
```

**Story Requirements:**

- **Vertical slices** - Complete, testable functionality delivery
- **Sequential ordering** - Logical progression within epic
- **No forward dependencies** - Only depend on previous work
- **AI-agent sized** - Completable in 2-4 hour focused session
- **Value-focused** - Integrate technical enablers into value-delivering stories

---

## Summary

**Stories Rewritten:** 2 (Story 1.2, Story 1.7)
**New AC Count:**
- Story 1.2: 7 criteria (up from 5)
- Story 1.7: 8 criteria (completely new structure)

**Implementation Tasks Count:**
- Story 1.2: 6 major tasks + testing
- Story 1.7: 8 backend tasks + 4 frontend tasks + 4 testing tasks

**Dependencies Added:**
- Story 1.2 now depends on Story 1.7 (Admin API Key required)

**Key Changes:**
1. Story 1.2 completely rewritten for Costs API (organization-level collection with pagination)
2. Story 1.7 completely rewritten for Team Admin API Key + Project ID management
3. All AC aligned with tech-spec-epic-1-v2.md
4. Implementation tasks split between backend (tRPC) and frontend (UI)
5. Time estimates updated: Story 1.2 (4 hours), Story 1.7 (6 hours)

**For implementation:** Use the `create-story` workflow to generate individual story implementation plans from this epic breakdown.
