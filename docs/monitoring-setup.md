# 모니터링 및 관찰성 설정

## 개요

이 문서는 FinOps for AI 시스템의 모니터링 및 관찰성 설정을 설명합니다.

## Vercel Analytics

### 설정 방법

1. Vercel 대시보드에서 프로젝트 선택
2. **Analytics** 탭으로 이동
3. **Enable Analytics** 클릭

### 모니터링 메트릭

- **Core Web Vitals**
  - LCP (Largest Contentful Paint): <2.5초
  - FID (First Input Delay): <100ms
  - CLS (Cumulative Layout Shift): <0.1

- **Uptime Tracking**
  - 목표: 99.5% 이상 (NFR003)
  - 최대 허용 다운타임: 3.6시간/주

### 알림 설정

Vercel Analytics는 자동으로 다음과 같은 알림을 제공합니다:
- 배포 실패
- 빌드 실패
- 심각한 성능 저하

## Sentry Error Tracking

### 설정 방법

1. [Sentry.io](https://sentry.io)에서 계정 생성
2. 새 프로젝트 생성 (Next.js 선택)
3. DSN 키 복사
4. 환경 변수 설정:

```bash
# .env.local
SENTRY_DSN=your-sentry-dsn-here
NEXT_PUBLIC_SENTRY_DSN=your-sentry-dsn-here
```

### 에러 캡처

Sentry는 다음과 같은 에러를 자동으로 캡처합니다:
- 런타임 에러 (Unhandled exceptions)
- Promise rejections
- React 에러 바운더리
- API 요청 실패 (5xx 에러)
- tRPC 에러

### 알림 설정

1. Sentry 프로젝트 설정 → **Alerts** 탭
2. 새 알림 규칙 생성:

**Critical Errors Alert**
- 조건: Error level >= 'error'
- 빈도: 1분 내 5회 이상
- 액션: Email 및 Slack 알림

**Performance Degradation Alert**
- 조건: Transaction duration > 3초 (P95)
- 빈도: 5분 내 10회 이상
- 액션: Email 알림

### Slack 통합

1. Sentry 프로젝트 설정 → **Integrations**
2. Slack 통합 활성화
3. 알림 채널 선택: `#finops-alerts`

## 커스텀 메트릭

### Cron Job 성공률

Cron job 실행 로그는 `cron_logs` 테이블에 기록됩니다:

```sql
SELECT
  job_name,
  COUNT(*) as total_runs,
  SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_runs,
  ROUND(SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as success_rate
FROM cron_logs
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY job_name;
```

목표 성공률: 99% 이상

### 알림 발송 성공률

알림 발송 로그는 `cost_alerts` 테이블의 `sent_at` 필드로 추적:

```sql
SELECT
  COUNT(*) as total_alerts,
  SUM(CASE WHEN sent_at IS NOT NULL THEN 1 ELSE 0 END) as sent_alerts,
  ROUND(SUM(CASE WHEN sent_at IS NOT NULL THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as send_rate
FROM cost_alerts
WHERE created_at >= NOW() - INTERVAL '7 days';
```

목표: 95% 이상 (NFR002)

### API 응답 시간

Sentry Performance Monitoring을 통해 자동 추적:

- **tRPC 프로시저 응답 시간**
  - P50: <500ms
  - P95: <2000ms
  - P99: <5000ms

- **Cron Job 실행 시간**
  - daily-batch: <30초
  - poll-threshold: <10초
  - weekly-report: <60초

## 로그 분석

### Pino Logger

프로덕션 환경에서는 Pino logger를 사용하여 구조화된 로그를 생성합니다:

```typescript
import logger from '@/lib/logger';

logger.info('Cost data collected', {
  projectId: project.id,
  date: date.toISOString(),
  totalCost: cost.total,
});
```

### Vercel Logs

Vercel 대시보드에서 실시간 로그 확인:

1. Vercel 프로젝트 → **Logs** 탭
2. 필터링 옵션:
   - 에러만 보기
   - 특정 경로 필터
   - 시간 범위 선택

## 가동률 측정

### 7일 가동률 계산

```typescript
// 가동률 = (총 시간 - 다운타임) / 총 시간 * 100
const totalTime = 7 * 24 * 60; // 분
const downtimeMinutes = getTotalDowntime(); // Vercel Analytics에서 가져옴
const uptime = ((totalTime - downtimeMinutes) / totalTime) * 100;

console.log(`7일 가동률: ${uptime.toFixed(2)}%`);
```

### 목표 (NFR003)

- **가동률**: 99.5% 이상
- **최대 다운타임**: 3.6시간/주 (216분)
- **Mean Time To Recovery (MTTR)**: <30분

## 대시보드

### Sentry Dashboard

주요 메트릭:
- Error rate (24시간)
- Crash-free sessions
- Release adoption
- Slow transactions

### Vercel Analytics Dashboard

주요 메트릭:
- Real User Monitoring (RUM)
- Core Web Vitals trends
- Top pages by performance
- Geographic distribution

## 트러블슈팅

### Sentry 에러가 보고되지 않을 때

1. DSN 환경 변수 확인
2. Sentry 설정 파일 확인 (sentry.client.config.ts, sentry.server.config.ts)
3. 브라우저 개발자 도구에서 네트워크 탭 확인 (sentry.io로 요청 전송 확인)

### Vercel Analytics 데이터가 없을 때

1. Vercel 프로젝트에서 Analytics 활성화 확인
2. 프로덕션 배포 확인 (preview 배포는 별도 추적)
3. 최소 24시간 대기 (데이터 집계 시간)

## 검증

### AC #2: 시스템 가동률 99.5% 이상

```bash
# Vercel Analytics에서 7일간 가동률 조회
vercel analytics --uptime --days 7

# 또는 Vercel 대시보드에서 수동 확인:
# 1. Vercel 프로젝트 → Analytics → Uptime
# 2. 시간 범위: Last 7 days
# 3. Uptime percentage 확인
```

예상 결과: 99.5% 이상

## 참고 자료

- [Vercel Analytics Documentation](https://vercel.com/docs/analytics)
- [Sentry Next.js Documentation](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Pino Logger Documentation](https://getpino.io/)
