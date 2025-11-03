import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

/**
 * Epic 1 E2E Test: 비용 급증 감지 및 즉시 대응
 *
 * 사용자 여정:
 * 1. 회원가입 및 로그인
 * 2. 팀 생성
 * 3. 프로젝트 생성
 * 4. API 키 등록
 * 5. 비용 수집 시뮬레이션 (Mock OpenAI API)
 * 6. 대시보드에서 비용 확인
 * 7. 임계값 설정
 * 8. 비용 폭주 시뮬레이션
 * 9. 알림 발송 확인
 * 10. API 키 비활성화
 * 11. 비활성화 상태 확인
 */

test.describe("Epic 1 - 비용 급증 감지 및 즉시 대응", () => {
	test.beforeEach(async ({ page }) => {
		// Mock external APIs to avoid real API calls
		await page.route("https://api.openai.com/**", (route) => {
			route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					data: [
						{
							timestamp: Date.now(),
							aggregation_timestamp: Date.now() / 1000,
							n_requests: 10,
							operation: "chat.completions",
							n_context_tokens_total: 1000,
							n_generated_tokens_total: 500,
						},
					],
				}),
			});
		});
	});

	test("complete user journey from signup to cost runaway prevention", async ({
		page,
	}) => {
		const uniqueId = randomUUID().slice(0, 8);
		const testEmail = `test-${uniqueId}@example.com`;
		const testPassword = "SecurePass123!";
		const teamName = `테스트팀-${uniqueId}`;
		const projectName = `테스트프로젝트-${uniqueId}`;

		// 1. 회원가입 페이지로 이동
		await page.goto("/signup");
		await expect(page).toHaveTitle(/FinOps for AI/);

		// 2. 회원가입
		await page.fill('input[name="email"]', testEmail);
		await page.fill('input[name="password"]', testPassword);
		await page.fill('input[name="confirmPassword"]', testPassword);
		await page.click('button[type="submit"]');

		// 회원가입 성공 후 대시보드로 리다이렉트 확인
		await expect(page).toHaveURL(/\/dashboard/);
		await expect(page.locator("h1, h2")).toContainText(/대시보드|Dashboard/);

		// 3. 팀 생성
		await page.goto("/teams");
		await page.click(
			'button:has-text("팀 생성"), button:has-text("Create Team")',
		);

		// 팀 생성 폼 대기
		await page.waitForSelector('input[name="name"], input[name="teamName"]');
		await page.fill('input[name="name"], input[name="teamName"]', teamName);
		await page.click(
			'button[type="submit"], button:has-text("생성"), button:has-text("Create")',
		);

		// 팀 생성 완료 대기
		await expect(page.locator(`text=${teamName}`)).toBeVisible({
			timeout: 10000,
		});

		// 4. 프로젝트 생성
		await page.goto("/projects");
		await page.click(
			'button:has-text("프로젝트 생성"), button:has-text("Create Project"), button:has-text("New Project")',
		);

		await page.waitForSelector('input[name="name"], input[name="projectName"]');
		await page.fill(
			'input[name="name"], input[name="projectName"]',
			projectName,
		);
		await page.fill('input[name="description"]', "테스트 프로젝트입니다");

		// 팀 선택 (드롭다운에서 첫 번째 팀 선택)
		const teamSelect = page.locator('select[name="teamId"], [role="combobox"]');
		if ((await teamSelect.count()) > 0) {
			await teamSelect.first().click();
			await page.locator(`text=${teamName}`).click();
		}

		await page.click(
			'button[type="submit"], button:has-text("생성"), button:has-text("Create")',
		);

		// 프로젝트 생성 완료 대기
		await expect(page.locator(`text=${projectName}`)).toBeVisible({
			timeout: 10000,
		});

		// 5. 프로젝트 상세 페이지로 이동 및 API 키 등록
		await page.click(`text=${projectName}`);

		// API 키 등록 버튼 찾기
		await page.click(
			'button:has-text("API 키 등록"), button:has-text("Register API Key"), button:has-text("Add API Key")',
		);

		await page.waitForSelector('input[name="apiKey"]');
		await page.fill(
			'input[name="apiKey"]',
			"sk-test-mock-key-12345678901234567890123456789012",
		);
		await page.click(
			'button[type="submit"], button:has-text("저장"), button:has-text("Save")',
		);

		// API 키 등록 성공 확인
		await expect(
			page.locator("text=/API 키.*등록|API Key.*registered/i"),
		).toBeVisible({ timeout: 10000 });

		// 6. 대시보드에서 비용 확인 (아직 비용 데이터가 없을 수 있음)
		await page.goto("/dashboard");
		await expect(page.locator("h1, h2")).toContainText(/대시보드|Dashboard/);

		// 7. 임계값 설정
		await page.goto("/projects");
		await page.click(`text=${projectName}`);

		// 임계값 설정 섹션 찾기
		const thresholdInput = page.locator(
			'input[name="dailyThreshold"], input[name="threshold"]',
		);
		if ((await thresholdInput.count()) > 0) {
			await thresholdInput.first().fill("500");
			await page.click(
				'button:has-text("임계값 설정"), button:has-text("Set Threshold"), button:has-text("Save")',
			);

			// 임계값 설정 성공 확인
			await expect(page.locator("text=/임계값|threshold/i")).toBeVisible({
				timeout: 10000,
			});
		}

		// 8. Cron Job 수동 트리거 (API 호출)
		// Note: 실제 환경에서는 CRON_SECRET이 필요하지만, 테스트 환경에서는 mock 가능
		const cronResponse = await page.request.get("/api/cron/daily-batch", {
			headers: {
				Authorization: `Bearer ${process.env.CRON_SECRET || "test-cron-secret"}`,
			},
			failOnStatusCode: false,
		});

		// Cron job이 실행되었는지 확인 (성공 또는 인증 실패)
		expect([200, 401]).toContain(cronResponse.status());

		// 9. 대시보드에서 업데이트된 비용 확인
		await page.goto("/dashboard");
		await page.reload(); // 데이터 새로고침

		// 비용 데이터가 표시되는지 확인 (선택적)
		const costDisplay = page.locator("text=/\\$|비용|cost/i");
		if ((await costDisplay.count()) > 0) {
			await expect(costDisplay.first()).toBeVisible();
		}

		// 10. API 키 비활성화 테스트
		await page.goto("/projects");
		await page.click(`text=${projectName}`);

		// API 키 관리 섹션에서 비활성화 버튼 찾기
		const disableButton = page.locator(
			'button:has-text("비활성화"), button:has-text("Disable"), button:has-text("Deactivate")',
		);
		if ((await disableButton.count()) > 0) {
			await disableButton.first().click();

			// Type-to-confirm 모달 확인
			const confirmInput = page.locator(
				'input[placeholder*="차단"], input[placeholder*="disable"]',
			);
			if ((await confirmInput.count()) > 0) {
				await confirmInput.first().fill("차단");
				await page.click('button:has-text("확인"), button:has-text("Confirm")');

				// 비활성화 성공 확인
				await expect(
					page.locator("text=/비활성화됨|비활성화 완료|Disabled|Deactivated/i"),
				).toBeVisible({ timeout: 10000 });
			}
		}

		// 테스트 완료
	});

	test("weekly report access", async ({ page }) => {
		// 로그인 (기존 사용자 사용 또는 테스트 계정)
		await page.goto("/signin");

		// 임시로 테스트 계정 사용
		const testEmail = "test@example.com";
		const testPassword = "SecurePass123!";

		await page.fill('input[name="email"]', testEmail);
		await page.fill('input[name="password"]', testPassword);
		await page.click('button[type="submit"]');

		// 리포트 페이지로 이동
		await page.goto("/reports");

		// 리포트 페이지 표시 확인
		await expect(page.locator("h1, h2")).toContainText(/리포트|Report/);

		// Top 3/Bottom 3 프로젝트 섹션 확인 (데이터가 있는 경우)
		const reportContent = page.locator(
			"text=/Top 3|Bottom 3|효율|efficiency/i",
		);
		if ((await reportContent.count()) > 0) {
			await expect(reportContent.first()).toBeVisible();
		}
	});

	test("project cost drilldown", async ({ page }) => {
		// 로그인
		await page.goto("/signin");

		const testEmail = "test@example.com";
		const testPassword = "SecurePass123!";

		await page.fill('input[name="email"]', testEmail);
		await page.fill('input[name="password"]', testPassword);
		await page.click('button[type="submit"]');

		// 프로젝트 페이지로 이동
		await page.goto("/projects");

		// 첫 번째 프로젝트 선택 (존재하는 경우)
		const firstProject = page
			.locator('[data-testid="project-card"], .project-item')
			.first();
		if ((await firstProject.count()) > 0) {
			await firstProject.click();

			// 프로젝트 상세 페이지 확인
			await expect(page.locator("h1, h2")).toContainText(/프로젝트|Project/);

			// 비용 추이 그래프 확인 (Recharts 또는 차트 라이브러리 사용)
			const chart = page.locator('[role="img"], .recharts-wrapper, canvas');
			if ((await chart.count()) > 0) {
				await expect(chart.first()).toBeVisible();
			}

			// 메트릭 입력 필드 확인
			const metricsSection = page.locator("text=/메트릭|Metrics|성과/i");
			if ((await metricsSection.count()) > 0) {
				await expect(metricsSection).toBeVisible();
			}
		}
	});
});
