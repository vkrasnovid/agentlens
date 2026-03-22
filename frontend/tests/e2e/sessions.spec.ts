import { test, expect } from '@playwright/test';
import { mockSessionsRoute, MOCK_SESSIONS } from './fixtures';

test.describe('Sessions page', () => {
  test('sessions page loads', async ({ page }) => {
    await mockSessionsRoute(page);
    await page.goto('/sessions');
    await expect(page.locator('h1')).toContainText('Sessions');
  });

  test('sessions page shows session card with mock data', async ({ page }) => {
    await mockSessionsRoute(page);
    await page.goto('/sessions');
    // Wait for loading to complete (skeleton disappears, sessions appear)
    await expect(page.getByText('Test session 1')).toBeVisible({ timeout: 10000 });
  });

  test('session name is visible', async ({ page }) => {
    await mockSessionsRoute(page);
    await page.goto('/sessions');
    await expect(page.getByText('Test session 1')).toBeVisible();
  });

  test('session cost is displayed', async ({ page }) => {
    await mockSessionsRoute(page);
    await page.goto('/sessions');
    // Cost: $0.0234 shown in session card - use first match
    await expect(page.getByText(/\$0\.02/).first()).toBeVisible();
  });

  test('token count is visible', async ({ page }) => {
    await mockSessionsRoute(page);
    await page.goto('/sessions');
    // 4,500 tokens
    await expect(page.getByText(/4,500/)).toBeVisible();
  });

  test('"Total sessions" stat is visible', async ({ page }) => {
    await mockSessionsRoute(page);
    await page.goto('/sessions');
    await expect(page.getByText(/total sessions/i)).toBeVisible();
  });

  test('stats bar shows session count', async ({ page }) => {
    await mockSessionsRoute(page);
    await page.goto('/sessions');
    // 1 session in mock data
    const countEl = page.locator('text=Total sessions').locator('..').locator('p').last();
    await expect(countEl).toContainText('1');
  });

  test('clicking session card navigates to /s/abc123', async ({ page }) => {
    await mockSessionsRoute(page);
    // Also mock the detail page so navigation doesn't fail
    await page.route('**/api/sessions/abc123', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ session_id: 'abc123', events: [] }),
      });
    });
    await page.goto('/sessions');
    await expect(page.getByText('Test session 1')).toBeVisible();
    await page.getByText('Test session 1').click();
    await expect(page).toHaveURL(/\/s\/abc123/);
  });

  test('empty state shown when sessions = []', async ({ page }) => {
    await mockSessionsRoute(page, []);
    await page.goto('/sessions');
    // Wait for loading to finish
    await expect(page.getByText(/No sessions yet/i)).toBeVisible({ timeout: 10000 });
  });

  test('empty state has quickstart command', async ({ page }) => {
    await mockSessionsRoute(page, []);
    await page.goto('/sessions');
    await expect(page.getByText(/agentlens start/)).toBeVisible();
  });

  test('loading skeleton shown during fetch', async ({ page }) => {
    // Delay the API response so skeleton appears
    await page.route('**/api/sessions', async (route) => {
      await new Promise((r) => setTimeout(r, 500));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ sessions: MOCK_SESSIONS }),
      });
    });
    await page.goto('/sessions');
    // Skeleton has animate-pulse class
    const skeleton = page.locator('.animate-pulse').first();
    await expect(skeleton).toBeVisible();
  });

  test('shows model name in session card', async ({ page }) => {
    await mockSessionsRoute(page);
    await page.goto('/sessions');
    await expect(page.getByText('claude-3-5-sonnet-20241022')).toBeVisible();
  });

  test('nav breadcrumb shows Sessions', async ({ page }) => {
    await mockSessionsRoute(page);
    await page.goto('/sessions');
    await expect(page.locator('nav').getByText('Sessions')).toBeVisible();
  });

  test('nav has Home link', async ({ page }) => {
    await mockSessionsRoute(page);
    await page.goto('/sessions');
    await expect(page.locator('nav').getByText(/← Home/)).toBeVisible();
  });
});
