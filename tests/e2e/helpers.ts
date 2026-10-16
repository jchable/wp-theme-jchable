import { expect, type Page } from '@playwright/test';

export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, 'la page ne doit pas défiler horizontalement').toBeLessThanOrEqual(0);
}
