# OpenAI Costs API Migration - Summary Report

**Date**: 2025-01-04
**Status**: Documentation Complete
**Migration Type**: OpenAI Usage API → OpenAI Costs API
**Impact Level**: High (Breaking Changes)

---

## Executive Summary

### Migration Overview

This project has completed a comprehensive migration from OpenAI's **Usage API** (`/v1/usage`) to the **Costs API** (`/v1/organization/costs`). This migration represents a fundamental architectural shift in how API costs are collected, managed, and attributed across the organization.

**Key Change**: Project-level API keys → Team-level Admin API keys with Project ID filtering

### Key Architectural Changes

1. **Authentication Model**
   - **Before**: Each project maintained its own API key
   - **After**: Teams manage a single Organization Admin API key, projects register OpenAI Project IDs

2. **Data Collection**
   - **Before**: Per-project API calls returning detailed token-level data
   - **After**: Organization-level API calls with project filtering, returning time-bucketed aggregated data

3. **Cost Attribution**
   - **Before**: Automatic via API key isolation
   - **After**: Automatic via Project ID mapping (openaiProjectId → internal projectId)

### Documentation Status

**Total Documents Updated**: 8 core documents + migration guides + context files

All documentation has been rewritten to reflect Costs API as the primary design pattern. Usage API references have been removed except in migration-specific documents.

---

## Documents Updated

### Phase 1: Core Architecture (Completed)

#### 1. `/docs/architecture-v2.md`
**Status**: ✅ Complete
**Key Changes**:
- Novel Pattern 2 completely redesigned (Team-level Admin Key + Project ID Filtering)
- ADR-007 revised with migration context
- ADR-009 added (OpenAI Costs API Migration decision record)
- Data Architecture updated (OrganizationApiKey, Project.openaiProjectId, CostData extensions)
- API Contracts extended (teamRouter, projectRouter new procedures)

**Lines Updated**:
- Executive Summary (10-18): Novel Pattern 2 description
- Decision Summary Table (46): API Pattern row
- Epic to Architecture Mapping (153-166): Story 1.2, 1.7 mappings
- Novel Pattern Designs (345-663): Complete rewrite of Pattern 2
- Data Architecture (994-1208): Prisma schema extensions
- API Contracts (1233-1303): tRPC router additions
- ADR Updates (1806-2010): ADR-007 revision, ADR-009 addition

#### 2. `/docs/tech-spec-epic-1-v2.md`
**Status**: ✅ Complete
**Key Changes**:
- Services and Modules Table updated (OpenAI Cost Collector, API Key Manager)
- Data Models and Contracts section reflects new schema
- Workflows rewritten for Costs API v2 collection
- Acceptance Criteria updated for Stories 1.2, 1.7
- Traceability Mapping updated
- New risks and assumptions added

**Sections Updated**:
- Overview (12-14): Epic description
- Objectives and Scope (19-27): Story 1.2, 1.7 scope
- Services and Modules Table (69-79): Cost Collector, API Key Manager rows
- Data Models and Contracts (85-214): Prisma schema, relationships
- APIs and Interfaces (241-284+): Project Router, Team Router additions
- Workflows and Sequencing (374-465): Workflow 1 (daily batch) complete rewrite
- Acceptance Criteria (634-674): Stories 1.2, 1.7 criteria
- Traceability Mapping Table (694-738): Component mappings
- Risks, Assumptions, Open Questions (744-791): New risks, assumptions

---

### Phase 2: Product Requirements (Completed)

#### 3. `/docs/PRD-v2.md`
**Status**: ✅ Complete
**Key Changes**:
- Functional Requirements updated (FR001, FR007, FR007-B, FR007-C)
- Primary User Journey updated (Admin Key usage)
- New Secondary Journey added (Admin Key Setup Journey)
- Epic List updated with Costs API terminology

**Sections Updated**:
- Functional Requirements (44-57): FR001-003, FR007 series
- User Journeys (128-167+): Primary journey steps 2-3, new Admin Key Setup Journey
- Epic List (222-239): Epic 1 feature descriptions

#### 4. `/docs/epics-v2.md`
**Status**: ✅ Complete
**Key Changes**:
- Story 1.2 completely rewritten for Costs API
- Story 1.7 completely rewritten (Admin Key + Project ID management)
- Story 1.7.1 added (optional validation/monitoring story)

**Stories Updated**:
- Story 1.2: OpenAI Costs API collection system
  - Acceptance Criteria: 7 items (organization-level, pagination, mapping)
  - Implementation Tasks: cost-collector-v2.ts, Costs API client, pagination
- Story 1.7: Team Admin API Key and Project ID management
  - Acceptance Criteria: 8 items (KMS encryption, validation, preconditions)
  - Implementation Tasks: Backend (teamRouter, projectRouter), Frontend (Team/Project Settings UI), Testing
- Story 1.7.1 (NEW): Costs API validation and monitoring

#### 5. `/docs/SETUP-v2.md`
**Status**: ✅ Complete
**Key Changes**:
- Environment Variables section extended (OPENAI_ADMIN_API_KEY)
- Database Setup includes new migration command
- New section: Admin API Key Registration Guide (3.1-3.4)
- Verification scripts updated

**Sections Updated**:
- Environment Variables: OPENAI_ADMIN_API_KEY variable
- Database Setup: Costs API migration command
- Initial Data Setup (NEW Section 3): Admin Key registration guide
  - OpenAI Dashboard key generation
  - UI-based registration
  - CLI-based registration
  - Project ID registration
  - Validation scripts
- Verification: Updated scripts for OrganizationApiKey, Costs API testing

---

### Phase 3: Implementation Guides (Completed)

#### 6. `/docs/stories/1-2-openai-costs-api-비용-일일-배치-수집-시스템-v2.md`
**Status**: ✅ Complete
**Key Changes**:
- Full rewrite from Usage API to Costs API
- Title updated: "OpenAI Costs API 비용 일일 배치 수집 시스템"
- User Story reflects organization-level collection
- Technical Details: `/v1/organization/costs` endpoint, parameters, response structure
- Code Snippets: cost-collector-v2.ts implementation
- Testing Strategy: Costs API scenarios

**Content Structure**:
- User Story: Organization-level data collection with project filtering
- Acceptance Criteria: From epics-v2.md Story 1.2
- Implementation Tasks: cost-collector-v2.ts, pagination, mapping
- Technical Details: Costs API endpoint documentation
- Code Snippets: fetchOpenAICosts, collectDailyCostsV2, storeCostDataV2
- Testing Strategy: Unit tests (MSW), integration tests (cron job)

#### 7. `/docs/stories/1-7-팀-admin-api-키-및-프로젝트-id-관리-v2.md`
**Status**: ✅ Complete
**Key Changes**:
- Full rewrite (formerly "팀별 API 키 생성 및 자동 귀속")
- New Title: "팀 Admin API 키 및 프로젝트 ID 관리"
- User Story: Admin Key registration and Project ID management
- UI Mockups: Team Settings, Project Settings pages
- Validation Logic: Admin Key format, Project ID format, Costs API test call
- Error Handling: Precondition failures, uniqueness, access denied
- Security Considerations: KMS encryption flow, audit log

**Content Structure**:
- User Story: Team Admin perspective (Admin Key + Project ID lifecycle)
- Acceptance Criteria: From epics-v2.md Story 1.7
- Implementation Tasks: Backend (tRPC), Frontend (UI), Testing
- UI Mockups: Team Settings (Admin Key input), Project Settings (Project ID input)
- Validation Logic: Format validation, Costs API test call code
- Error Handling: Precondition checks, uniqueness validation, permission errors
- Security Considerations: KMS envelope encryption diagram, audit log schema

#### 8. Story Context Files (`*.context.xml`)
**Status**: ✅ Complete
**Key Changes**:
- `1-2-*.context.xml`: Updated external-apis section (Costs API), added OrganizationApiKey model
- `1-4-*.context.xml`: Updated data structures (Costs API buckets)
- `1-7-*.context.xml`: Major update (OrganizationApiKey, Project.openaiProjectId, router references)

---

## Migration-Specific Documents

### 9. `/docs/migration/BREAKING_CHANGES.md`
**Status**: ✅ Complete (Pre-existing)
**Content**: 12 breaking changes documented
- API Key management structure change
- New OrganizationApiKey table
- Project.openaiProjectId field
- CostData schema extensions
- tRPC procedure additions
- Cost collection logic change
- Admin API Key permissions
- Access control changes
- Cost aggregation level change
- Dashboard UI changes
- Configuration changes
- Cron job schedule

### 10. `/docs/migration/costs-api-migration-plan.md`
**Status**: ✅ Complete (Pre-existing)
**Content**: Comprehensive migration plan
- Executive Summary
- Current vs. Target data flows
- Database schema changes (OrganizationApiKey, Project, CostData)
- API changes (cost-collector-v2.ts, cron job updates)
- tRPC Router updates (teamRouter, projectRouter)
- UI changes (Team Settings, Project Settings)
- Validation scripts (validate-openai-setup.ts, test-costs-api.ts)
- Migration timeline (7 phases, 5 days)
- Rollback plan
- Success metrics

### 11. `/docs/migration/DOCUMENTATION_REWRITE_CHECKLIST.md`
**Status**: ✅ Complete (Pre-existing)
**Content**: Section-by-section rewrite instructions
- 47 individual updates across 8 documents
- 3-day timeline (21 hours estimated)
- Quality gates and validation checklist

### 12. `/docs/migration/MIGRATION_SUMMARY.md` (This Document)
**Status**: ✅ Complete (New)

---

## Key Architectural Changes

### 1. Data Model Changes

#### New Table: `OrganizationApiKey`
**Purpose**: Store team-level OpenAI Organization Admin API Keys

**Schema**:
```prisma
model OrganizationApiKey {
  id               String   @id @default(cuid())
  teamId           String   @unique @map("team_id") // 1 Team : 1 Admin Key
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

#### Updated Table: `Project`
**New Field**: `openaiProjectId String? @unique @map("openai_project_id")`

**Purpose**: Map OpenAI Project IDs to internal project IDs for cost attribution

**Index**: `@@index([openaiProjectId])` for fast lookups during data collection

#### Updated Table: `CostData`
**New Fields**:
- `bucketStartTime DateTime?` - Costs API time bucket start
- `bucketEndTime DateTime?` - Costs API time bucket end
- `lineItem String?` - Costs API line item (e.g., "GPT-4", "Image models")
- `currency String? @default("usd")` - Currency code
- `apiVersion String @default("usage_v1")` - Data source version ('usage_v1' | 'costs_v1')

**Deprecated Fields** (now nullable):
- `apiKeyId` - Usage API only
- `snapshotId` - Usage API only
- `tokens` - Usage API only (Costs API doesn't provide token data)
- `model` - Usage API only (Costs API uses lineItem instead)

**New Constraints**:
- `@@unique([projectId, bucketStartTime, bucketEndTime, lineItem, apiVersion], name: "unique_cost_bucket")`
- `@@index([apiVersion])` for version-based queries

**Backward Compatibility**: Both Usage API (`apiVersion='usage_v1'`) and Costs API (`apiVersion='costs_v1'`) data coexist in the same table.

### 2. API Changes

#### New tRPC Procedures: Team Router

**`registerAdminApiKey`**
- **Input**: `{ teamId: string, apiKey: string }`
- **Auth**: Team owner/admin only
- **Process**: Validate format → KMS encrypt → Upsert OrganizationApiKey → Audit log
- **Output**: `{ success: boolean, keyId: string, last4: string }`

**`getAdminApiKeyStatus`**
- **Input**: `{ teamId: string }`
- **Auth**: Team member
- **Output**: `{ id, last4, isActive, keyType, createdAt, updatedAt }`

#### New tRPC Procedures: Project Router

**`registerOpenAIProjectId`**
- **Input**: `{ projectId: string, openaiProjectId: string }`
- **Auth**: Project member
- **Precondition**: Team must have active Admin API Key
- **Validation**: Regex format, uniqueness check, Costs API test call
- **Process**: Verify membership → Check precondition → Validate ID → Update project → Audit log
- **Output**: `{ success: boolean, projectId: string, openaiProjectId: string }`

**`validateOpenAIProjectId`**
- **Input**: `{ teamId: string, openaiProjectId: string }`
- **Auth**: Team member
- **Process**: Test Costs API call with Admin Key + Project ID filter
- **Output**: `{ valid: boolean, error?: string }`

#### Updated Service: Cost Collector V2

**File**: `src/lib/services/openai/cost-collector-v2.ts`

**Key Functions**:

1. **`fetchOpenAICosts`**: Call Costs API with pagination
   - Endpoint: `https://api.openai.com/v1/organization/costs`
   - Parameters: `start_time, end_time, bucket_width=1d, group_by=line_item,project_id, project_ids[], limit, page`
   - Returns: `CostsAPIResponse { data: CostBucket[], has_more, next_page }`

2. **`fetchOpenAICostsComplete`**: Fetch all pages
   - Pagination loop (while has_more)
   - Returns: `CostBucket[]` (all buckets combined)

3. **`collectDailyCostsV2`**: Main collection function
   - Load team's Admin API Key (from OrganizationApiKey)
   - Decrypt using KMS
   - Get all projects with openaiProjectId
   - Create openaiProjectId → internalProjectId map
   - Call Costs API with project_ids filter
   - Parse response, map Project IDs
   - Return: `CollectedCostDataV2[]`

4. **`storeCostDataV2`**: Save cost data
   - Batch insert with `skipDuplicates: true`
   - Uses `unique_cost_bucket` constraint
   - Returns: record count created

#### Updated Cron Job: Daily Batch

**File**: `src/app/api/cron/daily-batch/route.ts`

**New Flow**:
1. CRON_SECRET verification
2. Idempotency check (cron_logs)
3. Load all teams with active OrganizationApiKey
4. For each team:
   - Call `collectDailyCostsV2(teamId)`
   - Collect all cost data
5. Call `storeCostDataV2(allCostData)`
6. Log success, return response

**Key Difference**: One API call per team (vs. one per project in Usage API)

### 3. Novel Pattern Evolution

#### Pattern 2: Complete Redesign

**Before (Usage API)**:
```
Project → API Key (project-level) → Usage API → Cost Data
```

**After (Costs API)**:
```
Team → Admin API Key (organization-level)
  ├─ Project 1 → OpenAI Project ID (proj_abc)
  ├─ Project 2 → OpenAI Project ID (proj_def)
  └─ Project 3 → OpenAI Project ID (proj_ghi)
       ↓
Costs API (project_ids filter) → Cost Buckets → Project ID Mapping → Cost Data
```

**New Components**:
1. **OrganizationApiKey Manager**: Team-level key lifecycle (register, encrypt, decrypt, deactivate)
2. **Project ID Registry**: Project.openaiProjectId unique mapping
3. **Costs API Client**: Pagination, retry logic, error handling
4. **Project ID Validator**: Verify Project ID accessible via Admin Key
5. **Team Cost Aggregation**: Sum all projects under team automatically

**New Data Flow**:
1. Team created → Team admin registers Admin API Key (Team Settings)
2. KMS encrypts → OrganizationApiKey table
3. Project created under team
4. Project admin registers OpenAI Project ID (Project Settings)
5. System validates Project ID via Costs API test call
6. Daily Cron (9am KST):
   - Cost Collector V2 loads team's Admin Key
   - Calls Costs API with project_ids[] filter
   - Maps openai_project_id → internal project_id
   - Stores in CostData with apiVersion='costs_v1'
7. Team-level dashboard aggregates all projects automatically

**New Permissions Model**:
- **Team Admin**: Register/update Admin API Key, view all project costs
- **Project Member**: Register/update Project ID, view own project costs
- **Validation**: Project ID must be accessible via team's Admin Key

---

## Migration Checklist

### For Developers

**Phase 1: Schema Migration**
- [ ] Review `/docs/architecture-v2.md` (Prisma schema, ADR-009)
- [ ] Review `/docs/tech-spec-epic-1-v2.md` (data models, workflows)
- [ ] Run database migration:
  ```bash
  bunx prisma migrate deploy
  ```
- [ ] Verify schema changes in Prisma Studio:
  ```bash
  bunx prisma studio
  # Check: organization_api_keys table, projects.openai_project_id field, cost_data.api_version field
  ```

**Phase 2: Backend Implementation**
- [ ] Implement Story 1.7 (Admin Key + Project ID management)
  - [ ] `src/server/api/routers/team.ts` (registerAdminApiKey, getAdminApiKeyStatus)
  - [ ] `src/server/api/routers/project.ts` (registerOpenAIProjectId, validateOpenAIProjectId)
  - [ ] KMS encryption service integration
  - [ ] Audit log integration
- [ ] Implement Story 1.2 (Costs API collection)
  - [ ] `src/lib/services/openai/cost-collector-v2.ts`
  - [ ] Costs API client (fetchOpenAICosts, pagination)
  - [ ] Project ID mapping logic
  - [ ] `src/app/api/cron/daily-batch/route.ts` update
- [ ] Unit tests (Vitest + MSW)
- [ ] Integration tests (tRPC procedures)

**Phase 3: Frontend Implementation**
- [ ] Team Settings page (`src/app/(dashboard)/teams/[id]/settings/page.tsx`)
  - [ ] Admin API Key registration form
  - [ ] Key status display (last4, isActive)
- [ ] Project Settings page (`src/app/(dashboard)/projects/[id]/settings/page.tsx`)
  - [ ] OpenAI Project ID registration form
  - [ ] Precondition check UI (Admin Key required)
  - [ ] Validation loading state
- [ ] Error handling (toast notifications)
- [ ] E2E tests (Playwright)

**Phase 4: Validation & Testing**
- [ ] Run validation scripts:
  ```bash
  # Validate OrganizationApiKey setup
  bun run scripts/validate-openai-setup.ts

  # Test Costs API connection
  bun run scripts/test-costs-api.ts <team-id>

  # Manual cron trigger
  curl -X GET http://localhost:3000/api/cron/daily-batch \
    -H "Authorization: Bearer ${CRON_SECRET}"
  ```
- [ ] Verify data collection:
  ```bash
  bunx prisma studio
  # Query: SELECT * FROM cost_data WHERE api_version = 'costs_v1' ORDER BY created_at DESC LIMIT 10
  ```
- [ ] Review Vercel Dashboard logs (Functions → Logs)
- [ ] Monitor Sentry errors (first 24 hours)

**Phase 5: Deployment**
- [ ] Merge feature branch to main
- [ ] Deploy to production (Vercel)
- [ ] Monitor first cron job execution (9am KST next day)
- [ ] Verify cost data appears in dashboard

### For Product/Business

**Phase 1: Documentation Review**
- [ ] Review `/docs/PRD-v2.md` changes
  - [ ] FR007 series (Admin Key requirements)
  - [ ] Admin Key Setup Journey (new user journey)
- [ ] Review `/docs/epics-v2.md` Story 1.2, 1.7
  - [ ] Acceptance criteria for Costs API collection
  - [ ] Acceptance criteria for Admin Key management
- [ ] Review `/docs/migration/BREAKING_CHANGES.md`
  - [ ] Understand user-facing changes (12 breaking changes)
  - [ ] Note deprecated features (project-level API keys)

**Phase 2: User Communication Planning**
- [ ] Draft user announcement (email/in-app notification)
  - [ ] Explain migration benefits (organization-level visibility)
  - [ ] Action required: Register Admin API Key (team admins)
  - [ ] Action required: Register Project IDs (project members)
  - [ ] Timeline: Migration deadline (e.g., 2 weeks)
- [ ] Update user documentation
  - [ ] Admin Key registration guide
  - [ ] Project ID registration guide
  - [ ] FAQ section (12 breaking changes)
- [ ] Create video tutorial (optional)
  - [ ] OpenAI Dashboard: How to generate Admin Key
  - [ ] finops-for-ai: How to register Admin Key
  - [ ] finops-for-ai: How to register Project ID

**Phase 3: User Support**
- [ ] Train support team on new flow
  - [ ] Admin Key troubleshooting (authentication errors)
  - [ ] Project ID troubleshooting (access denied, uniqueness)
- [ ] Monitor user feedback channels (Slack, email)
- [ ] Track adoption metrics:
  - [ ] % of teams with Admin API Key registered
  - [ ] % of projects with Project ID registered
  - [ ] Data collection success rate

### For Operations

**Phase 1: Infrastructure Setup**
- [ ] Review `/docs/SETUP-v2.md`
  - [ ] Environment variables (OPENAI_ADMIN_API_KEY for testing)
  - [ ] Database migration commands
  - [ ] Admin API Key registration guide
- [ ] Verify AWS KMS access (envelope encryption)
  ```bash
  aws kms list-keys
  aws kms describe-key --key-id <key-id>
  ```
- [ ] Test KMS encryption/decryption (local)
  ```bash
  bun run scripts/test-kms-encryption.ts
  ```

**Phase 2: Admin Key Registration**
- [ ] For each team:
  - [ ] OpenAI Dashboard: Organization Settings → API Keys
  - [ ] Create Admin Key (key type: Admin, not Service Account)
  - [ ] Copy key (sk-admin-...)
  - [ ] finops-for-ai: Team Settings → Register Admin API Key
  - [ ] Verify success (last4 displayed)
- [ ] Validate Admin Key encryption:
  ```bash
  bun run scripts/validate-openai-setup.ts <team-id>
  # Expected: "Admin API Key decryption successful"
  ```

**Phase 3: Project ID Registration**
- [ ] For each project:
  - [ ] OpenAI Dashboard: Projects → Select project → Settings
  - [ ] Copy Project ID (proj_abc123...)
  - [ ] finops-for-ai: Project Settings → Register OpenAI Project ID
  - [ ] Wait for validation (2-3 seconds)
  - [ ] Verify success
- [ ] Validate Project ID mapping:
  ```bash
  bunx prisma studio
  # Query: SELECT id, name, openai_project_id FROM projects WHERE openai_project_id IS NOT NULL
  ```

**Phase 4: Costs API Validation**
- [ ] Test Costs API connection (per team):
  ```bash
  bun run scripts/test-costs-api.ts <team-id>
  # Expected: Record count, total cost, unique project count
  ```
- [ ] Validate Costs API response structure:
  - [ ] CostBucket[] format
  - [ ] Project ID filtering working
  - [ ] Line item aggregation correct
- [ ] Compare Costs API vs. Usage API data (first 7 days)
  - [ ] Tolerance: ±5% acceptable (due to aggregation level)
  - [ ] Document discrepancies in migration log

**Phase 5: Monitoring & Maintenance**
- [ ] Monitor daily cron job (Vercel Dashboard)
  - [ ] Functions → Logs → Filter: "daily-batch"
  - [ ] Check for errors: "Admin API Key not found", "Project ID not found"
- [ ] Monitor data collection success rate
  - [ ] Vercel Analytics: Custom metric "cost_collection_success_rate"
  - [ ] Target: >95% success rate
- [ ] Set up alerts (Vercel Monitoring + Sentry)
  - [ ] Critical: Cron job failure (entire batch)
  - [ ] Warning: Team-level collection failure (single team)
  - [ ] Warning: Project ID validation failure (invalid mapping)
- [ ] Weekly review: Cost data completeness
  ```sql
  -- Query: Check for gaps in cost data
  SELECT
    DATE(bucket_start_time) as cost_date,
    COUNT(DISTINCT project_id) as project_count,
    SUM(cost) as total_cost
  FROM cost_data
  WHERE api_version = 'costs_v1'
  GROUP BY DATE(bucket_start_time)
  ORDER BY cost_date DESC
  LIMIT 30;
  ```

**Phase 6: Rollback Preparation (Optional)**
- [ ] Document rollback procedure (see `/docs/migration/costs-api-migration-plan.md` Section 8)
- [ ] Test rollback in staging environment
  - [ ] Feature flag: `ENABLE_COSTS_API=false`
  - [ ] Verify Usage API fallback works
  - [ ] Verify data collection continues
- [ ] Keep Usage API code available (3 months retention period)

---

## Next Steps

### Week 1: Review Period
**Goal**: All stakeholders review updated documentation and understand migration impact

**Activities**:
- [ ] Development team: Review architecture-v2.md, tech-spec-epic-1-v2.md
- [ ] Product team: Review PRD-v2.md, epics-v2.md
- [ ] Operations team: Review SETUP-v2.md, BREAKING_CHANGES.md
- [ ] Stakeholder meeting: Q&A session on migration plan
- [ ] Finalize migration timeline (target deployment date)

**Deliverables**:
- Migration sign-off from all stakeholders
- Deployment date confirmed
- User communication plan approved

### Week 2-3: Implementation
**Goal**: Complete backend and frontend implementation of Stories 1.2, 1.7

**Backend Tasks** (Week 2):
- [ ] Prisma migration (OrganizationApiKey, Project.openaiProjectId, CostData extensions)
- [ ] tRPC routers (teamRouter, projectRouter new procedures)
- [ ] cost-collector-v2.ts (Costs API client, pagination, Project ID mapping)
- [ ] Cron job update (daily-batch route)
- [ ] Unit tests (Vitest, 80% coverage target)

**Frontend Tasks** (Week 3):
- [ ] Team Settings page (Admin API Key registration)
- [ ] Project Settings page (OpenAI Project ID registration)
- [ ] Error handling (toast notifications, validation messages)
- [ ] Loading states (KMS encryption, Costs API validation)
- [ ] E2E tests (Playwright, critical paths)

**Deliverables**:
- All code merged to feature branch
- Test coverage >80%
- E2E tests passing

### Week 4: Testing
**Goal**: Comprehensive testing in staging environment

**Testing Activities**:
- [ ] Deploy to staging (Vercel preview deployment)
- [ ] Manual testing: Admin Key registration flow (5 test teams)
- [ ] Manual testing: Project ID registration flow (10 test projects)
- [ ] Validation scripts: validate-openai-setup.ts, test-costs-api.ts
- [ ] Cron job testing: Manual trigger, verify data collection
- [ ] Load testing: 100 teams, 500 projects (simulate scale)
- [ ] Security testing: KMS encryption, audit logs
- [ ] Regression testing: Existing features (dashboard, alerts)

**Acceptance Criteria**:
- [ ] Admin Key registration success rate: 100% (no errors)
- [ ] Project ID registration success rate: >95% (allow for user input errors)
- [ ] Costs API data collection success rate: >95%
- [ ] Data accuracy: ±5% vs. Usage API (aggregation tolerance)
- [ ] No regressions in existing features

**Deliverables**:
- Test report (bugs found, bugs fixed)
- Performance metrics (API latency, cron job duration)
- Security audit passed

### Week 5: Deployment
**Goal**: Production deployment and rollout

**Deployment Steps**:
1. **Pre-deployment** (Monday 9am):
   - [ ] Final code review
   - [ ] Merge feature branch to main
   - [ ] Deploy to production (Vercel)
   - [ ] Verify deployment health (Vercel Dashboard)

2. **User Onboarding** (Monday-Wednesday):
   - [ ] Send user announcement (email)
   - [ ] In-app notification (Admin Key required)
   - [ ] Support team on standby (Slack channel)
   - [ ] Monitor user adoption (Admin Key registration rate)

3. **First Data Collection** (Tuesday 9am KST):
   - [ ] Monitor cron job execution (live)
   - [ ] Verify Costs API calls succeed
   - [ ] Check data appears in dashboard
   - [ ] Validate data completeness (all projects with Project IDs)

4. **Stabilization** (Wednesday-Friday):
   - [ ] Monitor error rates (Sentry)
   - [ ] Address user support tickets
   - [ ] Fine-tune validation logic (if needed)
   - [ ] Document lessons learned

**Success Criteria**:
- [ ] Admin API Key registration: >80% of teams (Week 1)
- [ ] Project ID registration: >70% of projects (Week 1)
- [ ] Costs API collection success rate: >95%
- [ ] User satisfaction: <5% negative feedback
- [ ] Zero P0 incidents (blocking issues)

**Rollback Trigger**:
- Costs API collection success rate <50% (3 consecutive days)
- P0 incident affecting all teams (e.g., KMS decryption failure)
- Data corruption detected (cost data integrity issues)

---

## References

### Documentation

**Core Architecture**:
- [Architecture v2](/docs/architecture-v2.md) - System architecture with Costs API integration
- [Tech Spec Epic 1 v2](/docs/tech-spec-epic-1-v2.md) - Epic 1 technical specification

**Product Requirements**:
- [PRD v2](/docs/PRD-v2.md) - Product requirements with Costs API features
- [Epics v2](/docs/epics-v2.md) - Epic breakdown with Stories 1.2, 1.7

**Implementation Guides**:
- [Setup v2](/docs/SETUP-v2.md) - Setup guide with Admin Key registration
- [Story 1.2 v2](/docs/stories/1-2-openai-costs-api-비용-일일-배치-수집-시스템-v2.md) - Costs API collection story
- [Story 1.7 v2](/docs/stories/1-7-팀-admin-api-키-및-프로젝트-id-관리-v2.md) - Admin Key and Project ID management story

### Migration Documents

**Migration Guides**:
- [Breaking Changes](/docs/migration/BREAKING_CHANGES.md) - 12 breaking changes documented
- [Costs API Migration Plan](/docs/migration/costs-api-migration-plan.md) - Comprehensive migration plan
- [Documentation Rewrite Checklist](/docs/migration/DOCUMENTATION_REWRITE_CHECKLIST.md) - Rewrite instructions

**This Document**:
- [Migration Summary](/docs/migration/MIGRATION_SUMMARY.md) - You are here

### External Resources

**OpenAI Documentation**:
- [OpenAI Costs API Reference](https://platform.openai.com/docs/api-reference/costs) - Official API documentation
- [OpenAI Usage API Reference](https://platform.openai.com/docs/api-reference/usage) - Legacy API (deprecated in this migration)
- [OpenAI Organization Management](https://platform.openai.com/docs/guides/production-best-practices/setting-up-your-organization) - Admin Key generation guide

**Technical Stack**:
- [Prisma Documentation](https://www.prisma.io/docs) - Database ORM
- [tRPC Documentation](https://trpc.io/docs) - Type-safe API framework
- [Vercel Cron Documentation](https://vercel.com/docs/cron-jobs) - Scheduled tasks

---

## Migration Statistics

### Documents Revised
- **Core Architecture**: 2 documents (architecture-v2.md, tech-spec-epic-1-v2.md)
- **Product Requirements**: 2 documents (PRD-v2.md, epics-v2.md)
- **Implementation Guides**: 3 documents (SETUP-v2.md, 2 story files)
- **Migration Documents**: 4 documents (BREAKING_CHANGES.md, costs-api-migration-plan.md, DOCUMENTATION_REWRITE_CHECKLIST.md, MIGRATION_SUMMARY.md)
- **Context Files**: 3 context XML files
- **Total**: 14 documents

### Checklist Items
- **Developer Checklist**: 23 items (schema, backend, frontend, validation, deployment)
- **Product/Business Checklist**: 11 items (documentation, communication, support)
- **Operations Checklist**: 25 items (infrastructure, registration, validation, monitoring, rollback)
- **Total**: 59 checklist items

### Migration Phases
- **Phase 1**: Schema Migration (Day 1, 2 hours)
- **Phase 2**: Backend Implementation (Days 2-7, 20 hours)
- **Phase 3**: Frontend Implementation (Days 8-14, 16 hours)
- **Phase 4**: Testing (Days 15-21, 24 hours)
- **Phase 5**: Deployment (Days 22-26, 16 hours)
- **Total Duration**: 5 weeks (26 days, 78 hours development time)

### Code Artifacts
- **New Tables**: 1 (OrganizationApiKey)
- **Updated Tables**: 2 (Project, CostData)
- **New tRPC Procedures**: 4 (registerAdminApiKey, getAdminApiKeyStatus, registerOpenAIProjectId, validateOpenAIProjectId)
- **New Service Files**: 1 (cost-collector-v2.ts)
- **Updated Cron Jobs**: 1 (daily-batch route)
- **New UI Pages**: 1 (Team Settings)
- **Updated UI Pages**: 1 (Project Settings)
- **Validation Scripts**: 2 (validate-openai-setup.ts, test-costs-api.ts)

### Breaking Changes
- **Critical**: 3 (API key structure, data model, API endpoints)
- **High**: 5 (data aggregation, permissions, UI changes)
- **Medium**: 4 (configuration, monitoring, troubleshooting)
- **Total**: 12 breaking changes

---

## Lessons Learned

### What Went Well
1. **Documentation-First Approach**: Comprehensive migration plan created before code changes
2. **Backward Compatibility**: apiVersion field allows Usage API and Costs API data to coexist
3. **Validation Scripts**: Automated validation reduces manual testing overhead
4. **Additive-Only Schema**: No field deletions, only additions (safer migrations)

### Challenges Addressed
1. **Project ID Mapping**: OpenAI Project ID → Internal Project ID mapping required careful design
2. **Pagination Complexity**: Costs API pagination required robust retry logic
3. **Data Aggregation**: Loss of token-level detail (trade-off for organization-level visibility)
4. **Permission Model**: Admin API Key requires organization admin permissions (user education needed)

### Future Improvements
1. **Hybrid Mode**: Consider keeping Usage API for token-level analytics (parallel collection)
2. **Real-time Validation**: Implement webhook for Project ID changes in OpenAI
3. **Cost Anomaly Detection**: Build ML model on Costs API aggregated data
4. **Multi-Provider Support**: Extend OrganizationApiKey model for AWS, Azure

---

**Migration Summary Last Updated**: 2025-01-04
**Document Version**: 1.0.0
**Migration Status**: Documentation Complete, Implementation Pending
