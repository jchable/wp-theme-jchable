import { test, expect } from '@playwright/test';
import { PAGES } from '../e2e/fixtures';

test.describe('icônes du bureau', () => {
  test('5 icônes : 3 du menu du site et 2 outils', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.desktop-icons a.wp-block-navigation-item__content')).toHaveCount(5);
    await expect(page.locator('.desktop-icons')).toContainText('Accueil');
    await expect(page.locator('.desktop-icons')).toContainText('À propos');
    await expect(page.locator('.desktop-icons')).toContainText('Recherche');
    await expect(page.locator('.desktop-icons')).toContainText('RSS');
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
