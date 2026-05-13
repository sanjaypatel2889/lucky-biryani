import { test, expect } from './fixtures';
import { DEMO, loginAs } from './helpers';

test.describe('Table booking', () => {
  test('public availability endpoint returns slots', async ({ request }) => {
    // Pick the seeded branch
    const branchRes = await request.get('/api/v1/menu/branch');
    const { branch } = await branchRes.json();
    expect(branch?.id).toBeTruthy();

    const tomorrow = new Date(Date.now() + 24 * 60 * 60_000).toISOString().slice(0, 10);
    const r = await request.get(`/api/v1/bookings/availability?branchId=${branch.id}&date=${tomorrow}&partySize=2`);
    expect(r.ok()).toBeTruthy();
    const { slots } = await r.json();
    expect(Array.isArray(slots)).toBe(true);
    // Branch opens at 11 and closes at 23 with 30-min slots, so there are many free slots on a fresh DB.
    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0]).toMatchObject({ start: expect.any(String), end: expect.any(String), freeTables: expect.any(Number) });
  });

  test('end-to-end booking via API as the demo customer', async ({ page, request }) => {
    const { token } = await loginAs(page, DEMO.customer);

    const { branch } = await (await request.get('/api/v1/menu/branch')).json();
    const tomorrow = new Date(Date.now() + 24 * 60 * 60_000).toISOString().slice(0, 10);
    const { slots } = await (await request.get(
      `/api/v1/bookings/availability?branchId=${branch.id}&date=${tomorrow}&partySize=2`,
    )).json();
    expect(slots.length).toBeGreaterThan(0);

    const create = await request.post('/api/v1/bookings', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        branchId: branch.id,
        partySize: 2,
        slotStart: slots[0].start,
        occasion: 'birthday',
        preferredZone: 'Indoor',
      },
    });
    expect(create.ok(), `booking create failed: ${create.status()} ${await create.text()}`).toBeTruthy();
    const { booking, qr } = await create.json();
    expect(booking.bookingNumber).toMatch(/^LBC-R-/);
    expect(booking.status).toBe('CONFIRMED');
    expect(qr).toMatch(/^data:image\/png;base64,/);
  });

  test('/book page renders the form', async ({ page }) => {
    await page.goto('/book');
    // Look for any reasonable booking-form element
    await expect(
      page.getByText(/party|table|guests|book/i).first(),
    ).toBeVisible({ timeout: 15_000 });
  });
});
