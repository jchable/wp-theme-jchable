import { test, expect, type Page } from '@playwright/test';

async function launchDoom(page: Page): Promise<void> {
  await page.goto('/');
  await page.locator('#bureau-desktop .bicon', { hasText: 'DOOM.EXE' }).dblclick();
}

test.beforeEach(async ({}, info) => test.skip(info.project.name !== 'desktop'));

for (const file of ['websockets-doom.js', 'websockets-doom.wasm', 'doom1.wad']) {
  test(`DOOM refuse un fichier altéré : ${file}`, async ({ page }) => {
    await page.route(`**/assets/doom/${file}`, async (route) => {
      const response = await route.fetch();
      const body = await response.body();
      body[Math.floor(body.length / 2)] ^= 1;
      await route.fulfill({ response, body });
    });
    await launchDoom(page);
    await expect(page.locator('.bapp-doom-error')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.bapp-doom-frame')).toHaveCount(0);
  });
}

test('DOOM refuse les redirections des fichiers du moteur', async ({ page }) => {
  let followed = false;
  await page.route('**/assets/doom/websockets-doom.js', (route) =>
    route.fulfill({ status: 302, headers: { location: '/security-redirect-probe' } }));
  await page.route('**/security-redirect-probe', (route) => {
    followed = true;
    return route.fulfill({ body: '' });
  });
  await launchDoom(page);
  await expect(page.locator('.bapp-doom-error')).toBeVisible();
  expect(followed).toBe(false);
});

test('DOOM ne peut accéder au blog, au stockage ni au réseau et ignore les faux messages', async ({ page }) => {
  await launchDoom(page);
  const iframe = page.locator('.bapp-doom-frame');
  await expect(iframe).toHaveAttribute('sandbox', 'allow-scripts');
  await expect(page.locator('.bapp-doom-strip').getByRole('button', { name: 'Plein écran', exact: true })).toBeEnabled({ timeout: 30_000 });
  const frame = await (await iframe.elementHandle())!.contentFrame();
  expect(frame).not.toBeNull();
  const origin = new URL(page.url()).origin;
  const blocked = await frame!.evaluate(async (origin) => {
    const denied = (action: () => unknown): boolean => {
      try { action(); return false; } catch (error) { return error instanceof DOMException && error.name === 'SecurityError'; }
    };
    const network = await fetch(`${origin}/security-network-probe`).then(() => false, () => true);
    return {
      parent: denied(() => parent.document.body),
      storage: denied(() => localStorage.getItem('jchable-bureau:v1')),
      cookies: denied(() => document.cookie),
      network,
    };
  }, origin);
  expect(blocked).toEqual({ parent: true, storage: true, cookies: true, network: true });
  await page.evaluate(() => {
    window.postMessage({ type: 'exit', value: 0 }, '*');
    window.postMessage({ type: 'error', value: 'spoofed' }, '*');
  });
  await expect(iframe).toBeVisible();
  await expect(page.locator('.bapp-doom-error')).toHaveCount(0);
  await page.locator('.bapp-doom-hint').click();
  await page.keyboard.press('Alt+q');
  await expect(page.locator('.bapp-doom-strip').getByRole('button', { name: 'Plein écran', exact: true })).toBeFocused();
  await page.locator('.bwin[data-app="doom"] .bwin-controls').getByRole('button', { name: 'Fermer' }).click();
  await expect(iframe).toHaveCount(0);
});

test('le collage WordPad et son brouillon restent inertes dans le navigateur', async ({ page }) => {
  await page.goto('/');
  await page.locator('#bureau-desktop .bicon', { hasText: 'WORDPAD.EXE' }).dblclick();
  const editor = page.locator('.bapp-wordpad-editor');
  await editor.evaluate((el) => {
    const transfer = new DataTransfer();
    transfer.setData('text/html', '<p onclick="window.securityProbe=1">texte sûr</p><img src=x onerror="window.securityProbe=1"><a href="java&#10;script:alert(1)">lien</a>');
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: transfer, bubbles: true, cancelable: true }));
  });
  await expect(editor).toContainText('texte sûr');
  await expect(editor.locator('img, script, [onclick], [onerror], a[href^="javascript:"]')).toHaveCount(0);
  expect(await page.evaluate(() => Object.hasOwn(window, 'securityProbe'))).toBe(false);
  await page.locator('.bwin[data-app="wordpad"] .bwin-controls').getByRole('button', { name: 'Fermer' }).click();
  await page.reload();
  await page.locator('#bureau-desktop .bicon', { hasText: 'WORDPAD.EXE' }).dblclick();
  await expect(editor).toContainText('texte sûr');
  await expect(editor.locator('img, script, [onclick], [onerror]')).toHaveCount(0);
});
