import { afterEach, describe, expect, it } from 'vitest';
import { setLang } from '../../../core/i18n';
import { readColors, readSceneContext, readTitles } from './context';
import { DEFAULT_COLORS } from './types';

afterEach(() => {
  document.body.innerHTML = '';
  document.documentElement.removeAttribute('style');
  setLang('fr');
});

describe('contexte des scènes', () => {
  it('lit les titres d’articles de la page, sans doublon ni espaces en trop', () => {
    document.body.innerHTML = `
      <h2 class="wp-block-post-title"> Premier   article </h2>
      <h2 class="wp-block-post-title">Premier article</h2>
      <h2 class="wp-block-post-title">Second</h2>
      <h2 class="wp-block-post-title">  </h2>`;
    expect(readTitles(document)).toEqual(['Premier article', 'Second']);
  });

  it('borne le nombre et la longueur des titres', () => {
    document.body.innerHTML = Array.from({ length: 30 }, (_, i) => `<h2 class="wp-block-post-title">${i}-${'x'.repeat(200)}</h2>`).join('');
    const titles = readTitles(document);
    expect(titles).toHaveLength(12);
    expect(titles.every((t) => t.length <= 80)).toBe(true);
  });

  it('retombe sur les couleurs du thème quand les variables CSS manquent', () => {
    expect(readColors(document)).toEqual(DEFAULT_COLORS);
  });

  it('prend les variables CSS de WordPress quand elles existent', () => {
    document.documentElement.style.setProperty('--wp--preset--color--yellow', '#ff0000');
    expect(readColors(document).yellow).toBe('#ff0000');
    expect(readColors(document).sky).toBe(DEFAULT_COLORS.sky);
  });

  it('donne la langue courante et un nom de site', () => {
    setLang('en');
    const context = readSceneContext(document);
    expect(context.lang).toBe('en');
    expect(context.siteName).toBeTruthy();
    document.body.innerHTML = '<p class="wp-block-site-title">Mon blog</p>';
    expect(readSceneContext(document).siteName).toBe('Mon blog');
  });
});
