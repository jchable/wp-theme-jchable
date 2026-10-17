import { describe, expect, it } from 'vitest';
import { WHITE, createRaster, getPixel, hexToRgba, rgbaToHex, sameColor, setPixel } from './raster';

describe('raster', () => {
  it('crée une image remplie d’une couleur (blanc opaque par défaut)', () => {
    const r = createRaster(3, 2);
    expect(r.width).toBe(3);
    expect(r.height).toBe(2);
    expect(r.data).toHaveLength(3 * 2 * 4);
    expect(getPixel(r, 0, 0)).toEqual([255, 255, 255, 255]);
    expect(getPixel(r, 2, 1)).toEqual([255, 255, 255, 255]);
    expect(createRaster(1, 1, [1, 2, 3, 4]).data).toEqual(new Uint8ClampedArray([1, 2, 3, 4]));
  });

  it('lit et écrit un pixel', () => {
    const r = createRaster(4, 4);
    expect(setPixel(r, 1, 2, [10, 20, 30, 255])).toBe(true);
    expect(getPixel(r, 1, 2)).toEqual([10, 20, 30, 255]);
    expect(r.data.slice((2 * 4 + 1) * 4, (2 * 4 + 1) * 4 + 4)).toEqual(new Uint8ClampedArray([10, 20, 30, 255]));
  });

  it('ignore ce qui sort de l’image, sans erreur', () => {
    const r = createRaster(4, 4);
    for (const [x, y] of [[-1, 0], [0, -1], [4, 0], [0, 4], [100, 100]] as const) {
      expect(setPixel(r, x, y, [0, 0, 0, 255])).toBe(false);
      expect(getPixel(r, x, y)).toBeNull();
    }
    expect(r.data.every((v) => v === 255)).toBe(true);
  });

  it('setPixel dit si la valeur a changé', () => {
    const r = createRaster(2, 2);
    expect(setPixel(r, 0, 0, WHITE)).toBe(false);
    expect(setPixel(r, 0, 0, [0, 0, 0, 255])).toBe(true);
  });

  it('convertit les couleurs hexadécimales', () => {
    expect(hexToRgba('#ff8040')).toEqual([255, 128, 64, 255]);
    expect(hexToRgba('#000000')).toEqual([0, 0, 0, 255]);
    expect(rgbaToHex([255, 128, 64, 255])).toBe('#ff8040');
    expect(rgbaToHex([0, 0, 0, 255])).toBe('#000000');
  });

  it('compare deux couleurs', () => {
    expect(sameColor([1, 2, 3, 4], [1, 2, 3, 4])).toBe(true);
    expect(sameColor([1, 2, 3, 4], [1, 2, 3, 5])).toBe(false);
  });
});
