import { describe, expect, it } from 'vitest';
import { formatCount, formatDate, formatSize, moveSelection, totalSize } from './helpers';
import { TRASH_ITEMS } from './items';

describe('totalSize', () => {
  it('additionne les tailles', () => {
    expect(totalSize([{ sizeKo: 3 }, { sizeKo: 4 }])).toBe(7);
  });
  it('vaut 0 pour une liste vide', () => {
    expect(totalSize([])).toBe(0);
  });
  it('calcule le total des données', () => {
    expect(totalSize(TRASH_ITEMS)).toBe(TRASH_ITEMS.reduce((s, i) => s + i.sizeKo, 0));
  });
});

describe('formatSize', () => {
  it('affiche des Ko', () => {
    expect(formatSize(14)).toBe('14 Ko');
    expect(formatSize(0)).toBe('0 Ko');
  });
  it('groupe les milliers', () => {
    expect(formatSize(1234)).toBe('1 234 Ko');
  });
  it('passe en Mo à partir de 10 000 Ko', () => {
    expect(formatSize(20480)).toBe('20,0 Mo');
  });
});

describe('formatDate', () => {
  it('formate en jj/mm/aaaa', () => {
    expect(formatDate('2025-03-14')).toBe('14/03/2025');
  });
  it("renvoie le texte tel quel s'il est invalide", () => {
    expect(formatDate('hier')).toBe('hier');
  });
});

describe('formatCount', () => {
  it('accorde le pluriel', () => {
    expect(formatCount(0)).toBe('0 objet');
    expect(formatCount(1)).toBe('1 objet');
    expect(formatCount(8)).toBe('8 objets');
  });
});

describe('moveSelection', () => {
  it('descend et monte sans dépasser', () => {
    expect(moveSelection(0, 'ArrowDown', 3)).toBe(1);
    expect(moveSelection(2, 'ArrowDown', 3)).toBe(2);
    expect(moveSelection(1, 'ArrowUp', 3)).toBe(0);
    expect(moveSelection(0, 'ArrowUp', 3)).toBe(0);
  });
  it('gère Début et Fin', () => {
    expect(moveSelection(1, 'Home', 5)).toBe(0);
    expect(moveSelection(1, 'End', 5)).toBe(4);
  });
  it('sélectionne le premier sans sélection', () => {
    expect(moveSelection(-1, 'ArrowDown', 3)).toBe(0);
  });
  it('ignore les autres touches', () => {
    expect(moveSelection(1, 'a', 3)).toBe(1);
    expect(moveSelection(-1, 'a', 3)).toBe(-1);
  });
  it('renvoie -1 si la liste est vide', () => {
    expect(moveSelection(0, 'ArrowDown', 0)).toBe(-1);
  });
});
