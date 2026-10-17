import { describe, expect, it } from 'vitest';
import { constrainLine45, constrainSquare, ellipseOutline, ellipseSpans, normalizeBox, rectOutline, rectSpans } from './shapes';

const key = (p: { x: number; y: number }): string => `${p.x},${p.y}`;

describe('normalizeBox', () => {
  it('range les coins quel que soit le sens du glisser', () => {
    expect(normalizeBox({ x: 5, y: 7 }, { x: 2, y: 3 })).toEqual({ x0: 2, y0: 3, x1: 5, y1: 7 });
    expect(normalizeBox({ x: 2, y: 7 }, { x: 5, y: 3 })).toEqual({ x0: 2, y0: 3, x1: 5, y1: 7 });
    expect(normalizeBox({ x: 2, y: 3 }, { x: 5, y: 7 })).toEqual({ x0: 2, y0: 3, x1: 5, y1: 7 });
  });
  it('un clic sans glisser donne une boîte d’un pixel', () => {
    expect(normalizeBox({ x: 4, y: 4 }, { x: 4, y: 4 })).toEqual({ x0: 4, y0: 4, x1: 4, y1: 4 });
  });
  it('arrondit les coordonnées décimales', () => {
    expect(normalizeBox({ x: 1.6, y: 2.2 }, { x: 4.4, y: 0.5 })).toEqual({ x0: 2, y0: 1, x1: 4, y1: 2 });
  });
});

describe('contraintes de Maj', () => {
  it('carré / cercle : le plus grand des deux côtés, dans le sens du glisser', () => {
    expect(constrainSquare({ x: 10, y: 10 }, { x: 14, y: 12 })).toEqual({ x: 14, y: 14 });
    expect(constrainSquare({ x: 10, y: 10 }, { x: 12, y: 4 })).toEqual({ x: 16, y: 4 });
    expect(constrainSquare({ x: 10, y: 10 }, { x: 4, y: 13 })).toEqual({ x: 4, y: 16 });
    expect(constrainSquare({ x: 10, y: 10 }, { x: 10, y: 10 })).toEqual({ x: 10, y: 10 });
  });
  it('ligne à 45° : horizontale, verticale ou diagonale', () => {
    const o = { x: 0, y: 0 };
    expect(constrainLine45(o, { x: 20, y: 3 })).toEqual({ x: 20, y: 0 });
    expect(constrainLine45(o, { x: -20, y: -3 })).toEqual({ x: -20, y: 0 });
    expect(constrainLine45(o, { x: 3, y: 20 })).toEqual({ x: 0, y: 20 });
    expect(constrainLine45(o, { x: 3, y: -20 })).toEqual({ x: 0, y: -20 });
    expect(constrainLine45(o, { x: 10, y: 8 })).toEqual({ x: 10, y: 10 });
    expect(constrainLine45(o, { x: -10, y: 8 })).toEqual({ x: -10, y: 10 });
    expect(constrainLine45(o, { x: 10, y: -12 })).toEqual({ x: 12, y: -12 });
    expect(constrainLine45({ x: 5, y: 5 }, { x: 5, y: 5 })).toEqual({ x: 5, y: 5 });
  });
});

describe('rectOutline', () => {
  it('le tour d’un rectangle', () => {
    const pts = rectOutline({ x0: 1, y0: 1, x1: 4, y1: 3 });
    expect(new Set(pts.map(key)).size).toBe(pts.length); // sans doublons
    expect(pts).toHaveLength(10); // 4 pixels de large, 3 de haut : 12 - 2 pixels intérieurs
    expect(pts.map(key)).toContain('1,1');
    expect(pts.map(key)).toContain('4,3');
    expect(pts.map(key)).not.toContain('2,2'); // l’intérieur est vide
  });
  it('une boîte d’un pixel, une ligne', () => {
    expect(rectOutline({ x0: 2, y0: 2, x1: 2, y1: 2 }).map(key)).toEqual(['2,2']);
    expect(rectOutline({ x0: 0, y0: 0, x1: 3, y1: 0 })).toHaveLength(4);
    expect(rectOutline({ x0: 0, y0: 0, x1: 0, y1: 3 })).toHaveLength(4);
  });
  it('rectSpans : lignes pleines', () => {
    expect(rectSpans({ x0: 1, y0: 1, x1: 4, y1: 3 })).toEqual([
      { y: 1, x0: 1, x1: 4 },
      { y: 2, x0: 1, x1: 4 },
      { y: 3, x0: 1, x1: 4 },
    ]);
  });
});

describe('ellipse', () => {
  const box = { x0: 0, y0: 0, x1: 20, y1: 10 };

  it('reste dans sa boîte et touche ses quatre côtés', () => {
    const pts = ellipseOutline(box);
    expect(pts.length).toBeGreaterThan(30);
    for (const p of pts) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(20);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(10);
    }
    expect(Math.min(...pts.map((p) => p.x))).toBe(0);
    expect(Math.max(...pts.map((p) => p.x))).toBe(20);
    expect(Math.min(...pts.map((p) => p.y))).toBe(0);
    expect(Math.max(...pts.map((p) => p.y))).toBe(10);
  });

  it('est symétrique et sans doublons', () => {
    const pts = ellipseOutline(box);
    const set = new Set(pts.map(key));
    expect(set.size).toBe(pts.length);
    for (const p of pts) {
      expect(set.has(key({ x: 20 - p.x, y: p.y }))).toBe(true);
      expect(set.has(key({ x: p.x, y: 10 - p.y }))).toBe(true);
    }
  });

  it('est fermée : chaque point a au moins deux voisins sur le contour', () => {
    const pts = ellipseOutline(box);
    const set = new Set(pts.map(key));
    for (const p of pts) {
      let n = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]] as const) {
        if (set.has(key({ x: p.x + dx, y: p.y + dy }))) n++;
      }
      expect(n).toBeGreaterThanOrEqual(2);
    }
  });

  it('cercle dans un carré : tous les points à peu près à égale distance du centre', () => {
    const pts = ellipseOutline({ x0: 0, y0: 0, x1: 20, y1: 20 });
    for (const p of pts) {
      const d = Math.hypot(p.x + 0.5 - 10.5, p.y + 0.5 - 10.5);
      expect(Math.abs(d - 10.5)).toBeLessThan(1.1);
    }
  });

  it('les spans remplissent l’ellipse, du haut en bas', () => {
    const spans = ellipseSpans(box);
    expect(spans[0]!.y).toBe(0);
    expect(spans[spans.length - 1]!.y).toBe(10);
    expect(spans).toHaveLength(11);
    const middle = spans[5]!;
    expect(middle.x0).toBe(0);
    expect(middle.x1).toBe(20);
    expect(spans[0]!.x0).toBeGreaterThan(3); // la pointe du haut est étroite
    for (const s of spans) expect(s.x0 + s.x1).toBe(20); // symétrie
  });

  it('boîtes minuscules : un pixel, une ligne', () => {
    expect(ellipseOutline({ x0: 3, y0: 3, x1: 3, y1: 3 }).map(key)).toEqual(['3,3']);
    expect(ellipseOutline({ x0: 0, y0: 0, x1: 5, y1: 0 }).length).toBeGreaterThanOrEqual(6);
    expect(ellipseSpans({ x0: 3, y0: 3, x1: 3, y1: 3 })).toEqual([{ y: 3, x0: 3, x1: 3 }]);
  });

  it('les contours sont bornés même pour une très grande boîte', () => {
    const pts = ellipseOutline({ x0: 0, y0: 0, x1: 639, y1: 399 });
    expect(pts.length).toBeLessThan(5000);
  });
});
