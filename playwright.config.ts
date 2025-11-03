import { defineConfig, devices } from "@playwright/test";

/**
 * Enhanced Playwright Configuration
 * Includes accessibility testing, performance monitoring, and visual regression
 *
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
	testDir: "./__tests__/e2e",
	testMatch: "**/*.spec.ts",

	/* Maximum time one test can run (30s default, increased for E2E) */
	timeout: 60 * 1000,

	/* Run tests in files in parallel */
	fullyParallel: !process.env.CI, // Serial on CI for stability

	/* Fail the build on CI if you accidentally left test.only in the source code. */
	forbidOnly: !!process.env.CI,

	/* Retry on CI only */
	retries: process.env.CI ? 2 : 0,

	/* Opt out of parallel tests on CI. */
	workers: process.env.CI ? 1 : undefined,

	/* Reporter to use */
	reporter: process.env.CI
		? [
				["html", { open: "never" }],
				["list"],
				["github"],
				["json", { outputFile: "playwright-report/test-results.json" }],
			]
		: [
				["html", { open: "never" }],
				["list"],
				["json", { outputFile: "playwright-report/test-results.json" }],
			],

	/* Global setup/teardown */
	globalSetup: undefined,
	globalTeardown: undefined,

	/* Shared settings for all projects */
	use: {
		/* Base URL */
		baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",

		/* Collect trace when retrying the failed test */
		trace: "retain-on-failure",

		/* Screenshot on failure */
		screenshot: "only-on-failure",

		/* Video on failure */
		video: "retain-on-failure",

		/* Action timeout */
		actionTimeout: 15 * 1000,

		/* Navigation timeout */
		navigationTimeout: 30 * 1000,

		/* Viewport size */
		viewport: { width: 1280, height: 720 },

		/* Ignore HTTPS errors */
		ignoreHTTPSErrors: true,

		/* Extra HTTP headers */
		extraHTTPHeaders: {
			"Accept-Language": "ko-KR,en-US",
		},

		/* Context options */
		contextOptions: {
			permissions: [],
			geolocation: undefined,
			locale: "ko-KR",
			timezoneId: "Asia/Seoul",
		},
	},

	/* Configure projects for major browsers and devices */
	projects: [
		{
			name: "chromium",
			use: {
				...devices["Desktop Chrome"],
				// Enable Chrome DevTools for debugging
				launchOptions: {
					args: ["--disable-web-security", "--disable-features=IsolateOrigins,site-per-process"],
				},
			},
		},

		{
			name: "webkit",
			use: {
				...devices["Desktop Safari"],
			},
		},

		/* Test against mobile viewports */
		{
			name: "Mobile Safari",
			use: {
				...devices["iPhone 13"],
			},
		},

		/* Desktop Firefox (optional) */
		// {
		//   name: 'firefox',
		//   use: {
		//     ...devices['Desktop Firefox'],
		//   },
		// },

		/* Mobile Chrome (optional) */
		// {
		//   name: 'Mobile Chrome',
		//   use: {
		//     ...devices['Pixel 5'],
		//   },
		// },
	],

	/* Run your local dev server before starting the tests */
	webServer: {
		command: "bun run dev",
		url: "http://localhost:3000",
		reuseExistingServer: !process.env.CI,
		timeout: 120 * 1000,
		stdout: "ignore",
		stderr: "pipe",
	},

	/* Output folder for test artifacts */
	outputDir: "playwright-report/test-results",

	/* Folder for snapshots (visual regression) */
	snapshotDir: "__tests__/e2e/snapshots",

	/* Expect configuration */
	expect: {
		timeout: 10 * 1000,
		toHaveScreenshot: {
			maxDiffPixels: 100,
			threshold: 0.2,
		},
	},
});
