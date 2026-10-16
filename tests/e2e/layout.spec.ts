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
