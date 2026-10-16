import { describe, expect, it } from 'vitest';
import { hasReadableContent, slugOf } from './pages';

const ORIGIN = 'https://x.test';

describe('slugOf', () => {
  it('extrait le slug d’une page du site', () => {
    expect(slugOf('https://x.test/a-propos/', ORIGIN)).toBe('a-propos');
    expect(slugOf('https://x.test/a-propos', ORIGIN)).toBe('a-propos');
    expect(slugOf('https://x.test/a-propos/?x=1#haut', ORIGIN)).toBe('a-propos');
  });

  it('ignore l’accueil, les archives, les liens d’une autre origine et les ancres', () => {
    expect(slugOf('https://x.test/', ORIGIN)).toBeNull();
    expect(slugOf('https://x.test/2026/10/', ORIGIN)).toBeNull();
    expect(slugOf('https://x.test/category/divers/', ORIGIN)).toBeNull();
    expect(slugOf('https://autre.test/a-propos/', ORIGIN)).toBeNull();
    expect(slugOf('#recherche', ORIGIN)).toBeNull();
    expect(slugOf('mailto:a@x.test', ORIGIN)).toBeNull();
    expect(slugOf('javascript:alert(1)', ORIGIN)).toBeNull();
    expect(slugOf('', ORIGIN)).toBeNull();
  });

  it('décode le slug et refuse les valeurs étranges', () => {
    expect(slugOf('https://x.test/%C3%A0-propos/', ORIGIN)).toBe('à-propos');
    expect(slugOf('https://x.test/%E0%A4%A/', ORIGIN)).toBeNull();
  });
});

describe('hasReadableContent', () => {
  it('faux pour un contenu vide ou sans texte', () => {
    expect(hasReadableContent('')).toBe(false);
    expect(hasReadableContent('<p></p>')).toBe(false);
    expect(hasReadableContent('  \n <!-- wp:paragraph --> ')).toBe(false);
    expect(hasReadableContent(undefined)).toBe(false);
  });

  it('vrai dès qu’il y a du texte ou une image', () => {
    expect(hasReadableContent('<p>Bonjour</p>')).toBe(true);
    expect(hasReadableContent('<figure><img src="/a.png" alt=""></figure>')).toBe(true);
  });
});
