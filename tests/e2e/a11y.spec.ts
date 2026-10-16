import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { POSTS, PAGES, ARCHIVES } from './fixtures';

const PATHS = ['/', POSTS.latest.path, POSTS.code.path, PAGES.about, PAGES.sitemap, ARCHIVES.category, ARCHIVES.search, ARCHIVES.notFound];

for (const path of PATHS) {
  test(`axe : aucune violation sérieuse ou critique sur ${path}`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => `${v.id} (${v.impact}) : ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
    expect(blocking).toEqual([]);
  });
}

test('code : la zone défilante est accessible au clavier', async ({ page }) => {
  await page.goto(POSTS.code.path);
  await expect(page.locator('.wp-block-code')).toHaveAttribute('tabindex', '0');
});
