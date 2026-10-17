import { describe, expect, it } from 'vitest';
import { floodFill } from './fill';
import { createRaster, getPixel, setPixel, type RGBA, type Raster } from './raster';

const RED: RGBA = [255, 0, 0, 255];
const BLACK: RGBA = [0, 0, 0, 255];
const BLUE: RGBA = [0, 0, 255, 255];
const WHITE: RGBA = [255, 255, 255, 255];

function count(r: Raster, color: RGBA): number {
  let n = 0;
  for (let y = 0; y < r.height; y++) for (let x = 0; x < r.width; x++) if (getPixel(r, x, y)!.join() === color.join()) n++;
  return n;
}

describe('floodFill', () => {
  it('remplit toute une image vide', () => {
    const r = createRaster(10, 8);
    expect(floodFill(r, 3, 3, RED)).toBe(80);
    expect(count(r, RED)).toBe(80);
  });

  it('s’arrête aux bordures : une pièce fermée', () => {
    const r = createRaster(10, 10);
    for (let i = 2; i <= 6; i++) {
      setPixel(r, i, 2, BLACK);
      setPixel(r, i, 6, BLACK);
      setPixel(r, 2, i, BLACK);
      setPixel(r, 6, i, BLACK);
    }
    expect(floodFill(r, 4, 4, RED)).toBe(9); // l’intérieur 3×3
    expect(getPixel(r, 4, 4)).toEqual(RED);
    expect(getPixel(r, 0, 0)).toEqual(WHITE); // le dehors est intact
    expect(getPixel(r, 2, 2)).toEqual(BLACK);
    expect(floodFill(r, 0, 0, BLUE)).toBe(100 - 16 - 9);
  });

  it('ne passe pas par les diagonales (4 voisins)', () => {
    const r = createRaster(3, 3);
    setPixel(r, 1, 0, BLACK);
    setPixel(r, 0, 1, BLACK);
    setPixel(r, 1, 1, BLACK); // ferme le coin haut gauche
    expect(floodFill(r, 0, 0, RED)).toBe(1);
  });

  it('tolérance 0 : une couleur presque identique est un obstacle', () => {
    const r = createRaster(5, 1);
    setPixel(r, 2, 0, [254, 255, 255, 255]);
    expect(floodFill(r, 0, 0, RED)).toBe(2);
    expect(getPixel(r, 2, 0)).toEqual([254, 255, 255, 255]);
    expect(getPixel(r, 3, 0)).toEqual(WHITE);
  });

  it('remplir avec la couleur déjà présente ne fait rien', () => {
    const r = createRaster(4, 4);
    expect(floodFill(r, 1, 1, WHITE)).toBe(0);
  });

  it('un clic hors de l’image ne fait rien', () => {
    const r = createRaster(4, 4);
    expect(floodFill(r, -1, 0, RED)).toBe(0);
    expect(floodFill(r, 0, 4, RED)).toBe(0);
    expect(floodFill(r, 99, 99, RED)).toBe(0);
    expect(count(r, RED)).toBe(0);
  });

  it('accepte des coordonnées décimales (position du pointeur)', () => {
    const r = createRaster(4, 4);
    expect(floodFill(r, 1.7, 2.2, RED)).toBe(16);
  });

  it('remplit un couloir en serpentin d’un pixel de large', () => {
    const r = createRaster(9, 9, BLACK);
    let open = 0;
    for (let y = 0; y < 9; y += 2) {
      for (let x = 0; x < 9; x++) {
        setPixel(r, x, y, WHITE);
        open++;
      }
    }
    for (let y = 1; y < 9; y += 2) {
      setPixel(r, y % 4 === 1 ? 8 : 0, y, WHITE);
      open++;
    }
    expect(floodFill(r, 0, 0, RED)).toBe(open);
  });

  it('grande image : itératif, sans dépassement de pile, en temps raisonnable', () => {
    const r = createRaster(640, 400);
    const start = Date.now();
    expect(floodFill(r, 0, 0, RED)).toBe(640 * 400);
    expect(Date.now() - start).toBeLessThan(1500);
  });

  it('damier : chaque case est isolée, le remplissage reste borné', () => {
    const r = createRaster(200, 200);
    for (let y = 0; y < 200; y++) for (let x = 0; x < 200; x++) if ((x + y) % 2 === 0) setPixel(r, x, y, BLACK);
    expect(floodFill(r, 1, 0, RED)).toBe(1);
    expect(floodFill(r, 0, 0, BLUE)).toBe(1);
  });

  it('peint avec la couleur et la transparence demandées', () => {
    const r = createRaster(2, 2);
    floodFill(r, 0, 0, [1, 2, 3, 128]);
    expect(getPixel(r, 1, 1)).toEqual([1, 2, 3, 128]);
  });
});
