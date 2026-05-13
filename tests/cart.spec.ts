import { test, expect } from './fixtures';

test.describe('Cart', () => {
  test('quote endpoint computes totals for a known cart', async ({ request }) => {
    const branchRes = await request.get('/api/v1/menu/branch');
    const { branch } = await branchRes.json();
    const { items } = await (await request.get('/api/v1/menu/items')).json();
    const biryani = items.find((i: any) => i.name === 'Hyderabadi Chicken Biryani');
    const naan    = items.find((i: any) => i.name === 'Butter Naan');
    expect(biryani && naan).toBeTruthy();

    const r = await request.post('/api/v1/orders/quote', {
      data: {
        branchId: branch.id,
        type: 'PICKUP',
        cart: [
          { itemId: biryani.id, qty: 1 },
          { itemId: naan.id,    qty: 2 },
        ],
      },
    });
    expect(r.ok()).toBeTruthy();
    const q = await r.json();
    expect(q.errors).toEqual([]);
    expect(q.lines.length).toBe(2);
    // 320 + 50*2 = 420 subtotal
    expect(q.subtotal).toBe(420);
    // 5% tax on every line at the seed defaults
    expect(q.tax).toBeCloseTo(21, 1);
    expect(q.total).toBeGreaterThan(0);
  });

  test('FIRST50 coupon applies as a flat ₹50 discount', async ({ request }) => {
    const { branch } = await (await request.get('/api/v1/menu/branch')).json();
    const { items } = await (await request.get('/api/v1/menu/items')).json();
    const biryani = items.find((i: any) => i.name === 'Hyderabadi Chicken Biryani');

    const r = await request.post('/api/v1/orders/quote', {
      data: {
        branchId: branch.id,
        type: 'PICKUP',
        cart: [{ itemId: biryani.id, qty: 1 }],
        couponCode: 'FIRST50',
      },
    });
    const q = await r.json();
    expect(q.couponCode).toBe('FIRST50');
    expect(q.discount).toBe(50);
  });

  test('cart page is reachable from header', async ({ page }) => {
    await page.goto('/');
    await page.locator('#lbc-cart-target').click();
    await expect(page).toHaveURL(/\/cart/);
    // empty cart copy or any reasonable rendering
    await expect(page.locator('body')).toBeVisible();
  });
});
