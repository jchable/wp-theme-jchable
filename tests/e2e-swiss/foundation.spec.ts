import { test, expect } from '@playwright/test';

test.describe('socle du thème Swiss Électrique', () => {
  test('fond papier #FAFAF7, texte encre #0A0A0A', async ({ page }) => {
    await page.goto('/');
    const colors = await page.evaluate(() => {
      const s = getComputedStyle(document.body);
      return { background: s.backgroundColor, color: s.color };
    });
    expect(colors.background).toBe('rgb(250, 250, 247)');
    expect(colors.color).toBe('rgb(10, 10, 10)');
  });

  test('palette : accent électrique #2B2BFF et jaune-vert #D4FF00', async ({ page }) => {
    await page.goto('/');
    const palette = await page.evaluate(() => {
      const s = getComputedStyle(document.documentElement);
      return ['accent', 'lime', 'base', 'contrast'].map((slug) =>
        s.getPropertyValue(`--wp--preset--color--${slug}`).trim().toLowerCase(),
      );
    });
    expect(palette).toEqual(['#2b2bff', '#d4ff00', '#fafaf7', '#0a0a0a']);
  });

  test('Bricolage Grotesque et IBM Plex Mono sont servies par le thème, sans appel externe', async ({ page }) => {
    const fontRequests: string[] = [];
    const externalRequests: string[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (/^https?:/.test(request.url()) && url.hostname !== 'localhost') externalRequests.push(request.url());
      if (/\/themes\/jchable-swiss\/assets\/fonts\/.+\.woff2$/.test(url.pathname)) fontRequests.push(url.pathname);
    });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toContain('Bricolage Grotesque');
    expect(fontRequests.some((f) => f.includes('bricolage-grotesque-latin-800'))).toBe(true);
    expect(fontRequests.some((f) => f.includes('ibm-plex-mono-latin-400'))).toBe(true);
    expect(await page.evaluate(() => document.fonts.check('800 20px "Bricolage Grotesque"'))).toBe(true);
    expect(await page.evaluate(() => document.fonts.check('500 14px "IBM Plex Mono"'))).toBe(true);
    expect(externalRequests).toEqual([]);
  });

  test('les titres sont en 800 avec un interlettrage serré', async ({ page }) => {
    await page.goto('/');
    const h1 = await page.getByRole('heading', { level: 1 }).evaluate((el) => {
      const s = getComputedStyle(el);
      return { weight: s.fontWeight, spacing: parseFloat(s.letterSpacing), size: parseFloat(s.fontSize) };
    });
    expect(h1.weight).toBe('800');
    expect(h1.spacing).toBeLessThan(-h1.size * 0.03); // au moins -0,03em
  });

  test('les feuilles du thème sont versionnées par la date du fichier (cache)', async ({ page }) => {
    await page.goto('/');
    const hrefs = await page
      .locator('link[rel="stylesheet"][href*="/themes/jchable-swiss/assets/css/"]')
      .evaluateAll((links) => links.map((l) => (l as HTMLLinkElement).href));
    expect(hrefs.length).toBeGreaterThanOrEqual(2);
    for (const href of hrefs) expect(href).toMatch(/\?ver=\d{9,}/);
  });

  test('aucun script du thème : le design est en CSS pur', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('script[src*="/themes/jchable-swiss/"]')).toHaveCount(0);
  });

  test('un focus clavier visible : contour épais sur les liens', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab'); // lien d'évitement
    await page.keyboard.press('Tab');
    const outline = await page.evaluate(() => {
      const s = getComputedStyle(document.activeElement!);
      return { style: s.outlineStyle, width: parseFloat(s.outlineWidth) };
    });
    expect(outline.style).not.toBe('none');
    expect(outline.width).toBeGreaterThanOrEqual(2);
  });
});
