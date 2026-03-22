import { Page } from '@playwright/test';

export const MOCK_SESSIONS = [
  {
    id: 'abc123',
    name: 'Test session 1',
    created_at: new Date().toISOString(), // today's date for "spent today" stats
    total_tokens: 4500,
    total_cost_usd: 0.0234,
    event_count: 12,
    model_used: 'claude-3-5-sonnet-20241022',
    duration_seconds: 45.2,
  },
];

export const MOCK_SESSION_DETAIL = {
  session_id: 'abc123',
  metadata: {
    id: 'abc123',
    name: 'Test session 1',
    created_at: '2026-03-22T20:00:00Z',
    total_tokens: 4500,
    total_cost_usd: 0.0234,
    event_count: 6,
    model_used: 'claude-3-5-sonnet-20241022',
    duration_seconds: 45.2,
  },
  events: [
    {
      type: 'session_start',
      timestamp: '2026-03-22T20:00:00Z',
      metadata: { name: 'Test session 1' },
      content_preview: 'Session initialized',
    },
    {
      type: 'api_request',
      timestamp: '2026-03-22T20:00:01Z',
      model: 'claude-3-5-sonnet-20241022',
      input_tokens: 1500,
      content_preview: 'Analyze the codebase',
    },
    {
      type: 'tool_call',
      timestamp: '2026-03-22T20:00:02Z',
      tool_name: 'bash',
      input: { command: 'ls -la' },
      content_preview: 'Running bash command',
    },
    {
      type: 'tool_result',
      timestamp: '2026-03-22T20:00:03Z',
      tool_name: 'bash',
      content_preview: 'total 48\n...',
    },
    {
      type: 'api_response',
      timestamp: '2026-03-22T20:00:04Z',
      output_tokens: 350,
      cost_usd: 0.0053,
      content_preview: 'Analysis complete',
    },
    {
      type: 'session_end',
      timestamp: '2026-03-22T20:00:45Z',
      total_tokens: 4500,
      total_cost_usd: 0.0234,
      content_preview: 'Session completed',
    },
  ],
};

export async function mockSessionsRoute(page: Page, sessions = MOCK_SESSIONS) {
  await page.route('**/api/sessions', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          sessions,
          summary: {
            total_cost_usd: sessions.reduce((s, x) => s + x.total_cost_usd, 0),
            total_tokens: sessions.reduce((s, x) => s + x.total_tokens, 0),
            session_count: sessions.length,
          },
          pagination: { has_more: false },
        }),
      });
    }
  });
}

export async function mockSessionDetailRoute(page: Page, detail = MOCK_SESSION_DETAIL) {
  await page.route(`**/api/sessions/${detail.session_id}`, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(detail),
      });
    }
  });
}
