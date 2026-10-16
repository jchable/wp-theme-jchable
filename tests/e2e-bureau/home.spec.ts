import { test, expect } from '@playwright/test';
import { POSTS, TOTAL_POSTS } from '../e2e/fixtures';

const ACCENT = 'rgb(45, 63, 200)';
const DARK = 'rgb(16, 16, 16)';

test.describe('accueil Bureau', () => {
  test('fenêtre bienvenue.txt : h1 = titre du site, slogan', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Julien Chable');
    const welcome = page.locator('.window', { hasText: 'bienvenue.txt' }).first();
    await expect(welcome).toContainText('what else ?');
  });

  test('10 articles dans des fenêtres titrées slug.md — date', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.post-feed .wp-block-post')).toHaveCount(10);
    await expect(page.locator('.post-feed .window-titlebar').first()).toHaveText(
      'a-folder-of-markdown-you-can-actually-browse.md — 16.10.2026',
    );
    await expect(page.getByRole('heading', { level: 2, name: POSTS.latest.title })).toBeVisible();
  });

  test('page 1 : la première barre est bleue, les suivantes noires', async ({ page }) => {
    await page.goto('/');
    const bars = page.locator('.post-feed .window-titlebar');
    expect(await bars.nth(0).evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(ACCENT);
    expect(await bars.nth(1).evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(DARK);
  });

  test('page 2 : pas de fenêtre à la une', async ({ page }) => {
    await page.goto('/page/2/');
    await expect(page.locator('.post-feed .wp-block-post')).toHaveCount(TOTAL_POSTS - 10);
    const first = page.locator('.post-feed .window-titlebar').first();
    expect(await first.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(DARK);
  });

  test('la fenêtre a une bordure noire et une ombre dure', async ({ page }) => {
    await page.goto('/');
    const style = await page.locator('.window').first().evaluate((el) => {
      const s = getComputedStyle(el);
      return { border: s.borderTopWidth, color: s.borderTopColor, shadow: s.boxShadow };
    });
    expect(style.border).toBe('2px');
    expect(style.color).toBe(DARK);
    expect(style.shadow).toContain('6px 6px');
  });

  test('la pagination en boutons mène aux articles plus anciens', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Articles plus anciens' }).click();
    await expect(page).toHaveURL(/\/page\/2\/$/);
  });
});

test.describe('pas de bandeau en haut de la page', () => {
  test('le nom du site n’occupe plus une barre en haut : le contenu et les icônes remontent', async ({ page }, info) => {
    await page.goto('/');
    const bar = await page.locator('.menubar').boundingBox();
    expect(bar === null || (bar.width <= 1 && bar.height <= 1)).toBe(true); // masqué à l'écran, lu par les lecteurs d'écran
    await expect(page.locator('.menubar')).toHaveText('Julien Chable');
    if (info.project.name === 'desktop') {
      expect((await page.locator('main .window').first().boundingBox())!.y).toBeLessThan(90);
      expect((await page.locator('#bureau-desktop .bicon').first().boundingBox())!.y).toBeLessThan(40);
    }
  });
});

test.describe('image du dernier article sur l’accueil', () => {
  test('elle est deux fois moins haute qu’en 16/9, et centrée verticalement', async ({ page }) => {
    await page.goto('/');
    const img = page.locator('.post-feed .wp-block-post-template > li:first-child .wp-block-post-featured-image img');
    await expect(img).toBeVisible();
    const box = (await img.boundingBox())!;
    // 16/9 donnerait une hauteur de largeur × 0,5625 ; la moitié, c'est largeur × 0,28125 (32/9)
    expect(box.height / box.width).toBeCloseTo(9 / 32, 2);
    const fit = await img.evaluate((el) => ({ fit: getComputedStyle(el).objectFit, pos: getComputedStyle(el).objectPosition }));
    expect(fit.fit).toBe('cover');
    expect(fit.pos).toBe('50% 50%');
  });
});
