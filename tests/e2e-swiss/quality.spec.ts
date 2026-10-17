import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { POSTS, PAGES, ARCHIVES } from '../e2e/fixtures';
import { expectNoHorizontalScroll } from '../e2e/helpers';
import { feedNumbers } from './helpers';

const PATHS = [
  '/',
  '/page/2/',
  POSTS.latest.path,
  POSTS.closed.path,
  POSTS.long.path,
  POSTS.code.path,
  PAGES.about,
  PAGES.sitemap,
  ARCHIVES.category,
  ARCHIVES.month,
  ARCHIVES.search,
  ARCHIVES.searchEmpty,
  ARCHIVES.notFound,
];

for (const path of PATHS) {
  test(`pas de défilement horizontal : ${path}`, async ({ page }) => {
    await page.goto(path);
    await expectNoHorizontalScroll(page);
  });

  test(`axe : aucune violation sérieuse ou critique sur ${path}`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => `${v.id} (${v.impact}) : ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
    expect(blocking).toEqual([]);
  });
}

test('pas de défilement horizontal avec des textes interminables injectés (article)', async ({ page }) => {
  await page.goto(POSTS.latest.path);
  await page.evaluate(() => {
    const long = 'x'.repeat(100);
    const targets = [
      '.wp-block-comment-content',
      '.wp-block-comment-author-name',
      '.wp-block-post-terms a',
      '.wp-block-navigation-item__label',
      '.wp-block-jchable-swiss-site-host a',
      '.wp-block-jchable-post-filename',
      '.post-nav a',
      '.swiss-footer .wp-block-site-title',
      '.swiss-footer p',
    ];
    for (const selector of targets) {
      document.querySelectorAll(selector).forEach((el) => {
        el.textContent = long;
      });
    }
  });
  await expectNoHorizontalScroll(page);
});

test('pas de défilement horizontal avec des textes interminables injectés (accueil)', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const long = 'x'.repeat(100);
    const targets = [
      '.wp-block-site-title',
      '.swiss-hero p',
      '.wp-block-post-title a',
      '.wp-block-post-excerpt__excerpt',
      '.wp-block-post-terms a',
      '.wp-block-archives select option',
      '.wp-block-search__label',
      '.wp-block-query-pagination-next',
    ];
    for (const selector of targets) {
      document.querySelectorAll(selector).forEach((el) => {
        if (el.children.length === 0) el.textContent = long;
      });
    }
  });
  await expectNoHorizontalScroll(page);
});

test('aucune requête vers un domaine externe (Google Fonts compris) sur les pages principales', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (request) => {
    if (/^https?:/.test(request.url()) && new URL(request.url()).hostname !== 'localhost') external.push(request.url());
  });
  for (const path of ['/', POSTS.latest.path, PAGES.about, ARCHIVES.category, ARCHIVES.search, ARCHIVES.notFound, PAGES.sitemap]) {
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);
  }
  expect(external).toEqual([]);
});

test('le document déclare sa langue et un titre', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', /^fr/);
  expect(await page.title()).toContain('Julien Chable');
});

test.describe('navigation au clavier', () => {
  test('Tab atteint le menu, un titre d’article, avec un contour visible, et Entrée suit le lien', async ({ page }) => {
    await page.goto('/');
    const visited: string[] = [];
    let reachedTitle = false;
    for (let i = 0; i < 40 && !reachedTitle; i++) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        const s = getComputedStyle(el);
        return {
          text: (el.textContent ?? '').trim().slice(0, 60),
          outline: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2,
          inTitle: !!el.closest('.swiss-card .wp-block-post-title'),
        };
      });
      expect(info.outline, `contour visible sur « ${info.text} »`).toBe(true);
      visited.push(info.text);
      reachedTitle = info.inTitle;
    }
    expect(visited).toContain('À propos');
    expect(reachedTitle, 'le titre du premier article est atteint au clavier').toBe(true);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`${POSTS.latest.path}$`));
  });

  test('le lien d’évitement mène au contenu', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('a.skip-link')).toHaveAttribute('href', '#contenu');
    await expect(page.locator('main#contenu')).toHaveCount(1);
  });
});

test.describe('sans JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('accueil lisible : 10 articles numérotés, navigation vers un article', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('a.skip-link')).toHaveAttribute('href', '#contenu');
    await expect(page.locator('.swiss-feed .wp-block-post')).toHaveCount(10);
    expect((await feedNumbers(page))[2]).toBe('03');
    await page.getByRole('link', { name: POSTS.latest.title }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(POSTS.latest.title);
    await expect(page.locator('.post-comments textarea#comment')).toBeVisible();
  });

  test('la recherche fonctionne par simple envoi du formulaire', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('searchbox').fill('okf4net');
    await page.getByRole('searchbox').press('Enter');
    await expect(page).toHaveURL(/\?s=okf4net/);
    await expect(page.locator('.swiss-feed .swiss-card')).toHaveCount(3);
  });
});

test.describe('impression', () => {
  test('à l’impression : texte noir sur fond blanc, sans menu ni formulaires, quel que soit le design', async ({ page }) => {
    await page.goto(POSTS.latest.path);
    await page.emulateMedia({ media: 'print' });
    const style = await page.evaluate(() => {
      const visible = (selector: string) => [...document.querySelectorAll<HTMLElement>(selector)].some((el) => getComputedStyle(el).display !== 'none');
      const footer = document.querySelector('footer')!;
      return {
        bodyColor: getComputedStyle(document.body).color,
        footerBg: getComputedStyle(footer).backgroundColor,
        footerColor: getComputedStyle(footer).color,
        navVisible: visible('nav'),
        formVisible: visible('form[role="search"], .wp-block-search'),
      };
    });
    expect(style.bodyColor).toBe('rgb(0, 0, 0)');
    expect(style.footerBg).toBe('rgba(0, 0, 0, 0)');
    expect(style.footerColor).toBe('rgb(0, 0, 0)');
    expect(style.navVisible).toBe(false);
    expect(style.formVisible).toBe(false);
  });
});
