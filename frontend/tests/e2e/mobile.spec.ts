import { test, expect } from '@playwright/test';
import { mockSessionsRoute, mockSessionDetailRoute } from './fixtures';

const MOBILE_VIEWPORT = { width: 375, height: 812 };

test.describe('Mobile responsiveness', () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test('landing page (375px): no horizontal scroll', async ({ page }) => {
    await page.goto('/');
    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const clientWidth = await page.evaluate(() => document.body.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
  });

  test('landing page (375px): headline visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('landing page (375px): navigation visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('nav')).toBeVisible();
  });

  test('landing page (375px): quickstart steps visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('pip install agentlens')).toBeVisible();
  });

  test('sessions page mobile (375px): cards stack vertically', async ({ page }) => {
    await mockSessionsRoute(page);
    await page.goto('/sessions');
    await expect(page.getByText('Test session 1')).toBeVisible({ timeout: 10000 });

    // Check cards are stacked - container uses space-y-4 (vertical stack)
    const cards = page.locator('a[href="/s/abc123"]');
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toBeVisible();
  });

  test('sessions page mobile (375px): no horizontal overflow', async ({ page }) => {
    await mockSessionsRoute(page);
    await page.goto('/sessions');
    await expect(page.getByText('Test session 1')).toBeVisible({ timeout: 10000 });
    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const clientWidth = await page.evaluate(() => document.body.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
  });

  test('timeline page mobile (375px): events are readable', async ({ page }) => {
    await mockSessionDetailRoute(page);
    await page.goto('/s/abc123');
    await expect(page.getByText('SESSION START')).toBeVisible({ timeout: 10000 });
  });

  test('timeline page mobile (375px): back link visible', async ({ page }) => {
    await mockSessionDetailRoute(page);
    await page.goto('/s/abc123');
    await expect(page.getByText(/← Back/)).toBeVisible();
  });

  test('timeline page mobile (375px): copy button visible', async ({ page }) => {
    await mockSessionDetailRoute(page);
    await page.goto('/s/abc123');
    await expect(page.getByRole('button', { name: /copy link/i })).toBeVisible();
  });
});
