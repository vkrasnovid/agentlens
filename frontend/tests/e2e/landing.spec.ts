import { test, expect } from '@playwright/test';

test.describe('Landing page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('page loads successfully (200)', async ({ page }) => {
    await expect(page).toHaveURL('/');
    // If page loaded we're good - check no fatal error
    await expect(page.locator('body')).toBeVisible();
  });

  test('"AgentLens" headline is visible', async ({ page }) => {
    // The h1 contains "Agent" + "Lens" split by a span
    const h1 = page.locator('h1').first();
    await expect(h1).toContainText('AgentLens');
  });

  test('tagline / subtitle is visible', async ({ page }) => {
    // "Record, replay, and debug your AI agent sessions"
    await expect(page.getByText(/Record, replay, and debug/i)).toBeVisible();
  });

  test('quickstart section has 3 code blocks (steps)', async ({ page }) => {
    // 3 steps with terminal-style blocks
    await expect(page.getByText(/Get started in/i)).toBeVisible();

    // Each step has a terminal block - look for "terminal" label
    const terminals = page.getByText('terminal');
    await expect(terminals).toHaveCount(3);
  });

  test('GitHub link is present in nav', async ({ page }) => {
    const navGithub = page.locator('nav').getByRole('link', { name: /github/i });
    await expect(navGithub).toBeVisible();
    await expect(navGithub).toHaveAttribute('href', /github\.com/);
  });

  test('GitHub link is present in hero section', async ({ page }) => {
    // Hero section also has a GitHub button
    const heroGithub = page.locator('section').getByRole('link', { name: /github/i }).first();
    await expect(heroGithub).toBeVisible();
  });

  test('"View Sessions" button is present in nav', async ({ page }) => {
    const navLink = page.locator('nav').getByRole('link', { name: /view sessions/i });
    await expect(navLink).toBeVisible();
  });

  test('"View Sessions" button links to /sessions', async ({ page }) => {
    const navLink = page.locator('nav').getByRole('link', { name: /view sessions/i });
    await expect(navLink).toHaveAttribute('href', '/sessions');
  });

  test('"View Sessions" button in hero links to /sessions', async ({ page }) => {
    // The big hero CTA button
    const heroLink = page.locator('section').getByRole('link', { name: /view sessions/i }).first();
    await expect(heroLink).toBeVisible();
    await expect(heroLink).toHaveAttribute('href', '/sessions');
  });

  test('demo/mock timeline section is visible', async ({ page }) => {
    // The mock timeline section shows "Session Timeline" heading
    await expect(page.getByText(/Session.*Timeline/i)).toBeVisible();
  });

  test('mock timeline shows event badges', async ({ page }) => {
    // Timeline demo has event rows with badge-like elements
    await expect(page.getByText('session_start')).toBeVisible();
    await expect(page.getByText('api_request')).toBeVisible();
  });

  test('quickstart step 1: pip install agentlens', async ({ page }) => {
    await expect(page.getByText('pip install agentlens')).toBeVisible();
  });

  test('quickstart step 2: agentlens start command', async ({ page }) => {
    await expect(page.getByText(/agentlens start/)).toBeVisible();
  });

  test('quickstart step 3: ANTHROPIC_BASE_URL command', async ({ page }) => {
    await expect(page.getByText(/ANTHROPIC_BASE_URL/)).toBeVisible();
  });

  test('mobile viewport (375px): page loads without overflow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    // Page body should not be wider than viewport
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 5); // 5px tolerance
  });

  test('mobile viewport (375px): headline visible', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('footer shows AgentLens text', async ({ page }) => {
    await expect(page.locator('footer')).toContainText('AgentLens');
  });
});
