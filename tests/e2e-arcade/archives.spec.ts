import { test, expect } from '@playwright/test';
import { ARCHIVES, PAGES } from '../e2e/fixtures';

const CYAN = 'rgb(92, 225, 230)';
const ACCENT = 'rgb(255, 204, 51)';

test.describe('archives Arcade', () => {
  test('catégorie : titre h1 et 10 cartes à stage, sans carte mise en avant', async ({ page }) => {
    await page.goto(ARCHIVES.category);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Divers');
    const cards = page.locator('.arcade-feed .wp-block-post article');
    await expect(cards).toHaveCount(10);
    await expect(cards.first().locator('.wp-block-jchable-arcade-stage')).toHaveText('STAGE 13');
    const first = await cards.first().evaluate((el) => ({ clip: getComputedStyle(el).clipPath, border: getComputedStyle(el).borderTopColor }));
    expect(first.clip).toBe('none');
    expect(first.border).toBe(CYAN);
    await expect(page.getByRole('link', { name: /Articles plus anciens/ })).toBeVisible();
  });

  test('mois : octobre 2026 contient 2 articles', async ({ page }) => {
    await page.goto(ARCHIVES.month);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('2026');
    await expect(page.locator('.arcade-feed .wp-block-post')).toHaveCount(2);
    await expect(page.getByRole('link', { name: /Articles plus anciens/ })).toHaveCount(0);
  });

  test('le titre d’archive est en police pixel', async ({ page }) => {
    await page.goto(ARCHIVES.category);
    const h1 = page.getByRole('heading', { level: 1 });
    expect(await h1.evaluate((el) => getComputedStyle(el).fontFamily)).toContain('Pixelify Sans');
    expect(await h1.evaluate((el) => getComputedStyle(el).color)).toBe(ACCENT);
  });
});

test.describe('recherche Arcade', () => {
  test('trouve les 3 articles OKF4net', async ({ page }) => {
    await page.goto(ARCHIVES.search);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('okf4net');
    await expect(page.locator('.arcade-feed .wp-block-post')).toHaveCount(3);
  });

  test('sans résultat : message clair et nouveau champ de recherche', async ({ page }) => {
    await page.goto(ARCHIVES.searchEmpty);
    await expect(page.locator('main')).toContainText('Aucun résultat');
    await expect(page.locator('main input[type="search"]')).toBeVisible();
  });

  test('la recherche mène aux résultats', async ({ page }) => {
    await page.goto('/');
    const form = page.locator('#recherche');
    await form.locator('input[type="search"]').fill('okf4net');
    await form.getByRole('button', { name: 'Chercher' }).click();
    await expect(page).toHaveURL(/\?s=okf4net/);
    await expect(page.locator('.arcade-feed .wp-block-post')).toHaveCount(3);
  });

  test('le titre de recherche échappe les balises saisies', async ({ page }) => {
    await page.goto('/?s=%3Cscript%3Ealert(1)%3C%2Fscript%3E');
    await expect(page.locator('main script')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('<script>');
  });
});

test.describe('404 Arcade : GAME OVER', () => {
  test('code 404, écran GAME OVER sobre, chemin affiché et retour à l’accueil', async ({ page }) => {
    const response = await page.goto(ARCHIVES.notFound);
    expect(response?.status()).toBe(404);
    await expect(page.locator('.arcade-gameover .arcade-hero__eyebrow')).toHaveText('— GAME OVER —');
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toHaveText('Page introuvable');
    const style = await h1.evaluate((el) => ({ color: getComputedStyle(el).color, shadow: getComputedStyle(el).textShadow, family: getComputedStyle(el).fontFamily }));
    expect(style.color).toBe(ACCENT);
    expect(style.shadow).toContain('rgb(194, 37, 92)');
    expect(style.family).toContain('Pixelify Sans');
    await expect(page.locator('.wp-block-jchable-request-path')).toHaveText(ARCHIVES.notFound);
    await expect(page.locator('#recherche input[type="search"]')).toBeVisible();
    await page.getByRole('link', { name: /Rejouer/ }).click();
    await expect(page).toHaveURL('/');
  });

  test('pas de barre latérale sur l’écran GAME OVER, mais l’en-tête et le pied de page', async ({ page }) => {
    await page.goto(ARCHIVES.notFound);
    await expect(page.getByRole('complementary')).toHaveCount(0);
    await expect(page.locator('.arcade-header')).toBeVisible();
    await expect(page.locator('.arcade-footer')).toBeVisible();
  });

  test('échappe le chemin demandé', async ({ page }) => {
    await page.goto('/%3Cscript%3Ealert(1)%3C/script%3E/');
    await expect(page.locator('main script')).toHaveCount(0);
    await expect(page.locator('.wp-block-jchable-request-path')).toContainText('%3Cscript%3E');
  });
});

test.describe('plan du site Arcade', () => {
  test('liste les archives par mois, les catégories et les pages dans des cartes', async ({ page }) => {
    await page.goto(PAGES.sitemap);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Plan du site');
    await expect(page.locator('main .arcade-sitemap__card')).toHaveCount(3);
    await expect(page.locator('main a[href$="/2026/10/"]')).toHaveCount(1);
    await expect(page.locator('main a[href$="/category/divers/"]')).toHaveCount(1);
    await expect(page.locator('main a[href$="/a-propos/"]')).toHaveCount(1);
    await expect(page.getByRole('complementary')).toBeVisible();
  });
});
