import { test, expect } from '@playwright/test';
import { POSTS, PAGES } from '../e2e/fixtures';

test.describe('article Bureau', () => {
  test('une fenêtre titrée slug.md — date, avec h1, catégorie et image légendée', async ({ page }) => {
    await page.goto(POSTS.latest.path);
    await expect(page.locator('article.window > .window-titlebar')).toHaveText(
      'a-folder-of-markdown-you-can-actually-browse.md — 16.10.2026',
    );
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(POSTS.latest.title);
    await expect(page.locator('.post-meta')).toContainText('Divers');
    await expect(page.locator('.wp-block-post-content figcaption')).toContainText('The explorer of the synthetic bundle');
  });

  test('fenêtre commentaires.log : 3 commentaires et le formulaire', async ({ page }) => {
    await page.goto(POSTS.latest.path);
    await expect(page.locator('.post-comments .window-titlebar')).toHaveText('commentaires.log');
    await expect(page.locator('.post-comments .wp-block-comment-template > li')).toHaveCount(3);
    await expect(page.locator('.post-comments textarea#comment')).toBeVisible();
  });

  test('commentaires fermés : ni formulaire ni fenêtre vide', async ({ page }) => {
    await page.goto(POSTS.closed.path);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(POSTS.closed.title);
    await expect(page.locator('textarea#comment')).toHaveCount(0);
    await expect(page.locator('.post-comments')).toHaveCount(0);
  });

  test('boutons Précédent et Suivant', async ({ page }) => {
    await page.goto(POSTS.release.path);
    await expect(page.locator('.post-nav a')).toHaveCount(2);
    const radius = await page.locator('.post-nav a').first().evaluate((a) => getComputedStyle(a).borderTopWidth);
    expect(radius).toBe('2px');
  });

  test('page : slug.md sans date, sans commentaires', async ({ page }) => {
    await page.goto(PAGES.about);
    await expect(page.locator('article.window > .window-titlebar')).toHaveText('a-propos.md');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('À propos');
    await expect(page.locator('textarea#comment')).toHaveCount(0);
  });
});

test.describe('retouches de présentation', () => {
  test('la barre des tâches n’affiche plus « Propulsé par WordPress »', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.taskbar')).not.toContainText('WordPress');
    await expect(page.locator('.taskbar')).not.toContainText('Propulsé');
    await expect(page.locator('.taskbar a[href*="wordpress.org"]')).toHaveCount(0);
  });

  test('la fenêtre d’un article ou d’une page garde peu de marge autour du texte', async ({ page }) => {
    for (const path of [POSTS.latest.path, '/a-propos/']) {
      await page.goto(path);
      const padding = await page.locator('.single-window > .window-body').evaluate((el) => {
        const style = getComputedStyle(el);
        return [style.paddingLeft, style.paddingRight, style.paddingTop].map(parseFloat);
      });
      for (const value of padding) {
        expect(value, path).toBeGreaterThan(0); // « un peu » : pas zéro
        expect(value, path).toBeLessThanOrEqual(16);
      }
    }
  });
});
