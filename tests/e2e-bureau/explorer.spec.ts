import { test, expect } from '@playwright/test';
import { ARCHIVES, PAGES } from '../e2e/fixtures';

test.describe('explorateur', () => {
  test('catégorie : fenêtre Explorateur, adresse et 10 lignes à 3 colonnes', async ({ page }) => {
    await page.goto(ARCHIVES.category);
    await expect(page.locator('.explorer .window-titlebar')).toHaveText('Explorateur');
    await expect(page.locator('.explorer .wp-block-jchable-archive-path')).toHaveText('C:\\Blog\\Catégories\\Divers');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Divers');
    const rows = page.locator('.explorer .explorer-row');
    await expect(rows).toHaveCount(10);
    await expect(rows.first().locator('.wp-block-jchable-post-filename')).toHaveText(/\.md$/);
    await expect(rows.first().locator('.wp-block-post-date')).toBeVisible();
    await expect(rows.first().locator('.wp-block-post-terms')).toContainText('Divers');
  });

  test('ordinateur : une ligne affiche ses 3 colonnes côte à côte', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop');
    await page.goto(ARCHIVES.category);
    const row = page.locator('.explorer .explorer-row').first();
    const name = await row.locator('.wp-block-post-title').boundingBox();
    const date = await row.locator('.wp-block-post-date').boundingBox();
    const term = await row.locator('.wp-block-post-terms').boundingBox();
    expect(name && date && term && name.x < date.x && date.x < term.x).toBeTruthy();
  });

  test('mois : 2 articles', async ({ page }) => {
    await page.goto(ARCHIVES.month);
    await expect(page.locator('.explorer .wp-block-jchable-archive-path')).toHaveText('C:\\Blog\\Archives\\2026\\10');
    await expect(page.locator('.explorer .explorer-row')).toHaveCount(2);
  });

  test('recherche : 3 résultats', async ({ page }) => {
    await page.goto(ARCHIVES.search);
    await expect(page.locator('.explorer .wp-block-jchable-archive-path')).toHaveText('C:\\Blog\\Recherche\\« okf4net »');
    await expect(page.locator('.explorer .explorer-row')).toHaveCount(3);
  });

  test('recherche sans résultat : message clair et formulaire', async ({ page }) => {
    await page.goto(ARCHIVES.searchEmpty);
    await expect(page.locator('.explorer')).toContainText('Aucun résultat');
    await expect(page.locator('.explorer input[type="search"]')).toBeVisible();
  });

  test('plan du site : archives, catégories et pages', async ({ page }) => {
    await page.goto(PAGES.sitemap);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Plan du site');
    await expect(page.locator('main a[href$="/2026/10/"]')).toHaveCount(1);
    await expect(page.locator('main a[href$="/category/divers/"]')).toHaveCount(1);
    await expect(page.locator('main a[href$="/a-propos/"]')).toHaveCount(1);
  });
});

test.describe('barre latérale', () => {
  test('3 fenêtres : Rechercher, Archives, À propos', async ({ page }) => {
    await page.goto('/');
    const titles = page.locator('.site-sidebar .window-titlebar');
    await expect(titles).toHaveText(['Rechercher…', 'Archives', 'À propos']);
    await expect(page.locator('#recherche input[type="search"]')).toBeVisible();
  });
});
