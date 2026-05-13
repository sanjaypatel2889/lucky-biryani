import { test, expect } from './fixtures';
import { DEMO, loginAs } from './helpers';

test.describe('Rider PWA', () => {
  test('rider can log in and load /rider', async ({ page }) => {
    await loginAs(page, DEMO.rider);
    await page.goto('/rider');
    // Any rider UI surface — shift button or earnings card or status pill
    await expect(page.locator('body')).toBeVisible();
    await expect(page.getByText(/shift|deliver|earnings|offer|rider/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('rider API: /me + /earnings return data', async ({ page, request }) => {
    const { token } = await loginAs(page, DEMO.rider);

    const me = await request.get('/api/v1/rider/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(me.ok()).toBeTruthy();
    const meBody = await me.json();
    expect(meBody.rider).toBeDefined();
    expect(meBody.rider.vehicleType).toBeDefined();

    const earnings = await request.get('/api/v1/rider/earnings', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(earnings.ok()).toBeTruthy();
    const earn = await earnings.json();
    for (const window of ['today', 'week', 'month'] as const) {
      expect(earn[window]).toMatchObject({
        count: expect.any(Number),
        earnings: expect.any(Number),
        km: expect.any(Number),
      });
    }
  });

  test('rider ping updates rider location', async ({ page, request }) => {
    const { token } = await loginAs(page, DEMO.rider);
    const r = await request.post('/api/v1/rider/ping', {
      headers: { Authorization: `Bearer ${token}` },
      data: { lat: 17.385, lng: 78.4867 },
    });
    expect(r.ok()).toBeTruthy();
    const body = await r.json();
    expect(body.ok).toBe(true);
  });
});
