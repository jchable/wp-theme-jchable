import { test, expect, type Page } from '@playwright/test';
import { POSTS, PAGES, TOTAL_POSTS } from '../e2e/fixtures';

// Rendu d'un bloc dynamique par l'API REST de l'éditeur (connexion administrateur du WordPress local).
async function renderBlock(page: Page, block: string, attributes: Record<string, unknown>, postId?: number): Promise<string> {
  // Les trois projets se connectent en même temps avec le même compte : WordPress peut perdre une session
  // (écriture simultanée des jetons). On se reconnecte donc après un refus, au plus 5 fois.
  let last = '';
  for (let attempt = 0; attempt < 5; attempt++) {
    await page.goto('/wp-login.php');
    await page.fill('#user_login', 'admin');
    await page.fill('#user_pass', 'password');
    await Promise.all([page.waitForURL(/wp-admin/), page.click('#wp-submit')]);
    const nonce = (await (await page.request.get('/wp-admin/admin-ajax.php?action=rest-nonce')).text()).trim();
    const response = await page.request.post(`/wp-json/wp/v2/block-renderer/${block}?context=edit`, {
      headers: { 'X-WP-Nonce': nonce },
      data: { attributes, ...(postId ? { post_id: postId } : {}) },
    });
    if (response.status() === 200) return (await response.json()).rendered as string;
    last = `${response.status()} ${await response.text()}`;
    await page.waitForTimeout(300 + Math.random() * 700);
  }
  throw new Error(`Rendu du bloc refusé : ${last}`);
}

async function postId(page: Page, slug: string): Promise<number> {
  const posts = await (await page.request.get(`/wp-json/wp/v2/posts?slug=${slug}`)).json();
  return posts[0].id as number;
}

test.describe('bloc jchable-arcade/stage', () => {
  test('numérote les articles publiés du plus ancien (01) au plus récent', async ({ page }) => {
    await page.goto('/');
    const stages = page.locator('.arcade-feed .wp-block-jchable-arcade-stage');
    await expect(stages).toHaveText(['STAGE 13', 'STAGE 12', 'STAGE 11', 'STAGE 10', 'STAGE 09', 'STAGE 08', 'STAGE 07', 'STAGE 06', 'STAGE 05', 'STAGE 04']);
  });

  test('chaque article porte son numéro d’ordre', async ({ page }) => {
    const expected: Array<[string, string]> = [
      [POSTS.latest.path, 'STAGE 13'],
      [POSTS.release.path, 'STAGE 12'],
      [POSTS.closed.path, 'STAGE 11'],
      [POSTS.long.path, 'STAGE 10'],
      [POSTS.code.path, 'STAGE 09'],
      [POSTS.filler.path, 'STAGE 01'],
    ];
    for (const [path, stage] of expected) {
      await page.goto(path);
      await expect(page.locator('main .wp-block-jchable-arcade-stage'), path).toHaveText(stage);
    }
  });

  test('une page n’a pas de numéro de stage', async ({ page }) => {
    await page.goto(PAGES.about);
    await expect(page.locator('.wp-block-jchable-arcade-stage')).toHaveCount(0);
  });

  test('le dernier billet est le STAGE 13, le premier le STAGE 01 (rendu REST)', async ({ page }) => {
    const first = await renderBlock(page, 'jchable-arcade/stage', {}, await postId(page, 'billet-de-test-1'));
    expect(first).toContain('STAGE 01');
    const last = await renderBlock(page, 'jchable-arcade/stage', {}, await postId(page, 'a-folder-of-markdown-you-can-actually-browse'));
    expect(last).toContain('STAGE 13');
  });

  test('le libellé est échappé', async ({ page }) => {
    const html = await renderBlock(page, 'jchable-arcade/stage', { label: '<img src=x onerror=alert(1)>' }, await postId(page, 'okf4net-0-6-0'));
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
    expect(html).toContain('12');
  });
});

test.describe('bloc jchable-arcade/high-score', () => {
  test('affiche le premier billet, le dernier billet et le nombre de billets publiés', async ({ page }) => {
    await page.goto('/');
    const score = page.locator('.site-sidebar .wp-block-jchable-arcade-high-score');
    await expect(score.locator('dt')).toHaveText(['Premier billet', 'Dernier billet', 'Billets publiés']);
    await expect(score.locator('dd')).toHaveText([/^(juin|June) 2009$/, /^(octobre|October) 2026$/, String(TOTAL_POSTS)]);
    await expect(score.locator('dd time').first()).toHaveAttribute('datetime', '2009-06-15');
    await expect(score.locator('dd time').nth(1)).toHaveAttribute('datetime', '2026-10-16');
  });

  test('les valeurs sont présentes sur toutes les pages à barre latérale', async ({ page }) => {
    for (const path of [POSTS.latest.path, PAGES.about, '/category/divers/', '/?s=okf4net']) {
      await page.goto(path);
      await expect(page.locator('.wp-block-jchable-arcade-high-score dd').last(), path).toHaveText(String(TOTAL_POSTS));
    }
  });

  test('mise en forme : libellés atténués à gauche, valeurs à droite', async ({ page }) => {
    await page.goto('/');
    const dt = page.locator('.wp-block-jchable-arcade-high-score dt').first();
    const dd = page.locator('.wp-block-jchable-arcade-high-score dd').first();
    expect(await dt.evaluate((el) => getComputedStyle(el).color)).toBe('rgb(185, 190, 219)');
    expect(await dd.evaluate((el) => getComputedStyle(el).fontFamily)).toContain('Geist Mono');
    const a = (await dt.boundingBox())!;
    const b = (await dd.boundingBox())!;
    expect(b.x).toBeGreaterThan(a.x);
  });

  test('les libellés personnalisés sont échappés', async ({ page }) => {
    const html = await renderBlock(page, 'jchable-arcade/high-score', {
      firstLabel: '<script>alert(1)</script>',
      lastLabel: '"><b>gras</b>',
      countLabel: '<img src=x onerror=alert(2)>',
    });
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<b>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain(String(TOTAL_POSTS));
  });
});

test.describe('bloc jchable-arcade/logo', () => {
  test('dérive le logo du titre du site, le point est décoratif', async ({ page }) => {
    await page.goto('/');
    const logo = page.locator('.wp-block-jchable-arcade-logo');
    await expect(logo).toHaveText('julien.chable');
    await expect(logo.locator('.arcade-logo__dot')).toHaveAttribute('aria-hidden', 'true');
    await expect(logo).toHaveAccessibleName('Julien Chable');
  });
});
