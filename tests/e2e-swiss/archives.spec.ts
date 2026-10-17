import { test, expect, type Locator } from '@playwright/test';
import { ARCHIVES, PAGES, POSTS } from '../e2e/fixtures';
import { feedNumbers } from './helpers';

const INK = 'rgb(10, 10, 10)';
const ACCENT = 'rgb(43, 43, 255)';

async function pseudo(el: Locator, which = '::before'): Promise<string> {
  return el.evaluate(
    (node, w) => {
      const c = getComputedStyle(node, w).content;
      const m = c.match(/^"([^"]*)"/);
      return m ? m[1] : c;
    },
    which,
  );
}

test.describe('archives', () => {
  test('catégorie : h1, 10 articles numérotés, sans article à la une', async ({ page }) => {
    await page.goto(ARCHIVES.category);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Divers');
    const cards = page.locator('.swiss-feed .swiss-card');
    await expect(cards).toHaveCount(10);
    expect(await feedNumbers(page)).toEqual(['01', '02', '03', '04', '05', '06', '07', '08', '09', '10']);
    expect(await pseudo(cards.first().locator('.swiss-meta'))).not.toBe('Nouveau');
    await expect(cards.first().locator('.swiss-visual')).toBeHidden();
    await expect(page.locator('.swiss-hero')).toHaveCount(0);
  });

  test('le titre de l’archive est un grand h1 de la même famille que celui de l’accueil', async ({ page }) => {
    await page.goto(ARCHIVES.category);
    const style = await page.getByRole('heading', { level: 1 }).evaluate((el) => {
      const s = getComputedStyle(el);
      return { weight: s.fontWeight, size: parseFloat(s.fontSize), spacing: parseFloat(s.letterSpacing) };
    });
    expect(style.weight).toBe('800');
    expect(style.size).toBeGreaterThanOrEqual(40);
    expect(style.spacing).toBeLessThan(0);
  });

  test('mois : 2 articles', async ({ page }) => {
    await page.goto(ARCHIVES.month);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/octobre 2026|October 2026/);
    await expect(page.locator('.swiss-feed .swiss-card')).toHaveCount(2);
  });

  test('la pagination d’une archive est la même que celle de l’accueil', async ({ page }) => {
    await page.goto(ARCHIVES.category);
    await page.getByRole('link', { name: /Articles plus anciens/ }).click();
    await expect(page).toHaveURL(/\/category\/divers\/page\/2\/$/);
    expect(await feedNumbers(page)).toEqual(['11', '12', '13']);
  });
});

test.describe('recherche', () => {
  test('3 résultats, le terme dans le titre, formulaire de recherche pré-rempli', async ({ page }) => {
    await page.goto(ARCHIVES.search);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('okf4net');
    await expect(page.locator('.swiss-feed .swiss-card')).toHaveCount(3);
    await expect(page.getByRole('searchbox')).toBeVisible();
  });

  test('sans résultat : message clair et formulaire', async ({ page }) => {
    await page.goto(ARCHIVES.searchEmpty);
    await expect(page.locator('main')).toContainText('Aucun résultat');
    await expect(page.locator('main input[type="search"]')).toBeVisible();
    await expect(page.locator('.swiss-feed .swiss-card')).toHaveCount(0);
  });
});

test.describe('404', () => {
  test('code 404, grand « 404 » en accent, chemin demandé et retour à l’accueil', async ({ page }) => {
    const response = await page.goto(ARCHIVES.notFound);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page introuvable');
    await expect(page.locator('.wp-block-jchable-request-path')).toHaveText(ARCHIVES.notFound);
    const code = page.locator('.swiss-404-code');
    await expect(code).toHaveText('404');
    expect(await code.evaluate((el) => getComputedStyle(el).color)).toBe(ACCENT);
    expect(await code.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(96);
    await page.getByRole('link', { name: /Retour à l’accueil|Retour à l'accueil/ }).click();
    await expect(page).toHaveURL('/');
  });

  test('l’en-tête et le pied de page sont conservés', async ({ page }) => {
    await page.goto(ARCHIVES.notFound);
    await expect(page.getByRole('navigation', { name: 'Menu principal' })).toBeVisible();
    await expect(page.locator('.swiss-footer')).toBeVisible();
  });

  test('échappe le chemin demandé', async ({ page }) => {
    await page.goto('/%3Cscript%3Ealert(1)%3C/script%3E/');
    await expect(page.locator('main script', { hasText: 'alert(1)' })).toHaveCount(0);
  });
});

test.describe('plan du site', () => {
  test('h1, archives par mois, catégories et pages, chaque lien une seule fois', async ({ page }) => {
    await page.goto(PAGES.sitemap);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Plan du site');
    await expect(page.locator('main a[href$="/2026/10/"]')).toHaveCount(1);
    await expect(page.locator('main a[href$="/category/divers/"]')).toHaveCount(1);
    await expect(page.locator('main a[href$="/a-propos/"]')).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Archives par mois', 'Catégories', 'Pages']);
  });

  test('sections séparées par des filets noirs de 2 px', async ({ page }) => {
    await page.goto(PAGES.sitemap);
    const sections = page.locator('.swiss-sitemap-section');
    await expect(sections).toHaveCount(3);
    const border = await sections.first().evaluate((el) => {
      const s = getComputedStyle(el);
      return { top: s.borderTopWidth, color: s.borderTopColor };
    });
    expect(border).toEqual({ top: '2px', color: INK });
  });

  test('un lien de l’archive mène aux articles du mois', async ({ page }) => {
    await page.goto(PAGES.sitemap);
    await page.locator('main a[href$="/2026/10/"]').click();
    await expect(page.locator('.swiss-feed .swiss-card')).toHaveCount(2);
    await expect(page.getByRole('link', { name: POSTS.latest.title })).toBeVisible();
  });
});
