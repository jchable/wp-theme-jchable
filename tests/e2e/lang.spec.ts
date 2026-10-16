import { test, expect } from '@playwright/test';
import { POSTS } from './fixtures';

test('la page est en français', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr-FR');
});

test('le contenu d’un article anglais porte lang="en"', async ({ page }) => {
  await page.goto(POSTS.latest.path);
  await expect(page.locator('.wp-block-post-content')).toHaveAttribute('lang', 'en');
});

test('sans champ jchable_lang, pas d’attribut lang sur le contenu', async ({ page }) => {
  await page.goto(POSTS.filler.path);
  await expect(page.locator('.wp-block-post-content')).not.toHaveAttribute('lang', /.+/);
});
