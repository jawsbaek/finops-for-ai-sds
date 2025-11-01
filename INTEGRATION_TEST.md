# Cron Job 통합 테스트 가이드

Story 1.4의 비용 임계값 모니터링 시스템 통합 테스트 가이드입니다.

## 테스트 시나리오: 비용 임계값 초과 알림

### 전제 조건

1. **환경 변수 설정** (.env.local)
   ```bash
   # 필수
   DATABASE_URL="postgresql://..."
   CRON_SECRET="your-cron-secret"  # openssl rand -base64 32

   # Email 알림 (필수)
   RESEND_API_KEY="re_xxxxx"
   RESEND_FROM_EMAIL="alerts@your-domain.com"

   # Slack 알림 (선택사항)
   SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..."
   ```

2. **개발 서버 실행**
   ```bash
   bun run dev
   ```

### 테스트 단계

#### 1. 테스트 데이터 준비

**Prisma Studio로 데이터 생성:**

```bash
bun prisma studio
```

**필요한 데이터:**

1. **Team 생성**
   - name: "Test Team"

2. **User 생성** (이미 있으면 스킵)
   - email: "test@example.com"

3. **TeamMember 연결**
   - userId: (User ID)
   - teamId: (Team ID)

4. **Project 생성**
   - name: "Test Project"
   - teamId: (Team ID)

5. **CostAlert 생성**
   - projectId: (Project ID)
   - thresholdType: "daily"
   - thresholdValue: 100.00
   - isActive: true

6. **CostData 생성** (임계값 초과 데이터)
   - projectId: (Project ID)
   - date: (오늘 날짜, 예: 2025-11-02T00:00:00.000Z)
   - cost: 150.00  ← 임계값(100) 초과!
   - usage: 1000
   - model: "gpt-4"

#### 2. Cron Endpoint 수동 호출

**터미널에서 실행:**

```bash
# CRON_SECRET 확인
echo $CRON_SECRET

# Cron endpoint 호출
curl -X GET http://localhost:3000/api/cron/poll-threshold \
  -H "Authorization: Bearer YOUR_CRON_SECRET_HERE" \
  -v
```

**예상 응답:**

```json
{
  "success": true,
  "breaches": 1,
  "checked": 1,
  "message": "Threshold monitoring completed"
}
```

#### 3. 결과 검증

**A. 서버 로그 확인**

개발 서버 콘솔에서 다음 로그 확인:

```
[TRPC] Threshold monitoring completed
Slack alert sent successfully (if configured)
Cost alert email sent successfully
```

**B. 이메일 수신 확인**

- Resend Dashboard (https://resend.com) → Logs
- 발송된 이메일 확인
- 제목: "🚨 [Test Team] Test Project 비용 임계값 초과"
- 내용: 프로젝트명, 현재 비용($150.00), 임계값($100.00), 초과율(50%)

**C. Slack 메시지 확인** (선택사항)

- 설정한 Slack 채널에서 알림 메시지 확인
- Blocks API 포맷으로 포맷된 메시지
- "상세 보기" 버튼 포함

**D. 데이터베이스 검증**

Prisma Studio에서 CostAlert 레코드 확인:
- `lastAlertSentAt` 필드가 현재 시간으로 업데이트됨

#### 4. Throttling 테스트

**1시간 이내 재호출:**

```bash
# 즉시 다시 호출
curl -X GET http://localhost:3000/api/cron/poll-threshold \
  -H "Authorization: Bearer YOUR_CRON_SECRET_HERE"
```

**예상 결과:**
```json
{
  "success": true,
  "breaches": 0,  ← Throttled! (1시간 이내)
  "checked": 1,
  "message": "Threshold monitoring completed"
}
```

**Throttling 우회 테스트:**

```sql
-- Prisma Studio에서 lastAlertSentAt을 2시간 전으로 변경
UPDATE CostAlert
SET last_alert_sent_at = NOW() - INTERVAL '2 hours'
WHERE id = 'your-alert-id';
```

다시 Cron 호출 → 알림 재발송됨 ✅

### 엣지 케이스 테스트

#### TC1: 비용이 임계값 미만
```
cost: 80.00
threshold: 100.00
→ breaches: 0 (알림 발송 안됨)
```

#### TC2: 비용 데이터 없음
```
CostData 레코드 삭제
→ breaches: 0 (currentCost = 0)
```

#### TC3: 비활성 알림
```
CostAlert.isActive = false
→ breaches: 0 (체크 안됨)
```

#### TC4: 주간 임계값
```
CostAlert.thresholdType = "weekly"
CostAlert.thresholdValue = 500.00

CostData 생성 (이번 주 월~금):
- 월: $100
- 화: $120
- 수: $150
- 목: $140  ← 총 $510 (초과!)

→ breaches: 1 ✅
```

### 보안 테스트

#### TC5: CRON_SECRET 없이 호출
```bash
curl -X GET http://localhost:3000/api/cron/poll-threshold
```

**예상 결과:**
```json
{
  "error": "Unauthorized"
}
```
HTTP 401 Unauthorized ✅

#### TC6: 잘못된 CRON_SECRET
```bash
curl -X GET http://localhost:3000/api/cron/poll-threshold \
  -H "Authorization: Bearer wrong-secret"
```

**예상 결과:**
```json
{
  "error": "Unauthorized"
}
```
HTTP 401 Unauthorized ✅

### 성능 테스트

#### TC7: 다수 프로젝트 처리

**Prisma Studio에서:**
- 10개 프로젝트 생성
- 각각 CostAlert 및 CostData 생성

**Cron 호출:**
```bash
time curl -X GET http://localhost:3000/api/cron/poll-threshold \
  -H "Authorization: Bearer $CRON_SECRET"
```

**예상 성능:**
- 10개 프로젝트 처리 시간: < 5초
- 데이터베이스 쿼리 최적화 (인덱스 활용)

### 정리

테스트 완료 후 테스트 데이터 삭제:

```bash
bun prisma studio
```

- CostData 삭제
- CostAlert 삭제
- Project 삭제 (Cascade로 자동 삭제됨)

---

## 자동화 테스트 (향후 구현 가능)

현재는 매뉴얼 테스트이지만, 향후 다음과 같이 자동화 가능:

```typescript
// __tests__/integration/cron-threshold.test.ts
describe('Cron Threshold Integration', () => {
  it('should send alerts when threshold exceeded', async () => {
    // Setup: Create test data
    const team = await db.team.create({...});
    const project = await db.project.create({...});
    const alert = await db.costAlert.create({
      projectId: project.id,
      thresholdValue: 100,
      thresholdType: 'daily',
    });
    await db.costData.create({
      projectId: project.id,
      cost: 150, // Exceeds threshold
      date: new Date(),
    });

    // Execute: Call cron endpoint
    const response = await fetch('http://localhost:3000/api/cron/poll-threshold', {
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` }
    });

    // Assert
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.breaches).toBe(1);

    // Cleanup
    await db.costData.deleteMany({ projectId: project.id });
    await db.project.delete({ where: { id: project.id } });
  });
});
```

## 결론

모든 테스트 케이스 통과 시 Story 1.4 구현 완료로 간주합니다.

- ✅ AC #1: 프로젝트 설정 페이지에서 임계값 설정
- ✅ AC #2: 5분마다 비용 데이터 확인 (Cron 설정)
- ✅ AC #3: 임계값 초과 시 Slack/Email 알림
- ✅ AC #4: 알림 메시지에 필수 정보 포함
- ✅ AC #5: 상세 보기 링크 포함
- ✅ NFR002: 알림 지연 < 5분 (Cron 5분 주기)
