import { describe, expect, it } from 'vitest';
import { CELL_SIZE, cellKey, clampCell, layoutIcons, nearestFreeCell, pointToCell, cellToPoint } from './grid';

describe('conversion point / case', () => {
  it('aligne un point sur la case la plus proche', () => {
    expect(pointToCell(10, 10)).toEqual({ col: 0, row: 0 });
    expect(pointToCell(CELL_SIZE + 60, 2 * CELL_SIZE + 10)).toEqual({ col: 2, row: 2 });
  });

  it('un point négatif reste dans la première case', () => {
    expect(pointToCell(-50, -80)).toEqual({ col: 0, row: 0 });
  });

  it('case vers point (coin haut gauche)', () => {
    expect(cellToPoint({ col: 2, row: 1 })).toEqual({ x: 2 * CELL_SIZE, y: CELL_SIZE });
  });
});

describe('clampCell', () => {
  it('ramène une case dans la grille', () => {
    expect(clampCell({ col: 99, row: -2 }, 5, 4)).toEqual({ col: 4, row: 0 });
  });
});

describe('nearestFreeCell', () => {
  it('garde la case voulue si elle est libre', () => {
    expect(nearestFreeCell({ col: 1, row: 1 }, new Set(), 5, 5)).toEqual({ col: 1, row: 1 });
  });

  it('cherche la case libre la plus proche quand elle est occupée', () => {
    const occupied = new Set([cellKey({ col: 1, row: 1 })]);
    const got = nearestFreeCell({ col: 1, row: 1 }, occupied, 5, 5);
    expect(got).not.toEqual({ col: 1, row: 1 });
    expect(Math.abs(got.col - 1) + Math.abs(got.row - 1)).toBe(1);
  });

  it('trouve une case même dans un coin presque plein', () => {
    const occupied = new Set<string>();
    for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) occupied.add(cellKey({ col: c, row: r }));
    occupied.delete(cellKey({ col: 2, row: 2 }));
    expect(nearestFreeCell({ col: 0, row: 0 }, occupied, 3, 3)).toEqual({ col: 2, row: 2 });
  });

  it('renvoie la case demandée (clampée) si la grille est pleine', () => {
    const occupied = new Set<string>();
    for (let c = 0; c < 2; c++) for (let r = 0; r < 2; r++) occupied.add(cellKey({ col: c, row: r }));
    expect(nearestFreeCell({ col: 5, row: 5 }, occupied, 2, 2)).toEqual({ col: 1, row: 1 });
  });
});

describe('layoutIcons', () => {
  it('range les icônes sans position en colonnes de haut en bas', () => {
    const got = layoutIcons(['a', 'b', 'c'], {}, 4, 2);
    expect(got['a']).toEqual({ col: 0, row: 0 });
    expect(got['b']).toEqual({ col: 0, row: 1 });
    expect(got['c']).toEqual({ col: 1, row: 0 });
  });

  it('respecte les positions enregistrées valides', () => {
    const got = layoutIcons(['a', 'b'], { a: { col: 3, row: 1 } }, 5, 5);
    expect(got['a']).toEqual({ col: 3, row: 1 });
    expect(got['b']).toEqual({ col: 0, row: 0 });
  });

  it('replace une position enregistrée qui sort de la grille (écran plus petit)', () => {
    const got = layoutIcons(['a'], { a: { col: 40, row: 40 } }, 5, 4);
    expect(got['a']).toEqual({ col: 4, row: 3 });
  });

  it('ne place jamais deux icônes dans la même case', () => {
    const got = layoutIcons(['a', 'b', 'c'], { a: { col: 1, row: 1 }, b: { col: 1, row: 1 } }, 5, 5);
    const keys = new Set(Object.values(got).map(cellKey));
    expect(keys.size).toBe(3);
  });
});
