# Breaking Changes - Costs API Migration

**Version:** 2.0.0
**Date:** 2025-01-04
**Impact:** High

---

## Overview

OpenAI Costs API 마이그레이션으로 인한 주요 변경 사항을 정리합니다. 모든 사용자는 이 가이드를 읽고 시스템을 업데이트해야 합니다.

---

## 🚨 Critical Changes

### 1. API Key 관리 구조 변경

**Before (Usage API):**
```
Project → API Key (프로젝트별 개별 API 키)
```

**After (Costs API):**
```
Team → Admin API Key (팀 단위 조직 관리자 키)
  └─ Project → OpenAI Project ID (프로젝트 식별자)
```

**Action Required:**
- ✅ 팀 관리자는 **Admin API Key**를 팀 설정에 등록해야 함
- ✅ 각 프로젝트에 **OpenAI Project ID** 등록 필요
- ⚠️ 기존 프로젝트별 API Key는 deprecated (읽기 전용으로 전환)

---

## 📋 Data Model Changes

### 2. New Table: `organization_api_keys`

**새로운 테이블이 추가되었습니다:**

```sql
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
  "updated_at" TIMESTAMP(3) NOT NULL
);
```

**Migration:**
자동으로 생성됩니다. 사용자 액션 불필요.

---

### 3. Projects Table: New Field `openai_project_id`

**변경 사항:**
```prisma
model Project {
  // ... existing fields
  openaiProjectId String? @unique @map("openai_project_id") // 🆕 추가
}
```

**Action Required:**
- UI에서 각 프로젝트의 OpenAI Project ID를 등록해야 합니다
- 등록하지 않은 프로젝트는 Costs API 데이터 수집 대상에서 제외됩니다

**How to find OpenAI Project ID:**
1. OpenAI Dashboard → Projects
2. 프로젝트 선택 → Settings
3. Project ID 복사 (형식: `proj_abc123...`)

---

### 4. CostData Table: Schema Extension

**새로운 필드:**

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| `bucketStartTime` | DateTime | Costs API 버킷 시작 시간 | No (nullable) |
| `bucketEndTime` | DateTime | Costs API 버킷 종료 시간 | No (nullable) |
| `lineItem` | String | Costs API line item (e.g., "GPT-4") | No (nullable) |
| `currency` | String | 통화 코드 (기본: "usd") | No (default) |
| `apiVersion` | String | 데이터 출처 API 버전 | Yes (default: "usage_v1") |

**Deprecated 필드 (nullable 전환):**

| Field | Status | Migration Strategy |
|-------|--------|---------------------|
| `apiKeyId` | ⚠️ Deprecated | Costs API는 null, Usage API는 계속 사용 |
| `snapshotId` | ⚠️ Deprecated | Costs API는 null, Usage API는 계속 사용 |
| `tokens` | ⚠️ Deprecated | Costs API는 null (토큰 정보 없음) |
| `model` | ⚠️ Deprecated | Costs API는 null (line_item 사용) |

**Backward Compatibility:**
- 기존 Usage API 데이터는 그대로 유지 (`apiVersion='usage_v1'`)
- 새 Costs API 데이터는 `apiVersion='costs_v1'`로 저장
- 두 버전 데이터를 동시에 쿼리 가능

---

## 🔄 API Changes

### 5. tRPC Procedures - New Endpoints

**Team Router (새로운 프로시저):**

```typescript
// Admin API Key 등록
api.team.registerAdminApiKey.useMutation({
  teamId: string;
  apiKey: string;
})

// Admin API Key 상태 조회
api.team.getAdminApiKeyStatus.useQuery({
  teamId: string;
})
```

**Project Router (새로운 프로시저):**

```typescript
// OpenAI Project ID 등록
api.project.registerOpenAIProjectId.useMutation({
  projectId: string;
  openaiProjectId: string;
})

// Project ID 검증
api.project.validateOpenAIProjectId.useMutation({
  teamId: string;
  openaiProjectId: string;
})
```

**Action Required:**
- UI에서 이 새로운 프로시저를 호출하여 설정 완료
- 팀 관리자만 `registerAdminApiKey` 호출 가능 (권한 검증)

---

### 6. Cost Data Collection Logic Change

**Before (Usage API):**
- Cron Job이 모든 **프로젝트 API Key**를 순회하며 데이터 수집
- 각 API Key마다 개별 API 호출

**After (Costs API):**
- Cron Job이 모든 **팀의 Admin API Key**를 순회
- 한 번의 API 호출로 팀의 모든 프로젝트 비용 집계
- `project_ids` 파라미터로 필터링

**Impact:**
- ✅ API 호출 횟수 감소 (성능 향상)
- ✅ Rate limit 압박 감소
- ⚠️ Admin API Key 없는 팀은 데이터 수집 안 됨

---

## 🛡️ Security & Permissions

### 7. Admin API Key Permissions

**New Requirement:**
- Costs API는 **Organization Admin** 권한이 필요합니다
- 일반 프로젝트 API Key로는 접근 불가능

**Action Required:**
1. OpenAI Organization Settings → Members
2. 본인 계정에 **Admin** 권한 부여 (Owner만 가능)
3. API Keys → Create **Admin Key** (Service Account Key와 다름)
4. Team Settings에 등록

**Security Note:**
- Admin API Key는 KMS Envelope Encryption으로 암호화 저장
- 기존 API Key와 동일한 보안 수준 유지
- UI에는 마지막 4자리만 표시

---

### 8. Access Control Changes

**Team Settings - Admin API Key:**
- 등록/수정: **Team Owner** 또는 **Team Admin**만 가능
- 조회: 모든 팀 멤버 가능 (마지막 4자리만)

**Project Settings - OpenAI Project ID:**
- 등록/수정: 프로젝트 멤버 누구나 가능
- 전제조건: 팀에 Admin API Key 등록되어 있어야 함

---

## 📊 Data & Analytics Impact

### 9. Cost Aggregation Level Change

**Before (Usage API):**
- 모델별 세부 데이터 (gpt-4, gpt-3.5-turbo, etc.)
- 토큰 수 제공 (n_context_tokens, n_generated_tokens)
- 요청 수 제공 (n_requests)

**After (Costs API):**
- Line item별 집계 (e.g., "GPT-4", "Image models")
- 토큰 수 **제공 안 함**
- 요청 수 **제공 안 함**

**Impact on Features:**
- ⚠️ 토큰 기반 효율성 분석 불가능 (Costs API 데이터만 사용 시)
- ⚠️ 모델별 세부 분석 정확도 감소 (line_item은 여러 모델 포함 가능)
- ✅ 비용 집계 및 예산 추적은 정상 작동
- ✅ 프로젝트/팀별 비용 분석은 정상 작동

**Mitigation:**
하이브리드 모드를 사용하면 Usage API 데이터도 계속 수집 가능 (선택사항)

---

### 10. Dashboard & UI Changes

**Cost Cards:**
- 기존 UI 유지 (변경 없음)
- 내부적으로 `apiVersion` 필터링 추가

**Cost Charts:**
- Line item 기반 차트 추가 (새로운 필터 옵션)
- 기존 모델별 차트는 Usage API 데이터만 표시

**Project Detail Page:**
- OpenAI Project ID 필드 추가 (Settings 탭)
- Admin API Key 상태 표시 (읽기 전용)

---

## 🔧 Configuration Changes

### 11. Environment Variables

**새로운 환경 변수 (선택사항):**

```bash
# Feature flag: Costs API 활성화 여부
ENABLE_COSTS_API=true

# Feature flag: Usage API 병행 사용 (하이브리드 모드)
ENABLE_USAGE_API_FALLBACK=false
```

**Default Behavior:**
- `ENABLE_COSTS_API=true`: Costs API 우선 사용
- Admin API Key 없는 팀은 자동으로 Usage API 폴백 (하이브리드 모드)

---

### 12. Cron Job Schedule

**변경 없음:**
- 여전히 매일 오전 9시 KST 실행
- vercel.json 설정 유지

**Internal Logic Change:**
- Usage API 호출 → Costs API 호출로 전환
- 에러 핸들링 강화 (Admin Key 권한 오류 대응)

---

## 📝 Migration Checklist

사용자가 취해야 할 액션:

### Team Owners/Admins:
- [ ] OpenAI Organization에서 Admin 권한 확보
- [ ] Admin API Key 생성
- [ ] Team Settings에서 Admin API Key 등록
- [ ] 등록 성공 확인 (last4 표시)

### Project Members:
- [ ] OpenAI Dashboard에서 Project ID 확인
- [ ] Project Settings에서 OpenAI Project ID 등록
- [ ] 팀에 Admin API Key가 등록되어 있는지 확인

### Developers:
- [ ] 데이터베이스 마이그레이션 실행 (`bunx prisma migrate deploy`)
- [ ] 환경 변수 설정 (필요 시)
- [ ] 검증 스크립트 실행 (`bun run scripts/validate-openai-setup.ts`)
- [ ] Costs API 테스트 (`bun run scripts/test-costs-api.ts <teamId>`)

---

## 🆘 Troubleshooting

### Problem: Admin API Key 등록 실패

**Symptoms:**
- "Invalid OpenAI Admin API key format" 에러
- 401 Unauthorized 에러

**Solutions:**
1. API Key가 `sk-admin-` 또는 `sk-proj-`로 시작하는지 확인
2. Organization Admin 권한이 있는지 확인
3. API Key가 활성화되어 있는지 확인 (OpenAI Dashboard)

---

### Problem: Project ID 등록 시 "Team must have Admin API Key" 에러

**Cause:**
팀에 Admin API Key가 등록되어 있지 않음

**Solution:**
1. Team Settings로 이동
2. Admin API Key 먼저 등록
3. 이후 Project Settings에서 Project ID 등록

---

### Problem: Costs API 데이터 수집 안 됨

**Check:**
1. Team에 Admin API Key 등록되어 있는지
2. Project에 OpenAI Project ID 등록되어 있는지
3. Cron job 로그 확인 (Vercel Dashboard → Functions → Logs)
4. 검증 스크립트 실행: `bun run scripts/validate-openai-setup.ts`

---

### Problem: 기존 Usage API 데이터 사라짐

**Answer:**
사라지지 않습니다.
- 기존 데이터는 `apiVersion='usage_v1'`로 보존
- 대시보드는 두 API 버전 모두 집계
- 원한다면 Usage API 계속 사용 가능 (하이브리드 모드)

---

## 📞 Support

문제 발생 시:
1. [GitHub Issues](https://github.com/your-org/finops-for-ai/issues)에 보고
2. 검증 스크립트 결과 첨부
3. Cron job 로그 첨부

---

## 📚 Additional Resources

- [Costs API Migration Plan](./costs-api-migration-plan.md)
- [OpenAI Costs API Documentation](https://platform.openai.com/docs/api-reference/costs)
- [Team Settings Guide](../guides/team-settings.md)
- [Project Settings Guide](../guides/project-settings.md)

---

**Last Updated:** 2025-01-04
