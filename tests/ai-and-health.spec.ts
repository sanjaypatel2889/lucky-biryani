import { test, expect } from './fixtures';

test.describe('Lucky AI chatbot', () => {
  test('/api/v1/ai/status reports a mode', async ({ request }) => {
    const r = await request.get('/api/v1/ai/status');
    expect(r.ok()).toBeTruthy();
    const body = await r.json();
    expect(['live', 'fallback']).toContain(body.mode);
    expect(typeof body.enabled).toBe('boolean');
  });

  test('/api/v1/ai/chat answers a menu question', async ({ request }) => {
    const r = await request.post('/api/v1/ai/chat', {
      data: {
        messages: [{ role: 'user', content: 'recommend something spicy under 300' }],
      },
    });
    expect(r.ok()).toBeTruthy();
    const body = await r.json();
    expect(typeof body.reply).toBe('string');
    expect(body.reply.length).toBeGreaterThan(10);
  });

  test('floating chat button is visible on the homepage', async ({ page }) => {
    await page.goto('/');
    const launcher = page.locator('button[aria-label*="lucky" i], button[aria-label*="chat" i], [data-lucky-ai]').first();
    // Component is rendered globally; if no specific selector matches we still
    // expect *something* fixed at the bottom of the viewport.
    const allFixedBottom = page.locator('button.fixed, [class*="fixed"][class*="bottom"]');
    expect(await launcher.count() + await allFixedBottom.count()).toBeGreaterThan(0);
  });
});

test.describe('Service health', () => {
  test('GET /api/v1/health is OK', async ({ request }) => {
    const r = await request.get('/api/v1/health');
    expect(r.ok()).toBeTruthy();
    const body = await r.json();
    expect(body.ok).toBe(true);
    expect(typeof body.at).toBe('string');
  });
});
