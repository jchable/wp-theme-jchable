import { test, expect } from '@playwright/test';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { POSTS, PAGES, ARCHIVES } from '../e2e/fixtures';

const NIGHT = 'rgb(15, 18, 34)';
const TEXT = 'rgb(232, 234, 246)';

test.describe('socle du thème Arcade', () => {
  test('fond nuit #0F1222 avec motif de points, texte clair', async ({ page }) => {
    await page.goto('/');
    const style = await page.evaluate(() => {
      const s = getComputedStyle(document.body);
      return { bg: s.backgroundColor, image: s.backgroundImage, color: s.color };
    });
    expect(style.bg).toBe(NIGHT);
    expect(style.color).toBe(TEXT);
    expect(style.image.match(/radial-gradient/g)?.length, 'deux trames de points').toBe(2);
  });

  test('Pixelify Sans, Geist et Geist Mono sont servies par le thème', async ({ page }) => {
    const fonts: string[] = [];
    page.on('request', (request) => {
      const path = new URL(request.url()).pathname;
      if (/\/themes\/jchable-arcade\/assets\/fonts\/.+\.woff2$/.test(path)) fonts.push(path);
    });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const families = await page.evaluate(() => ({
      body: getComputedStyle(document.body).fontFamily,
      h1: getComputedStyle(document.querySelector('h1')!).fontFamily,
      meta: getComputedStyle(document.querySelector('.wp-block-jchable-arcade-stage')!).fontFamily,
    }));
    expect(families.body).toContain('Geist');
    expect(families.h1).toContain('Pixelify Sans');
    expect(families.meta).toContain('Geist Mono');
    const checks = ['700 48px "Pixelify Sans"', '400 16px "Geist"', '400 13px "Geist Mono"'];
    const loaded = await page.evaluate(async (list) => {
      await Promise.all(list.map((f) => document.fonts.load(f)));
      return list.map((f) => document.fonts.check(f));
    }, checks);
    expect(loaded).toEqual([true, true, true]);
    expect(fonts.length, 'au moins une police du thème est téléchargée').toBeGreaterThan(0);
    expect(fonts.some((f) => /pixelify-sans/.test(f))).toBe(true);
    expect(fonts.some((f) => /geist-sans/.test(f))).toBe(true);
    expect(fonts.some((f) => /geist-mono/.test(f))).toBe(true);
  });

  test('fonts.css : font-display swap, aucune adresse externe', async ({ request }) => {
    const response = await request.get('/wp-content/themes/jchable-arcade/assets/css/fonts.css');
    expect(response.status()).toBe(200);
    const css = await response.text();
    expect(css).toContain('font-display: swap');
    expect(css).not.toMatch(/https?:\/\//);
    expect(css).not.toContain('googleapis');
  });

  test('les polices pèsent moins de 500 Ko et la licence OFL est livrée', () => {
    const dir = join(process.cwd(), 'themes', 'jchable-arcade', 'assets', 'fonts');
    const files = readdirSync(dir);
    const total = files.filter((f) => f.endsWith('.woff2')).reduce((sum, f) => sum + statSync(join(dir, f)).size, 0);
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThan(500 * 1024);
    expect(files).toContain('LICENSE-OFL.txt');
  });

  test('les feuilles du thème ont pour version la date du fichier', async ({ page }) => {
    await page.goto('/');
    const hrefs = await page.$$eval('link[rel="stylesheet"]', (links) => links.map((l) => (l as HTMLLinkElement).href));
    for (const name of ['fonts.css', 'arcade.css']) {
      const href = hrefs.find((h) => h.includes(`/jchable-arcade/assets/css/${name}`));
      expect(href, name).toBeTruthy();
      expect(href, name).toMatch(/[?&]ver=\d{9,}/);
    }
  });

  test('aucun JavaScript propre au thème', async ({ page }) => {
    await page.goto('/');
    const scripts = await page.$$eval('script[src]', (s) => s.map((el) => (el as HTMLScriptElement).src));
    expect(scripts.filter((src) => src.includes('/themes/jchable-arcade/'))).toEqual([]);
  });
});

for (const path of ['/', '/page/2/', POSTS.latest.path, PAGES.about, PAGES.sitemap, ARCHIVES.category, ARCHIVES.search, ARCHIVES.notFound]) {
  test(`aucune requête vers un domaine externe : ${path}`, async ({ page }) => {
    const external: string[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (/^https?:$/.test(url.protocol) && url.hostname !== 'localhost') external.push(request.url());
    });
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForLoadState('networkidle');
    expect(external).toEqual([]);
  });
}
