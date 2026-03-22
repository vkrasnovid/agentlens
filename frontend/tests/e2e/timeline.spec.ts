import { test, expect } from '@playwright/test';
import { mockSessionDetailRoute, mockSessionsRoute, MOCK_SESSION_DETAIL } from './fixtures';

test.describe('Timeline / Session detail page', () => {
  test.beforeEach(async ({ page }) => {
    await mockSessionDetailRoute(page);
  });

  test('timeline page loads for /s/abc123', async ({ page }) => {
    await page.goto('/s/abc123');
    // Should not show error
    await expect(page.locator('body')).not.toContainText('Failed to load session', { timeout: 10000 });
  });

  test('timeline shows 6 mock events', async ({ page }) => {
    await page.goto('/s/abc123');
    // Wait for events to render
    await expect(page.getByText('SESSION START')).toBeVisible({ timeout: 10000 });
    // Count event rows in the timeline - all 6 event type badges visible
    const rows = page.locator('button.w-full.text-left');
    await expect(rows).toHaveCount(6);
  });

  test('session_start event visible with purple badge', async ({ page }) => {
    await page.goto('/s/abc123');
    const badge = page.getByText('SESSION START');
    await expect(badge).toBeVisible();
    // Check purple color class
    await expect(badge).toHaveClass(/purple/);
  });

  test('api_request event visible with blue badge', async ({ page }) => {
    await page.goto('/s/abc123');
    const badge = page.getByText('API REQUEST');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveClass(/blue/);
  });

  test('tool_call event visible with amber badge', async ({ page }) => {
    await page.goto('/s/abc123');
    const badge = page.getByText('TOOL CALL');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveClass(/amber/);
  });

  test('tool_result event visible with teal badge', async ({ page }) => {
    await page.goto('/s/abc123');
    const badge = page.getByText('TOOL RESULT');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveClass(/teal/);
  });

  test('api_response event visible with green badge', async ({ page }) => {
    await page.goto('/s/abc123');
    const badge = page.getByText('API RESPONSE');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveClass(/green/);
  });

  test('session_end event visible with purple badge', async ({ page }) => {
    await page.goto('/s/abc123');
    const badge = page.getByText('SESSION END');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveClass(/purple/);
  });

  test('total cost shown in header', async ({ page }) => {
    await page.goto('/s/abc123');
    // Cost in sticky header
    const header = page.locator('div.sticky');
    await expect(header).toContainText(/Cost:/);
    await expect(header).toContainText(/\$/);
  });

  test('click event row expands details (JSON visible)', async ({ page }) => {
    await page.goto('/s/abc123');
    await expect(page.getByText('SESSION START')).toBeVisible();
    // Click the first event row
    const firstRow = page.locator('button.w-full.text-left').first();
    await firstRow.click();
    // Pre block with JSON should appear
    await expect(page.locator('pre').first()).toBeVisible();
  });

  test('expanded event shows JSON content', async ({ page }) => {
    await page.goto('/s/abc123');
    await expect(page.getByText('API REQUEST')).toBeVisible();
    // Click api_request row (second row)
    const rows = page.locator('button.w-full.text-left');
    await rows.nth(1).click();
    const pre = page.locator('pre').first();
    await expect(pre).toBeVisible();
    await expect(pre).toContainText('{');
  });

  test('back to sessions link is present', async ({ page }) => {
    await page.goto('/s/abc123');
    const backLink = page.getByText(/← Back/);
    await expect(backLink).toBeVisible();
  });

  test('back link navigates to /sessions', async ({ page }) => {
    await mockSessionsRoute(page);
    await page.goto('/s/abc123');
    const backLink = page.getByRole('link', { name: /← Back/ });
    await expect(backLink).toHaveAttribute('href', '/sessions');
  });

  test('share/copy link button is present', async ({ page }) => {
    await page.goto('/s/abc123');
    const copyBtn = page.getByRole('button', { name: /copy link/i });
    await expect(copyBtn).toBeVisible();
  });

  test('copy link button changes to "Copied" after click', async ({ page }) => {
    await page.goto('/s/abc123');
    // Grant clipboard permissions
    await page.context().grantPermissions(['clipboard-write']);
    const copyBtn = page.getByRole('button', { name: /copy link/i });
    await copyBtn.click();
    await expect(page.getByRole('button', { name: /✓ Copied/i })).toBeVisible();
  });

  test('session name shown in header', async ({ page }) => {
    await page.goto('/s/abc123');
    const header = page.locator('div.sticky');
    await expect(header).toContainText('Test session 1');
  });

  test('metadata cards are shown (Model, Duration, Cost, Created)', async ({ page }) => {
    await page.goto('/s/abc123');
    await expect(page.getByText('Model')).toBeVisible();
    await expect(page.getByText('Duration')).toBeVisible();
    await expect(page.getByText('Total cost')).toBeVisible();
    await expect(page.getByText('Created')).toBeVisible();
  });

  test('tool_call shows tool name (bash)', async ({ page }) => {
    await page.goto('/s/abc123');
    await expect(page.getByText('bash').first()).toBeVisible();
  });

  test('timeline header shows column labels', async ({ page }) => {
    await page.goto('/s/abc123');
    // Timeline column headers: TIME, TYPE, DETAILS
    await expect(page.getByText('TIME')).toBeVisible();
    await expect(page.getByText('TYPE')).toBeVisible();
    await expect(page.getByText('DETAILS')).toBeVisible();
  });
});
