// Custom Playwright test fixture that pre-dismisses the first-visit onboarding
// overlay. Without this, the modal's `fixed inset-0` div intercepts pointer
// events on the header and the login button.

import { test as base, expect } from '@playwright/test';

export const test = base.extend<{}>({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('lbc_onboarded_v1', '1');
      } catch {}
    });
    await use(page);
  },
});

export { expect };
