import { test, expect } from './fixtures';
import { DEMO, loginAs } from './helpers';

test.describe('Admin dashboard', () => {
  test('renders today + deep analytics for the admin user', async ({ page }) => {
    await loginAs(page, DEMO.admin);
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/orders today/i)).toBeVisible();
    await expect(page.getByText(/revenue today/i)).toBeVisible();
    await expect(page.getByText(/bookings/i).first()).toBeVisible();
  });

  test('admin API endpoints require auth', async ({ request }) => {
    const r = await request.get('/api/v1/admin/orders');
    expect(r.status()).toBe(401);
  });

  test('admin API returns analytics with a valid token', async ({ page, request }) => {
    const { token } = await loginAs(page, DEMO.admin);
    const today = await request.get('/api/v1/admin/analytics/today', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(today.ok()).toBeTruthy();
    const body = await today.json();
    expect(body).toMatchObject({
      orders: expect.any(Number),
      delivered: expect.any(Number),
      revenue: expect.any(Number),
      bookings: expect.any(Number),
    });

    const deep = await request.get('/api/v1/admin/analytics/deep', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(deep.ok()).toBeTruthy();
    const d = await deep.json();
    expect(d.customers).toBeDefined();
    expect(d.menu.topItems).toBeDefined();
    expect(d.revenue7d.length).toBe(7);
  });

  test('automation health endpoint is up', async ({ page, request }) => {
    const { token } = await loginAs(page, DEMO.admin);
    const r = await request.get('/api/v1/admin/automation/health', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(r.ok()).toBeTruthy();
    const body = await r.json();
    expect(body.healthy).toBe(true);
    expect(Array.isArray(body.workers)).toBe(true);
  });
});

test.describe('Customer role cannot access admin', () => {
  test('GET /api/v1/admin/orders as a CUSTOMER returns 403', async ({ page, request }) => {
    const { token } = await loginAs(page, DEMO.customer);
    const r = await request.get('/api/v1/admin/orders', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(r.status()).toBe(403);
  });
});
