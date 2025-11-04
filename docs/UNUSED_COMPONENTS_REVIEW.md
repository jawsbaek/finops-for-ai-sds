# 사용하지 않는 컴포넌트 삭제 검토

> 작성일: 2025-11-04
> 목적: 코드베이스에서 사용되지 않는 컴포넌트를 식별하고 삭제 여부를 검토

## ✅ 삭제 완료

### 1. `src/hooks/use-toast.tsx`
- **상태**: 삭제 완료
- **이유**: shadcn/ui toast wrapper hook으로, 전체 프로젝트가 `sonner` 라이브러리로 표준화됨
- **영향**: 없음 (어디서도 사용되지 않음)

---

## 🔍 삭제 검토 대상

### Custom Components (`src/components/custom/`)

#### 1. `action-checklist.tsx`
- **현재 사용**: ❌ 사용되지 않음
- **위치**: `src/components/custom/action-checklist.tsx`
- **Export**: `src/components/custom/index.ts`에서 export됨
- **실제 사용처**: 없음 (컴포넌트 자체 파일과 index.ts에서만 참조)
- **검토 의견**:
  - 향후 액션 체크리스트 기능이 필요할 수 있음
  - 현재는 사용되지 않으므로 삭제 고려
- **삭제 권장**: ⚠️ **보류** (향후 기능 계획 확인 필요)

```tsx
// 컴포넌트 정의
export interface ChecklistItem {
  id: string;
  label: string;
  completed: boolean;
}

export interface ActionChecklistProps {
  items: ChecklistItem[];
  onToggle: (id: string) => void;
  title?: string;
}
```

---

#### 2. `confirmation-modal.tsx`
- **현재 사용**: ❌ 사용되지 않음
- **위치**: `src/components/custom/confirmation-modal.tsx`
- **Export**: `src/components/custom/index.ts`에서 export됨
- **실제 사용처**: 없음
- **검토 의견**:
  - 확인 모달은 일반적으로 많이 사용되는 패턴
  - 현재는 `window.confirm()` 또는 Dialog 컴포넌트를 직접 사용 중
  - 재사용 가능한 컴포넌트로 유용할 수 있음
- **삭제 권장**: ⚠️ **보류** (재사용 가능성 높음)

```tsx
// 컴포넌트 정의
export interface ImpactDetails {
  action: string;
  consequences: string[];
}

export interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  impact?: ImpactDetails;
  confirmText?: string;
  cancelText?: string;
}
```

---

#### 3. `view-switcher.tsx`
- **현재 사용**: ❌ 사용되지 않음
- **위치**: `src/components/custom/view-switcher.tsx`
- **Export**: `src/components/custom/index.ts`에서 export됨
- **실제 사용처**: `Switch` UI 컴포넌트만 import
- **검토 의견**:
  - 뷰 전환 기능은 향후 대시보드나 리포트 페이지에서 필요할 수 있음
  - 현재는 사용되지 않음
- **삭제 권장**: ✅ **삭제 권장** (필요 시 재구현 가능)

```tsx
// 컴포넌트 정의
export type ViewType = "grid" | "list" | "table";

export interface ViewSwitcherProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  availableViews?: ViewType[];
}
```

---

#### 4. `alert-banner.tsx`
- **현재 사용**: ❌ 사용되지 않음
- **위치**: `src/components/custom/alert-banner.tsx`
- **Export**: `src/components/custom/index.ts`에서 export됨
- **실제 사용처**: 없음
- **검토 의견**:
  - 알림 배너는 중요한 시스템 메시지 표시에 유용
  - 현재는 toast로 대체되어 사용 중
  - 페이지 상단 고정 배너가 필요한 경우 유용할 수 있음
- **삭제 권장**: ⚠️ **보류** (시스템 공지사항 기능 계획 확인 필요)

```tsx
// 컴포넌트 정의
export interface AlertAction {
  label: string;
  onClick: () => void;
}

export interface AlertBannerProps {
  type: "info" | "warning" | "error" | "success";
  message: string;
  dismissible?: boolean;
  onDismiss?: () => void;
  action?: AlertAction;
}
```

---

### UI Components (`src/components/ui/`)

#### 5. `accordion.tsx`
- **현재 사용**: ❌ 사용되지 않음
- **위치**: `src/components/ui/accordion.tsx`
- **실제 사용처**: 컴포넌트 자체 파일에서만 참조
- **검토 의견**:
  - Radix UI Accordion 래퍼
  - FAQ나 확장 가능한 섹션에 유용
- **삭제 권장**: ⚠️ **보류** (shadcn/ui 표준 컴포넌트)

---

#### 6. `avatar.tsx`
- **현재 사용**: ❌ 사용되지 않음
- **위치**: `src/components/ui/avatar.tsx`
- **실제 사용처**: 컴포넌트 자체 파일에서만 참조
- **검토 의견**:
  - Radix UI Avatar 래퍼
  - 사용자 프로필 이미지 표시에 유용
  - 팀 멤버 목록에서 사용 가능
- **삭제 권장**: ⚠️ **보류** (shadcn/ui 표준 컴포넌트, 향후 사용 가능성 높음)

---

#### 7. `checkbox.tsx`
- **현재 사용**: ⚠️ 제한적 사용
- **위치**: `src/components/ui/checkbox.tsx`
- **실제 사용처**: `dropdown-menu.tsx`에서만 import
- **검토 의견**:
  - Radix UI Checkbox 래퍼
  - dropdown-menu에서 사용되나, dropdown-menu 자체가 사용되지 않음
- **삭제 권장**: ⚠️ **보류** (shadcn/ui 표준 컴포넌트)

---

#### 8. `dropdown-menu.tsx`
- **현재 사용**: ❌ 사용되지 않음
- **위치**: `src/components/ui/dropdown-menu.tsx`
- **실제 사용처**: 컴포넌트 자체 파일에서만 참조
- **검토 의견**:
  - Radix UI Dropdown Menu 래퍼
  - 사용자 메뉴, 액션 메뉴 등에 매우 유용
  - 현재는 사용되지 않으나 향후 필요 가능성 높음
- **삭제 권장**: ⚠️ **보류** (shadcn/ui 표준 컴포넌트, 향후 사용 가능성 높음)

---

#### 9. `popover.tsx`
- **현재 사용**: ❌ 사용되지 않음
- **위치**: `src/components/ui/popover.tsx`
- **실제 사용처**: 컴포넌트 자체 파일에서만 참조
- **검토 의견**:
  - Radix UI Popover 래퍼
  - 툴팁이나 컨텍스트 메뉴에 유용
- **삭제 권장**: ⚠️ **보류** (shadcn/ui 표준 컴포넌트)

---

## 📊 요약

### 삭제 완료
- ✅ `use-toast.tsx` - sonner로 대체됨

### 삭제 권장
- ✅ `view-switcher.tsx` - 현재 사용되지 않으며 필요 시 재구현 가능

### 삭제 보류 (추가 검토 필요)

#### Custom Components (4개)
1. `action-checklist.tsx` - 향후 체크리스트 기능 계획 확인 필요
2. `confirmation-modal.tsx` - 재사용 가능성 높음
3. `alert-banner.tsx` - 시스템 공지사항 기능 계획 확인 필요

#### UI Components (5개)
1. `accordion.tsx` - shadcn/ui 표준 컴포넌트
2. `avatar.tsx` - 사용자 프로필 기능에 필요할 수 있음
3. `checkbox.tsx` - shadcn/ui 표준 컴포넌트
4. `dropdown-menu.tsx` - 메뉴 기능에 필요 가능성 높음
5. `popover.tsx` - shadcn/ui 표준 컴포넌트

---

## 💡 권장 사항

### 1. Custom Components
- **즉시 삭제**: `view-switcher.tsx`
- **제품 로드맵 확인 후 결정**:
  - `action-checklist.tsx` - 체크리스트 기능 필요 여부
  - `alert-banner.tsx` - 시스템 공지사항 기능 필요 여부
  - `confirmation-modal.tsx` - 현재 confirm() 사용 중, 향후 UX 개선 시 필요

### 2. UI Components (shadcn/ui)
- **보류 권장**: shadcn/ui 표준 컴포넌트들은 프로젝트 초기 설정 시 추가된 것으로 보임
- 실제로 번들 크기에 큰 영향을 주지 않으며, tree-shaking으로 제거됨
- 향후 기능 추가 시 바로 사용 가능하여 개발 속도 향상
- 삭제하더라도 필요 시 `npx shadcn@latest add` 명령으로 재설치 가능

### 3. 다음 단계
1. ✅ `view-switcher.tsx` 삭제
2. 제품 로드맵 확인
3. 사용하지 않는 custom components 제거 여부 결정
4. `src/components/custom/index.ts`에서 삭제된 컴포넌트 export 제거

---

## 🔧 삭제 시 추가 작업

### `view-switcher.tsx` 삭제 시:
```bash
# 1. 파일 삭제
rm src/components/custom/view-switcher.tsx

# 2. index.ts에서 export 제거
# src/components/custom/index.ts 파일에서 다음 라인 제거:
# export { ViewSwitcher, type ViewSwitcherProps, type ViewType } from "./view-switcher";
```

### 기타 컴포넌트 삭제 시:
동일한 방식으로 파일 삭제 후 `index.ts`에서 export 제거

---

## 📝 참고사항

- 이 문서는 2025-11-04 기준으로 작성됨
- 코드베이스 변경에 따라 주기적으로 업데이트 필요
- 삭제 전 반드시 전체 검색으로 사용처 재확인 권장
