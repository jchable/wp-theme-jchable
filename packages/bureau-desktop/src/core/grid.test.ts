import { describe, expect, it } from 'vitest';
import { CELL_SIZE, bandLayout, cellKey, clampCell, layoutIcons, nearestFreeCell, pointToCell, cellToPoint } from './grid';

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

describe('bandLayout : la bande d’icônes s’adapte à l’écran', () => {
  it('deux colonnes équilibrées sur un écran large et peu haut (11 icônes, 1440×900)', () => {
    const band = bandLayout(11, 1440, 900);
    expect(band.cols).toBe(2);
    expect(band.rows).toBe(6); // 6 + 5 : jamais 8 + 3
  });

  it('une seule colonne quand tout tient en hauteur', () => {
    const band = bandLayout(11, 1920, 1300);
    expect(band.cols).toBe(1);
    expect(band.rows).toBe(11);
  });

  it('une seule colonne sur un écran étroit, même si la bande doit défiler', () => {
    const band = bandLayout(11, 1000, 900);
    expect(band.cols).toBe(1);
    expect(band.rows).toBe(11);
  });

  it('trois colonnes au maximum sur un très grand écran peu haut', () => {
    const band = bandLayout(11, 2200, 500);
    expect(band.cols).toBe(3);
    expect(band.rows).toBe(4);
  });

  it('la largeur de la bande suit le nombre de colonnes', () => {
    expect(bandLayout(11, 1440, 900).widthPx).toBeGreaterThan(bandLayout(11, 1920, 1300).widthPx);
  });

  it('la place offerte suffit toujours pour toutes les icônes', () => {
    for (const [vw, vh] of [[900, 400], [1100, 700], [1440, 900], [1920, 1080], [3000, 300]] as const) {
      for (const n of [1, 5, 11, 20]) {
        const { cols, rows } = bandLayout(n, vw, vh);
        expect(cols * rows).toBeGreaterThanOrEqual(n);
        expect(cols).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('les icônes se répartissent 6 puis 5 avec ces dimensions', () => {
    const { cols, rows } = bandLayout(11, 1440, 900);
    const ids = Array.from({ length: 11 }, (_, i) => `i${i}`);
    const placed = layoutIcons(ids, {}, cols, rows);
    const perColumn = [0, 1].map((c) => Object.values(placed).filter((cell) => cell.col === c).length);
    expect(perColumn).toEqual([6, 5]);
  });
});
