# Color System Guidelines

_FinOps for AI Platform - Design System Documentation_
_Created: 2025-11-01_

---

## 목차

1. [개요](#개요)
2. [컬러 팔레트](#컬러-팔레트)
3. [사용 규칙](#사용-규칙)
4. [코드 예시](#코드-예시)
5. [일반적인 실수와 해결](#일반적인-실수와-해결)
6. [자동화된 검증](#자동화된-검증)

---

## 개요

FinOps for AI 플랫폼은 **Premium Indigo 다크 테마**를 사용하여 혁신성과 프리미엄 이미지를 전달합니다. 모든 색상은 CSS Custom Properties로 정의되어 있으며, **Tailwind 기본 색상 팔레트를 직접 사용하는 것은 금지**됩니다.

### 핵심 원칙

✅ **DO: CSS Custom Properties 사용**
```tsx
className="text-foreground bg-background border-border"
```

❌ **DON'T: Tailwind 기본 색상 직접 사용**
```tsx
className="text-gray-900 bg-white border-gray-300"  // ❌ 절대 사용 금지
```

### 왜 이것이 중요한가?

1. **테마 일관성**: 모든 컴포넌트가 동일한 색상 시스템을 따라야 합니다
2. **다크 모드 지원**: 라이트 모드 색상은 다크 모드에서 깨집니다
3. **브랜드 아이덴티티**: Premium Indigo 테마가 우리의 차별화 요소입니다
4. **유지보수성**: 색상 변경 시 CSS 변수만 수정하면 됩니다

---

## 컬러 팔레트

### Primary Colors (브랜드 컬러)

```css
--color-primary: 239 84% 67%;       /* #6366f1 - Indigo */
--color-primary-dark: 243 75% 59%;  /* #4338ca */
--color-primary-light: 238 76% 75%; /* #818cf8 */
--color-primary-foreground: 0 0% 100%; /* #ffffff */
```

**사용 예:**
- 주요 액션 버튼 (CTA)
- 브랜드 강조 요소
- Active 상태 표시
- 링크 색상

### Semantic Colors (상태 표시)

```css
--color-success: 158 64% 52%;  /* #10b981 - 녹색 */
--color-warning: 38 92% 50%;   /* #f59e0b - 오렌지 */
--color-error: 4 90% 58%;      /* #ef4444 - 빨강 */
--color-info: 217 91% 60%;     /* #3b82f6 - 파랑 */
```

**사용 예:**
- Success: 비용 절감, 목표 달성, 정상 작동
- Warning: 임계값 근접, 주의 필요
- Error: 한도 초과, 시스템 오류, 긴급 상황
- Info: 정보성 알림, 안내 메시지

### Neutral Colors (기본 UI)

```css
--color-background: 240 67% 6%;    /* #0f0a1a - 페이지 배경 */
--color-foreground: 0 0% 100%;     /* #ffffff - 주 텍스트 */

--color-muted: 240 21% 15%;        /* #1e1b29 - 보조 배경 */
--color-muted-foreground: 240 15% 65%; /* #a5a0b8 - 보조 텍스트 */

--color-card: 240 21% 15%;         /* #1e1b29 - 카드 배경 */
--color-card-foreground: 0 0% 100%; /* #ffffff - 카드 텍스트 */

--color-border: 240 23% 22%;       /* #312d40 - 테두리 */
--color-input: 240 23% 22%;        /* #312d40 - 입력 필드 */

--color-ring: 239 84% 67%;         /* #6366f1 - 포커스 링 */
```

### Extended Neutral Scale

```css
--color-neutral-900: 240 67% 6%;   /* #0f0a1a - 가장 어두움 */
--color-neutral-800: 240 21% 15%;  /* #1e1b29 */
--color-neutral-700: 240 23% 22%;  /* #312d40 */
--color-neutral-600: 240 22% 35%;  /* #5b5570 */
--color-neutral-500: 240 15% 65%;  /* #a5a0b8 */
--color-neutral-400: 240 20% 80%;  /* #c5c1d8 */
--color-neutral-100: 0 0% 100%;    /* #ffffff - 가장 밝음 */
```

---

## 사용 규칙

### 1. 텍스트 색상

| 용도 | Tailwind Class | CSS Variable |
|------|----------------|--------------|
| 주 텍스트 | `text-foreground` | `--color-foreground` |
| 보조 텍스트 | `text-muted-foreground` | `--color-muted-foreground` |
| 성공 메시지 | `text-success` | `--color-success` |
| 경고 메시지 | `text-warning` | `--color-warning` |
| 에러 메시지 | `text-error` | `--color-error` |
| 정보 메시지 | `text-info` | `--color-info` |

### 2. 배경 색상

| 용도 | Tailwind Class | CSS Variable |
|------|----------------|--------------|
| 페이지 배경 | `bg-background` | `--color-background` |
| 카드 배경 | `bg-card` | `--color-card` |
| 보조 배경 | `bg-muted` | `--color-muted` |
| 주요 버튼 | `bg-primary` | `--color-primary` |
| 성공 알림 (투명) | `bg-success/10` | `--color-success` (10% opacity) |

### 3. 테두리 색상

| 용도 | Tailwind Class | CSS Variable |
|------|----------------|--------------|
| 기본 테두리 | `border-border` | `--color-border` |
| 입력 필드 | `border-input` | `--color-input` |
| 성공 테두리 | `border-success` | `--color-success` |
| 경고 테두리 | `border-warning` | `--color-warning` |

### 4. Opacity 사용

투명도가 필요할 때는 `/` 구문 사용:

```tsx
// ✅ 올바른 사용
className="bg-primary/10"       // 10% opacity
className="bg-success/20"       // 20% opacity
className="border-error/30"     // 30% opacity
```

---

## 코드 예시

### ✅ 올바른 예시

#### 1. 페이지 헤더

```tsx
<div className="flex items-center justify-between">
  <h2 className="text-2xl font-bold text-foreground">
    비용 대시보드
  </h2>
  <p className="text-sm text-muted-foreground">
    마지막 업데이트: 2분 전
  </p>
</div>
```

#### 2. 알림 배너

```tsx
// Info 알림
<div className="rounded-lg border border-info/30 bg-info/10 p-4">
  <AlertCircle className="h-5 w-5 text-info" />
  <p className="text-sm text-info-foreground">
    데이터는 8-24시간 지연될 수 있습니다.
  </p>
</div>

// Warning 알림
<div className="rounded-lg border border-warning/30 bg-warning/10 p-4">
  <AlertTriangle className="h-5 w-5 text-warning" />
  <p className="text-sm text-warning-foreground">
    이번 주 예산의 80%를 사용했습니다.
  </p>
</div>
```

#### 3. Empty State

```tsx
<div className="rounded-lg border-2 border-dashed border-border p-12 text-center">
  <BarChart className="mx-auto h-12 w-12 text-muted-foreground" />
  <h3 className="mt-2 text-sm font-semibold text-foreground">
    데이터가 없습니다
  </h3>
  <p className="mt-1 text-sm text-muted-foreground">
    첫 데이터 수집은 내일 오전 9시에 시작됩니다.
  </p>
</div>
```

#### 4. 통계 카드

```tsx
<Card>
  <CardHeader>
    <CardTitle className="text-sm font-medium text-muted-foreground">
      어제 총 비용
    </CardTitle>
  </CardHeader>
  <CardContent>
    <div className="text-2xl font-bold text-foreground">
      $234.50
    </div>
  </CardContent>
</Card>
```

### ❌ 잘못된 예시

```tsx
// ❌ Tailwind 기본 색상 직접 사용
<h2 className="text-gray-900">비용 대시보드</h2>
<p className="text-gray-600">마지막 업데이트</p>

// ❌ 라이트 모드 색상
<div className="bg-blue-50 text-blue-700">
  알림 메시지
</div>

// ❌ 하드코딩된 회색 팔레트
<div className="border-gray-300 bg-gray-100">
  Empty State
</div>

// ❌ 임의의 색상 코드
<p className="text-[#666666]">보조 텍스트</p>
```

---

## 일반적인 실수와 해결

### 실수 1: 페이지 헤더에 gray 팔레트 사용

**문제:**
```tsx
<h2 className="text-2xl font-bold text-gray-900">
  비용 대시보드
</h2>
<p className="text-sm text-gray-600">
  마지막 업데이트: 2분 전
</p>
```

**해결:**
```tsx
<h2 className="text-2xl font-bold text-foreground">
  비용 대시보드
</h2>
<p className="text-sm text-muted-foreground">
  마지막 업데이트: 2분 전
</p>
```

### 실수 2: Info 알림에 blue 팔레트 사용

**문제:**
```tsx
<div className="rounded-lg bg-blue-50 p-4">
  <AlertCircle className="h-5 w-5 text-blue-400" />
  <p className="text-sm text-blue-700">
    데이터는 지연될 수 있습니다.
  </p>
</div>
```

**해결:**
```tsx
<div className="rounded-lg border border-info/30 bg-info/10 p-4">
  <AlertCircle className="h-5 w-5 text-info" />
  <p className="text-sm text-info-foreground">
    데이터는 지연될 수 있습니다.
  </p>
</div>
```

### 실수 3: Empty State에 라이트 모드 색상 사용

**문제:**
```tsx
<div className="rounded-lg border-2 border-gray-300 border-dashed p-12">
  <BarChart className="mx-auto h-12 w-12 text-gray-400" />
  <h3 className="mt-2 text-sm font-semibold text-gray-900">
    데이터가 없습니다
  </h3>
</div>
```

**해결:**
```tsx
<div className="rounded-lg border-2 border-dashed border-border p-12">
  <BarChart className="mx-auto h-12 w-12 text-muted-foreground" />
  <h3 className="mt-2 text-sm font-semibold text-foreground">
    데이터가 없습니다
  </h3>
</div>
```

---

## 자동화된 검증

### Biome의 한계

Biome는 JavaScript/TypeScript 린팅에 특화되어 있어 **Tailwind className 내부의 특정 색상 패턴을 검증할 수 없습니다**.

### 커스텀 검증 스크립트

대신 다음과 같은 커스텀 검증 스크립트를 제공합니다:

```bash
# 금지된 색상 패턴 검사
npm run validate:colors

# Pre-commit hook에 통합됨
git commit -m "..."  # 자동으로 검증 실행
```

### 검증 대상 패턴

다음 패턴들은 자동으로 검출되어 에러로 표시됩니다:

- `text-gray-*` → `text-foreground` 또는 `text-muted-foreground` 사용
- `bg-gray-*` → `bg-background`, `bg-card`, `bg-muted` 사용
- `border-gray-*` → `border-border` 사용
- `text-blue-*` → `text-info` 사용
- `bg-blue-*` → `bg-info/10` 사용
- `text-green-*` → `text-success` 사용
- `text-red-*` → `text-error` 사용
- `text-yellow-*`, `text-orange-*` → `text-warning` 사용

### 예외 처리

정당한 이유로 기본 색상을 사용해야 하는 경우:

```tsx
// eslint-disable-next-line validate-colors
className="text-gray-500"  // 명시적 주석으로 검증 스킵
```

---

## 참고 자료

- **UX Design Specification**: `docs/ux-design-specification.md`
- **Global Styles**: `src/styles/globals.css`
- **Tailwind Config**: `tailwind.config.ts`
- **Color Validation Script**: `scripts/validate-colors.ts`

---

## 변경 이력

- **2025-11-01**: 초기 문서 작성 (Story 1.2 리뷰 결과 반영)

---

**질문이나 제안사항이 있으신가요?**
GitHub Issues 또는 팀 Slack #design-system 채널로 문의해주세요.
