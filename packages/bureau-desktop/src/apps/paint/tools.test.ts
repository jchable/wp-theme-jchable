import { describe, expect, it } from 'vitest';
import { linePoints } from './line';
import { createRaster, getPixel, type RGBA, type Raster } from './raster';
import { drawShape, pickColor, strokeBounds, strokeSegment } from './tools';

const RED: RGBA = [255, 0, 0, 255];
const BLUE: RGBA = [0, 0, 255, 255];
const WHITE: RGBA = [255, 255, 255, 255];

const is = (r: Raster, x: number, y: number, color: RGBA): boolean => getPixel(r, x, y)?.join() === color.join();
function painted(r: Raster, color: RGBA): number {
  let n = 0;
  for (let y = 0; y < r.height; y++) for (let x = 0; x < r.width; x++) if (is(r, x, y, color)) n++;
  return n;
}

describe('strokeSegment : crayon, pinceau, gomme', () => {
  it('le crayon trace un pixel par point de la ligne, sans trou', () => {
    const r = createRaster(40, 40);
    strokeSegment(r, 'pencil', { x: 2, y: 3 }, { x: 30, y: 17 }, 4, RED);
    const expected = linePoints(2, 3, 30, 17);
    expect(painted(r, RED)).toBe(expected.length); // le crayon fait toujours 1 pixel, même en taille 4
    for (const p of expected) expect(is(r, p.x, p.y, RED)).toBe(true);
  });

  it('un clic sans bouger dessine un point', () => {
    const r = createRaster(10, 10);
    strokeSegment(r, 'pencil', { x: 5, y: 5 }, { x: 5, y: 5 }, 1, RED);
    expect(painted(r, RED)).toBe(1);
    expect(is(r, 5, 5, RED)).toBe(true);
  });

  it('le pinceau est plus épais selon la taille', () => {
    const thin = createRaster(60, 60);
    const thick = createRaster(60, 60);
    strokeSegment(thin, 'brush', { x: 5, y: 30 }, { x: 55, y: 30 }, 2, RED);
    strokeSegment(thick, 'brush', { x: 5, y: 30 }, { x: 55, y: 30 }, 8, RED);
    expect(painted(thick, RED)).toBeGreaterThan(painted(thin, RED) * 3);
    expect(is(thick, 30, 27, RED)).toBe(true);
    expect(is(thick, 30, 33, RED)).toBe(true);
    expect(is(thick, 30, 20, RED)).toBe(false);
  });

  it('la gomme peint un carré de la couleur donnée', () => {
    const r = createRaster(40, 40, RED);
    strokeSegment(r, 'eraser', { x: 10, y: 20 }, { x: 30, y: 20 }, 2, WHITE);
    expect(is(r, 20, 20, WHITE)).toBe(true);
    expect(is(r, 20, 22, WHITE)).toBe(true); // 6 px de côté
    expect(is(r, 20, 30, WHITE)).toBe(false);
    expect(is(r, 0, 0, RED)).toBe(true);
  });

  it('dessiner hors de l’image ne plante pas et ne déborde pas', () => {
    const r = createRaster(10, 10);
    expect(() => strokeSegment(r, 'brush', { x: -50, y: -50 }, { x: 80, y: 80 }, 8, RED)).not.toThrow();
    expect(() => strokeSegment(r, 'pencil', { x: 5000, y: -3 }, { x: -9000, y: 4 }, 1, RED)).not.toThrow();
    expect(r.data).toHaveLength(10 * 10 * 4);
  });

  it('strokeBounds couvre le trait et l’épaisseur, bornée à l’image', () => {
    const r = createRaster(100, 80);
    expect(strokeBounds(r, { x: 10, y: 10 }, { x: 20, y: 30 }, 'brush', 4)).toEqual({ x0: 7, y0: 7, x1: 23, y1: 33 });
    expect(strokeBounds(r, { x: -10, y: -10 }, { x: 500, y: 500 }, 'pencil', 1)).toEqual({ x0: 0, y0: 0, x1: 99, y1: 79 });
  });
});

describe('drawShape', () => {
  const base = { size: 1, color: RED, fillColor: null, constrain: false } as const;

  it('ligne', () => {
    const r = createRaster(30, 30);
    drawShape(r, 'line', { x: 2, y: 2 }, { x: 20, y: 10 }, base);
    expect(painted(r, RED)).toBe(linePoints(2, 2, 20, 10).length);
  });

  it('ligne avec Maj : à 45°', () => {
    const r = createRaster(30, 30);
    drawShape(r, 'line', { x: 5, y: 5 }, { x: 25, y: 9 }, { ...base, constrain: true });
    for (let x = 5; x <= 25; x++) expect(is(r, x, 5, RED)).toBe(true); // horizontale
    expect(painted(r, RED)).toBe(21);
  });

  it('rectangle : contour seulement', () => {
    const r = createRaster(30, 30);
    drawShape(r, 'rect', { x: 5, y: 5 }, { x: 15, y: 12 }, base);
    expect(is(r, 5, 5, RED)).toBe(true);
    expect(is(r, 15, 12, RED)).toBe(true);
    expect(is(r, 10, 5, RED)).toBe(true);
    expect(is(r, 10, 8, RED)).toBe(false);
  });

  it('rectangle avec Maj : un carré (le plus grand côté)', () => {
    const r = createRaster(40, 40);
    drawShape(r, 'rect', { x: 5, y: 5 }, { x: 25, y: 10 }, { ...base, constrain: true });
    expect(is(r, 25, 25, RED)).toBe(true); // coin d’un carré de 21
    expect(is(r, 25, 10, RED)).toBe(true);
  });

  it('rectangle plein : contour + remplissage de la couleur de fond', () => {
    const r = createRaster(30, 30);
    drawShape(r, 'rect', { x: 5, y: 5 }, { x: 15, y: 12 }, { ...base, fillColor: BLUE });
    expect(is(r, 5, 5, RED)).toBe(true);
    expect(is(r, 10, 8, BLUE)).toBe(true);
    expect(is(r, 4, 8, WHITE)).toBe(true);
  });

  it('le glisser dans l’autre sens donne le même rectangle', () => {
    const a = createRaster(30, 30);
    const b = createRaster(30, 30);
    drawShape(a, 'rect', { x: 5, y: 5 }, { x: 15, y: 12 }, base);
    drawShape(b, 'rect', { x: 15, y: 12 }, { x: 5, y: 5 }, base);
    expect(a.data).toEqual(b.data);
  });

  it('ellipse : contour, centre vide ; avec fond, centre rempli', () => {
    const outline = createRaster(40, 40);
    drawShape(outline, 'ellipse', { x: 5, y: 5 }, { x: 35, y: 25 }, base);
    expect(is(outline, 5, 15, RED) || is(outline, 6, 15, RED)).toBe(true);
    expect(is(outline, 20, 15, WHITE)).toBe(true);
    const filled = createRaster(40, 40);
    drawShape(filled, 'ellipse', { x: 5, y: 5 }, { x: 35, y: 25 }, { ...base, fillColor: BLUE });
    expect(is(filled, 20, 15, BLUE)).toBe(true);
    expect(is(filled, 5, 5, WHITE)).toBe(true); // le coin de la boîte reste hors de l’ellipse
  });

  it('cercle avec Maj', () => {
    const r = createRaster(60, 60);
    drawShape(r, 'ellipse', { x: 10, y: 10 }, { x: 40, y: 20 }, { ...base, constrain: true });
    // la boîte devient 31×31 : le contour touche le bas de cette boîte
    expect(painted(r, RED)).toBeGreaterThan(60);
    let maxY = 0;
    for (let y = 0; y < 60; y++) for (let x = 0; x < 60; x++) if (is(r, x, y, RED)) maxY = Math.max(maxY, y);
    expect(maxY).toBe(40);
  });

  it('trait épais : le contour s’épaissit', () => {
    const thin = createRaster(60, 60);
    const thick = createRaster(60, 60);
    drawShape(thin, 'rect', { x: 10, y: 10 }, { x: 40, y: 40 }, base);
    drawShape(thick, 'rect', { x: 10, y: 10 }, { x: 40, y: 40 }, { ...base, size: 4 });
    expect(painted(thick, RED)).toBeGreaterThan(painted(thin, RED) * 2);
  });

  it('ne déborde pas de l’image', () => {
    const r = createRaster(20, 20);
    expect(() => drawShape(r, 'ellipse', { x: -30, y: -30 }, { x: 80, y: 80 }, { ...base, size: 4, fillColor: BLUE })).not.toThrow();
  });
});

describe('pickColor (pipette)', () => {
  it('lit la couleur d’un pixel en hexadécimal', () => {
    const r = createRaster(5, 5, [255, 128, 64, 255]);
    expect(pickColor(r, 2, 2)).toBe('#ff8040');
    expect(pickColor(r, 2.9, 4.1)).toBe('#ff8040');
  });
  it('hors de l’image : rien', () => {
    expect(pickColor(createRaster(5, 5), -1, 2)).toBeNull();
    expect(pickColor(createRaster(5, 5), 5, 2)).toBeNull();
  });
});
