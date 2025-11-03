# E2E Testing Infrastructure

Comprehensive End-to-End testing setup for FinOps for AI using Playwright with advanced patterns and utilities.

## Overview

This E2E testing infrastructure provides:

- **Page Object Model (POM)**: Maintainable, reusable page abstractions
- **Test Fixtures**: Automated authentication and setup
- **Comprehensive Mocking**: OpenAI API, Email, Slack webhooks
- **Accessibility Testing**: WCAG 2.1 AA compliance with axe-core
- **Performance Monitoring**: Core Web Vitals measurement
- **Visual Regression**: Screenshot comparison capabilities
- **Data Builders**: Clean test data creation with Builder pattern

## Quick Start

### Running Tests

```bash
# Run all E2E tests
bun run test:e2e

# Run tests in UI mode (interactive)
bun run test:e2e:ui

# Run tests in debug mode
bun run test:e2e:debug

# Run specific test file
bun test:e2e __tests__/e2e/enhanced-user-journey.spec.ts

# Run tests on specific browser
bun test:e2e --project=chromium
bun test:e2e --project=webkit
bun test:e2e --project="Mobile Safari"
```

### Viewing Test Reports

```bash
# View HTML report
bun run test:e2e:report
```

## Project Structure

```
__tests__/e2e/
├── page-objects/          # Page Object Model classes
│   ├── base-page.ts       # Base page with common functionality
│   ├── login-page.ts      # Login/signup pages
│   ├── dashboard-page.ts  # Main dashboard
│   ├── project-page.ts    # Project management
│   ├── team-page.ts       # Team management
│   ├── report-page.ts     # Reports and analytics
│   └── index.ts           # Barrel export
│
├── fixtures/              # Test fixtures
│   ├── auth.fixture.ts    # Authentication setup
│   └── database.fixture.ts # Database utilities
│
├── mocks/                 # API mocking
│   ├── openai-api.mock.ts # OpenAI API responses
│   ├── email-slack.mock.ts # Notification services
│   └── index.ts           # Centralized mock setup
│
├── helpers/               # Test utilities
│   ├── accessibility.ts   # Accessibility testing (axe-core)
│   ├── performance.ts     # Core Web Vitals measurement
│   ├── visual-regression.ts # Screenshot comparison
│   ├── api-helpers.ts     # API utilities
│   └── test-data-builder.ts # Data builder classes
│
├── snapshots/             # Visual regression baselines
├── enhanced-user-journey.spec.ts # Enhanced E2E tests
└── README.md              # This file
```

## Page Object Model

### Using Page Objects

Page objects provide a clean abstraction over page interactions:

```typescript
import { test, expect } from './fixtures/auth.fixture';

test('example test', async ({ authenticatedPage: page, dashboardPage, projectPage }) => {
  // Navigate to dashboard
  await dashboardPage.navigate();

  // Get project names
  const projects = await dashboardPage.getProjectNames();
  expect(projects.length).toBeGreaterThan(0);

  // Create new project
  await projectPage.navigate();
  await projectPage.createProject({
    name: 'Test Project',
    description: 'E2E test project',
    teamName: 'My Team'
  });
});
```

### Available Page Objects

- **BasePage**: Common functionality (goto, waitForURL, screenshots, etc.)
- **LoginPage**: Login/signup operations
- **DashboardPage**: Dashboard navigation and data
- **ProjectPage**: Project CRUD, API keys, thresholds
- **TeamPage**: Team management
- **ReportPage**: Weekly reports and analytics

## Test Fixtures

### Authentication Fixture

Automatically creates a test user and logs in:

```typescript
import { test, expect } from './fixtures/auth.fixture';

test('authenticated test', async ({
  authenticatedPage: page,
  testUser,
  dashboardPage
}) => {
  // User is already logged in
  // testUser contains email, password

  await dashboardPage.navigate();
  // Your test logic
});
```

### Database Fixture

For database operations and cleanup:

```typescript
import { test as dbTest } from './fixtures/database.fixture';

dbTest('database test', async ({ db, cleanupTestData }) => {
  // Use Prisma client
  const users = await db.user.findMany();

  // Automatic cleanup after test
  await cleanupTestData();
});
```

## API Mocking

### Mock External APIs

```typescript
import { setupAllMocks, mockHighCostScenario } from './mocks';

test.beforeEach(async ({ page }) => {
  // Mock all external APIs
  await setupAllMocks(page);
});

test('high cost scenario', async ({ page }) => {
  // Mock specific scenario
  await mockHighCostScenario(page, 750); // $750 total cost

  // Your test logic
});
```

### Available Mocks

- **OpenAI API**: `mockOpenAIApi`, `mockHighCostScenario`, `mockLowCostScenario`
- **Email (Resend)**: `mockResendEmail`, `mockResendEmailError`
- **Slack**: `mockSlackWebhook`, `mockSlackWebhookError`

### Tracking Notifications

```typescript
import { getTrackedNotifications, getLatestNotification } from './mocks';

// After triggering notification
const notifications = getTrackedNotifications();
expect(notifications.length).toBeGreaterThan(0);

const latest = getLatestNotification();
expect(latest?.type).toBe('email');
```

## Test Data Builders

Create test data with sensible defaults:

```typescript
import { buildTeam, buildProject, buildApiKey } from './helpers/test-data-builder';

// With defaults
const team = buildTeam();

// With customization
const project = buildProject((builder) => {
  builder
    .withName('Custom Project')
    .withDescription('Custom description')
    .withTeamId('team-123');
});

// API key builder
const apiKey = buildApiKey();
```

### Available Builders

- **TeamBuilder**: Team data
- **ProjectBuilder**: Project data
- **ApiKeyBuilder**: API key data
- **CostDataBuilder**: Cost data with helpers (aboveThreshold, yesterday, etc.)

## Accessibility Testing

### Test WCAG Compliance

```typescript
import { assertNoCriticalAccessibilityViolations } from './helpers/accessibility';

test('accessibility test', async ({ page }) => {
  await page.goto('/dashboard');

  // Assert no critical/serious violations
  await assertNoCriticalAccessibilityViolations(page);

  // Or test specific elements
  await assertNoCriticalAccessibilityViolations(page, {
    include: ['[role="main"]'],
    tags: ['wcag2a', 'wcag2aa'],
  });
});
```

### Accessibility Utilities

- `scanAccessibility()`: Get all violations
- `assertNoAccessibilityViolations()`: Fail if any violations
- `assertNoCriticalAccessibilityViolations()`: Fail only on critical/serious
- `testKeyboardNavigation()`: Test keyboard access
- `testColorContrast()`: Test color contrast

## Performance Testing

### Measure Core Web Vitals

```typescript
import { assertPerformanceThresholds, measurePerformanceMetrics } from './helpers/performance';

test('performance test', async ({ page }) => {
  await page.goto('/dashboard');

  // Assert performance thresholds
  await assertPerformanceThresholds(page, {
    LCP: 2500,   // Largest Contentful Paint
    FID: 100,    // First Input Delay
    CLS: 0.1,    // Cumulative Layout Shift
    FCP: 1800,   // First Contentful Paint
    TTFB: 600,   // Time to First Byte
    loadTime: 3000
  });

  // Or just measure
  const metrics = await measurePerformanceMetrics(page);
  console.log(metrics.webVitals);
});
```

## Visual Regression Testing

### Screenshot Comparison

```typescript
import { compareScreenshot, compareScreenshotMaskCommon } from './helpers/visual-regression';

test('visual regression', async ({ page }) => {
  await page.goto('/dashboard');

  // Compare with baseline
  await compareScreenshot(page, {
    name: 'dashboard',
    fullPage: true,
    mask: ['[data-testid="timestamp"]'], // Mask dynamic elements
  });

  // With common masks (dates, timestamps, etc.)
  await compareScreenshotMaskCommon(page, 'dashboard-masked');
});
```

## API Helpers

### Cron Job Triggers

```typescript
import { triggerCronJob } from './helpers/api-helpers';

test('cron job test', async ({ page }) => {
  // Trigger daily batch
  const status = await triggerCronJob(page, 'daily-batch');
  expect([200, 401]).toContain(status);

  // Available jobs: 'daily-batch', 'poll-threshold', 'weekly-report'
});
```

## Writing Tests

### Best Practices

1. **Use Page Objects**: Don't directly interact with the page in tests
2. **Use Fixtures**: Leverage authentication and setup fixtures
3. **Mock External APIs**: Always mock OpenAI, email, Slack
4. **Builder Pattern for Data**: Use test data builders
5. **Test Accessibility**: Include accessibility checks
6. **Measure Performance**: Add performance assertions
7. **Clean Selectors**: Prefer `data-testid` attributes

### Example Test

```typescript
import { test, expect } from './fixtures/auth.fixture';
import { setupAllMocks } from './mocks';
import { buildTeam, buildProject, buildApiKey } from './helpers/test-data-builder';
import { assertNoCriticalAccessibilityViolations } from './helpers/accessibility';

test.describe('Project Management', () => {
  test.beforeEach(async ({ page }) => {
    await setupAllMocks(page);
  });

  test('create project and register API key', async ({
    authenticatedPage: page,
    teamPage,
    projectPage
  }) => {
    // Create team
    const team = buildTeam();
    await teamPage.navigate();
    await teamPage.createTeam({ name: team.name });

    // Create project
    const project = buildProject();
    await projectPage.navigate();
    await projectPage.createProject({
      name: project.name,
      teamName: team.name
    });

    // Register API key
    await projectPage.openProject(project.name);
    const apiKey = buildApiKey();
    await projectPage.registerApiKey(apiKey.key);

    // Verify
    await expect(page.locator('text=/API Key.*registered/i')).toBeVisible();

    // Accessibility check
    await assertNoCriticalAccessibilityViolations(page);
  });
});
```

## CI/CD Integration

The E2E tests are configured to run in CI with:

- Serial execution for stability
- 2 retries on failure
- HTML and JSON reports
- GitHub Actions integration

## Troubleshooting

### Tests Timing Out

- Increase timeout in test: `test.setTimeout(120000)`
- Check webServer is running: `bun run dev`

### Flaky Tests

- Add explicit waits: `await page.waitForLoadState('networkidle')`
- Use `data-testid` selectors instead of text
- Mock external APIs consistently

### Screenshots Don't Match

- Update baselines: `bun test:e2e --update-snapshots`
- Mask dynamic content: `mask: ['[data-timestamp]']`

### Accessibility Violations

- Check console for violation details
- Visit helpUrl in violation report
- Disable specific rules if needed (carefully)

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Axe-core Rules](https://github.com/dequelabs/axe-core/blob/master/doc/rule-descriptions.md)
- [Core Web Vitals](https://web.dev/vitals/)
- [Page Object Model Pattern](https://martinfowler.com/bliki/PageObject.html)
