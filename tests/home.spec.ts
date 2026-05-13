import { test, expect } from './fixtures';

test.describe('Homepage', () => {
  test('loads hero with brand and CTAs', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Lucky Biryani/i);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/biryani/i);
    await expect(page.getByRole('link', { name: /order now/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /book a table/i }).first()).toBeVisible();
  });

  test('header nav links resolve to the right routes', async ({ page }) => {
    await page.goto('/');
    const header = page.locator('header').first();

    await header.getByRole('link', { name: 'Menu', exact: true }).click();
    await expect(page).toHaveURL(/\/menu/);

    await page.goto('/');
    await header.getByRole('link', { name: /book a table/i }).click();
    await expect(page).toHaveURL(/\/book/);

    await page.goto('/');
    await header.getByRole('link', { name: /help/i }).click();
    await expect(page).toHaveURL(/\/help/);
  });

  test('cart icon shows zero items by default and routes to /cart', async ({ page }) => {
    await page.goto('/');
    const cart = page.locator('#lbc-cart-target');
    await expect(cart).toBeVisible();
    await cart.click();
    await expect(page).toHaveURL(/\/cart/);
  });

  test('static pages render', async ({ page }) => {
    for (const path of ['/help', '/privacy', '/terms', '/refer', '/club']) {
      await page.goto(path);
      await expect(page.locator('body')).not.toBeEmpty();
      await expect(page).toHaveURL(new RegExp(path));
    }
  });
});
