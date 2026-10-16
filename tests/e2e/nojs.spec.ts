import { test, expect } from '@playwright/test';
import { POSTS } from './fixtures';

test.use({ javaScriptEnabled: false });

test('sans JavaScript : lien d’évitement unique vers le contenu', async ({ page }) => {
  await page.goto('/');
  const skip = page.locator("a.skip-link");
  await expect(skip).toHaveCount(1);
  await expect(skip).toHaveAttribute('href', '#contenu');
  await expect(page.locator('main#contenu')).toHaveCount(1);
});

test('sans JavaScript : accueil lisible et navigable', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.post-feed .wp-block-post')).toHaveCount(10);
  await page.getByRole('link', { name: POSTS.latest.title }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(POSTS.latest.title);
  await expect(page.locator('.post-comments textarea#comment')).toBeVisible();
});
