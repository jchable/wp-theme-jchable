import { test, expect } from '@playwright/test';
import { PAGES } from '../e2e/fixtures';

test.describe('icônes du bureau (menu d’origine, sans JavaScript)', () => {
  test.use({ javaScriptEnabled: false });

  test('4 icônes : 3 du menu du site et la recherche ; plan du site et RSS dans la barre des tâches', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.desktop-icons a.wp-block-navigation-item__content')).toHaveCount(4);
    await expect(page.locator('.desktop-icons')).toContainText('Accueil');
    await expect(page.locator('.desktop-icons')).toContainText('À propos');
    await expect(page.locator('.desktop-icons')).toContainText('Recherche');
    await expect(page.locator('.desktop-icons')).not.toContainText('RSS');
    // Les raccourcis (plan du site, RSS) sont dans la barre des tâches, à côté de l'heure.
    const links = page.locator('.taskbar .taskbar-links a');
    await expect(links).toHaveCount(2);
    await expect(links.nth(0)).toHaveAttribute('href', /\/plan-du-site\/$/);
    await expect(links.nth(1)).toHaveAttribute('href', /\/feed\/$/);
    await expect(links.nth(1)).toHaveAccessibleName('Flux RSS');
    const clock = (await page.locator('.taskbar .taskbar-clock').boundingBox())!;
    const last = (await links.nth(1).boundingBox())!;
    expect(last.x + last.width).toBeLessThanOrEqual(clock.x + 1);
  });

  test('chaque icône affiche un pictogramme', async ({ page }) => {
    await page.goto('/');
    const images = await page.locator('.desktop-icons a.wp-block-navigation-item__content').evaluateAll((links) =>
      links.map((a) => getComputedStyle(a, '::before').backgroundImage),
    );
    for (const image of images) expect(image).toContain('url(');
  });

  test('ordinateur : les icônes sont à gauche du contenu', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop');
    await page.goto('/');
    const icons = await page.locator('.desktop-icons').boundingBox();
    const main = await page.locator('main').boundingBox();
    expect(icons && main && icons.x + icons.width <= main.x + 1).toBeTruthy();
  });

  test('mobile : les icônes forment une rangée qui défile', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile');
    await page.goto('/');
    const tops = await page
      .locator('.desktop-icons a.wp-block-navigation-item__content')
      .evaluateAll((links) => links.map((a) => Math.round(a.getBoundingClientRect().top)));
    expect(new Set(tops).size, 'toutes les icônes sur la même ligne').toBe(1);
    const overflow = await page.locator('.desktop-icons').evaluate((el) => getComputedStyle(el).overflowX);
    expect(overflow).toBe('auto');
  });
});

test.describe('barre des tâches', () => {
  test('bouton Démarrer vers le plan du site, onglet de la page et horloge', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.taskbar a.start-button')).toHaveAttribute('href', new RegExp(`${PAGES.sitemap}$`));
    await expect(page.locator('.taskbar .taskbar-tab')).toContainText('Accueil');
    await expect(page.locator('.taskbar time.taskbar-clock')).toHaveText(/^\d{2}:\d{2}$/);
  });

  test.describe('sans JavaScript', () => {
    test.use({ javaScriptEnabled: false });
    test('l’horloge affiche l’année', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('.taskbar time.taskbar-clock')).toHaveText(String(new Date().getFullYear()));
    });
  });

  test('l’onglet reprend le titre de l’article', async ({ page }) => {
    await page.goto('/okf4net-0-6-0/');
    await expect(page.locator('.taskbar .taskbar-tab')).toContainText('OKF4net 0.6.0');
  });
});
