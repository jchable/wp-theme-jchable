import { test, expect } from '@playwright/test';
import { ARCHIVES, POSTS, TOTAL_POSTS } from '../e2e/fixtures';

const ACCENT = 'rgb(255, 204, 51)';
const CYAN = 'rgb(92, 225, 230)';
const PINK = 'rgb(194, 37, 92)';
const CARD = 'rgb(23, 27, 48)';

test.describe('accueil Arcade : en-tête', () => {
  test('logo julien.chable, menu du site et bouton Rechercher', async ({ page }) => {
    await page.goto('/');
    const logo = page.locator('.arcade-header .wp-block-jchable-arcade-logo');
    await expect(logo).toHaveText('julien.chable');
    await expect(logo).toHaveAttribute('href', /\/$/);
    const nav = page.getByRole('navigation', { name: 'Menu principal' });
    await expect(nav.getByRole('link')).toHaveText(['Accueil', 'À propos', 'Plan du site']);
    const search = page.locator('.arcade-header').getByRole('link', { name: 'Rechercher' });
    await expect(search).toHaveAttribute('href', '#recherche');
    expect(await search.evaluate((a) => getComputedStyle(a).backgroundColor)).toBe(ACCENT);
  });

  test('l’entrée courante du menu est une pastille aux coins pixel', async ({ page }) => {
    await page.goto('/a-propos/');
    const current = page.locator('.arcade-menu .current-menu-item > a');
    await expect(current).toHaveText('À propos');
    const style = await current.evaluate((a) => ({ bg: getComputedStyle(a).backgroundColor, clip: getComputedStyle(a).clipPath }));
    expect(style.bg).toBe('rgb(28, 33, 64)');
    expect(style.clip).toContain('polygon');
  });

  test('sur la recherche, aucune entrée du menu n’est « courante » (surtout pas Accueil)', async ({ page }) => {
    await page.goto(ARCHIVES.search);
    const nav = page.getByRole('navigation', { name: 'Menu principal' });
    await expect(nav.getByRole('link')).toHaveCount(3);
    await expect(nav.locator('[aria-current]')).toHaveCount(0);
    await expect(page.locator('.arcade-menu .current-menu-item')).toHaveCount(0);
  });

  test('sur une adresse sans chemin (?p=), Accueil n’est courant que sur l’accueil', async ({ page }) => {
    await page.goto('/?p=1');
    const nav = page.getByRole('navigation', { name: 'Menu principal' });
    await expect(nav.locator('[aria-current]')).toHaveCount(0);
  });

  test('le point du logo suit la couleur d’accent', async ({ page }) => {
    await page.goto('/');
    const dot = page.locator('.wp-block-jchable-arcade-logo .arcade-logo__dot');
    expect(await dot.evaluate((el) => getComputedStyle(el).color)).toBe(ACCENT);
  });
});

test.describe('accueil Arcade : héros', () => {
  test('accroche, titre pixel jaune à ombre rose et frise de pixels', async ({ page }) => {
    await page.goto('/');
    const hero = page.locator('.arcade-hero');
    await expect(hero.locator('.arcade-hero__eyebrow')).toHaveText('— INSERT COIN · DEPUIS 2009 —');
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toHaveText('Julien Chable');
    const style = await h1.evaluate((el) => ({ color: getComputedStyle(el).color, shadow: getComputedStyle(el).textShadow, family: getComputedStyle(el).fontFamily }));
    expect(style.color).toBe(ACCENT);
    expect(style.shadow).toContain(PINK);
    expect(style.shadow).toMatch(/(4|6)px (4|6)px/); // 6 px, 4 px sur petit écran
    expect(style.family).toContain('Pixelify Sans');
    await expect(hero).toContainText('SharePoint, Office 365 and .NET … what else ?');
    const svg = hero.locator('svg[aria-hidden="true"]');
    await expect(svg).toHaveCount(1);
    expect(await svg.locator('rect').count()).toBeGreaterThan(10);
  });

  test('le titre du héros est le seul h1', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  });
});

test.describe('accueil Arcade : articles', () => {
  test('page 1 : 10 cartes, la première est l’article mis en avant', async ({ page }) => {
    await page.goto('/');
    const posts = page.locator('.arcade-feed .wp-block-post');
    await expect(posts).toHaveCount(10);
    const featured = posts.first().locator('article');
    await expect(featured.locator('.wp-block-jchable-arcade-stage')).toHaveText('STAGE 13');
    await expect(featured.getByRole('heading', { level: 2, name: POSTS.latest.title })).toBeVisible();
    await expect(featured.locator('.wp-block-post-date')).toContainText('2026');
    await expect(featured.locator('.wp-block-post-terms')).toContainText('Divers');
    await expect(featured.locator('.wp-block-post-featured-image img')).toBeVisible();
    const press = featured.getByRole('link', { name: /Press start/ });
    await expect(press).toBeVisible();
    await expect(press).toHaveAttribute('href', new RegExp(`${POSTS.latest.path}$`));
    const style = await featured.evaluate((el) => ({ bg: getComputedStyle(el).backgroundColor, clip: getComputedStyle(el).clipPath }));
    expect(style.bg).toBe(CARD);
    expect(style.clip).toContain('polygon');
  });

  test('les cartes suivantes ont un liseré supérieur cyan puis rose, sans visuel ni bouton', async ({ page }) => {
    await page.goto('/');
    const cards = page.locator('.arcade-feed .wp-block-post article');
    const border = (i: number) => cards.nth(i).evaluate((el) => ({ w: getComputedStyle(el).borderTopWidth, c: getComputedStyle(el).borderTopColor }));
    expect(await border(1)).toEqual({ w: '4px', c: CYAN });
    expect(await border(2)).toEqual({ w: '4px', c: PINK });
    expect(await border(3)).toEqual({ w: '4px', c: CYAN });
    await expect(cards.nth(1).locator('.wp-block-jchable-arcade-stage')).toHaveText('STAGE 12');
    await expect(cards.nth(2).locator('.wp-block-jchable-arcade-stage')).toHaveText('STAGE 11');
    await expect(cards.nth(1).getByRole('heading', { level: 2, name: POSTS.release.title })).toBeVisible();
    await expect(cards.nth(1).locator('.wp-block-post-excerpt')).toBeVisible();
    await expect(cards.nth(1).getByRole('link', { name: /Press start/ })).toBeHidden();
  });

  test('sur ordinateur, la grille a deux colonnes et la carte mise en avant les deux', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop');
    await page.goto('/');
    const boxes = await page.locator('.arcade-feed .wp-block-post').evaluateAll((els) => els.slice(0, 4).map((e) => e.getBoundingClientRect().toJSON()));
    expect(boxes[0].width).toBeGreaterThan(boxes[1].width * 1.7);
    expect(boxes[1].y).toBeCloseTo(boxes[2].y, 0);
    expect(boxes[2].x).toBeGreaterThan(boxes[1].x + 100);
    expect(boxes[3].y).toBeGreaterThan(boxes[1].y + 50);
  });

  test('sur mobile, les cartes sont empilées', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile');
    await page.goto('/');
    const boxes = await page.locator('.arcade-feed .wp-block-post').evaluateAll((els) => els.slice(0, 3).map((e) => e.getBoundingClientRect().toJSON()));
    expect(boxes[1].x).toBeCloseTo(boxes[2].x, 0);
    expect(boxes[2].y).toBeGreaterThan(boxes[1].y + boxes[1].height - 1);
  });

  test('pagination : « Continue ? » mène aux articles plus anciens', async ({ page }) => {
    await page.goto('/');
    const next = page.getByRole('link', { name: /Articles plus anciens/ });
    await expect(next).toContainText('Continue ?');
    const style = await next.evaluate((a) => ({ border: getComputedStyle(a).borderTopWidth, family: getComputedStyle(a).fontFamily }));
    expect(style.border).toBe('3px');
    expect(style.family).toContain('Pixelify Sans');
    await next.click();
    await expect(page).toHaveURL(/\/page\/2\/$/);
    await expect(page.getByRole('link', { name: /Articles plus récents/ })).toBeVisible();
  });

  test('page 2 : pas d’article mis en avant, les STAGE descendent jusqu’à 01', async ({ page }) => {
    await page.goto('/page/2/');
    const posts = page.locator('.arcade-feed .wp-block-post');
    await expect(posts).toHaveCount(TOTAL_POSTS - 10);
    await expect(posts.locator('.wp-block-jchable-arcade-stage')).toHaveText(['STAGE 03', 'STAGE 02', 'STAGE 01']);
    const clip = await posts.first().locator('article').evaluate((el) => getComputedStyle(el).clipPath);
    expect(clip).toBe('none');
    await expect(page.getByRole('link', { name: /Articles plus anciens/ })).toHaveCount(0);
  });
});

test.describe('accueil Arcade : barre latérale et pied de page', () => {
  test('High score, À propos, Archives et Rechercher', async ({ page }) => {
    await page.goto('/');
    const aside = page.getByRole('complementary');
    await expect(aside.getByRole('heading', { level: 2 })).toHaveText(['High score', 'À propos', 'Archives', 'Rechercher']);
    const title = aside.getByRole('heading', { name: 'High score' });
    expect(await title.evaluate((el) => getComputedStyle(el).color)).toBe(ACCENT);
    expect(await title.evaluate((el) => getComputedStyle(el).fontFamily)).toContain('Pixelify Sans');
    await expect(aside.locator('select')).toHaveCount(1);
    await expect(aside.locator('select option')).not.toHaveCount(0);
    await expect(aside.locator('#recherche input[type="search"]')).toBeVisible();
  });

  test('la liste déroulante des archives propose les mois publiés', async ({ page }) => {
    await page.goto('/');
    const options = await page.locator('.site-sidebar select option').allTextContents();
    expect(options.some((o) => /(octobre|october) 2026/i.test(o))).toBe(true);
    expect(options.some((o) => /(juin|june) 2009/i.test(o))).toBe(true);
    await expect(page.locator('.site-sidebar select')).toHaveAccessibleName(/Archives/);
  });

  test('sur ordinateur la barre latérale est à droite, sur mobile en dessous', async ({ page }, info) => {
    await page.goto('/');
    const main = (await page.locator('main').boundingBox())!;
    const aside = (await page.locator('.site-sidebar').boundingBox())!;
    if (info.project.name === 'desktop') {
      expect(aside.x).toBeGreaterThan(main.x + main.width - 1);
      expect(aside.width).toBeLessThan(400);
    } else if (info.project.name === 'mobile') {
      expect(aside.y).toBeGreaterThan(main.y + main.height - 1);
    }
  });

  test('pied de page à filet pointillé', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('.arcade-footer');
    const style = await footer.evaluate((el) => ({ w: getComputedStyle(el).borderTopWidth, s: getComputedStyle(el).borderTopStyle, c: getComputedStyle(el).borderTopColor }));
    expect(style).toEqual({ w: '4px', s: 'dashed', c: 'rgb(42, 48, 96)' });
    await expect(footer).toContainText('Julien Chable');
    await expect(footer).toContainText('Game over ? Jamais.');
    await expect(footer).toContainText('Propulsé par WordPress');
  });
});
