import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { POSTS, PAGES, ARCHIVES } from '../e2e/fixtures';
import { expectNoHorizontalScroll } from '../e2e/helpers';

const PATHS = [
  '/',
  '/page/2/',
  POSTS.latest.path,
  POSTS.closed.path,
  POSTS.long.path,
  POSTS.code.path,
  PAGES.about,
  PAGES.sitemap,
  ARCHIVES.category,
  ARCHIVES.month,
  ARCHIVES.search,
  ARCHIVES.searchEmpty,
  ARCHIVES.notFound,
];

for (const path of PATHS) {
  test(`pas de défilement horizontal : ${path}`, async ({ page }) => {
    await page.goto(path);
    await expectNoHorizontalScroll(page);
  });

  test(`axe : aucune violation sérieuse ou critique sur ${path}`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => `${v.id} (${v.impact}) : ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
    expect(blocking).toEqual([]);
  });
}

test('pas de défilement horizontal avec des textes interminables injectés', async ({ page }) => {
  await page.goto(POSTS.latest.path);
  await page.evaluate(() => {
    const long = 'x'.repeat(100);
    const targets = [
      '.wp-block-comment-content',
      '.wp-block-comment-author-name',
      '.wp-block-post-terms a',
      '.taskbar-tab',
      '.window-title',
      '.wp-block-navigation-item__label',
      '.post-nav a',
      '.wp-block-archives a',
    ];
    for (const selector of targets) {
      document.querySelectorAll(selector).forEach((el) => {
        el.textContent = long;
      });
    }
  });
  await expectNoHorizontalScroll(page);
});

test.describe('sans JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('accueil lisible, lien d’évitement, navigation vers un article', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('a.skip-link')).toHaveAttribute('href', '#contenu');
    await expect(page.locator('.post-feed .wp-block-post')).toHaveCount(10);
    await page.getByRole('link', { name: POSTS.latest.title }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(POSTS.latest.title);
    await expect(page.locator('.post-comments textarea#comment')).toBeVisible();
  });
});
