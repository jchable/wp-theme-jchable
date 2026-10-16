import { test, expect } from '@playwright/test';
import { ARCHIVES, PAGES } from './fixtures';

test.describe('archives', () => {
  test('catégorie : titre et 10 articles', async ({ page }) => {
    await page.goto(ARCHIVES.category);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Divers');
    await expect(page.locator('.post-feed .wp-block-post')).toHaveCount(10);
  });

  test('mois : octobre 2026 contient 2 articles', async ({ page }) => {
    await page.goto(ARCHIVES.month);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('2026');
    await expect(page.locator('.post-feed .wp-block-post')).toHaveCount(2);
  });
});

test.describe('recherche', () => {
  test('trouve les 3 articles OKF4net', async ({ page }) => {
    await page.goto(ARCHIVES.search);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('okf4net');
    await expect(page.locator('.post-feed .wp-block-post')).toHaveCount(3);
  });

  test('sans résultat : message clair et nouveau champ de recherche', async ({ page }) => {
    await page.goto(ARCHIVES.searchEmpty);
    await expect(page.locator('.site-main')).toContainText('Aucun résultat');
    await expect(page.locator('.site-main input[type="search"]')).toBeVisible();
  });
});

test.describe('404', () => {
  test('renvoie un code 404 et une page explicite', async ({ page }) => {
    const response = await page.goto(ARCHIVES.notFound);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page introuvable');
    await expect(page.locator('.site-main input[type="search"]')).toBeVisible();
  });
});

test.describe('plan du site', () => {
  test('liste les archives par mois, les catégories et les pages', async ({ page }) => {
    await page.goto(PAGES.sitemap);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Plan du site');
    await expect(page.locator('.site-main a[href$="/2026/10/"]')).toHaveCount(1);
    await expect(page.locator('.site-main a[href$="/category/divers/"]')).toHaveCount(1);
    await expect(page.locator('.site-main a[href$="/a-propos/"]')).toHaveCount(1);
  });
});
