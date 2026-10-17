import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const isDesktop = (name: string): boolean => name === 'desktop';
const SCENES = ['tunnel', 'windows', 'graph', 'voxel'] as const;

async function openSettings(page: Page) {
  await page.locator('.start-button').click();
  await page.locator('.bmenu').getByRole('menuitem', { name: 'Préférences…' }).click();
  const win = page.locator('.bwin[data-app="settings"]');
  await expect(win).toBeVisible();
  await expect(win.locator('.bset')).toBeVisible();
  return win;
}

const storedPrefs = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('jchable-bureau:v1') ?? '{}'));

test.describe('fenêtre Préférences', () => {
  test.beforeEach(async ({}, info) => test.skip(!isDesktop(info.project.name)));

  test('le menu Démarrer ouvre les préférences, le bureau en voxels est coché par défaut', async ({ page }) => {
    await page.goto('/');
    const win = await openSettings(page);
    await expect(win.locator('input[name="bset-scene"]')).toHaveCount(4);
    await expect(win.locator('input[name="bset-scene"]:checked')).toHaveValue('voxel');
    await expect(win).toContainText('Tunnel néon');
    await expect(win).toContainText('Bureau en voxels');
    await expect(win.locator('.bset-auto')).toBeChecked();
    await expect(win.locator('.bset-delay')).toHaveValue('3');
    await expect(win.locator('input[name="bset-lang"]:checked')).toHaveValue('auto');
  });

  test('le choix d’un écran de veille est mémorisé, même après rechargement', async ({ page }) => {
    await page.goto('/');
    const win = await openSettings(page);
    await win.getByRole('radio', { name: /Graphe de connaissances/ }).check();
    expect((await storedPrefs(page)).saver).toBeUndefined(); // rien n'est enregistré avant « Enregistrer »
    await win.locator('.bset-save').click();
    await expect(win.locator('.bset-status')).toHaveText('Préférences enregistrées.');
    expect((await storedPrefs(page)).saver).toBe('graph');
    await page.reload();
    const again = await openSettings(page);
    await expect(again.locator('input[name="bset-scene"]:checked')).toHaveValue('graph');
  });

  for (const scene of SCENES) {
    test(`l’aperçu « ${scene} » s’affiche sans erreur et se ferme au moindre geste`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto('/');
      const win = await openSettings(page);
      await win.locator(`input[value="${scene}"]`).check();
      await win.locator('.bset-preview').click();
      const overlay = page.locator('.bscr-overlay');
      await expect(overlay).toBeVisible();
      await page.waitForTimeout(1200);
      // Le canevas n’est pas resté vide : une image pleine fait un PNG bien plus lourd qu’un aplat.
      expect((await overlay.screenshot()).length).toBeGreaterThan(6000);
      await page.waitForTimeout(400);
      await page.mouse.move(400, 300);
      await page.mouse.move(460, 340);
      await expect(overlay).toHaveCount(0);
      expect(errors).toEqual([]);
    });
  }

  test('le délai choisi décide du moment où l’écran de veille démarre', async ({ page }) => {
    await page.clock.install();
    await page.goto('/');
    const win = await openSettings(page);
    await win.locator('.bset-delay').selectOption('1');
    await win.locator('.bset-save').click();
    await win.locator('.bset-close').click();
    await page.clock.fastForward(30 * 1000);
    await expect(page.locator('.bscr-overlay')).toHaveCount(0);
    await page.clock.fastForward(31 * 1000);
    await expect(page.locator('.bscr-overlay')).toBeVisible();
    expect((await storedPrefs(page)).saverDelay).toBe(1);
  });

  test('l’écran de veille choisi est celui qui démarre tout seul', async ({ page }) => {
    await page.clock.install();
    await page.goto('/');
    const win = await openSettings(page);
    await win.getByRole('radio', { name: /Fenêtres flottantes/ }).check();
    await win.locator('.bset-save').click();
    await win.locator('.bset-close').click();
    await page.clock.fastForward(3 * 60 * 1000 + 1000);
    await expect(page.locator('.bscr-overlay')).toBeVisible();
  });

  test('désactiver l’écran de veille automatique l’empêche de démarrer, l’aperçu marche toujours', async ({ page }) => {
    await page.clock.install();
    await page.goto('/');
    const win = await openSettings(page);
    await win.locator('.bset-auto').uncheck();
    await expect(win.locator('.bset-delay')).toBeDisabled();
    await win.locator('.bset-save').click();
    await page.clock.fastForward(10 * 60 * 1000);
    await expect(page.locator('.bscr-overlay')).toHaveCount(0);
    await win.locator('.bset-preview').click();
    await expect(page.locator('.bscr-overlay')).toBeVisible();
  });

  test('changer la langue recharge le bureau dans cette langue', async ({ page }) => {
    await page.goto('/');
    const win = await openSettings(page);
    await win.getByRole('radio', { name: 'English' }).check();
    // Rien ne se recharge tant qu'on n'a pas validé : la fenêtre reste ouverte, l'interface reste en français.
    await page.waitForTimeout(500);
    await expect(win).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-bureau-lang', 'fr');
    expect((await storedPrefs(page)).lang).toBeUndefined();
    await win.locator('.bset-save').click(); // la page se recharge
    await expect(page.locator('html')).toHaveAttribute('data-bureau-lang', 'en');
    await expect(page.locator('.start-button')).toContainText('Start');
    await page.locator('.start-button').click();
    await page.locator('.bmenu').getByRole('menuitem', { name: 'Settings…' }).click();
    await expect(page.locator('.bwin[data-app="settings"]')).toContainText('Neon tunnel');
    expect((await storedPrefs(page)).lang).toBe('en');
  });

  test('fermer sans enregistrer abandonne les changements', async ({ page }) => {
    await page.goto('/');
    const win = await openSettings(page);
    await expect(win.locator('.bset-save')).toBeDisabled();
    await win.getByRole('radio', { name: /Tunnel néon/ }).check();
    await expect(win.locator('.bset-save')).toBeEnabled();
    await win.locator('.bset-close').click();
    await expect(win).toHaveCount(0);
    const again = await openSettings(page);
    await expect(again.locator('input[name="bset-scene"]:checked')).toHaveValue('voxel');
    expect((await storedPrefs(page)).saver).toBeUndefined();
  });

  test('« Réorganiser les icônes » remet les icônes en place', async ({ page }) => {
    await page.goto('/');
    const icon = page.locator('#bureau-desktop .bicon').first();
    const before = await icon.boundingBox();
    await page.mouse.move(before!.x + 20, before!.y + 20);
    await page.mouse.down();
    await page.mouse.move(before!.x + 20, before!.y + 160, { steps: 6 });
    await page.mouse.up();
    const win = await openSettings(page);
    await win.locator('.bset-reset').click();
    await expect.poll(async () => Math.round((await icon.boundingBox())!.y)).toBe(Math.round(before!.y));
  });

  test('le son se règle depuis les préférences, Échap ferme la fenêtre', async ({ page }) => {
    await page.goto('/');
    const win = await openSettings(page);
    await expect(win.locator('.bset-sound')).toBeChecked(); // le son est activé par défaut
    await win.locator('.bset-sound').uncheck();
    await win.locator('.bset-save').click();
    expect((await storedPrefs(page)).sound).toBe(false);
    await win.locator('.bset-sound').press('Escape');
    await expect(win).toHaveCount(0);
  });

  test('la fenêtre Préférences est accessible (axe)', async ({ page }) => {
    await page.goto('/');
    await openSettings(page);
    const results = await new AxeBuilder({ page }).include('.bwin[data-app="settings"]').analyze();
    const blocking = results.violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => `${v.id} : ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
    expect(blocking).toEqual([]);
  });
});
