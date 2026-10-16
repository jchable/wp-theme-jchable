import { test, expect } from '@playwright/test';
import { POSTS, PAGES, ARCHIVES } from './fixtures';

test.describe('bloc post-filename', () => {
  test('article : slug.md et date', async ({ page }) => {
    await page.goto(POSTS.latest.path);
    await expect(page.locator('.wp-block-jchable-post-filename')).toHaveText(
      'a-folder-of-markdown-you-can-actually-browse.md — 16.10.2026',
    );
  });

  test('page : slug.md sans date', async ({ page }) => {
    await page.goto(PAGES.about);
    await expect(page.locator('.wp-block-jchable-post-filename')).toHaveText('a-propos.md');
  });
});

test.describe('bloc archive-path', () => {
  test('catégorie', async ({ page }) => {
    await page.goto(ARCHIVES.category);
    await expect(page.locator('.wp-block-jchable-archive-path')).toHaveText('C:\\Blog\\Catégories\\Divers');
  });

  test('mois', async ({ page }) => {
    await page.goto(ARCHIVES.month);
    await expect(page.locator('.wp-block-jchable-archive-path')).toHaveText('C:\\Blog\\Archives\\2026\\10');
  });

  test('recherche', async ({ page }) => {
    await page.goto(ARCHIVES.search);
    await expect(page.locator('.wp-block-jchable-archive-path')).toHaveText('C:\\Blog\\Recherche\\« okf4net »');
  });

  test('page 2 d’une archive', async ({ page }) => {
    await page.goto(ARCHIVES.category + 'page/2/');
    await expect(page.locator('.wp-block-jchable-archive-path')).toHaveText('C:\\Blog\\Catégories\\Divers\\page-2');
  });

  test('échappe la recherche', async ({ page }) => {
    await page.goto('/?s=' + encodeURIComponent('<b>x</b>'));
    const path = page.locator('.wp-block-jchable-archive-path');
    await expect(path).toHaveText('C:\\Blog\\Recherche\\« <b>x</b> »');
    await expect(path.locator('b')).toHaveCount(0);
  });
});

test.describe('bloc request-path', () => {
  test('affiche le chemin demandé', async ({ page }) => {
    await page.goto(ARCHIVES.notFound);
    await expect(page.locator('.wp-block-jchable-request-path')).toHaveText(ARCHIVES.notFound);
  });

  test('échappe le chemin de la 404', async ({ page }) => {
    await page.goto('/%3Cscript%3Ealert(1)%3C/script%3E/');
    const path = page.locator('.wp-block-jchable-request-path');
    await expect(path).toContainText('%3Cscript%3E');
    await expect(page.locator('.site-main script')).toHaveCount(0);
  });
});
