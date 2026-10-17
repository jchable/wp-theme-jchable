import { test, expect } from '@playwright/test';
import { POSTS, PAGES } from '../e2e/fixtures';

const INK = 'rgb(10, 10, 10)';
const ACCENT = 'rgb(43, 43, 255)';

test.describe('article Swiss', () => {
  test('grand titre h1, métadonnées en mono (nom de fichier, date, catégorie) et image légendée', async ({ page }) => {
    await page.goto(POSTS.latest.path);
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toHaveText(POSTS.latest.title);
    expect(await h1.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(40);
    const meta = page.locator('.swiss-single-meta');
    await expect(meta.locator('.wp-block-jchable-post-filename')).toHaveText(
      'a-folder-of-markdown-you-can-actually-browse.md — 16.10.2026',
    );
    await expect(meta).toContainText('Divers');
    expect(await meta.evaluate((el) => getComputedStyle(el).fontFamily)).toContain('IBM Plex Mono');
    await expect(page.locator('.wp-block-post-content figcaption')).toContainText('The explorer of the synthetic bundle');
  });

  test('filets noirs de 2 px autour des métadonnées', async ({ page }) => {
    await page.goto(POSTS.latest.path);
    const rules = await page.locator('.swiss-single-meta').evaluate((el) => {
      const s = getComputedStyle(el);
      return { top: s.borderTopWidth, bottom: s.borderBottomWidth, color: s.borderTopColor };
    });
    expect(rules).toEqual({ top: '2px', bottom: '2px', color: INK });
  });

  test('l’attribut lang du contenu suit le champ jchable_lang', async ({ page }) => {
    await page.goto(POSTS.latest.path);
    await expect(page.locator('.wp-block-post-content')).toHaveAttribute('lang', 'en');
  });

  test('le texte reste dans une colonne lisible (≤ 760 px) alignée à gauche', async ({ page }) => {
    await page.goto(POSTS.latest.path);
    const title = (await page.getByRole('heading', { level: 1 }).boundingBox())!;
    const p = (await page.locator('.wp-block-post-content > p').first().boundingBox())!;
    expect(p.width).toBeLessThanOrEqual(760);
    expect(Math.abs(p.x - title.x)).toBeLessThan(2);
  });

  test('3 commentaires et le formulaire, filets de 2 px', async ({ page }) => {
    await page.goto(POSTS.latest.path);
    await expect(page.locator('.post-comments .wp-block-comment-template > li')).toHaveCount(3);
    const area = page.locator('.post-comments textarea#comment');
    await expect(area).toBeVisible();
    expect(await area.evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe('2px');
    const submit = page.locator('.post-comments input[type="submit"], .post-comments button[type="submit"]').first();
    expect(await submit.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(INK);
  });

  test('commentaires fermés : ni formulaire ni section vide', async ({ page }) => {
    await page.goto(POSTS.closed.path);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(POSTS.closed.title);
    await expect(page.locator('textarea#comment')).toHaveCount(0);
    await expect(page.locator('.post-comments')).toHaveCount(0);
  });

  test('liens Précédent et Suivant en blocs à filet de 2 px', async ({ page }) => {
    await page.goto(POSTS.release.path);
    const links = page.locator('.post-nav a');
    await expect(links).toHaveCount(2);
    expect(await links.first().evaluate((a) => getComputedStyle(a).borderTopWidth)).toBe('2px');
  });

  test('un lien du texte est souligné, et passe à l’accent au survol', async ({ page }) => {
    await page.goto(POSTS.latest.path);
    await page.evaluate(() => {
      const p = document.querySelector('.wp-block-post-content > p')!;
      p.insertAdjacentHTML('beforeend', ' <a id="lien-test" href="#">un lien</a>');
    });
    const link = page.locator('#lien-test');
    expect(await link.evaluate((a) => getComputedStyle(a).textDecorationLine)).toBe('underline');
    await link.hover();
    expect(await link.evaluate((a) => getComputedStyle(a).color)).toBe(ACCENT);
  });

  test('le titre d’un article de la liste passe à l’accent au survol', async ({ page }) => {
    await page.goto('/');
    const link = page.locator('.swiss-card .wp-block-post-title a').nth(1);
    await link.hover();
    expect(await link.evaluate((a) => getComputedStyle(a).color)).toBe(ACCENT);
  });

  test('bloc de code : filet de 2 px, défilement interne et atteignable au clavier', async ({ page }) => {
    await page.goto(POSTS.code.path);
    const pre = page.locator('.wp-block-post-content pre').first();
    await expect(pre).toBeVisible();
    await expect(pre).toHaveAttribute('tabindex', '0');
    expect(await pre.evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe('2px');
    expect(await pre.evaluate((el) => getComputedStyle(el).fontFamily)).toContain('IBM Plex Mono');
  });
});

test.describe('page Swiss', () => {
  test('h1 et contenu, sans date ni commentaires', async ({ page }) => {
    await page.goto(PAGES.about);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('À propos');
    await expect(page.locator('textarea#comment')).toHaveCount(0);
    await expect(page.locator('.swiss-single-meta .wp-block-post-date')).toHaveCount(0);
    await expect(page.locator('.swiss-hero')).toHaveCount(0); // le grand titre du site est réservé à l'accueil
  });

  test('le menu y est présent, avec la page courante', async ({ page }) => {
    await page.goto(PAGES.about);
    await expect(page.getByRole('navigation', { name: 'Menu principal' }).getByRole('link')).toHaveCount(3);
  });
});
