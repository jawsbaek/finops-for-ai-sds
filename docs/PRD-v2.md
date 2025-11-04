# finops-for-ai Product Requirements Document (PRD)

**Author:** Issac
**Date:** 2025-10-31
**Updated:** 2025-01-04 (Costs API Migration)
**Project Level:** 2
**Target Scale:** MVP - AI Cost Management Platform

> **🔄 MIGRATION NOTE:** This document has been updated to reflect the OpenAI Costs API migration. The system now uses team-level Admin API Keys and Project ID filtering instead of project-level API keys. See [BREAKING_CHANGES.md](./migration/BREAKING_CHANGES.md) for details.

---

## Goals and Background Context

### Goals

- **실시간 AI 비용 가시성 확보**: 모든 이해관계자가 현재 AI 지출을 실시간으로 파악하고, 토큰/GPU 시간 등 AI-specific 메트릭을 추적할 수 있다
- **공정한 팀별 비용 귀속 달성**: 공유 AI 리소스(GPU 클러스터, API)의 사용량을 팀/프로젝트별로 자동 분배하여 책임 소재를 명확히 한다
- **예산 초과 방지**: 비용 임계값 설정 및 실시간 알림을 통해 예상치 못한 AI 비용 급증을 90% 감소시킨다

### Background Context

AI 도입이 가속화되면서 조직들은 전례 없는 비용 관리 위기에 직면하고 있습니다. 66%의 팀이 예상치 못한 AI 비용 급증을 경험했으며, 단 13%만이 AI 비용을 예측할 수 있다고 응답했습니다.

핵심 문제는 **가시성 부재**입니다. 기존 클라우드 FinOps 도구들은 토큰, 임베딩, GPU 시간 등 AI-native 비용 단위를 추적할 수 없으며, 공유 리소스의 책임 소재가 불분명합니다. 더 근본적으로는 ML 엔지니어("성능"), 재무팀("비용"), PM("가치") 간 언어의 분열로 인해 조직 전체가 동일한 데이터를 보면서도 다르게 해석하고 있습니다.

광범위한 시장 리서치와 브레인스토밍 세션을 통해 "실시간 비용 가시성 대시보드"가 Quick Win이자 최우선 과제로 식별되었습니다. AI 비용 관리 시장은 1년 만에 2배 성장(31% → 63% 채택률)했으며, APAC 지역은 특히 급성장 중(연 33.6% CAGR)입니다. 한국어 네이티브 지원과 AI-native 접근법으로 시장을 선점할 최적의 타이밍입니다.

---

## Requirements

### Functional Requirements

> **First Principles 기반 설계**: 가정을 벗겨내고 근본 문제("한정된 예산으로 최대 가치 창출")로부터 재구축
>
> **핵심 원칙**:
> 1. **가치-비용 연결**: 비용은 항상 얻은 가치와 함께 표시
> 2. **행동 유도**: 정보 제공이 아닌 실제 비용 절감 행동 유도가 목표
> 3. **단순성 우선**: 한 가지를 완벽히 > 여러 가지를 부실하게
> 4. **아키텍처로 해결**: 프로세스/태그 의존 전에 격리 아키텍처로 근본 해결
> 5. **즉시성의 선택**: 위급한 것만 실시간, 일상은 일일 배치로 충분

#### **Phase 1A: 핵심 가설 검증 (Week 1-4)**
**가설**: "비용-가치 연결이 실제 의사결정을 개선하는가?"

**비용-가치 통합 추적 (Cost-Value Integration)**
- FR001: 시스템은 **OpenAI Costs API**를 통해 organization 비용 데이터를 일일 배치(매일 오전 9시 KST)로 수집하고 전일 총 비용을 표시해야 한다
  - ※ Costs API는 organization-level 집계 데이터를 제공하며, 8-24시간 지연이 발생할 수 있음
- FR002: 시스템은 각 API 호출에 대해 비용과 함께 컨텍스트(프로젝트명, 작업 유형, 사용자 의도)를 기록해야 한다
- FR003: 시스템은 프로젝트/실험별로 "총 비용" 및 "비용 대비 성과"(성공한 작업 수, 사용자 피드백 점수 등)를 함께 표시해야 한다
  - ※ Costs API는 organization-level 집계 데이터 제공 (8-24시간 지연)

**실시간 비용 폭주 방지 (Real-time Cost Runaway Prevention)**
- FR004: 시스템은 프로젝트별 일일/주간 비용 임계값을 설정하고, 초과 시 즉시(<1분) Slack/이메일 알림을 발송해야 한다
- FR005: 시스템은 임계값 초과 시 관리자 승인 전까지 해당 Team Admin API 키를 자동으로 비활성화할 수 있어야 한다

**행동 유도 리포트 (Action-Driven Reporting)**
- FR006: 시스템은 주간 리포트를 생성하여 "가장 비용 효율적인 프로젝트 Top 3" 및 "개선 필요 프로젝트 Top 3"를 하이라이트해야 한다

**아키텍처 기반 귀속 (Architecture-based Attribution)**
- FR007: 시스템은 팀별로 **OpenAI Organization Admin API Key**를 등록하고 관리할 수 있어야 한다
- **FR007-B (NEW)**: 시스템은 프로젝트별로 **OpenAI Project ID**를 등록하고, Admin Key로 접근 가능한지 검증해야 한다
- **FR007-C (NEW)**: 비용 수집 시 Admin Key + Project IDs 필터링으로 프로젝트별 비용을 자동 귀속해야 한다 (태그 불필요)

#### **Phase 1B: 클라우드 확장 (Week 5-8)**
**가설**: "추가 클라우드 통합이 실제 가치를 더하는가?"

**순차적 클라우드 통합 (Sequential Cloud Integration)**
- FR008: 시스템은 사용자 요청에 따라 AWS **또는** Azure 중 하나를 선택하여 통합해야 한다 (동시 지원 아님)
- FR009: 시스템은 선택된 클라우드(AWS/Azure)의 AI 서비스 비용을 일일 배치로 수집하고 OpenAI 비용과 통합 표시해야 한다 (8-24시간 지연 명시)

**아키텍처 격리 권고 (Architecture Isolation Recommendations)**
- FR010: 시스템은 클라우드 리소스 격리 아키텍처 권고(팀별 AWS 계정 분리, 프로젝트별 Azure 리소스 그룹 격리)를 제공해야 한다

**기본 UI 및 인증 (Basic UI & Authentication)**
- FR011: 시스템은 이메일/비밀번호 기반 사용자 인증 및 한국어 인터페이스를 제공해야 한다

#### **Phase 1C: 검증 및 학습 (Week 9-12)**
**목표**: "사용자가 실제로 비용 절감 행동을 하는가? 다음 무엇이 필요한가?"

**행동 변화 측정 (Behavior Change Measurement)**
- FR012: 시스템은 사용자의 비용 절감 행동(API 키 변경, 프로젝트 중단, 임계값 조정, 모델 변경)을 추적하고 리포트 효과성을 측정해야 한다

**피드백 루프 (Feedback Loop)**
- FR013: 시스템은 사용자 인터뷰 일정 잡기 UI, 피드백 수집 폼, "다음 필요 기능" 투표 기능을 제공해야 한다

---

#### **Phase 2 이후: 검증 후 확장**

**Note**: Phase 2 이상의 기능은 Phase 1C 피드백 기반으로 우선순위를 재조정합니다. 아래는 잠재적 기능 후보입니다.

**잠재적 Phase 2 기능들**:
- 대시보드 UI 개선 (현재는 주간 리포트 중심)
- 추가 클라우드 통합 (AWS와 Azure 동시 지원)
- 팀별 예산 관리 및 소진율 추적
- 영어 인터페이스 지원
- 태그 기반 비용 귀속 (레거시 리소스용)
- 온프레미스 GPU 비용 수동 입력
- 멀티 계정/구독 통합 뷰
- SSO 인증 (Google, Microsoft)
- 역할별 접근 제어
- 3년 히스토리 데이터 보관 및 장기 트렌드 분석

**우선순위 결정 기준**:
1. Phase 1C 사용자 투표 결과
2. 실제 비용 절감 효과 데이터
3. 고객 이탈 방지에 필요한 기능

### Non-Functional Requirements

**성능 (Performance)**
- NFR001: 시스템은 대시보드 초기 로딩 시간을 3초 이내로 제공해야 한다 (P95 기준)
- NFR002: 시스템은 비용 임계값 초과 감지 후 5분 이내에 알림을 발송해야 한다 (5분 폴링 주기)

**가용성 및 신뢰성 (Availability & Reliability)**
- NFR003: 시스템은 99.5% 이상의 가동률을 유지해야 한다 (MVP 목표, 월 최대 3.6시간 다운타임 허용)

**보안 (Security)**
- NFR004: 시스템은 모든 클라우드 제공사 API 자격증명 및 Admin API Key를 AES-256으로 암호화하여 저장해야 한다
- NFR005: 시스템은 모든 통신에 TLS 1.3 이상을 사용해야 한다

---

## User Journeys

### Primary Journey: 비용 급증 감지 및 즉시 대응

**사용자**: FinOps 관리자 (이지훈)
**목표**: AI 비용 폭주를 조기에 발견하고 즉시 중단하여 예산 손실 방지
**빈도**: 주 1-2회 (비정상 상황 발생 시)

**여정 흐름**:

1. **알림 수신** (월요일 오후 2시)
   - 이지훈은 Slack에서 비용 임계값 초과 알림을 받음
   - 메시지: "🚨 [마케팅팀] 일일 한도 $500 초과 - 현재 $742 (148%)"
   - 컨텍스트: "chatbot-experiment 프로젝트"

2. **상황 파악** (2분 소요)
   - Slack 알림의 "상세 보기" 링크 클릭 → 웹 대시보드 열림
   - 주간 리포트에서 "chatbot-experiment"의 비용 추이 확인
   - 주간 리포트에서 해당 프로젝트의 **OpenAI Project ID** 확인
   - 발견: 어제까지 일 $50 수준 → 오늘 갑자기 $742로 급증
   - 원인 파악: API 호출 수가 평소의 15배 (새로운 무한 루프 버그 의심)

3. **즉시 차단** (30초 소요)
   - 대시보드에서 **"팀 Admin API 키 비활성화"** 버튼 클릭 (전체 팀 프로젝트 중단) 또는 **"프로젝트 Project ID 제거"** (해당 프로젝트만 제외)
   - 확인 팝업: "이 키를 사용하는 모든 애플리케이션이 중단됩니다. 계속하시겠습니까?"
   - "예, 즉시 차단" 선택
   - 시스템이 Admin API 키를 즉시 비활성화 → 추가 비용 발생 중단

4. **팀 커뮤니케이션** (5분 소요)
   - 마케팅팀 팀장(김민수)에게 Slack DM 발송
   - "chatbot-experiment API 키를 긴급 차단했습니다. 무한 루프 버그로 의심됩니다. 확인 후 연락 주세요."
   - 김민수 확인: "네, 방금 배포한 코드에 재시도 로직 버그가 있었습니다. 수정하겠습니다."

5. **복구 및 모니터링** (10분 소요)
   - 김민수가 버그 수정 후 코드 리뷰 완료 확인
   - 이지훈이 Admin API 키 재활성화 또는 Project ID 재등록
   - 시스템이 다음 날 모니터링 계속

**결과**:
- ✅ 추가 손실 $258 방지 (만약 알림이 없었다면 하루 더 실행되어 추가 $742 손실)
- ✅ 총 17.5분 만에 문제 발견 → 차단 → 복구 완료
- ✅ 마케팅팀이 재발 방지 프로세스 수립 (코드 리뷰 강화, 재시도 로직 테스트)

**핵심 터치포인트**:
- FR004: 실시간 임계값 초과 알림
- FR005: 즉시 Admin API 키 비활성화
- FR006: 주간 리포트로 정상 패턴 대비 이상 징후 파악
- FR012: 행동 추적 (차단 결정의 효과성 측정)

---

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

---

## UX Design Principles

> **Note**: 상세 UX 설계는 별도 UX workflow에서 진행. 여기서는 핵심 원칙만 정의

**1. 행동 우선 (Action-First)**
- 정보 나열이 아닌 "다음 할 일"을 명확히 제시
- 예: "비용 $742 초과" → "지금 차단하기" 버튼 즉시 표시

**2. 푸시 중심, 풀 보조 (Push-First, Pull-Secondary)**
- 사용자가 찾아오는 대시보드(Pull)보다 알림과 리포트(Push)로 먼저 전달
- 대시보드는 "상세 확인" 및 "긴급 조치" 용도

**3. 맥락과 함께 (Context-Aware)**
- 단순 숫자가 아닌 "왜 중요한가" 설명 포함
- 예: "오늘 $742 지출" → "평소($50) 대비 1,384% 증가"

**4. 한국어 우선 (Korean-First)**
- Phase 1은 한국어만 지원, 영어는 Phase 3 이후
- 한국 비즈니스 문화 반영 (상급자 보고 포맷, 경어 사용)

---

## User Interface Design Goals

**플랫폼**: Web (반응형)
**브라우저 지원**: Chrome, Safari, Edge 최신 버전

**Phase 1 UI 구성**:

1. **주간 이메일 리포트** (핵심)
   - 자동 발송: 매주 월요일 오전 9시
   - 내용: Top 3 비용 효율 프로젝트, Bottom 3 개선 필요 프로젝트, 주간 총 비용, 전주 대비 증감률

2. **실시간 알림** (Slack/이메일)
   - 비용 임계값 초과 시 즉시 발송
   - 클릭 한 번으로 대시보드 열람 및 조치

3. **기본 웹 대시보드** (보조)
   - **홈 화면**: 전일/전주/전월 총 비용, 주요 프로젝트 비용 Top 5
   - **프로젝트 상세**: 비용 추이 그래프, 비용-가치 메트릭, API 키 관리
   - **긴급 조치**: Admin API 키 비활성화 버튼, 임계값 설정

**UI 제약사항**:
- 대시보드는 "정보 소비"가 아닌 "긴급 조치"에 최적화
- Phase 1C 피드백 후 UI 개선 우선순위 재조정

---

## Epic List

> **전략**: First Principles 접근에 따라 핵심 가치 제공에 집중한 2개의 Epic으로 구성

### Epic 1: 프로젝트 기반 및 OpenAI 비용 관리 시스템
**목표**: OpenAI Costs API 비용 추적, 실시간 폭주 방지, 행동 유도 리포트를 통해 즉각적인 가치 제공
**기간**: Week 1-6
**예상 스토리 수**: 8-10개

**핵심 기능**:
- 프로젝트 인프라 설정 (CI/CD, 데이터베이스, 기본 인증, Costs API 지원)
- **OpenAI Costs API** 비용 일일 배치 수집 및 표시 (organization-level)
- 비용-가치 컨텍스트 기록 (프로젝트별 성과 추적)
- 실시간 비용 임계값 알림 및 Admin API 키 긴급 차단
- 주간 리포트 (Top 3/Bottom 3 프로젝트)
- **팀 Admin API 키 등록 및 프로젝트 ID 관리** (Costs API 필터링)
- 기본 웹 대시보드 (긴급 조치용)

**검증 기준**:
- 최소 1개 팀이 실제 비용 절감 행동 수행
- 비용 폭주 알림으로 실제 손실 방지 사례 1건 이상

---

### Epic 2: 클라우드 확장 및 검증 루프
**목표**: AWS/Azure 통합으로 적용 범위 확대, 사용자 행동 측정을 통한 제품 개선 방향 확정
**기간**: Week 7-12
**예상 스토리 수**: 5-7개

**핵심 기능**:
- AWS 또는 Azure 선택적 통합 (사용자 요청 기반)
- 클라우드 비용 일일 배치 수집 및 OpenAI 통합 표시
- 아키텍처 격리 권고 기능
- 사용자 비용 절감 행동 추적 및 효과성 측정
- 피드백 수집 UI (인터뷰 예약, 기능 투표)

**검증 기준**:
- Phase 2 기능 우선순위가 사용자 투표로 결정됨
- 행동 추적 데이터로 리포트 효과성 정량화

---

**총 예상**: 2 Epics, 13-17 Stories (Level 2 권장 범위: 1-2 epics, 5-15 stories)

> **Note:** Detailed epic breakdown with full story specifications is available in [epics.md](./epics.md)

---

## Out of Scope

> **Phase 1 (12주) 범위에서 명시적으로 제외된 기능들**
>
> **철학**: First Principles 접근에 따라 핵심 가치 검증에 집중. 아래 기능들은 Phase 1C 사용자 피드백 후 우선순위 재평가

### Phase 1에서 제외 (Phase 2+ 후보)

**고급 대시보드 기능**
- 실시간 자동 새로고침 대시보드 (일일 배치로 충분)
- 커스텀 대시보드 빌더 (역할별 고정 뷰로 시작)
- 고급 필터링 (드릴다운, 다차원 분석)
- 대시보드 공유 및 북마크 기능

**AI 예측 및 최적화**
- AI 비용 예측 엔진 (데이터 수집 기간 필요)
- 자동 최적화 권고 (복잡한 ML 모델 필요)
- 이상 탐지 알고리즘 (단순 임계값 초과로 충분)
- 시나리오 시뮬레이션 ("만약 X하면 비용은?")

**고급 통합**
- Anthropic Claude API 통합
- Google Vertex AI 통합
- Databricks, Snowflake 데이터 플랫폼 통합
- Kubernetes/Kubecost 컨테이너 비용 추적
- 국내 클라우드 (Naver Cloud, KT Cloud, Samsung Cloud Platform)
- 온프레미스 GPU 자동 수집 (수동 입력도 Phase 1 제외)

**조직 및 권한 관리**
- 복잡한 조직 계층 구조 (팀 수준으로 충분)
- SSO 통합 (Google, Microsoft)
- 세밀한 역할 기반 접근 제어 (RBAC)
- 감사 로그 및 컴플라이언스 리포팅

**예산 및 재무 기능**
- 팀별 예산 할당 및 소진율 추적
- 자동 showback/chargeback 리포트
- 비용 배분 규칙 엔진
- 다중 통화 지원
- 회계 시스템 통합 (ERP)

**협업 및 워크플로우**
- 비용 이상에 대한 댓글 및 토론
- 승인 워크플로우 (고비용 실험 사전 승인)
- 팀 간 비용 할당 조정 협상
- Jira, Asana 등 프로젝트 관리 도구 통합

**모바일 및 다국어**
- 네이티브 모바일 앱 (iOS, Android)
- 영어 인터페이스 (한국어만 Phase 1)
- 추가 언어 지원 (일본어, 중국어 등)

**장기 데이터 및 분석**
- 3년 이상 히스토리 데이터 보관
- 장기 트렌드 분석 및 계절성 감지
- 벤치마킹 (타 고객 익명 데이터 비교)
- 고급 분석 (비용 드라이버 분석, what-if 시나리오)

**기타 고급 기능**
- API 제공 (외부 시스템 통합)
- Webhook 이벤트 (비용 변화 알림)
- 태그 기반 자동 비용 귀속 (Admin Key + Project ID로 충분)
- CSV/PDF 외 추가 내보내기 형식
- 멀티 AWS 계정/Azure 구독 통합 뷰

---

### 명시적으로 하지 않을 것들 (장기적으로도)

**비용 자동 최적화 실행**
- 이유: 비용 절감 "권고"까지만 제공. 실제 실행(리소스 삭제, 스케일 다운)은 사용자 책임
- 리스크: 자동 최적화로 인한 서비스 중단 가능성

**AI 모델 학습 비용 추적**
- 이유: 학습 비용은 추론 비용과 패턴이 완전히 다름. 별도 제품 필요
- Phase 1은 API 기반 추론 비용만 다룸

**비AI 클라우드 비용 관리**
- 이유: 기존 FinOps 도구가 이미 잘 하고 있음
- 차별화: AI-specific 비용만 집중
