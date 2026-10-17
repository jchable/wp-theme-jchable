/**
 * Image en pixels, indépendante du DOM : un tableau RGBA (comme `ImageData.data`).
 * Toute la logique de dessin travaille dessus, ce qui permet de la tester sans canevas.
 */

export type RGBA = readonly [number, number, number, number];

export interface Point {
  x: number;
  y: number;
}

/** Boîte de pixels, bornes comprises (x0 ≤ x1, y0 ≤ y1). */
export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface Raster {
  readonly width: number;
  readonly height: number;
  /** Les pixels, ligne après ligne, quatre valeurs (R, V, B, A) par pixel. */
  data: Uint8ClampedArray<ArrayBuffer>;
}

export const WHITE: RGBA = [255, 255, 255, 255];

export function createRaster(width: number, height: number, color: RGBA = WHITE): Raster {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = color[0];
    data[i + 1] = color[1];
    data[i + 2] = color[2];
    data[i + 3] = color[3];
  }
  return { width, height, data };
}

export const inBounds = (r: Raster, x: number, y: number): boolean => x >= 0 && y >= 0 && x < r.width && y < r.height;

export function getPixel(r: Raster, x: number, y: number): RGBA | null {
  if (!inBounds(r, x, y)) return null;
  const i = (y * r.width + x) * 4;
  return [r.data[i]!, r.data[i + 1]!, r.data[i + 2]!, r.data[i + 3]!];
}

/** Écrit un pixel ; renvoie vrai si la valeur a changé (faux : hors de l'image ou déjà de cette couleur). */
export function setPixel(r: Raster, x: number, y: number, color: RGBA): boolean {
  if (!inBounds(r, x, y)) return false;
  const i = (y * r.width + x) * 4;
  const d = r.data;
  if (d[i] === color[0] && d[i + 1] === color[1] && d[i + 2] === color[2] && d[i + 3] === color[3]) return false;
  d[i] = color[0];
  d[i + 1] = color[1];
  d[i + 2] = color[2];
  d[i + 3] = color[3];
  return true;
}

export const sameColor = (a: RGBA, b: RGBA): boolean => a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];

/** « #rrggbb » vers RGBA opaque. */
export function hexToRgba(hex: string): RGBA {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
}

export function rgbaToHex(color: RGBA): string {
  return `#${[color[0], color[1], color[2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
