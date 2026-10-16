import { afterEach, describe, expect, it } from 'vitest';
import { setLang } from '../core/i18n';
import { chromeLabel, translateChrome } from './chrome';

afterEach(() => {
  document.body.innerHTML = '';
  setLang('fr');
});

describe('translateChrome', () => {
  it('traduit les textes du thème en anglais, en gardant les espaces', () => {
    document.body.innerHTML =
      '<div class="taskbar"><a class="start-button">✦ Démarrer</a><p>Propulsé par <a href="#">WordPress</a></p></div>' +
      '<h2 class="feed-title">Derniers articles</h2><header class="window-titlebar"><p>Rechercher…</p></header>';
    setLang('en');
    translateChrome(document);
    expect(document.querySelector('.start-button')?.textContent).toBe('✦ Start');
    expect(document.querySelector('.taskbar p')?.textContent).toBe('Powered by WordPress');
    expect(document.querySelector('.feed-title')?.textContent).toBe('Latest posts');
    expect(document.querySelector('.window-titlebar p')?.textContent).toBe('Search…');
  });

  it('ne touche jamais au contenu des articles', () => {
    document.body.innerHTML = '<article class="window"><div class="window-body"><p>Accueil</p><h1>À propos</h1></div></article>';
    setLang('en');
    translateChrome(document);
    expect(document.querySelector('p')?.textContent).toBe('Accueil');
    expect(document.querySelector('h1')?.textContent).toBe('À propos');
  });

  it('traduit aussi les attributs utiles', () => {
    document.body.innerHTML = '<div class="sidebar-windows"><input aria-label="Recherche" placeholder="Rechercher…"></div>';
    setLang('en');
    translateChrome(document);
    const input = document.querySelector('input');
    expect(input?.getAttribute('aria-label')).toBe('Search');
    expect(input?.getAttribute('placeholder')).toBe('Search…');
  });

  it('ne fait rien en français', () => {
    document.body.innerHTML = '<h2 class="feed-title">Derniers articles</h2>';
    translateChrome(document);
    expect(document.querySelector('.feed-title')?.textContent).toBe('Derniers articles');
  });

  it('est idempotent', () => {
    document.body.innerHTML = '<h2 class="feed-title">Derniers articles</h2>';
    setLang('en');
    translateChrome(document);
    translateChrome(document);
    expect(document.querySelector('.feed-title')?.textContent).toBe('Latest posts');
  });
});

describe('chromeLabel', () => {
  it('traduit les libellés connus du menu, laisse les autres', () => {
    setLang('en');
    expect(chromeLabel('À propos')).toBe('About');
    expect(chromeLabel('Plan du site')).toBe('Site map');
    expect(chromeLabel('Mon lien perso')).toBe('Mon lien perso');
    setLang('fr');
    expect(chromeLabel('À propos')).toBe('À propos');
  });
});
