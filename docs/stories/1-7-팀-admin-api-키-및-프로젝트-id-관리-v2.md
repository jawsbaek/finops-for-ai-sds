# Story 1.7: 팀 Admin API 키 등록 및 프로젝트 ID 관리

**Status:** ready-for-dev

**Date Created:** 2025-01-04 (Migration Version)
**Original Story:** 1-7-팀별-api-키-생성-및-자동-귀속.md
**Migration Context:** OpenAI Costs API Migration - Team-level Admin Key + Project ID Filtering

---

## Story

**As a** Team Admin,
**I want** OpenAI Organization Admin API Key를 등록하고 프로젝트별 Project ID를 관리하여,
**So that** Costs API로 organization 전체 비용을 조회하고 프로젝트별로 필터링할 수 있다.

**우선순위:** Must Have
**예상 시간:** 6시간
**의존성:** Story 1.1 (KMS 인프라)

---

## Acceptance Criteria

1. ✅ Team Settings 페이지에 "Admin API Key" 등록 UI 구현
2. ✅ Admin API Key KMS 암호화 후 OrganizationApiKey 테이블 저장
3. ✅ Project Settings 페이지에 "OpenAI Project ID" 등록 UI 구현
4. ✅ Project ID 형식 검증 (regex: `/^proj_[a-zA-Z0-9_-]+$/`)
5. ✅ Project ID 유효성 검증 (Costs API test call with Admin Key)
6. ✅ Project ID uniqueness 검증 (다른 프로젝트에서 이미 사용 중이면 reject)
7. ✅ Team에 Admin Key 없으면 Project ID 등록 불가 (precondition)
8. ✅ Audit log 기록 (admin_api_key_registered, openai_project_id_registered)

---

## Implementation Tasks

### Backend (8 tasks)

#### Task 1: Prisma Schema 확장
- [ ] `prisma/schema.prisma` 수정
  - [ ] OrganizationApiKey 모델 추가
  - [ ] Team 모델에 organizationApiKey 관계 추가
  - [ ] Project 모델에 openaiProjectId 필드 추가
  - [ ] CostData 모델에 Costs API 필드 추가 (bucketStartTime, lineItem, apiVersion)
- [ ] 마이그레이션 생성 및 실행: `bunx prisma migrate dev --name add_costs_api_support`

#### Task 2: Team tRPC Router - Admin API Key 관리
- [ ] `src/server/api/routers/team.ts` 생성 또는 확장
  - [ ] `registerAdminApiKey` procedure 구현
    - [ ] 팀 멤버십 확인 (owner/admin만 허용)
    - [ ] API 키 형식 검증 (sk-admin- 또는 sk-proj- with admin scope)
    - [ ] KMS envelope encryption
    - [ ] OrganizationApiKey upsert
    - [ ] Audit log 생성
  - [ ] `getAdminApiKeyStatus` procedure 구현
    - [ ] 팀 멤버십 확인
    - [ ] Admin Key 상태 조회 (last4, isActive, keyType, createdAt)

#### Task 3: Project tRPC Router - Project ID 관리
- [ ] `src/server/api/routers/project.ts` 확장
  - [ ] `registerOpenAIProjectId` procedure 구현
    - [ ] 프로젝트 멤버십 확인
    - [ ] Precondition: Team에 Admin Key 존재 확인
    - [ ] Project ID 형식 검증 (regex)
    - [ ] Uniqueness 검증
    - [ ] Project 업데이트
    - [ ] Audit log 생성
  - [ ] `validateOpenAIProjectId` procedure 구현
    - [ ] Costs API 테스트 호출 (Admin Key + Project ID)
    - [ ] 접근 가능 여부 검증
    - [ ] 에러 처리 (invalid, access denied)

#### Task 4: API Key Manager Service 확장
- [ ] `src/lib/services/encryption/api-key-manager.ts` 확장
  - [ ] validateApiKey 함수 업데이트
    - [ ] OpenAI Admin Key 형식 검증 (sk-admin-, sk-proj-)
    - [ ] Project ID 형식 검증 추가
  - [ ] encryptApiKey 함수 (기존 KMS 래퍼 재사용)
  - [ ] decryptApiKey 함수
  - [ ] maskApiKey 함수 (last4만 표시)

#### Task 5: Costs API Test Validator
- [ ] `src/lib/services/openai/costs-api-validator.ts` 생성
  - [ ] testCostsAPIAccess 함수
    - [ ] Admin Key로 Costs API 호출
    - [ ] project_ids 파라미터로 단일 Project ID 테스트
    - [ ] 성공/실패 여부 반환
    - [ ] 에러 메시지 매핑 (403, 404, 500)

#### Task 6: Database Indexes 추가
- [ ] OrganizationApiKey 인덱스
  - [ ] `@@index([teamId])`
  - [ ] `@@index([provider, isActive])`
- [ ] Project 인덱스
  - [ ] `@@index([openaiProjectId])`
- [ ] CostData 인덱스
  - [ ] `@@index([apiVersion])`
  - [ ] `@@unique([projectId, bucketStartTime, bucketEndTime, lineItem, apiVersion])`

#### Task 7: Error Handling 및 Logging
- [ ] 모든 tRPC procedures에 try-catch 추가
- [ ] Sentry 통합 (API 키 관련 에러)
- [ ] Audit log 표준화
  - [ ] actionType: admin_api_key_registered, openai_project_id_registered
  - [ ] metadata: teamId, last4, openaiProjectId

#### Task 8: Root tRPC Router 업데이트
- [ ] `src/server/api/root.ts` 수정
  - [ ] teamRouter 추가
  - [ ] Export appRouter 업데이트

---

### Frontend (4 tasks)

#### Task 9: Team Settings Page - Admin API Key UI
- [ ] `src/app/(dashboard)/teams/[id]/settings/page.tsx` 생성
  - [ ] Admin API Key 입력 폼
    - [ ] Input type="password" (마스킹)
    - [ ] Validation: 최소 20자
    - [ ] Placeholder: "sk-admin-..."
  - [ ] Key status 표시
    - [ ] 등록 여부 Alert
    - [ ] Last4, isActive, createdAt
  - [ ] 등록/업데이트 버튼
    - [ ] Loading state (Loader2 spinner)
    - [ ] Success toast: "Admin API Key가 등록되었습니다 (ends with ...{last4})"
    - [ ] Error toast: "Admin API Key 등록 실패: {error}"

#### Task 10: Project Settings Page - Project ID UI
- [ ] `src/app/(dashboard)/projects/[id]/settings/page.tsx` 확장
  - [ ] OpenAI Project ID 섹션 추가
  - [ ] Precondition Alert
    - [ ] Team에 Admin Key 없으면 경고 메시지
    - [ ] "Your team must register an Admin API Key first"
  - [ ] Project ID 입력 폼
    - [ ] Input placeholder: "proj_abc123..."
    - [ ] Client-side validation (regex)
    - [ ] Disabled if no Admin Key
  - [ ] 유효성 검증 UI
    - [ ] Loading state (2-3초 소요)
    - [ ] 진행 메시지: "Validating Project ID with Costs API..."
    - [ ] Success: "Project ID validated successfully"
    - [ ] Error: "Access denied" | "Invalid format" | "Already registered"

#### Task 11: UI Components
- [ ] `src/components/settings/admin-key-section.tsx` 생성
  - [ ] AdminKeyStatusAlert 컴포넌트
  - [ ] AdminKeyForm 컴포넌트
- [ ] `src/components/settings/project-id-section.tsx` 생성
  - [ ] PreconditionAlert 컴포넌트
  - [ ] ProjectIdForm 컴포넌트
  - [ ] ValidationLoader 컴포넌트

#### Task 12: Form Validation 및 Error Handling
- [ ] Zod schema 정의
  - [ ] adminApiKeySchema: z.string().min(20)
  - [ ] projectIdSchema: z.string().regex(/^proj_[a-zA-Z0-9_-]+$/)
- [ ] React Hook Form 통합
  - [ ] useForm with zodResolver
  - [ ] Field-level validation
  - [ ] Submit 버튼 disabled state

---

### Testing (4 tasks)

#### Task 13: Unit Tests
- [ ] `api-key-manager.test.ts`
  - [ ] validateApiKey 함수 테스트 (Admin Key, Project ID)
  - [ ] encryptApiKey/decryptApiKey 테스트
  - [ ] maskApiKey 테스트 (last4 반환 확인)
- [ ] `costs-api-validator.test.ts`
  - [ ] testCostsAPIAccess 함수 테스트 (MSW mock)
  - [ ] Success case, error cases (403, 404)

#### Task 14: Integration Tests
- [ ] `team.router.test.ts`
  - [ ] registerAdminApiKey 통합 테스트
    - [ ] Owner/admin만 허용 확인
    - [ ] KMS 암호화 검증
    - [ ] Audit log 생성 확인
  - [ ] getAdminApiKeyStatus 통합 테스트
- [ ] `project.router.test.ts`
  - [ ] registerOpenAIProjectId 통합 테스트
    - [ ] Precondition 체크 (Admin Key 필수)
    - [ ] Uniqueness 검증
    - [ ] Audit log 확인
  - [ ] validateOpenAIProjectId 통합 테스트

#### Task 15: E2E Tests
- [ ] Playwright E2E 시나리오
  - [ ] 팀 생성 → Admin Key 등록 → 성공 메시지 확인
  - [ ] 프로젝트 생성 → Project ID 등록 (Admin Key 있는 경우)
  - [ ] Project ID 등록 실패 (Admin Key 없는 경우)
  - [ ] Project ID 중복 등록 시도 → 에러 메시지 확인

#### Task 16: Validation Scripts
- [ ] `scripts/validate-openai-setup.ts` 생성
  - [ ] validateTeamSetup 함수
    - [ ] Team → Admin API Key 관계 확인
    - [ ] Admin API Key 복호화 테스트
    - [ ] Projects with openaiProjectId 확인
  - [ ] validateAllTeams 함수
  - [ ] CLI 실행: `bun run scripts/validate-openai-setup.ts`
- [ ] `scripts/test-costs-api.ts` 생성
  - [ ] testCostsAPI 함수 (team-level)
  - [ ] CLI 실행: `bun run scripts/test-costs-api.ts <team-id>`

---

## Technical Details

### 1. Data Models

#### OrganizationApiKey Model (NEW)

```prisma
// Team-level OpenAI Organization Admin API Key
model OrganizationApiKey {
  id               String   @id @default(cuid())
  teamId           String   @unique @map("team_id") // 1 Team : 1 Admin Key
  provider         String   // 'openai' (향후 확장 대비)

  // KMS Envelope Encryption
  encryptedKey     String   @map("encrypted_key") @db.Text
  encryptedDataKey String   @map("encrypted_data_key") @db.Text
  iv               String   // Initialization vector

  // Security and Metadata
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

#### Team Model Extension

```prisma
model Team {
  id        String   @id @default(cuid())
  name      String
  ownerId   String?  @map("owner_id")
  budget    Decimal? @db.Decimal(10, 2)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  members            TeamMember[]
  projects           Project[]
  organizationApiKey OrganizationApiKey? // 1:1 관계

  @@index([ownerId])
  @@map("teams")
}
```

#### Project Model Extension

```prisma
model Project {
  id          String   @id @default(cuid())
  teamId      String   @map("team_id")
  name        String
  description String?

  // OpenAI Project ID (Costs API 필터링용)
  openaiProjectId String? @unique @map("openai_project_id") // e.g., "proj_abc123"

  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  team       Team            @relation(fields: [teamId], references: [id], onDelete: Cascade)
  members    ProjectMember[]
  apiKeys    ApiKey[]        // Deprecated: Usage API용
  costData   CostData[]
  metrics    ProjectMetrics?
  costAlerts CostAlert[]

  @@index([teamId])
  @@index([openaiProjectId])
  @@map("projects")
}
```

#### CostData Model Extension

```prisma
model CostData {
  id         String   @id @default(cuid())
  projectId  String   @map("project_id")

  // Deprecated: Usage API 전용
  apiKeyId   String?  @map("api_key_id")
  snapshotId String?  @map("snapshot_id")
  tokens     Int?
  model      String?

  // Common fields
  provider   String
  service    String   // Usage API: 'gpt-4', Costs API: line_item
  cost       Decimal  @db.Decimal(10, 2)
  date       DateTime @db.Date

  // Costs API specific
  bucketStartTime DateTime? @map("bucket_start_time")
  bucketEndTime   DateTime? @map("bucket_end_time")
  lineItem        String?   @map("line_item")
  currency        String?   @default("usd")
  apiVersion      String    @default("usage_v1") @map("api_version") // 'usage_v1' | 'costs_v1'

  // Novel Pattern 1: Context
  taskType   String? @map("task_type")
  userIntent String? @map("user_intent")

  createdAt DateTime @default(now()) @map("created_at")

  project Project @relation(fields: [projectId], references: [id])
  apiKey  ApiKey? @relation(fields: [apiKeyId], references: [id])

  @@unique([projectId, bucketStartTime, bucketEndTime, lineItem, apiVersion], name: "unique_cost_bucket")
  @@unique([apiKeyId, date, snapshotId], name: "unique_usage_snapshot")
  @@index([projectId, date])
  @@index([apiVersion])
  @@map("cost_data")
}
```

---

### 2. tRPC Procedures

#### Team Router - Admin API Key Management

**File:** `src/server/api/routers/team.ts`

```typescript
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { getKMSEncryption } from "~/lib/services/encryption/kms-envelope";

export const teamRouter = createTRPCRouter({
  /**
   * Register OpenAI Admin API Key for a team
   *
   * Requirements:
   * - User must be team owner or admin
   * - API Key format validation (sk-admin- or sk-proj- with admin scope)
   * - KMS envelope encryption
   * - Audit log creation
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

      // 1. Verify team membership (owner/admin only)
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

      // 2. Validate API key format
      const isValidFormat =
        input.apiKey.startsWith("sk-admin-") ||
        input.apiKey.startsWith("sk-proj-");

      if (!isValidFormat) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid OpenAI Admin API key format. Must start with 'sk-admin-' or 'sk-proj-'",
        });
      }

      // 3. KMS envelope encryption
      const kms = getKMSEncryption();
      const { ciphertext, encryptedDataKey, iv } = await kms.encrypt(input.apiKey);

      // 4. Extract last 4 characters for UI display
      const last4 = input.apiKey.slice(-4);

      // 5. Upsert OrganizationApiKey (update if exists, create if not)
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

      // 6. Create audit log
      await ctx.db.auditLog.create({
        data: {
          userId,
          actionType: "admin_api_key_registered",
          resourceType: "organization_api_key",
          resourceId: adminKey.id,
          metadata: {
            teamId: input.teamId,
            last4,
            action: adminKey.createdAt === adminKey.updatedAt ? "created" : "updated",
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
   *
   * Returns:
   * - Key ID, last4, isActive, keyType, timestamps
   * - null if no Admin Key registered
   */
  getAdminApiKeyStatus: protectedProcedure
    .input(z.object({ teamId: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Verify team membership
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

      // Query Admin API Key
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

---

#### Project Router - Project ID Management

**File:** `src/server/api/routers/project.ts` (extension)

```typescript
export const projectRouter = createTRPCRouter({
  // ... existing procedures

  /**
   * Register OpenAI Project ID for a project
   *
   * Requirements:
   * - User must be project member
   * - Team must have active Admin API Key (precondition)
   * - Project ID format: /^proj_[a-zA-Z0-9_-]+$/
   * - Project ID uniqueness check
   */
  registerOpenAIProjectId: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        openaiProjectId: z.string().regex(
          /^proj_[a-zA-Z0-9_-]+$/,
          "OpenAI Project ID must start with 'proj_' and contain only alphanumeric characters, hyphens, and underscores"
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // 1. Verify project membership
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
                  organizationApiKey: true,
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

      // 2. Precondition: Team must have active Admin API Key
      const adminKey = projectMember.project.team.organizationApiKey;

      if (!adminKey || !adminKey.isActive) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Team must have an active Admin API Key before registering Project IDs. Please contact your team admin.",
        });
      }

      // 3. Check OpenAI Project ID uniqueness
      const existingProject = await ctx.db.project.findUnique({
        where: { openaiProjectId: input.openaiProjectId },
      });

      if (existingProject && existingProject.id !== input.projectId) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `This OpenAI Project ID is already registered to project "${existingProject.name}"`,
        });
      }

      // 4. Update project with OpenAI Project ID
      const updatedProject = await ctx.db.project.update({
        where: { id: input.projectId },
        data: {
          openaiProjectId: input.openaiProjectId,
        },
      });

      // 5. Create audit log
      await ctx.db.auditLog.create({
        data: {
          userId,
          actionType: "openai_project_id_registered",
          resourceType: "project",
          resourceId: updatedProject.id,
          metadata: {
            openaiProjectId: input.openaiProjectId,
            teamId: projectMember.project.teamId,
            projectName: updatedProject.name,
          },
        },
      });

      return {
        success: true,
        projectId: updatedProject.id,
        openaiProjectId: updatedProject.openaiProjectId,
      };
    }),

  /**
   * Validate OpenAI Project ID belongs to the team's organization
   *
   * This procedure tests if the Project ID is accessible via the team's Admin API Key
   * by making a test call to the Costs API.
   */
  validateOpenAIProjectId: protectedProcedure
    .input(
      z.object({
        teamId: z.string(),
        openaiProjectId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // 1. Verify team membership
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

      // 2. Get team's Admin API Key
      const adminKey = await ctx.db.organizationApiKey.findUnique({
        where: { teamId: input.teamId },
      });

      if (!adminKey || !adminKey.isActive) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Team does not have an active Admin API Key",
        });
      }

      // 3. Decrypt Admin API Key
      const kms = getKMSEncryption();
      const decryptedKey = await kms.decrypt(
        adminKey.encryptedKey,
        adminKey.encryptedDataKey,
        adminKey.iv
      );

      // 4. Test Costs API access with this Project ID
      try {
        const url = new URL("https://api.openai.com/v1/organization/costs");

        // Use a small time range (yesterday)
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const startTime = Math.floor(yesterday.setHours(0, 0, 0, 0) / 1000);
        const endTime = Math.floor(yesterday.setHours(23, 59, 59, 999) / 1000);

        url.searchParams.set("start_time", startTime.toString());
        url.searchParams.set("end_time", endTime.toString());
        url.searchParams.set("bucket_width", "1d");
        url.searchParams.set("limit", "1");
        url.searchParams.append("project_ids", input.openaiProjectId);

        const response = await fetch(url.toString(), {
          method: "GET",
          headers: {
            Authorization: `Bearer ${decryptedKey}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          const errorText = await response.text();

          if (response.status === 403) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Access denied: This Project ID does not belong to your organization or Admin Key lacks permissions",
            });
          }

          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Costs API validation failed (${response.status}): ${errorText}`,
          });
        }

        return {
          valid: true,
          message: "Project ID validated successfully with Costs API",
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Validation error: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }),
});
```

---

### 3. UI Mockups and Implementation

#### Team Settings Page - Admin API Key Registration

**File:** `src/app/(dashboard)/teams/[id]/settings/page.tsx`

**UI Layout:**

```
┌─────────────────────────────────────────────────────────────┐
│ Team Settings                                               │
│ Manage team-level OpenAI configuration                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ OpenAI Admin API Key                                        │
│ ┌───────────────────────────────────────────────────────┐  │
│ │ ℹ️ Admin API Key registered (ends with ...abc1)       │  │
│ │ Status: Active                                         │  │
│ │ Registered: 2025-01-04 10:30 AM                       │  │
│ └───────────────────────────────────────────────────────┘  │
│                                                             │
│ Admin API Key                                               │
│ [••••••••••••••••••••••••••••••••••••••]                   │
│ This key must have admin permissions for your OpenAI       │
│ organization                                                │
│                                                             │
│ [Update Admin API Key]                                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Key Features:**
- Password input (masked)
- Status alert (registered or not)
- Last4 display
- Update/Register button (conditional)
- Success toast: "Admin API Key가 등록되었습니다 (ends with ...{last4})"
- Error toast: "Admin API Key 등록 실패: {error message}"

---

#### Project Settings Page - OpenAI Project ID Registration

**File:** `src/app/(dashboard)/projects/[id]/settings/page.tsx`

**UI Layout:**

```
┌─────────────────────────────────────────────────────────────┐
│ Project Settings                                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ OpenAI Project ID                                           │
│ ┌───────────────────────────────────────────────────────┐  │
│ │ ⚠️ Your team must register an Admin API Key before    │  │
│ │ adding Project IDs.                                    │  │
│ └───────────────────────────────────────────────────────┘  │
│                                                             │
│ OpenAI Project ID                                           │
│ [proj_abc123...]                              [Disabled]    │
│ Find this in your OpenAI project settings                  │
│                                                             │
│ [Register Project ID]  (Disabled)                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**With Admin Key registered:**

```
┌─────────────────────────────────────────────────────────────┐
│ OpenAI Project ID                                           │
│ ┌───────────────────────────────────────────────────────┐  │
│ │ ℹ️ OpenAI Project ID: proj_abc123456                  │  │
│ └───────────────────────────────────────────────────────┘  │
│                                                             │
│ OpenAI Project ID                                           │
│ [proj_def789...]                                            │
│ Find this in your OpenAI project settings                  │
│                                                             │
│ [Validate & Register]  ⏳ Validating...                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Key Features:**
- Precondition alert (Admin Key required)
- Input disabled if no Admin Key
- Validation loading state (2-3초)
- Progress message: "Validating Project ID with Costs API..."
- Success toast: "Project ID가 등록되었습니다. 내일부터 비용 데이터가 수집됩니다."
- Error toasts:
  - "Invalid format: Project ID must start with 'proj_'"
  - "Access denied: This Project ID does not belong to your organization"
  - "Already registered: This Project ID is used by another project"

---

### 4. Validation Logic

#### Admin API Key Format Validation

```typescript
// src/lib/services/encryption/api-key-manager.ts

export function validateAdminApiKey(apiKey: string): boolean {
  // OpenAI Admin API Keys start with:
  // - sk-admin-... (organization admin)
  // - sk-proj-... (project key with admin scope)

  const adminKeyPattern = /^sk-(admin|proj)-[a-zA-Z0-9_-]{20,}$/;
  return adminKeyPattern.test(apiKey);
}
```

#### Project ID Format Validation

```typescript
// src/lib/services/openai/project-id-validator.ts

export function validateProjectIdFormat(projectId: string): {
  valid: boolean;
  error?: string;
} {
  const projectIdPattern = /^proj_[a-zA-Z0-9_-]+$/;

  if (!projectIdPattern.test(projectId)) {
    return {
      valid: false,
      error: "Project ID must start with 'proj_' and contain only alphanumeric characters, hyphens, and underscores",
    };
  }

  if (projectId.length < 10) {
    return {
      valid: false,
      error: "Project ID is too short (minimum 10 characters)",
    };
  }

  return { valid: true };
}
```

#### Costs API Test Validation

```typescript
// src/lib/services/openai/costs-api-validator.ts

import { retryWithBackoff } from "~/lib/utils/retry";

interface CostsAPITestResult {
  valid: boolean;
  error?: string;
  statusCode?: number;
}

export async function testCostsAPIAccess(
  adminApiKey: string,
  projectId: string,
): Promise<CostsAPITestResult> {
  try {
    const url = new URL("https://api.openai.com/v1/organization/costs");

    // Use yesterday's date for test
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const startTime = Math.floor(yesterday.setHours(0, 0, 0, 0) / 1000);
    const endTime = Math.floor(yesterday.setHours(23, 59, 59, 999) / 1000);

    url.searchParams.set("start_time", startTime.toString());
    url.searchParams.set("end_time", endTime.toString());
    url.searchParams.set("bucket_width", "1d");
    url.searchParams.set("limit", "1");
    url.searchParams.append("project_ids", projectId);

    const response = await retryWithBackoff(
      () =>
        fetch(url.toString(), {
          method: "GET",
          headers: {
            Authorization: `Bearer ${adminApiKey}`,
            "Content-Type": "application/json",
          },
        }),
      { maxRetries: 2, context: "Costs API test" }
    );

    if (!response.ok) {
      const errorText = await response.text();

      return {
        valid: false,
        error: mapCostsAPIError(response.status, errorText),
        statusCode: response.status,
      };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: `Network error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function mapCostsAPIError(statusCode: number, errorText: string): string {
  switch (statusCode) {
    case 401:
      return "Invalid Admin API Key: Authentication failed";
    case 403:
      return "Access denied: This Project ID does not belong to your organization or Admin Key lacks permissions";
    case 404:
      return "Project ID not found in your organization";
    case 429:
      return "Rate limit exceeded: Please try again in a few minutes";
    case 500:
    case 502:
    case 503:
      return "OpenAI API is temporarily unavailable. Please try again later.";
    default:
      return `API error (${statusCode}): ${errorText}`;
  }
}
```

---

### 5. Error Handling

#### Precondition Failures

```typescript
// Team에 Admin Key가 없는 경우
throw new TRPCError({
  code: "PRECONDITION_FAILED",
  message: "Team must have an active Admin API Key before registering Project IDs. Please contact your team admin.",
});
```

**UI Display:**
```
⚠️ Your team must register an Admin API Key before adding Project IDs.
Go to Team Settings → OpenAI Admin API Key to register.
```

#### Uniqueness Violations

```typescript
// Project ID가 이미 다른 프로젝트에 등록된 경우
if (existingProject && existingProject.id !== input.projectId) {
  throw new TRPCError({
    code: "CONFLICT",
    message: `This OpenAI Project ID is already registered to project "${existingProject.name}"`,
  });
}
```

**UI Display:**
```
❌ This OpenAI Project ID is already registered to project "Marketing Campaign".
Each Project ID can only be used once.
```

#### Access Denied

```typescript
// Costs API 접근 거부 (403)
if (response.status === 403) {
  throw new TRPCError({
    code: "FORBIDDEN",
    message: "Access denied: This Project ID does not belong to your organization or Admin Key lacks permissions",
  });
}
```

**UI Display:**
```
❌ Access denied: This Project ID does not belong to your organization.
Please verify:
1. The Project ID is correct
2. Your Admin API Key has organization-level permissions
3. The Project belongs to the same OpenAI organization
```

---

### 6. Security Considerations

#### KMS Encryption Flow

```
User enters Admin API Key
  ↓
[1] Client sends to tRPC (HTTPS encrypted)
  ↓
[2] Server validates format
  ↓
[3] KMS Envelope Encryption:
    - Generate Data Encryption Key (DEK)
    - Encrypt Admin Key with DEK (AES-256-GCM)
    - Encrypt DEK with KMS Master Key
    - Store: encryptedKey, encryptedDataKey, IV
  ↓
[4] Save to OrganizationApiKey table
  ↓
[5] Extract last4 for UI display
  ↓
[6] Create audit log (no plaintext key)
  ↓
[7] Return success + last4 to client
```

**Security Properties:**
- ✅ Plaintext key never stored in database
- ✅ KMS Master Key never leaves AWS
- ✅ DEK unique per encryption operation
- ✅ IV randomized per encryption
- ✅ Authenticated encryption (AES-256-GCM)
- ✅ Audit trail for all key operations

#### Audit Log Schema

```typescript
// Audit log for Admin API Key registration
{
  userId: string;              // Who performed the action
  actionType: "admin_api_key_registered";
  resourceType: "organization_api_key";
  resourceId: string;          // OrganizationApiKey.id
  metadata: {
    teamId: string;
    last4: string;             // Safe to log (last 4 chars only)
    action: "created" | "updated";
  };
  createdAt: DateTime;
}

// Audit log for Project ID registration
{
  userId: string;
  actionType: "openai_project_id_registered";
  resourceType: "project";
  resourceId: string;          // Project.id
  metadata: {
    openaiProjectId: string;   // Safe to log (not a secret)
    teamId: string;
    projectName: string;
  };
  createdAt: DateTime;
}
```

#### Admin-Only Operations

**Permission Model:**

| Operation | Required Role | Check Location |
|-----------|---------------|----------------|
| Register Admin API Key | Team Owner/Admin | `teamRouter.registerAdminApiKey` |
| View Admin API Key Status | Team Member | `teamRouter.getAdminApiKeyStatus` (last4 only) |
| Register Project ID | Project Member | `projectRouter.registerOpenAIProjectId` |
| Validate Project ID | Team Member | `projectRouter.validateOpenAIProjectId` |

**Authorization Flow:**

```typescript
// 1. Check team membership
const teamMember = await ctx.db.teamMember.findUnique({
  where: { teamId_userId: { teamId, userId } },
});

if (!teamMember) {
  throw new TRPCError({ code: "FORBIDDEN", message: "Not a team member" });
}

// 2. Check role for sensitive operations
if (!["owner", "admin"].includes(teamMember.role)) {
  throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
}
```

---

### 7. Testing Strategy

#### Unit Tests

**File:** `src/lib/services/encryption/api-key-manager.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { validateAdminApiKey, validateProjectIdFormat } from "./api-key-manager";

describe("Admin API Key Validation", () => {
  it("should accept valid Admin API Keys", () => {
    expect(validateAdminApiKey("sk-admin-abc123def456ghi789")).toBe(true);
    expect(validateAdminApiKey("sk-proj-xyz789abc123def456")).toBe(true);
  });

  it("should reject invalid formats", () => {
    expect(validateAdminApiKey("sk-abc123")).toBe(false); // Missing admin/proj prefix
    expect(validateAdminApiKey("admin-abc123")).toBe(false); // Missing sk- prefix
    expect(validateAdminApiKey("sk-admin-short")).toBe(false); // Too short
  });
});

describe("Project ID Validation", () => {
  it("should accept valid Project IDs", () => {
    const result = validateProjectIdFormat("proj_abc123def456");
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("should reject invalid formats", () => {
    const result1 = validateProjectIdFormat("abc123"); // Missing proj_ prefix
    expect(result1.valid).toBe(false);
    expect(result1.error).toContain("must start with 'proj_'");

    const result2 = validateProjectIdFormat("proj_ab"); // Too short
    expect(result2.valid).toBe(false);
    expect(result2.error).toContain("too short");
  });
});
```

#### Integration Tests

**File:** `src/server/api/routers/team.test.ts`

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { appRouter } from "~/server/api/root";
import { createInnerTRPCContext } from "~/server/api/trpc";
import { db } from "~/server/db";

describe("Team Router - Admin API Key", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;
  let teamId: string;
  let ownerId: string;

  beforeEach(async () => {
    // Setup test data
    const user = await db.user.create({
      data: { email: "test@example.com", name: "Test User" },
    });
    ownerId = user.id;

    const team = await db.team.create({
      data: { name: "Test Team", ownerId },
    });
    teamId = team.id;

    await db.teamMember.create({
      data: { teamId, userId: ownerId, role: "owner" },
    });

    const ctx = createInnerTRPCContext({ session: { user } });
    caller = appRouter.createCaller(ctx);
  });

  it("should register Admin API Key successfully", async () => {
    const result = await caller.team.registerAdminApiKey({
      teamId,
      apiKey: "sk-admin-test123456789012345",
    });

    expect(result.success).toBe(true);
    expect(result.last4).toBe("2345");

    // Verify database
    const adminKey = await db.organizationApiKey.findUnique({
      where: { teamId },
    });

    expect(adminKey).toBeDefined();
    expect(adminKey?.isActive).toBe(true);
    expect(adminKey?.keyType).toBe("admin");
  });

  it("should reject non-owner/admin users", async () => {
    const normalUser = await db.user.create({
      data: { email: "normal@example.com", name: "Normal User" },
    });

    await db.teamMember.create({
      data: { teamId, userId: normalUser.id, role: "member" },
    });

    const ctx = createInnerTRPCContext({ session: { user: normalUser } });
    const normalCaller = appRouter.createCaller(ctx);

    await expect(
      normalCaller.team.registerAdminApiKey({
        teamId,
        apiKey: "sk-admin-test123456789012345",
      })
    ).rejects.toThrow("Only team owners/admins can register Admin API keys");
  });
});
```

#### E2E Tests

**File:** `tests/e2e/admin-key-registration.spec.ts`

```typescript
import { test, expect } from "@playwright/test";

test.describe("Admin API Key Registration Flow", () => {
  test("should register Admin API Key and Project ID", async ({ page }) => {
    // 1. Login
    await page.goto("/login");
    await page.fill('input[name="email"]', "test@example.com");
    await page.fill('input[name="password"]', "password123");
    await page.click('button[type="submit"]');

    // 2. Create team
    await page.goto("/teams");
    await page.click('button:has-text("Create Team")');
    await page.fill('input[name="name"]', "E2E Test Team");
    await page.click('button:has-text("Create")');

    // 3. Navigate to Team Settings
    await page.click('a:has-text("Settings")');

    // 4. Register Admin API Key
    await page.fill('input[id="apiKey"]', "sk-admin-e2etest123456789");
    await page.click('button:has-text("Register Admin API Key")');

    // 5. Verify success toast
    await expect(page.locator('text=Admin API Key가 등록되었습니다')).toBeVisible();
    await expect(page.locator('text=ends with ...6789')).toBeVisible();

    // 6. Create project
    await page.goto("/projects");
    await page.click('button:has-text("Create Project")');
    await page.fill('input[name="name"]', "E2E Test Project");
    await page.click('button:has-text("Create")');

    // 7. Navigate to Project Settings
    await page.click('a:has-text("Settings")');

    // 8. Register Project ID
    await page.fill('input[id="openaiProjectId"]', "proj_e2etest123");
    await page.click('button:has-text("Register Project ID")');

    // 9. Wait for validation
    await expect(page.locator('text=Validating Project ID')).toBeVisible();

    // 10. Verify success (or validation failure in test env)
    // Note: In test environment, Costs API call will fail without real credentials
    // This test verifies UI flow, not actual API integration
  });

  test("should show precondition alert when no Admin Key", async ({ page }) => {
    // 1. Login and create team (without Admin Key)
    await page.goto("/login");
    // ... login steps ...

    // 2. Create project
    await page.goto("/projects");
    await page.click('button:has-text("Create Project")');
    // ... project creation ...

    // 3. Go to Project Settings
    await page.click('a:has-text("Settings")');

    // 4. Verify precondition alert
    await expect(
      page.locator('text=Your team must register an Admin API Key')
    ).toBeVisible();

    // 5. Verify Project ID input is disabled
    const input = page.locator('input[id="openaiProjectId"]');
    await expect(input).toBeDisabled();
  });
});
```

#### Validation Scripts

**File:** `scripts/validate-openai-setup.ts`

```typescript
import { db } from "~/server/db";
import { getKMSEncryption } from "~/lib/services/encryption/kms-envelope";
import pino from "pino";

const logger = pino({ name: "validate-openai-setup" });

async function validateTeamSetup(teamId: string) {
  const issues: string[] = [];

  // 1. Team 존재 확인
  const team = await db.team.findUnique({
    where: { id: teamId },
    include: {
      organizationApiKey: true,
      projects: {
        select: {
          id: true,
          name: true,
          openaiProjectId: true,
        },
      },
    },
  });

  if (!team) {
    issues.push(`Team ${teamId} not found`);
    return { valid: false, issues };
  }

  // 2. Admin API Key 확인
  if (!team.organizationApiKey) {
    issues.push(`Team "${team.name}" has no Admin API Key`);
  } else if (!team.organizationApiKey.isActive) {
    issues.push(`Team "${team.name}" Admin API Key is inactive`);
  }

  // 3. Admin API Key 복호화 테스트
  if (team.organizationApiKey) {
    try {
      const kms = getKMSEncryption();
      await kms.decrypt(
        team.organizationApiKey.encryptedKey,
        team.organizationApiKey.encryptedDataKey,
        team.organizationApiKey.iv
      );
      logger.info({ teamId }, "Admin API Key decryption successful");
    } catch (error) {
      issues.push(`Failed to decrypt Admin API Key: ${error}`);
    }
  }

  // 4. Projects with OpenAI Project ID 확인
  const projectsWithId = team.projects.filter(p => p.openaiProjectId);
  if (projectsWithId.length === 0) {
    issues.push(`Team "${team.name}" has no projects with OpenAI Project ID`);
  }

  logger.info({
    teamId,
    teamName: team.name,
    hasAdminKey: !!team.organizationApiKey,
    projectCount: team.projects.length,
    projectsWithId: projectsWithId.length,
  }, "Team validation completed");

  return {
    valid: issues.length === 0,
    issues,
  };
}

async function validateAllTeams() {
  const teams = await db.team.findMany({
    select: { id: true, name: true },
  });

  logger.info({ teamCount: teams.length }, "Validating all teams");

  for (const team of teams) {
    const result = await validateTeamSetup(team.id);

    if (!result.valid) {
      logger.warn({ teamId: team.id, teamName: team.name, issues: result.issues }, "❌ Validation failed");
    } else {
      logger.info({ teamId: team.id, teamName: team.name }, "✅ Validation passed");
    }
  }
}

// CLI execution
if (require.main === module) {
  validateAllTeams()
    .then(() => {
      logger.info("All teams validated");
      process.exit(0);
    })
    .catch(error => {
      logger.error({ error }, "Validation script failed");
      process.exit(1);
    });
}
```

**Usage:**
```bash
# Validate all teams
bun run scripts/validate-openai-setup.ts

# Output:
# ✅ Team "Engineering" - Admin Key OK, 3 projects with Project IDs
# ❌ Team "Marketing" - No Admin API Key registered
# ✅ Team "Sales" - Admin Key OK, 1 project with Project ID
```

---

## Dev Notes

### Architecture Patterns and Constraints

**Novel Pattern 2 (Revised): Team-level Admin Key + Project ID Filtering**

```
핵심 차별화 요소:
- Team 레벨 Admin API Key로 organization 전체 비용 조회
- Project ID 필터링으로 프로젝트별 비용 구분
- Costs API의 시간 버킷 집계 데이터 활용
- 태그 불필요 (architecture-based attribution)
```

**Data Flow:**

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

**Permissions Model:**

| Role | Team Settings | Project Settings |
|------|---------------|------------------|
| Team Owner/Admin | Register/update Admin API Key, view status | View all projects, register Project IDs |
| Team Member | View Admin Key status (last4 only) | View own projects |
| Project Member | N/A | Register/update Project ID for assigned projects |

### Project Structure

**New Files:**

```
finops-for-ai/
├── prisma/
│   ├── schema.prisma                                    # UPDATE: Add OrganizationApiKey, Project.openaiProjectId
│   └── migrations/
│       └── [timestamp]_add_costs_api_support/
│           └── migration.sql                            # NEW: Schema migration
├── src/
│   ├── app/
│   │   └── (dashboard)/
│   │       ├── teams/
│   │       │   └── [id]/
│   │       │       └── settings/
│   │       │           └── page.tsx                     # NEW: Team Settings (Admin Key)
│   │       └── projects/
│   │           └── [id]/
│   │               └── settings/
│   │                   └── page.tsx                     # UPDATE: Add Project ID section
│   ├── server/
│   │   └── api/
│   │       ├── routers/
│   │       │   ├── team.ts                              # NEW: Team router (Admin Key)
│   │       │   ├── project.ts                           # UPDATE: Add Project ID procedures
│   │       │   └── root.ts                              # UPDATE: Add teamRouter
│   │       └── trpc.ts                                  # REUSE: protectedProcedure
│   ├── lib/
│   │   └── services/
│   │       ├── encryption/
│   │       │   ├── kms-envelope.ts                      # REUSE: From Story 1.1
│   │       │   └── api-key-manager.ts                   # UPDATE: Add Admin Key validation
│   │       └── openai/
│   │           ├── costs-api-validator.ts               # NEW: Costs API test validator
│   │           └── project-id-validator.ts              # NEW: Project ID validation
│   └── components/
│       └── settings/
│           ├── admin-key-section.tsx                    # NEW: Admin Key UI component
│           └── project-id-section.tsx                   # NEW: Project ID UI component
└── scripts/
    ├── validate-openai-setup.ts                         # NEW: Validation script
    └── test-costs-api.ts                                # NEW: Costs API test script
```

**Files to Reuse:**
- `src/lib/services/encryption/kms-envelope.ts` - KMS encryption (Story 1.1)
- `src/server/api/trpc.ts` - protectedProcedure pattern
- `src/components/ui/*` - shadcn/ui components (Button, Input, Alert, Form)

**Files to Update:**
- `prisma/schema.prisma` - Add OrganizationApiKey model, extend Team, Project, CostData
- `src/server/api/root.ts` - Add teamRouter export
- `src/app/(dashboard)/projects/[id]/settings/page.tsx` - Add Project ID section

### Migration Context

**Breaking Changes from Usage API:**

| Aspect | Usage API (Old) | Costs API (New) |
|--------|-----------------|-----------------|
| API Key Level | Project-level | **Team-level (Admin)** |
| Authentication | Project API Key | **Organization Admin API Key** |
| Project Identification | API Key | **OpenAI Project ID** |
| Data Granularity | Model, token-level | **Time bucket, line_item aggregation** |
| Endpoint | `/v1/usage` | **/v1/organization/costs** |
| Response Structure | Per-project, detailed | **Organization-wide, aggregated** |

**Migration Strategy:**
- Additive-only schema changes (backward compatible)
- Both APIs can coexist (apiVersion field differentiates)
- Feature flag: `ENABLE_COSTS_API` for gradual rollout
- See [BREAKING_CHANGES.md](../migration/BREAKING_CHANGES.md) for details

### Learnings from Previous Stories

**From Story 1.5 (API 키 비활성화):**
- Audit Logger Service: `src/lib/services/audit/audit-logger.ts`
- Audit log pattern: userId, actionType, resourceId, metadata
- Apply to Admin Key registration and Project ID registration

**From Story 1.1, 1.2 (KMS Encryption):**
- KMS Envelope Encryption: `src/lib/services/encryption/kms-envelope.ts`
- encryptWithEnvelope, decryptWithEnvelope 함수 재사용
- OrganizationApiKey도 동일한 암호화 패턴 사용

**From Story 1.6 (주간 리포트):**
- React Email + Resend Service: 이메일 발송 패턴
- Story 1.7에서는 이메일 불필요 (UI 중심)

**From Story 1.10 (프로젝트 멤버 관리):**
- Permission model: Team admin vs. project member
- Type-to-confirm dialog pattern
- shadcn/ui components (Dialog, Form, Toast)

### Testing Standards

**Unit Tests (Vitest):**
- API Key format validation
- Project ID format validation
- KMS encryption/decryption

**Integration Tests (Vitest + MSW):**
- tRPC procedures with mocked KMS and Costs API
- Permission checks (owner/admin vs. member)
- Precondition enforcement

**E2E Tests (Playwright):**
- Full flow: Team creation → Admin Key → Project → Project ID
- Error scenarios: No Admin Key, invalid format, duplicate Project ID

**Validation Scripts:**
- `validate-openai-setup.ts` - Verify all teams have correct setup
- `test-costs-api.ts` - Test actual Costs API connectivity

---

## References

- [Source: docs/epics-v2.md#Story-1.7] - Story acceptance criteria and implementation tasks
- [Source: docs/migration/costs-api-migration-plan.md#Section-3.2] - tRPC router specifications
- [Source: docs/migration/DOCUMENTATION_REWRITE_CHECKLIST.md#Section-7] - Story 1.7 rewrite requirements
- [Source: docs/architecture.md#Novel-Patterns] - Pattern 2: Team-level Admin Key + Project ID Filtering
- [Source: docs/tech-spec-epic-1.md#Data-Models] - OrganizationApiKey, Project.openaiProjectId schema
- [Source: docs/PRD.md#Functional-Requirements] - FR007, FR007-B, FR007-C
- [OpenAI Costs API Documentation](https://platform.openai.com/docs/api-reference/costs)

---

## Change Log

### 2025-01-04
- Story completely rewritten for Costs API migration
- Changed from project-level API keys to team-level Admin Keys
- Added Project ID registration and validation
- Updated all 8 acceptance criteria
- Created 16 implementation tasks (Backend 8, Frontend 4, Testing 4)
- Added complete tRPC router code examples
- Added UI mockups and validation logic
- Added security considerations and testing strategy
- Status: ready-for-dev

---

**End of Story 1.7 Specification**
