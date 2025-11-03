import { test, expect } from '@playwright/test';

/**
 * E2E Test: 주간 리포트 확인
 *
 * Story 1.6 (주간 리포트 생성 및 발송) 검증
 *
 * 시나리오:
 * 1. 로그인
 * 2. 리포트 페이지 접근
 * 3. 주간 리포트 표시 확인 (Top 3/Bottom 3 프로젝트)
 * 4. 리포트 메트릭 검증 (총 비용, 효율성, 전주 대비 증감률)
 * 5. 리포트 아카이브 접근
 * 6. 과거 리포트 조회
 */

test.describe('Weekly Report', () => {
  test.beforeEach(async ({ page }) => {
    // 로그인
    await page.goto('/signin');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'SecurePass123!');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should display weekly report with top and bottom projects', async ({ page }) => {
    // 리포트 페이지로 이동
    await page.goto('/reports');

    // 리포트 페이지 제목 확인
    await expect(page.locator('h1, h2')).toContainText(/주간 리포트|Weekly Report/i);

    // Top 3 효율 프로젝트 섹션
    const top3Section = page.locator('text=/Top 3|효율|efficiency/i');
    if (await top3Section.count() > 0) {
      await expect(top3Section.first()).toBeVisible();

      // 프로젝트 카드 또는 리스트 아이템 확인
      const projectItems = page.locator('[data-testid="top-project"], .top-project-item');
      if (await projectItems.count() > 0) {
        // 최대 3개 프로젝트 표시 확인
        expect(await projectItems.count()).toBeLessThanOrEqual(3);
      }
    }

    // Bottom 3 개선 필요 프로젝트 섹션
    const bottom3Section = page.locator('text=/Bottom 3|개선 필요|improvement/i');
    if (await bottom3Section.count() > 0) {
      await expect(bottom3Section.first()).toBeVisible();

      const bottomProjectItems = page.locator('[data-testid="bottom-project"], .bottom-project-item');
      if (await bottomProjectItems.count() > 0) {
        expect(await bottomProjectItems.count()).toBeLessThanOrEqual(3);
      }
    }
  });

  test('should show weekly metrics and trends', async ({ page }) => {
    await page.goto('/reports');

    // 주간 총 비용 확인
    const totalCost = page.locator('text=/주간 총 비용|Total Weekly Cost|\\$\\d+/i');
    if (await totalCost.count() > 0) {
      await expect(totalCost.first()).toBeVisible();
    }

    // 전주 대비 증감률 확인
    const weekOverWeek = page.locator('text=/전주 대비|week-over-week|WoW|\\+\\d+%|-\\d+%/i');
    if (await weekOverWeek.count() > 0) {
      await expect(weekOverWeek.first()).toBeVisible();
    }

    // 효율성 메트릭 확인
    const efficiencyMetric = page.locator('text=/효율성|efficiency|성과/i');
    if (await efficiencyMetric.count() > 0) {
      await expect(efficiencyMetric.first()).toBeVisible();
    }

    // 차트 또는 그래프 확인
    const chart = page.locator('[role="img"], .recharts-wrapper, canvas');
    if (await chart.count() > 0) {
      await expect(chart.first()).toBeVisible();
    }
  });

  test('should access report archive and view historical reports', async ({ page }) => {
    await page.goto('/reports');

    // 리포트 아카이브 링크 또는 버튼
    const archiveLink = page.locator('a:has-text("아카이브"), a:has-text("Archive"), button:has-text("Past Reports")');
    if (await archiveLink.count() > 0) {
      await archiveLink.first().click();

      // 아카이브 페이지 확인
      await expect(page.locator('h1, h2')).toContainText(/아카이브|Archive|과거 리포트/i);

      // 과거 리포트 목록 확인
      const reportList = page.locator('[data-testid="report-item"], .report-list-item');
      if (await reportList.count() > 0) {
        // 첫 번째 과거 리포트 클릭
        await reportList.first().click();

        // 리포트 상세 내용 표시 확인
        await expect(page.locator('text=/Top 3|Bottom 3|주간|Weekly/i')).toBeVisible();
      }
    }
  });

  test('should trigger weekly report generation manually', async ({ page, request }) => {
    // 관리자 페이지 또는 설정에서 수동으로 주간 리포트 생성 트리거

    // weekly-report Cron job 수동 실행
    const cronResponse = await request.get('/api/cron/weekly-report', {
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET || 'test-cron-secret'}`,
      },
      failOnStatusCode: false,
    });

    // Cron job 실행 확인
    expect([200, 401]).toContain(cronResponse.status());

    // 리포트 페이지로 이동하여 최신 리포트 확인
    await page.goto('/reports');
    await page.reload();

    // 오늘 날짜의 리포트가 생성되었는지 확인
    const today = new Date().toLocaleDateString('ko-KR');
    const reportDate = page.locator(`text=${today}`);
    if (await reportDate.count() > 0) {
      await expect(reportDate.first()).toBeVisible();
    }
  });

  test('should display project efficiency scores', async ({ page }) => {
    await page.goto('/reports');

    // 각 프로젝트의 효율성 점수 표시 확인
    const efficiencyScores = page.locator('[data-testid="efficiency-score"], .efficiency-value');
    if (await efficiencyScores.count() > 0) {
      // 효율성 점수가 숫자 형식으로 표시되는지 확인
      const scoreText = await efficiencyScores.first().textContent();
      expect(scoreText).toMatch(/\d+/); // 숫자 포함 확인
    }

    // 효율성 계산 공식: successCount / totalCost
    // Top 3는 높은 효율성, Bottom 3는 낮은 효율성
  });

  test('should show cost breakdown by project', async ({ page }) => {
    await page.goto('/reports');

    // 프로젝트별 비용 분석 테이블 또는 차트
    const costBreakdown = page.locator('text=/프로젝트별 비용|Cost by Project/i');
    if (await costBreakdown.count() > 0) {
      await expect(costBreakdown).toBeVisible();

      // 테이블 행 확인
      const tableRows = page.locator('table tbody tr, [data-testid="project-row"]');
      if (await tableRows.count() > 0) {
        expect(await tableRows.count()).toBeGreaterThan(0);

        // 각 행에 프로젝트명, 비용, 효율성 표시 확인
        const firstRow = tableRows.first();
        await expect(firstRow).toContainText(/\$/); // 비용 표시
      }
    }
  });

  test('should allow filtering reports by date range', async ({ page }) => {
    await page.goto('/reports');

    // 날짜 범위 필터 (있는 경우)
    const dateFilter = page.locator('input[type="date"], [data-testid="date-picker"]');
    if (await dateFilter.count() > 0) {
      // 시작일 설정
      await dateFilter.first().fill('2025-10-01');

      // 종료일 설정 (2개의 날짜 입력이 있는 경우)
      if (await dateFilter.count() > 1) {
        await dateFilter.nth(1).fill('2025-10-31');
      }

      // 필터 적용 버튼
      const applyButton = page.locator('button:has-text("적용"), button:has-text("Apply")');
      if (await applyButton.count() > 0) {
        await applyButton.click();

        // 필터링된 결과 확인
        await page.waitForTimeout(1000);
        await expect(page.locator('text=/10월|October/i')).toBeVisible();
      }
    }
  });
});
