import { test, expect, type Page } from '@playwright/test';

type PaqWindow = Window & { _paq?: unknown[][] };

/** Fait comme le snippet Matomo du site : une file `_paq` existe avant le bureau. */
async function withMatomoQueue(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as PaqWindow)._paq = [];
  });
}

const events = (page: Page): Promise<unknown[][]> =>
  page.evaluate(() => ((window as PaqWindow)._paq ?? []).filter((entry) => entry[0] === 'trackEvent'));

async function openFromStartMenu(page: Page, name: string): Promise<void> {
  await page.locator('.start-button').click();
  await page.locator('.bmenu').getByRole('menuitem', { name }).click();
}

test.describe('mesure d’audience (événements Matomo)', () => {
  test('ouvrir puis fermer une appli envoie « Ouverture » puis « Durée active »', async ({ page }) => {
    await withMatomoQueue(page);
    await page.goto('/');
    await openFromStartMenu(page, 'Calculatrice');
    const win = page.locator('.bwin[data-app="calculator"]');
    await expect(win).toBeVisible();
    expect(await events(page)).toEqual([['trackEvent', 'Bureau', 'Ouverture', 'calculator']]);

    await page.waitForTimeout(1300);
    await win.locator('[data-action="close"]').click();
    await expect(win).toHaveCount(0);

    const sent = await events(page);
    expect(sent).toHaveLength(2);
    const [, category, action, name, seconds] = sent[1] as [string, string, string, string, number];
    expect([category, action, name]).toEqual(['Bureau', 'Durée active', 'calculator']);
    expect(seconds).toBeGreaterThanOrEqual(1);
    expect(seconds).toBeLessThan(10);
  });

  test('rouvrir une fenêtre déjà ouverte ne recompte pas l’ouverture', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop'); // en plein écran, la fenêtre recouvre le bouton Démarrer
    await withMatomoQueue(page);
    await page.goto('/');
    await openFromStartMenu(page, 'Calculatrice');
    await expect(page.locator('.bwin[data-app="calculator"]')).toBeVisible();
    await openFromStartMenu(page, 'Calculatrice');
    const openings = (await events(page)).filter((entry) => entry[2] === 'Ouverture');
    expect(openings).toHaveLength(1);
  });

  test('la durée des fenêtres encore ouvertes part quand le visiteur quitte la page', async ({ page }) => {
    await withMatomoQueue(page);
    await page.goto('/');
    await openFromStartMenu(page, 'Calculatrice');
    await expect(page.locator('.bwin[data-app="calculator"]')).toBeVisible();
    await page.waitForTimeout(1300);
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    const durations = (await events(page)).filter((entry) => entry[2] === 'Durée active');
    expect(durations).toHaveLength(1);
    expect(durations[0]?.[3]).toBe('calculator');
  });

  test('sans Matomo, le bureau fonctionne et ne crée rien', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/');
    await openFromStartMenu(page, 'Calculatrice');
    const win = page.locator('.bwin[data-app="calculator"]');
    await expect(win).toBeVisible();
    await win.locator('[data-action="close"]').click();
    await expect(win).toHaveCount(0);
    expect(await page.evaluate(() => '_paq' in window)).toBe(false);
    expect(errors).toEqual([]);
  });

  test('un réglage enregistré envoie « Préférence » avec sa nouvelle valeur', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop');
    await withMatomoQueue(page);
    await page.goto('/');
    await openFromStartMenu(page, 'Préférences…');
    const win = page.locator('.bwin[data-app="settings"]');
    await expect(win.locator('.bset')).toBeVisible();
    await win.getByRole('radio', { name: /Graphe de connaissances/ }).check();
    await win.locator('.bset-save').click();
    await expect(win.locator('.bset-status')).toHaveText('Préférences enregistrées.');
    const prefs = (await events(page)).filter((entry) => entry[2] === 'Préférence');
    expect(prefs).toEqual([['trackEvent', 'Bureau', 'Préférence', 'saverScene=graph']]);
  });

  test('l’aperçu d’un écran de veille n’est pas compté, mais le temps est mis en pause', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop');
    await withMatomoQueue(page);
    await page.goto('/');
    await openFromStartMenu(page, 'Préférences…');
    const win = page.locator('.bwin[data-app="settings"]');
    await expect(win.locator('.bset')).toBeVisible();
    await win.locator('.bset-preview').click();
    await expect(page.locator('.bscr-overlay')).toBeVisible();
    await page.waitForTimeout(500);
    await page.mouse.move(400, 300);
    await page.mouse.move(460, 340);
    await expect(page.locator('.bscr-overlay')).toHaveCount(0);
    expect((await events(page)).filter((entry) => entry[2] === 'Écran de veille')).toEqual([]);
  });

  test('l’écran de veille lancé depuis le menu Démarrer est compté avec sa scène', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop');
    await withMatomoQueue(page);
    await page.goto('/');
    await page.locator('.start-button').click();
    await page.locator('.bmenu').getByRole('menuitem', { name: 'Lancer l’écran de veille' }).click();
    await expect(page.locator('.bscr-overlay')).toBeVisible();
    expect((await events(page)).filter((entry) => entry[2] === 'Écran de veille')).toEqual([
      ['trackEvent', 'Bureau', 'Écran de veille', 'voxel'],
    ]);
  });
});
