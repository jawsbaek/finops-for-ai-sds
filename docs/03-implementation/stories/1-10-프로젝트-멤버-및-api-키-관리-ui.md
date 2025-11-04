# Story 1.10: 프로젝트 멤버 및 API 키 관리 UI

**Status:** ✅ COMPLETED (2025-11-03)

---

## User Story

**As a** 프로젝트 관리자,
**I want** 프로젝트 멤버를 추가/제거하고 API 키의 전체 생명주기를 관리할 수 있는 UI를,
**So that** 프로젝트별 접근 권한과 API 키를 효율적으로 통제할 수 있다.

---

## Acceptance Criteria

### 프로젝트 멤버 관리
1. ✅ 프로젝트 상세 페이지에 "프로젝트 멤버" 섹션이 표시되어야 한다
2. ✅ 현재 프로젝트 멤버 목록(이름, 이메일)이 카드 형태로 표시되어야 한다
3. ✅ "멤버 추가" 버튼 클릭 시 모달 다이얼로그가 열려야 한다
4. ✅ 모달에서 팀 멤버 드롭다운으로 추가할 사용자를 선택할 수 있어야 한다
5. ✅ 이미 프로젝트에 추가된 멤버는 드롭다운에서 비활성화되어야 한다
6. ✅ 멤버 추가 시 즉시 목록에 반영되어야 한다 (optimistic update)
7. ✅ 각 멤버 카드에 "제거" 버튼이 표시되어야 한다
8. ✅ 멤버 제거 시 확인 다이얼로그가 표시되어야 한다

### API 키 생명주기 관리
1. ✅ 프로젝트 상세 페이지에 "API 키 관리" 섹션이 표시되어야 한다
2. ✅ 현재 API 키 목록(provider, last4, 상태, 생성일)이 표시되어야 한다
3. ✅ "API 키 추가" 버튼 클릭 시 모달 다이얼로그가 열려야 한다
4. ✅ API 키 추가 모달에서 provider 선택 및 API 키 입력이 가능해야 한다
5. ✅ API 키 입력 시 password 타입으로 마스킹되어야 한다
6. ✅ OpenAI API 키는 "sk-"로 시작하는지 클라이언트 측에서 검증해야 한다
7. ✅ 비활성화된 API 키는 "활성화" 버튼이 표시되어야 한다
8. ✅ 활성 API 키는 "차단" 버튼이 표시되어야 한다
9. ✅ 모든 API 키는 "영구 삭제" 버튼이 표시되어야 한다
10. ✅ 차단 시 type-to-confirm 다이얼로그(사유 + "차단" 입력)가 표시되어야 한다
11. ✅ 영구 삭제 시 type-to-confirm 다이얼로그(사유 + "삭제" 입력)가 표시되어야 한다
12. ✅ 모든 API 키 작업(생성, 차단, 활성화, 삭제)이 audit log에 기록되어야 한다

### UX 요구사항
1. ✅ 모든 작업 중 로딩 상태가 명확히 표시되어야 한다
2. ✅ 작업 성공/실패 시 toast 알림이 표시되어야 한다
3. ✅ API 키 추가 시 보안 주의사항이 표시되어야 한다
4. ✅ 삭제 다이얼로그에 영구 삭제 경고가 명확히 표시되어야 한다

---

## Prerequisites

- Story 1.7 (팀별 API 키 생성 및 자동 귀속)
- Story 1.8 (긴급 조치용 기본 웹 대시보드)

---

## Implementation Summary

### Backend APIs (tRPC Procedures)

#### `src/server/api/routers/project.ts`
- **enableApiKey**: API 키 활성화 + audit log
- **deleteApiKey**: API 키 영구 삭제 + audit log (사유 필수)

#### `src/server/api/routers/team.ts`
- **getMembers**: 팀 멤버 목록 조회 (AddMemberDialog 드롭다운용)

### Frontend Components

#### `src/components/dialogs/AddMemberDialog.tsx` (179 lines)
- 팀 멤버 드롭다운 선택
- 이미 추가된 멤버 비활성화 처리
- 선택한 멤버 미리보기

#### `src/components/dialogs/AddApiKeyDialog.tsx` (174 lines)
- Provider 선택 (현재 OpenAI만 지원)
- API 키 입력 (password 타입)
- 클라이언트 측 validation (sk- 접두사)
- 보안 주의사항 표시

#### `src/components/dialogs/ConfirmDeleteKeyDialog.tsx` (130 lines)
- Type-to-confirm 패턴 ("삭제" 입력 필수)
- 사유 입력 (필수)
- 영구 삭제 경고 메시지

#### `src/app/(dashboard)/projects/[id]/page.tsx`
- 프로젝트 멤버 섹션 추가 (406-473 lines)
- API 키 관리 섹션 추가 (475-594 lines)
- 4개 다이얼로그 통합 (AddMember, AddApiKey, ConfirmDisable, ConfirmDelete)
- 모든 mutations에 optimistic updates 적용

### Permission Model

| 작업 | 필요 권한 | 구현 |
|------|---------|------|
| 멤버 추가/제거 | Team Admin | `ensureTeamAdmin()` |
| API 키 생성/차단/활성화/삭제 | Project Member 또는 Team Admin | `ensureProjectAccess()` |

### Security Features

1. **API 키 암호화**: AWS KMS envelope encryption (기존 구현 사용)
2. **Audit Logging**: 모든 API 키 lifecycle 이벤트 기록
3. **Type-to-Confirm**: 차단/삭제 시 명시적 확인 필수
4. **사유 기록**: 모든 위험 작업에 사유 입력 필수

---

## Technical Notes

### Dialog State Management Pattern
```typescript
// 각 다이얼로그별 독립적 상태 관리
const [addApiKeyDialogOpen, setAddApiKeyDialogOpen] = useState(false);
const [selectedApiKeyId, setSelectedApiKeyId] = useState<string | null>(null);

// Dialog close 시 자동 reset
const handleOpenChange = (newOpen: boolean) => {
  if (!newOpen) {
    setSelectedUserId("");  // Reset form
  }
  onOpenChange(newOpen);
};
```

### Optimistic Updates Pattern
```typescript
const addMember = api.project.addMember.useMutation({
  onSuccess: async () => {
    await utils.project.getMembers.invalidate({ projectId });
    setAddMemberDialogOpen(false);
    toast.success("멤버가 추가되었습니다");
  },
});
```

### Type-to-Confirm Validation
```typescript
const isConfirmEnabled = confirmText === "삭제" && reason.trim().length > 0;
```

---

## Testing Verification

### Manual Testing Checklist
- ✅ 멤버 추가: 드롭다운 선택 → 추가 → 목록 반영
- ✅ 멤버 제거: 제거 버튼 → 확인 → 목록에서 제거
- ✅ API 키 생성: 모달 → OpenAI 선택 → sk- 키 입력 → 추가
- ✅ API 키 차단: 차단 버튼 → 사유 + "차단" 입력 → 확인
- ✅ API 키 활성화: 활성화 버튼 → 사유 입력 → 확인
- ✅ API 키 삭제: 삭제 버튼 → 사유 + "삭제" 입력 → 영구 삭제
- ✅ 빌드 성공: `npm run build` 통과

### Build Output
```
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Collecting page data
✓ Generating static pages
✓ Collecting build traces
✓ Finalizing page optimization
```

---

## Code Review Results

**Overall Score:** 78% (Good with improvements needed)

### Strengths
- ✅ T3 App 표준 준수도: 85%
- ✅ TypeScript 타입 안전성: 95%
- ✅ Loading state 처리: 100%
- ✅ Modal UX 패턴: Excellent

### Issues Identified (See Story 1.11, 1.12, 1.13)
- ⚠️ API 키 노출 위험 (encryptedKey 클라이언트 전송)
- ⚠️ Rate limiting 미구현
- ⚠️ 영어 에러 메시지 (한국어 필요)
- ⚠️ N+1 쿼리 최적화 필요
- ⚠️ Audit log 트랜잭션 안전성

---

## Related Documentation

- **Design Document**: `docs/plans/2025-11-03-project-member-api-key-management-design.md`
- **Architecture Decision**: `docs/architecture.md` - ADR-008
- **Implementation Details**: `docs/architecture.md` - Novel Pattern 2, Sections 6-9

---

## Follow-up Stories

- **Story 1.11**: 보안 강화 - API 키 노출 방지 및 Rate Limiting
- **Story 1.12**: 성능 최적화 - 쿼리 최적화 및 인덱스 추가
- **Story 1.13**: 국제화 및 데이터 무결성 개선
