import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { ARCHIVES, POSTS } from '../e2e/fixtures';

const isDesktop = (name: string): boolean => name === 'desktop';

async function openApp(page: Page, title: string): Promise<void> {
  await page.locator('#bureau-desktop .bicon', { hasText: title }).dblclick();
}

test.describe('interface en français (navigateur français)', () => {
  test.use({ locale: 'fr-FR' });

  test('la langue est le français et le bouton s’appelle Démarrer', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-bureau-lang', 'fr');
    await expect(page.locator('.start-button')).toContainText('Démarrer');
    await expect(page.locator('.feed-title')).toHaveText('Derniers articles');
  });
});

test.describe('interface en anglais (navigateur anglais)', () => {
  test.use({ locale: 'en-US' });

  test('le thème, la barre des tâches et la barre latérale passent en anglais', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-bureau-lang', 'en');
    await expect(page.locator('.start-button')).toContainText('Start');
    await expect(page.locator('.feed-title')).toHaveText('Latest posts');
    await expect(page.locator('.welcome .window-title')).toHaveText('welcome.txt');
    await expect(page.locator('.site-sidebar .window-titlebar')).toHaveText(['Search…', 'Archives', 'About']);
    await expect(page.locator('.retro-pagination')).toContainText('Older posts');
    await expect(page.locator('.taskbar')).not.toContainText('Powered by');
  });

  test('le contenu des articles n’est jamais traduit', async ({ page }) => {
    await page.goto(POSTS.latest.path);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(POSTS.latest.title);
    await expect(page.locator('.wp-block-post-content')).toContainText('Open Knowledge Format');
    await page.goto('/a-propos/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('À propos');
  });

  test('les icônes du bureau et le menu Démarrer sont en anglais', async ({ page }, info) => {
    test.skip(!isDesktop(info.project.name));
    await page.goto('/');
    for (const label of ['Home', 'About', 'Site map', 'Search', 'Terminal', 'Minesweeper.exe', 'Recycle Bin']) {
      await expect(page.locator('#bureau-desktop .bicon', { hasText: label }).first()).toBeVisible();
    }
    await page.locator('.start-button').click();
    const menu = page.locator('.bmenu');
    await expect(menu).toHaveAttribute('aria-label', 'Start menu');
    await expect(menu.getByRole('menuitem', { name: 'Shut down…' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Arrange icons' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'RSS feed' })).toHaveCount(1);
  });

  test('les applis sont en anglais : Terminal, Corbeille, Démineur, À propos', async ({ page }, info) => {
    test.skip(!isDesktop(info.project.name));
    await page.goto('/');
    await openApp(page, 'Terminal');
    const terminal = page.locator('.bwin[data-app="terminal"]');
    await expect(terminal.locator('.bwin-title')).toHaveText('Command Prompt');
    await terminal.locator('input').fill('help');
    await terminal.locator('input').press('Enter');
    await expect(terminal).toContainText('Available commands');
    await terminal.getByRole('button', { name: 'Close' }).click();

    await openApp(page, 'Recycle Bin');
    const trash = page.locator('.bwin[data-app="trash"]');
    await expect(trash.getByRole('button', { name: 'Empty Recycle Bin' })).toBeVisible();
    await trash.getByRole('button', { name: 'Close' }).click();

    await openApp(page, 'Minesweeper.exe');
    await expect(page.locator('.bwin[data-app="minesweeper"]').getByRole('combobox', { name: 'Level' })).toBeVisible();
  });

  test('la fenêtre « À propos » garde le contenu de la page et son lien en anglais', async ({ page }, info) => {
    test.skip(!isDesktop(info.project.name));
    await page.goto('/');
    await openApp(page, 'About');
    const win = page.locator('.bwin[data-app="page-a-propos"]');
    await expect(win).toContainText('Open Knowledge Format');
    await expect(win.getByRole('link', { name: /Open the page/ })).toBeVisible();
  });

  test('l’écran bleu de la page 404 est en anglais', async ({ page }) => {
    await page.goto(ARCHIVES.notFound);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page not found');
    await expect(page.getByRole('link', { name: /Press any key to continue/ })).toBeVisible();
  });

  test('sur mobile, le menu Démarrer est en anglais', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile');
    await page.goto('/');
    await page.locator('.start-button').click();
    await expect(page.locator('.bmenu').getByRole('menuitem', { name: 'Minesweeper.exe' })).toBeVisible();
  });

  test('axe : aucune violation sérieuse en anglais, menu Démarrer ouvert', async ({ page }) => {
    await page.goto('/');
    await page.locator('.start-button').click();
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => `${v.id} : ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
    expect(blocking).toEqual([]);
  });
});

test.describe('réglage de la langue dans le menu Démarrer', () => {
  test.use({ locale: 'fr-FR' });

  test('on passe en anglais, le choix est mémorisé, puis on revient en français', async ({ page }) => {
    await page.goto('/');
    await page.locator('.start-button').click();
    await page.locator('.bmenu').getByRole('menuitemradio', { name: 'English' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-bureau-lang', 'en');
    await expect(page.locator('.start-button')).toContainText('Start');
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('jchable-bureau:v1') ?? '{}'));
    expect(stored.lang).toBe('en');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-bureau-lang', 'en');

    await page.locator('.start-button').click();
    await page.locator('.bmenu').getByRole('menuitemradio', { name: 'Français' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-bureau-lang', 'fr');
    await expect(page.locator('.start-button')).toContainText('Démarrer');
  });

  test('« Automatique » rend la main au navigateur', async ({ page }) => {
    await page.goto('/');
    await page.locator('.start-button').click();
    await page.locator('.bmenu').getByRole('menuitemradio', { name: 'English' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-bureau-lang', 'en');
    await page.locator('.start-button').click();
    await page.locator('.bmenu').getByRole('menuitemradio', { name: 'Automatic' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-bureau-lang', 'fr');
  });
});
