import { test, expect } from './fixtures';

test.describe('Menu', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/menu');
    // wait for items to land (we know there are 19+ seeded)
    await expect(page.getByText(/Hyderabadi Chicken Biryani/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('seeded items render', async ({ page }) => {
    await expect(page.getByText(/Mutton Dum Biryani/i).first()).toBeVisible();
    await expect(page.getByText(/Butter Naan/i).first()).toBeVisible();
    await expect(page.getByText(/Mango Lassi/i).first()).toBeVisible();
  });

  test('search filters down to one dish', async ({ page }) => {
    // Scope to the main category grid; the top bestseller rail is intentionally
    // unaffected by client-side search.
    const grid = page.locator('main').first();
    const search = page.getByPlaceholder(/search/i).first();
    await search.fill('mango');
    await expect(grid.getByText(/Mango Lassi/i).first()).toBeVisible();
    await expect(grid.locator('[id^="cat-"]').getByText(/Mutton Dum Biryani/i)).toHaveCount(0);
  });

  test('veg-only filter hides non-veg dishes', async ({ page }) => {
    const vegToggle = page.getByText(/veg only|^veg$/i).first();
    await vegToggle.click();
    // Scope assertion to the dish grid sections (cat-*), not the bestseller rail.
    const grid = page.locator('[id^="cat-"]');
    await expect(grid.getByText(/Veg Biryani/i).first()).toBeVisible();
    await expect(grid.getByText(/Hyderabadi Chicken Biryani/i)).toHaveCount(0);
  });
});

test.describe('Menu API', () => {
  test('GET /api/v1/menu/items returns ≥ 19 items', async ({ request }) => {
    const r = await request.get('/api/v1/menu/items');
    expect(r.ok()).toBeTruthy();
    const { items } = await r.json();
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThanOrEqual(19);
    const names = items.map((i: any) => i.name);
    expect(names).toContain('Hyderabadi Chicken Biryani');
    expect(names).toContain('Mutton Dum Biryani');
  });

  test('GET /api/v1/menu/categories returns categories including biryani', async ({ request }) => {
    const r = await request.get('/api/v1/menu/categories');
    const { categories } = await r.json();
    expect(categories.length).toBeGreaterThanOrEqual(6);
    const slugs = categories.map((c: any) => c.slug);
    // The extend-menu script may add variants; biryani is the one always present.
    expect(slugs.some((s: string) => s.includes('biryani'))).toBe(true);
  });

  test('GET /api/v1/menu/busyness returns a valid level', async ({ request }) => {
    const r = await request.get('/api/v1/menu/busyness');
    const body = await r.json();
    expect(['quiet', 'normal', 'busy', 'slammed']).toContain(body.level);
    expect(typeof body.extraEtaMin).toBe('number');
  });
});
