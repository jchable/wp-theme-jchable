import { afterEach, describe, expect, it } from 'vitest';
import { focusAnchor } from './anchor';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('focusAnchor', () => {
  it('ne lève jamais sur une ancre invalide', () => {
    for (const hash of ['#', '', '#1abc', '#a b', '#a[b', '#%E0%A4%A', 'pas-une-ancre']) {
      expect(() => focusAnchor(hash)).not.toThrow();
    }
  });

  it('donne le focus au premier champ de l’élément visé', () => {
    document.body.innerHTML = '<section id="recherche"><input type="search"></section>';
    focusAnchor('#recherche');
    expect(document.activeElement).toBe(document.querySelector('input'));
  });

  it('accepte un identifiant qui commence par un chiffre', () => {
    document.body.innerHTML = '<div id="1abc"><button>ok</button></div>';
    focusAnchor('#1abc');
    expect(document.activeElement).toBe(document.querySelector('button'));
  });

  it('ne fait rien si l’élément n’existe pas', () => {
    document.body.innerHTML = '<button id="b">x</button>';
    document.querySelector<HTMLElement>('#b')!.focus();
    focusAnchor('#absent');
    expect(document.activeElement?.id).toBe('b');
  });
});
