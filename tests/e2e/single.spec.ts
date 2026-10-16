import { test, expect } from '@playwright/test';
import { POSTS, PAGES } from './fixtures';

test.describe('article', () => {
  test('affiche le titre, la catégorie, l’image légendée et le contenu', async ({ page }) => {
    await page.goto(POSTS.latest.path);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(POSTS.latest.title);
    await expect(page.locator('.post-meta')).toContainText('Divers');
    await expect(page.locator('.wp-block-post-content figcaption')).toContainText('The explorer of the synthetic bundle');
  });

  test('affiche les 3 commentaires et le formulaire', async ({ page }) => {
    await page.goto(POSTS.latest.path);
    await expect(page.locator('.post-comments .wp-block-comment-template > li')).toHaveCount(3);
    await expect(page.locator('.post-comments textarea#comment')).toBeVisible();
  });

  test('commentaires fermés : pas de formulaire, le reste s’affiche', async ({ page }) => {
    await page.goto(POSTS.closed.path);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(POSTS.closed.title);
    await expect(page.locator('textarea#comment')).toHaveCount(0);
    await expect(page.locator('.wp-block-post-content')).toContainText('git blame line by line');
  });

  test('propose les liens Précédent et Suivant', async ({ page }) => {
    await page.goto(POSTS.release.path);
    await expect(page.locator('.post-nav a')).toHaveCount(2);
  });
});

test.describe('page', () => {
  test('affiche le titre et le contenu, sans commentaires', async ({ page }) => {
    await page.goto(PAGES.about);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('À propos');
    await expect(page.locator('.wp-block-post-content')).toContainText('Open Knowledge Format');
    await expect(page.locator('textarea#comment')).toHaveCount(0);
  });
});
