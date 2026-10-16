import { test, expect } from '@playwright/test';
import { ARCHIVES } from '../e2e/fixtures';

test.describe('écran bleu (404)', () => {
  test('code 404, fond bleu, chemin affiché et retour à l’accueil', async ({ page }) => {
    const response = await page.goto(ARCHIVES.notFound);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page introuvable');
    await expect(page.locator('.wp-block-jchable-request-path')).toHaveText(ARCHIVES.notFound);
    const background = await page.evaluate(() => getComputedStyle(document.querySelector('.bsod')!).backgroundColor);
    expect(background).toBe('rgb(0, 0, 170)');
    const link = page.getByRole('link', { name: /Appuyez sur une touche/ });
    await link.click();
    await expect(page).toHaveURL('/');
  });

  test('pas d’icônes ni de fenêtres sur l’écran bleu', async ({ page }) => {
    await page.goto(ARCHIVES.notFound);
    await expect(page.locator('.desktop-icons')).toHaveCount(0);
  });

  test('échappe le chemin demandé', async ({ page }) => {
    await page.goto('/%3Cscript%3Ealert(1)%3C/script%3E/');
    await expect(page.locator('.bsod script')).toHaveCount(0);
  });
});
