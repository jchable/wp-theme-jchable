import { test, expect } from '@playwright/test';
import { POSTS, TOTAL_POSTS } from './fixtures';

test.describe('accueil', () => {
  test('affiche le titre du site, le slogan et 10 articles', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.site-header .wp-block-site-title')).toHaveText('Julien Chable');
    await expect(page.locator('.site-header .wp-block-site-tagline')).toContainText('what else ?');
    await expect(page.locator('.post-feed .wp-block-post')).toHaveCount(10);
    await expect(page.getByRole('heading', { level: 2, name: POSTS.latest.title })).toBeVisible();
  });

  test('a un titre de niveau 1 et une barre latérale', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Derniers articles');
    await expect(page.locator('.site-columns > aside')).toContainText('Archives');
  });

  test('la page 2 liste les articles restants sans « à la une »', async ({ page }) => {
    await page.goto('/page/2/');
    await expect(page.locator('body')).toHaveClass(/\bpaged\b/);
    await expect(page.locator('.post-feed .wp-block-post')).toHaveCount(TOTAL_POSTS - 10);
    const first = page.locator('.post-feed .wp-block-post').first();
    const firstBox = await first.boundingBox();
    const feedBox = await page.locator('.post-feed .wp-block-post-template').boundingBox();
    // Sur la page 2, le premier article n'occupe pas toute la largeur (sauf sur mobile, où tout est sur une colonne).
    if (feedBox && firstBox && feedBox.width > 700) {
      expect(firstBox.width).toBeLessThan(feedBox.width * 0.75);
    }
  });

  test('sur la page 1, le premier article occupe toute la largeur', async ({ page }) => {
    await page.goto('/');
    const first = await page.locator('.post-feed .wp-block-post').first().boundingBox();
    const feed = await page.locator('.post-feed .wp-block-post-template').boundingBox();
    expect(first && feed && Math.abs(first.width - feed.width) < 2).toBeTruthy();
  });

  test('la pagination mène aux articles plus anciens', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Articles plus anciens' }).click();
    await expect(page).toHaveURL(/\/page\/2\/$/);
  });
});
