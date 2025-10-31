# finops-for-ai - Epic Breakdown

**Author:** Issac
**Date:** 2025-10-31
**Project Level:** 2
**Target Scale:** MVP - AI Cost Management Platform

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

**목표**: OpenAI API 비용 추적, 실시간 폭주 방지, 행동 유도 리포트를 통해 즉각적인 가치 제공

**기간**: Week 1-6

**예상 스토리 수**: 9개

**가치 제안**:
- 첫 주부터 OpenAI 비용 가시성 확보
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

### Story 1.2: OpenAI API 비용 일일 배치 수집 시스템

**As a** FinOps 관리자,
**I want** OpenAI API 사용 내역을 매일 자동으로 수집하여,
**So that** 전일 총 비용을 확인하고 프로젝트별 지출을 파악할 수 있다.

**Acceptance Criteria:**
1. 시스템은 매일 오전 9시 KST에 OpenAI API를 호출하여 전일 사용 내역을 가져와야 한다 (FR001)
2. 수집된 데이터는 cost_data 테이블에 저장되어야 한다 (날짜, API 키, 모델, 토큰 수, 비용)
3. 홈 화면에 "어제 총 비용" 및 "이번 주 총 비용"이 표시되어야 한다
4. 데이터 수집 실패 시 관리자에게 이메일 알림이 발송되어야 한다
5. API 자격증명은 AES-256으로 암호화되어 저장되어야 한다 (NFR004)

**Prerequisites:** Story 1.1 (인프라 및 데이터베이스)

**Technical Notes:**
- OpenAI API: `/v1/usage` endpoint (requires organization API key)
- Scheduler: Cron job or AWS EventBridge/Azure Functions
- Error handling: Retry logic with exponential backoff

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
2. 시스템은 OpenAI API 비용 데이터를 5분마다 확인하여 임계값 초과 여부를 검사해야 한다
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

### Story 1.7: 팀별 API 키 생성 및 자동 귀속

**As a** 시스템 관리자,
**I want** 팀별로 별도의 OpenAI API 키를 생성하고 관리하여,
**So that** 태그 없이도 비용이 자동으로 팀에 귀속되도록 할 수 있다.

**Acceptance Criteria:**
1. 시스템은 "팀" 엔티티를 생성할 수 있어야 한다 (팀명, 담당자, 예산)
2. 각 팀에 대해 고유한 OpenAI API 키를 생성하고 관리할 수 있어야 한다 (FR007)
3. 비용 데이터 수집 시 API 키를 기준으로 팀을 자동 식별해야 한다
4. 홈 화면에 "팀별 비용 Top 5" 차트가 표시되어야 한다
5. 팀 관리 페이지에서 API 키 생성, 조회, 비활성화를 할 수 있어야 한다

**Prerequisites:** Story 1.2 (비용 데이터 수집)

**Technical Notes:**
- API key mapping: api_keys table with team_id foreign key
- Isolation: One API key per team (no sharing)
- Billing: Aggregate costs by team_id for reporting

---

### Story 1.8: 긴급 조치용 기본 웹 대시보드

**As a** FinOps 관리자,
**I want** 비용 현황을 한눈에 파악하고 긴급 조치를 취할 수 있는 대시보드를,
**So that** 알림 받은 후 즉시 상황을 이해하고 대응할 수 있다.

**Acceptance Criteria:**
1. 홈 화면에 "전일/전주/전월 총 비용" 카드가 표시되어야 한다
2. 홈 화면에 "주요 프로젝트 비용 Top 5" 차트가 표시되어야 한다
3. 프로젝트 상세 페이지에 비용 추이 그래프(최근 30일)가 표시되어야 한다
4. 프로젝트 상세 페이지에서 임계값 설정 및 API 키 비활성화가 가능해야 한다
5. 대시보드 초기 로딩 시간은 3초 이내여야 한다 (NFR001)

**Prerequisites:** Story 1.7 (모든 데이터 수집 및 기능 완성)

**Technical Notes:**
- UI library: Recharts or Chart.js for visualization
- Performance: Server-side rendering + caching for fast load
- Mobile: Responsive design for tablet/mobile access

---

### Story 1.9: Epic 1 통합 테스트 및 검증

**As a** 품질 보증 엔지니어,
**I want** 모든 Epic 1 기능이 통합되어 정상 작동하는지 확인하고,
**So that** 사용자에게 안정적인 OpenAI 비용 관리 시스템을 제공할 수 있다.

**Acceptance Criteria:**
1. 엔드투엔드 시나리오 테스트가 성공해야 한다 (회원가입 → API 키 생성 → 비용 수집 → 알림 → 비활성화)
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

**For implementation:** Use the `create-story` workflow to generate individual story implementation plans from this epic breakdown.
