import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { POSTS, PAGES, ARCHIVES } from '../e2e/fixtures';
import { expectNoHorizontalScroll } from '../e2e/helpers';

const PATHS = [
  '/',
  '/page/2/',
  POSTS.latest.path,
  POSTS.closed.path,
  POSTS.long.path,
  POSTS.code.path,
  PAGES.about,
  PAGES.classic,
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
    await page.evaluate(() => document.fonts.ready);
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => `${v.id} (${v.impact}) : ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
    expect(blocking).toEqual([]);
  });
}

test('pas de défilement horizontal avec des textes interminables injectés', async ({ page }) => {
  for (const path of [POSTS.latest.path, '/']) {
    await page.goto(path);
    await page.evaluate(() => {
      const long = 'x'.repeat(120);
      const targets = [
        '.wp-block-comment-content',
        '.wp-block-comment-author-name',
        '.wp-block-post-terms a',
        '.wp-block-post-title',
        '.wp-block-post-title a',
        '.wp-block-post-excerpt__excerpt',
        '.wp-block-navigation-item__label',
        '.wp-block-jchable-arcade-logo',
        '.arcade-post-nav a',
        '.wp-block-search__button',
        '.wp-block-site-tagline',
        '.wp-block-site-title',
        '.arcade-footer p',
        '.wp-block-query-pagination a',
        '.wp-block-read-more',
        '.wp-block-jchable-arcade-high-score dd',
        '.wp-block-jchable-arcade-high-score dt',
        '.arcade-panel p',
        'select option',
      ];
      for (const selector of targets) {
        document.querySelectorAll(selector).forEach((el) => {
          el.textContent = long;
        });
      }
    });
    await expectNoHorizontalScroll(page);
  }
});

test('la page ne déborde pas non plus en 320 px de large', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  for (const path of ['/', POSTS.long.path, ARCHIVES.notFound]) {
    await page.goto(path);
    await expectNoHorizontalScroll(page);
  }
});

test.describe('clavier et focus', () => {
  test('lien d’évitement en premier, puis chaque élément focalisé a un contour visible', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    const first = await page.evaluate(() => ({ cls: document.activeElement?.className, href: (document.activeElement as HTMLAnchorElement | null)?.getAttribute('href') }));
    expect(first.cls).toContain('skip-link');
    expect(first.href).toBe('#contenu');
    const seen: string[] = [];
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      const state = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        const s = getComputedStyle(el);
        return { text: (el.textContent ?? '').trim().slice(0, 30), style: s.outlineStyle, width: parseFloat(s.outlineWidth), color: s.outlineColor };
      });
      seen.push(state.text);
      expect(state.style, state.text).not.toBe('none');
      expect(state.width, state.text).toBeGreaterThanOrEqual(2);
      expect(state.color, state.text).not.toBe('rgba(0, 0, 0, 0)');
    }
    expect(seen).toContain('Accueil');
    expect(seen).toContain('Rechercher');
  });

  test('le lien d’évitement mène au contenu principal', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#contenu$/);
    await expect(page.locator('main#contenu')).toHaveCount(1);
  });

  test('le bouton Rechercher mène au champ de recherche', async ({ page }) => {
    await page.goto(POSTS.latest.path);
    await page.locator('.arcade-header').getByRole('link', { name: 'Rechercher' }).click();
    await expect(page).toHaveURL(/#recherche$/);
    await expect(page.locator('#recherche input[type="search"]')).toBeVisible();
  });
});

test.describe('mouvement réduit', () => {
  test('aucune transition ni animation quand prefers-reduced-motion est demandé', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const moving = await page.evaluate(() =>
      [...document.querySelectorAll('a, button, input, select, article')]
        .filter((el) => {
          const s = getComputedStyle(el);
          const duration = s.transitionDuration.split(',').some((d) => parseFloat(d) > 0);
          return duration || s.animationName !== 'none';
        })
        .map((el) => el.tagName + '.' + el.className),
    );
    expect(moving).toEqual([]);
  });
});

test.describe('sans JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('accueil lisible, valeurs réelles, navigation vers un article', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('a.skip-link')).toHaveAttribute('href', '#contenu');
    await expect(page.locator('.arcade-feed .wp-block-post')).toHaveCount(10);
    await expect(page.locator('.arcade-feed .wp-block-jchable-arcade-stage').first()).toHaveText('STAGE 13');
    await expect(page.locator('.wp-block-jchable-arcade-high-score dd').last()).toHaveText('13');
    await page.getByRole('link', { name: POSTS.latest.title }).first().click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(POSTS.latest.title);
    await expect(page.locator('.arcade-comments textarea#comment')).toBeVisible();
  });

  test('le menu et la pagination fonctionnent', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('navigation', { name: 'Menu principal' }).getByRole('link', { name: 'À propos' }).click();
    await expect(page).toHaveURL(/\/a-propos\/$/);
    await page.goto('/');
    await page.getByRole('link', { name: /Articles plus anciens/ }).click();
    await expect(page).toHaveURL(/\/page\/2\/$/);
  });
});

test.describe('impression', () => {
  test('à l’impression : texte noir sur fond blanc, sans menu ni formulaires, quel que soit le design', async ({ page }) => {
    await page.goto(POSTS.latest.path);
    await page.emulateMedia({ media: 'print' });
    const style = await page.evaluate(() => {
      const visible = (selector: string) => [...document.querySelectorAll<HTMLElement>(selector)].some((el) => getComputedStyle(el).display !== 'none');
      return {
        bodyColor: getComputedStyle(document.body).color,
        bodyBg: getComputedStyle(document.body).backgroundColor,
        bodyImage: getComputedStyle(document.body).backgroundImage,
        navVisible: visible('nav'),
        formVisible: visible('form[role="search"], .wp-block-search'),
      };
    });
    expect(style.bodyColor).toBe('rgb(0, 0, 0)');
    expect(['rgb(255, 255, 255)', 'rgba(0, 0, 0, 0)']).toContain(style.bodyBg);
    expect(style.bodyImage).toBe('none');
    expect(style.navVisible).toBe(false);
    expect(style.formVisible).toBe(false);
  });
});
