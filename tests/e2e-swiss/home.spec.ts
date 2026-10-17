import { test, expect, type Locator } from '@playwright/test';
import { POSTS, TOTAL_POSTS } from '../e2e/fixtures';
import { feedNumbers } from './helpers';

const INK = 'rgb(10, 10, 10)';
const PAPER = 'rgb(250, 250, 247)';
const ACCENT = 'rgb(43, 43, 255)';
const LIME = 'rgb(212, 255, 0)';

/** Texte généré par CSS (pseudo-élément) d'un élément. */
async function pseudo(el: Locator, which = '::before'): Promise<string> {
  return el.evaluate(
    (node, w) => {
      const c = getComputedStyle(node, w).content;
      const m = c.match(/^"([^"]*)"/);
      return m ? m[1] : c;
    },
    which,
  );
}

test.describe('en-tête', () => {
  test('le domaine en mono et le menu principal lu dans le menu du site', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.swiss-bar .wp-block-jchable-swiss-site-host a')).toHaveText('localhost');
    const nav = page.getByRole('navigation', { name: 'Menu principal' });
    await expect(nav.getByRole('link')).toHaveText(['Accueil', 'À propos', 'Plan du site']);
  });

  test('l’entrée courante du menu est un bloc noir', async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Menu principal' });
    const current = nav.getByRole('link', { name: 'Accueil' });
    await expect(current).toHaveAttribute('aria-current', 'page');
    const style = await current.evaluate((a) => ({ bg: getComputedStyle(a).backgroundColor, fg: getComputedStyle(a).color }));
    expect(style).toEqual({ bg: INK, fg: PAPER });
    const other = nav.getByRole('link', { name: 'À propos' });
    expect(await other.evaluate((a) => getComputedStyle(a).backgroundColor)).not.toBe(INK);
  });

  test('sur une page, c’est cette page qui est courante', async ({ page }) => {
    await page.goto('/a-propos/');
    const nav = page.getByRole('navigation', { name: 'Menu principal' });
    await expect(nav.locator('[aria-current="page"]')).toHaveText('À propos');
  });

  test('un filet noir de 2 px sous la barre', async ({ page }) => {
    await page.goto('/');
    const border = await page.locator('.swiss-bar').evaluate((el) => {
      const s = getComputedStyle(el);
      return { width: s.borderBottomWidth, color: s.borderBottomColor };
    });
    expect(border).toEqual({ width: '2px', color: INK });
  });
});

test.describe('titre géant et badge', () => {
  test('h1 « Julien Chable » suivi d’un point d’accent, sur deux lignes', async ({ page }, info) => {
    await page.goto('/');
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toHaveText('Julien Chable');
    expect(await pseudo(h1, '::after')).toBe('.');
    expect(await h1.evaluate((el) => getComputedStyle(el, '::after').color)).toBe(ACCENT);
    const size = await h1.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    if (info.project.name === 'desktop') expect(size).toBeGreaterThan(150);
    expect(size).toBeGreaterThanOrEqual(72);
    const box = (await h1.boundingBox())!;
    expect(box.height).toBeGreaterThan(size * 1.4); // deux mots, deux lignes
  });

  test('badge rond SVG « SHAREPOINT · OFFICE 365 · .NET · WHAT ELSE ? » et texte de présentation', async ({ page }) => {
    await page.goto('/');
    const badge = page.locator('.swiss-hero svg[role="img"]');
    await expect(badge).toHaveAttribute('aria-label', /SharePoint · Office 365 · \.NET · what else \?/i);
    await expect(badge).toBeVisible();
    await expect(badge.locator('circle').first()).toHaveAttribute('fill', '#D4FF00');
    await expect(page.locator('.swiss-hero')).toContainText('Blog technique depuis juin 2009');
  });

  test('le badge tourne lentement, sauf si l’utilisateur réduit les animations', async ({ page }) => {
    await page.goto('/');
    expect(await page.locator('.swiss-badge').evaluate((el) => getComputedStyle(el).animationName)).toBe('swiss-spin');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await page.locator('.swiss-badge').evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  });
});

test.describe('liste d’articles', () => {
  test('page 1 : 10 articles numérotés 01 à 10 par compteur CSS', async ({ page }) => {
    await page.goto('/');
    const cards = page.locator('.swiss-feed .swiss-card');
    await expect(cards).toHaveCount(10);
    expect(await feedNumbers(page)).toEqual(['01', '02', '03', '04', '05', '06', '07', '08', '09', '10']);
  });

  test('page 2 : la numérotation continue (11, 12, 13)', async ({ page }) => {
    await page.goto('/page/2/');
    const cards = page.locator('.swiss-feed .swiss-card');
    await expect(cards).toHaveCount(TOTAL_POSTS - 10);
    expect(await feedNumbers(page)).toEqual(['11', '12', '13']);
  });

  test('le numéro est décoratif pour les lecteurs d’écran', async ({ page }) => {
    await page.goto('/');
    const raw = await page.locator('.swiss-card').first().evaluate((el) => getComputedStyle(el, '::before').content);
    expect(raw).toMatch(/\/\s*""$/); // texte de remplacement vide
  });

  test('le premier article : étiquette « Nouveau », numéro en accent, pleine largeur', async ({ page }) => {
    await page.goto('/');
    const first = page.locator('.swiss-feed .wp-block-post').first();
    const card = first.locator('.swiss-card');
    await expect(first.getByRole('heading', { level: 2, name: POSTS.latest.title })).toBeVisible();
    expect(await pseudo(card.locator('.swiss-meta'))).toBe('Nouveau');
    const label = await card.locator('.swiss-meta').evaluate((el) => {
      const s = getComputedStyle(el, '::before');
      return { bg: s.backgroundColor, fg: s.color };
    });
    expect(label).toEqual({ bg: LIME, fg: INK });
    expect(await card.evaluate((el) => getComputedStyle(el, '::before').color)).toBe(ACCENT);
    const feed = (await page.locator('.swiss-feed .wp-block-post-template').boundingBox())!;
    const box = (await first.boundingBox())!;
    expect(Math.round(box.width)).toBe(Math.round(feed.width));
  });

  test('les autres articles : pas d’étiquette « Nouveau », numéro noir', async ({ page }) => {
    await page.goto('/');
    const second = page.locator('.swiss-feed .swiss-card').nth(1);
    expect(await pseudo(second.locator('.swiss-meta'))).not.toBe('Nouveau');
    expect(await second.evaluate((el) => getComputedStyle(el, '::before').color)).toBe(INK);
  });

  test('le premier article a un aplat d’accent à quadrillage, à droite (ordinateur) ou dessous', async ({ page }, info) => {
    await page.goto('/');
    const visual = page.locator('.swiss-feed .swiss-card').first().locator('.swiss-visual');
    await expect(visual).toBeVisible();
    expect(await visual.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(ACCENT);
    expect(await visual.evaluate((el) => getComputedStyle(el).backgroundImage)).toContain('linear-gradient');
    const title = (await page.locator('.swiss-card').first().getByRole('heading', { level: 2 }).boundingBox())!;
    const v = (await visual.boundingBox())!;
    if (info.project.name === 'desktop') expect(v.x).toBeGreaterThan(title.x + title.width - 1);
    else expect(v.y).toBeGreaterThan(title.y);
  });

  test('l’image à la une remplit l’aplat', async ({ page }) => {
    await page.goto('/');
    const img = page.locator('.swiss-feed .swiss-card').first().locator('.swiss-visual img');
    await expect(img).toBeVisible();
    expect(await img.evaluate((el) => getComputedStyle(el).objectFit)).toBe('cover');
  });

  test('les autres articles n’affichent pas d’image', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.swiss-feed .swiss-card').nth(1).locator('.swiss-visual')).toBeHidden();
  });

  test('grille à filets noirs de 2 px', async ({ page }) => {
    await page.goto('/');
    const feed = await page.locator('.swiss-feed').evaluate((el) => {
      const s = getComputedStyle(el);
      return { top: s.borderTopWidth, color: s.borderTopColor };
    });
    expect(feed).toEqual({ top: '2px', color: INK });
    const li = await page.locator('.swiss-feed .wp-block-post').nth(1).evaluate((el) => {
      const s = getComputedStyle(el);
      return { bottom: s.borderBottomWidth, color: s.borderBottomColor };
    });
    expect(li).toEqual({ bottom: '2px', color: INK });
  });

  test('deux colonnes séparées par un filet dès la tablette', async ({ page }, info) => {
    await page.goto('/');
    const items = page.locator('.swiss-feed .wp-block-post');
    const a = (await items.nth(1).boundingBox())!;
    const b = (await items.nth(2).boundingBox())!;
    if (info.project.name === 'mobile') {
      expect(Math.abs(a.x - b.x)).toBeLessThan(2);
      expect(b.y).toBeGreaterThan(a.y);
    } else {
      expect(b.x).toBeGreaterThan(a.x + a.width - 2);
      expect(Math.abs(a.y - b.y)).toBeLessThan(2);
      const rule = await items.nth(1).evaluate((el) => getComputedStyle(el).borderRightWidth);
      expect(rule).toBe('2px');
    }
  });

  test('page 2 : pas d’article à la une, pas d’étiquette', async ({ page }) => {
    await page.goto('/page/2/');
    const first = page.locator('.swiss-feed .swiss-card').first();
    expect(await pseudo(first.locator('.swiss-meta'))).not.toBe('Nouveau');
    await expect(first.locator('.swiss-visual')).toBeHidden();
    expect(await first.evaluate((el) => getComputedStyle(el, '::before').color)).toBe(INK);
  });

  test('la date au format jj.mm.aaaa et la catégorie', async ({ page }) => {
    await page.goto('/');
    const meta = page.locator('.swiss-card').nth(1).locator('.swiss-meta');
    await expect(meta.locator('.wp-block-post-date')).toHaveText('02.10.2026');
    await expect(meta.locator('.wp-block-post-terms')).toHaveText('Divers');
  });

  test('un clic sur le titre mène à l’article', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: POSTS.release.title }).click();
    await expect(page).toHaveURL(new RegExp(`${POSTS.release.path}$`));
  });
});

test.describe('pagination, recherche et archives', () => {
  test('« Articles plus anciens → » en bloc noir, flèche jaune-vert', async ({ page }) => {
    await page.goto('/');
    const next = page.getByRole('link', { name: /Articles plus anciens/ });
    const style = await next.evaluate((a) => ({ bg: getComputedStyle(a).backgroundColor, fg: getComputedStyle(a).color }));
    expect(style).toEqual({ bg: INK, fg: PAPER });
    const arrow = await next.locator('.wp-block-query-pagination-next-arrow').evaluate((el) => getComputedStyle(el).color);
    expect(arrow).toBe(LIME);
    await next.click();
    await expect(page).toHaveURL(/\/page\/2\/$/);
  });

  test('page 2 : lien « Articles plus récents » pour revenir', async ({ page }) => {
    await page.goto('/page/2/');
    await page.getByRole('link', { name: /Articles plus récents/ }).click();
    await expect(page).toHaveURL(/localhost:8888\/(page\/1\/)?$/);
  });

  test('carte Recherche : étiquette, champ et bouton d’accent', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('.swiss-card-box', { has: page.getByRole('search') });
    expect(await card.evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe('2px');
    await expect(card.getByRole('searchbox', { name: 'Recherche' })).toBeVisible();
    const button = card.getByRole('button', { name: 'Rechercher' });
    expect(await button.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(ACCENT);
  });

  test('la recherche mène aux résultats', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('search').getByRole('searchbox').fill('okf4net');
    await page.getByRole('search').getByRole('button', { name: 'Rechercher' }).click();
    await expect(page).toHaveURL(/\?s=okf4net/);
  });

  test('carte Archives : liste déroulante des mois', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('.swiss-card-box', { has: page.locator('select') });
    expect(await card.evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe('2px');
    const select = card.locator('select');
    await expect(select).toBeVisible();
    await expect(select.locator('option', { hasText: /octobre 2026|October 2026/ })).toHaveCount(1);
  });

  test('la liste déroulante a une étiquette accessible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('select').first()).toHaveAccessibleName(/Archives/);
  });
});

test.describe('pied de page', () => {
  test('plein accent, « what else ? » géant, mentions', async ({ page }, info) => {
    await page.goto('/');
    const footer = page.locator('.swiss-footer').first();
    expect(await footer.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(ACCENT);
    expect(await footer.evaluate((el) => getComputedStyle(el).color)).toBe(PAPER);
    const big = footer.getByText('what else ?', { exact: true });
    await expect(big).toBeVisible();
    const size = await big.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    if (info.project.name === 'desktop') expect(size).toBeGreaterThan(70);
    expect(size).toBeGreaterThanOrEqual(40);
    await expect(footer.locator('.wp-block-site-title')).toHaveText('Julien Chable');
    expect(await pseudo(footer.locator('.wp-block-site-title'))).toBe('© ');
    await expect(footer).toContainText('WordPress');
    const box = (await footer.boundingBox())!;
    expect(box.x).toBeLessThanOrEqual(1); // le pied de page touche les bords de l'écran
    expect(box.width).toBeGreaterThanOrEqual(page.viewportSize()!.width - 1);
  });
});
