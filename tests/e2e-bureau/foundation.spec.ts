import { test, expect } from '@playwright/test';

test.describe('socle du thème Bureau', () => {
  test('le fond du bureau est sarcelle', async ({ page }) => {
    await page.goto('/');
    const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(background).toBe('rgb(46, 111, 108)');
  });

  test('Chivo est servie par le thème, sans appel externe', async ({ page }) => {
    const fontRequests: string[] = [];
    const externalRequests: string[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (/^https?:/.test(request.url()) && url.hostname !== 'localhost') externalRequests.push(request.url());
      if (/\/themes\/jchable-bureau\/assets\/fonts\/.+\.woff2$/.test(url.pathname)) {
        fontRequests.push(url.pathname);
      }
    });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toContain('Chivo');
    expect(fontRequests.length, 'au moins une police du thème doit être chargée').toBeGreaterThan(0);
    expect(externalRequests).toEqual([]);
  });

});
