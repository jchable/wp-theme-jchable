import { test } from '@playwright/test';
import { POSTS, PAGES, ARCHIVES } from './fixtures';
import { expectNoHorizontalScroll } from './helpers';

const PATHS = [
  '/',
  '/page/2/',
  POSTS.latest.path,
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
}

// Contenus utilisateur ou anciens articles : un mot interminable ne doit jamais élargir la page.
test('pas de défilement horizontal avec des textes interminables injectés', async ({ page }) => {
  await page.goto(POSTS.latest.path);
  await page.evaluate(() => {
    const long = 'x'.repeat(100);
    const targets = [
      '.wp-block-comment-content',
      '.wp-block-comment-author-name',
      '.wp-block-post-terms a',
      '.wp-block-site-title a',
      '.wp-block-site-tagline',
      '.wp-block-navigation-item__label',
      '.post-nav a',
      '.wp-block-archives a',
    ];
    for (const selector of targets) {
      document.querySelectorAll(selector).forEach((el) => {
        el.textContent = long;
      });
    }
    const frame = document.createElement('iframe');
    frame.setAttribute('width', '800');
    frame.setAttribute('height', '100');
    document.querySelector('.wp-block-post-content')?.appendChild(frame);
  });
  await expectNoHorizontalScroll(page);
});
