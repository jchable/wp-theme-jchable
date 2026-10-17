import type { Point } from './raster';

/**
 * Tous les pixels d'un segment (algorithme de Bresenham), extrémités comprises, du départ vers l'arrivée.
 * Sert à relier deux positions successives du pointeur : le tracé n'a jamais de trou.
 */
export function linePoints(x0: number, y0: number, x1: number, y1: number): Point[] {
  let x = Math.round(x0);
  let y = Math.round(y0);
  const endX = Math.round(x1);
  const endY = Math.round(y1);
  const dx = Math.abs(endX - x);
  const dy = -Math.abs(endY - y);
  const sx = x < endX ? 1 : -1;
  const sy = y < endY ? 1 : -1;
  let err = dx + dy;
  const points: Point[] = [];
  for (;;) {
    points.push({ x, y });
    if (x === endX && y === endY) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
  return points;
}

export type BrushShape = 'round' | 'square';

/** Côté de la gomme (un carré) pour une épaisseur donnée. */
export const eraserSide = (size: number): number => Math.max(4, size * 3);

/**
 * Les pixels couverts par un pinceau de diamètre `size`, relativement à son centre. Le rond écarte les coins,
 * le carré remplit tout son côté.
 */
export function brushOffsets(shape: BrushShape, size: number): Point[] {
  const d = Math.max(1, Math.round(size));
  const low = -Math.floor(d / 2);
  const center = (d - 1) / 2;
  const radius = d / 2;
  const points: Point[] = [];
  for (let j = 0; j < d; j++) {
    for (let i = 0; i < d; i++) {
      if (shape === 'round' && (i - center) ** 2 + (j - center) ** 2 > radius * radius + 1e-9) continue;
      points.push({ x: low + i, y: low + j });
    }
  }
  return points;
}
