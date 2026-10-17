import { describe, expect, it } from 'vitest';
import { brushOffsets, eraserSide, linePoints } from './line';

const key = (p: { x: number; y: number }): string => `${p.x},${p.y}`;
const adjacent = (a: { x: number; y: number }, b: { x: number; y: number }): boolean =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= 1;

describe('linePoints (Bresenham)', () => {
  it('un seul point quand le départ est l’arrivée', () => {
    expect(linePoints(3, 4, 3, 4)).toEqual([{ x: 3, y: 4 }]);
  });
  it('horizontale et verticale', () => {
    expect(linePoints(0, 0, 4, 0).map(key)).toEqual(['0,0', '1,0', '2,0', '3,0', '4,0']);
    expect(linePoints(2, 5, 2, 2).map(key)).toEqual(['2,5', '2,4', '2,3', '2,2']);
  });
  it('diagonale exacte', () => {
    expect(linePoints(0, 0, 3, 3).map(key)).toEqual(['0,0', '1,1', '2,2', '3,3']);
    expect(linePoints(3, 0, 0, 3).map(key)).toEqual(['3,0', '2,1', '1,2', '0,3']);
  });
  it('contient toujours les deux extrémités, dans le sens du tracé', () => {
    const pts = linePoints(1, 2, 17, 9);
    expect(pts[0]).toEqual({ x: 1, y: 2 });
    expect(pts[pts.length - 1]).toEqual({ x: 17, y: 9 });
  });
  it('sans trou : deux points consécutifs sont voisins, dans tous les octants', () => {
    for (const [x1, y1] of [[17, 3], [3, 17], [-17, 3], [-3, 17], [17, -3], [3, -17], [-17, -3], [-3, -17], [10, 10], [1, 0], [0, 1]] as const) {
      const pts = linePoints(0, 0, x1, y1);
      expect(pts).toHaveLength(Math.max(Math.abs(x1), Math.abs(y1)) + 1);
      for (let i = 1; i < pts.length; i++) expect(adjacent(pts[i - 1]!, pts[i]!)).toBe(true);
    }
  });
  it('l’aller et le retour ont la même longueur', () => {
    expect(linePoints(0, 0, 9, 4)).toHaveLength(linePoints(9, 4, 0, 0).length);
  });
  it('accepte des coordonnées décimales en les arrondissant', () => {
    expect(linePoints(0.4, 0.4, 2.6, 0.4).map(key)).toEqual(['0,0', '1,0', '2,0', '3,0']);
  });
  it('longue ligne : bornée', () => {
    expect(linePoints(0, 0, 5000, 3000)).toHaveLength(5001);
  });
});

describe('brushOffsets', () => {
  it('taille 1 : un pixel', () => {
    expect(brushOffsets('round', 1)).toEqual([{ x: 0, y: 0 }]);
    expect(brushOffsets('square', 1)).toEqual([{ x: 0, y: 0 }]);
  });
  it('le carré remplit son côté', () => {
    expect(brushOffsets('square', 4)).toHaveLength(16);
    const xs = brushOffsets('square', 4).map((p) => p.x);
    expect(Math.min(...xs)).toBe(-2);
    expect(Math.max(...xs)).toBe(1);
  });
  it('le rond est plus petit que son carré et sans les coins', () => {
    const round = brushOffsets('round', 6);
    expect(round.length).toBeLessThan(36);
    expect(round.length).toBeGreaterThan(20);
    expect(round.map(key)).not.toContain('-3,-3');
  });
  it('le rond est symétrique et centré (diamètre impair)', () => {
    const round = brushOffsets('round', 5);
    const set = new Set(round.map(key));
    for (const p of round) {
      expect(set.has(key({ x: -p.x, y: p.y }))).toBe(true);
      expect(set.has(key({ x: p.x, y: -p.y }))).toBe(true);
      expect(set.has(key({ x: p.y, y: p.x }))).toBe(true);
    }
  });
  it('sans doublons', () => {
    for (const size of [1, 2, 3, 4, 8]) {
      const pts = brushOffsets('round', size);
      expect(new Set(pts.map(key)).size).toBe(pts.length);
    }
  });
  it('la gomme est un carré plus grand que le trait', () => {
    expect(eraserSide(1)).toBe(4);
    expect(eraserSide(2)).toBe(6);
    expect(eraserSide(4)).toBe(12);
    expect(eraserSide(8)).toBe(24);
  });
});
