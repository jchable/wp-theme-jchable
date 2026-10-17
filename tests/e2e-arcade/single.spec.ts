import { test, expect } from '@playwright/test';
import { POSTS, PAGES } from '../e2e/fixtures';

const CARD = 'rgb(23, 27, 48)';

/** Rapport de contraste WCAG entre deux couleurs « rgb(r, g, b) ». */
function contrast(a: string, b: string): number {
  const luminance = (css: string): number => {
    const [r, g, bl] = (css.match(/\d+/g) ?? ['0', '0', '0']).slice(0, 3).map((n) => {
      const v = Number(n) / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

test.describe('article Arcade', () => {
  test('carte pixel : stage, date, catégorie, titre h1 pixel, image légendée', async ({ page }) => {
    await page.goto(POSTS.latest.path);
    const article = page.locator('main article.arcade-single');
    const style = await article.evaluate((el) => ({ bg: getComputedStyle(el).backgroundColor, clip: getComputedStyle(el).clipPath }));
    expect(style.bg).toBe(CARD);
    expect(style.clip).toContain('polygon');
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toHaveText(POSTS.latest.title);
    expect(await h1.evaluate((el) => getComputedStyle(el).fontFamily)).toContain('Pixelify Sans');
    const meta = article.locator('.arcade-meta');
    await expect(meta.locator('.wp-block-jchable-arcade-stage')).toHaveText('STAGE 13');
    await expect(meta.locator('.wp-block-post-date')).toContainText(/16 (octobre|October) 2026/);
    await expect(meta.locator('.wp-block-post-terms')).toContainText('Divers');
    await expect(article.locator('.wp-block-post-content figcaption')).toContainText('The explorer of the synthetic bundle');
  });

  test('la langue du contenu (champ jchable_lang) est conservée', async ({ page }) => {
    await page.goto(POSTS.latest.path);
    await expect(page.locator('.wp-block-post-content')).toHaveAttribute('lang', 'en');
  });

  test('les liens du texte sont soulignés et lisibles', async ({ page }) => {
    await page.goto(POSTS.latest.path);
    const info = await page.locator('main').evaluate((main) => {
      const a = document.createElement('a');
      a.href = '#x';
      a.textContent = 'lien';
      main.querySelector('.wp-block-post-content p')!.appendChild(a);
      const s = getComputedStyle(a);
      return { decoration: s.textDecorationLine, color: s.color };
    });
    expect(info.decoration).toBe('underline');
    expect(info.color).toBe('rgb(92, 225, 230)');
  });

  test('commentaires : 3 commentaires et le formulaire', async ({ page }) => {
    await page.goto(POSTS.latest.path);
    const comments = page.locator('.arcade-comments');
    await expect(comments.locator('.wp-block-comment-template > li')).toHaveCount(3);
    await expect(comments.locator('textarea#comment')).toBeVisible();
    await expect(comments.getByRole('heading', { level: 2 })).toBeVisible();
    expect(await comments.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(CARD);
    const field = await comments.locator('textarea#comment').evaluate((el) => ({ bg: getComputedStyle(el).backgroundColor, border: getComputedStyle(el).borderTopColor }));
    expect(field.bg).toBe('rgb(15, 18, 34)');
    // WCAG 1.4.11 : la bordure d'un champ se distingue de son fond avec au moins 3:1 (et de la carte qui l'entoure).
    expect(contrast(field.border, field.bg)).toBeGreaterThanOrEqual(3);
    expect(contrast(field.border, CARD)).toBeGreaterThanOrEqual(3);
  });

  test('commentaires fermés : ni formulaire ni carte vide', async ({ page }) => {
    await page.goto(POSTS.closed.path);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(POSTS.closed.title);
    await expect(page.locator('textarea#comment')).toHaveCount(0);
    await expect(page.locator('.arcade-comments')).toHaveCount(0);
  });

  test('navigation vers l’article précédent et suivant', async ({ page }) => {
    await page.goto(POSTS.release.path);
    const links = page.locator('.arcade-post-nav a');
    await expect(links).toHaveCount(2);
    const style = await links.first().evaluate((a) => ({ border: getComputedStyle(a).borderTopWidth, family: getComputedStyle(a).fontFamily }));
    expect(style.border).toBe('3px');
    expect(style.family).toContain('Pixelify Sans');
    await links.last().click();
    await expect(page).toHaveURL(new RegExp(`${POSTS.latest.path}$`));
  });

  test('un bloc de code défile dans sa carte sans élargir la page', async ({ page }) => {
    await page.goto(POSTS.code.path);
    const pre = page.locator('.wp-block-code');
    await expect(pre).toBeVisible();
    expect(await pre.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(CARD);
    expect(await pre.evaluate((el) => getComputedStyle(el).fontFamily)).toContain('Geist Mono');
  });

  test('barre latérale présente à côté de l’article', async ({ page }) => {
    await page.goto(POSTS.latest.path);
    await expect(page.getByRole('complementary')).toBeVisible();
  });
});

test.describe('page Arcade', () => {
  test('carte pixel, h1, ni stage ni commentaires', async ({ page }) => {
    await page.goto(PAGES.about);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('À propos');
    const article = page.locator('main article.arcade-single');
    await expect(article).toBeVisible();
    expect(await article.evaluate((el) => getComputedStyle(el).clipPath)).toContain('polygon');
    await expect(page.locator('.wp-block-jchable-arcade-stage')).toHaveCount(0);
    await expect(page.locator('textarea#comment')).toHaveCount(0);
    await expect(article).toContainText('SharePoint, Office 365');
  });

  test('page au contenu classique (HTML brut) lisible', async ({ page }) => {
    await page.goto(PAGES.classic);
    await expect(page.locator('main article.arcade-single')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});
