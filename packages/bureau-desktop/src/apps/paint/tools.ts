import { brushOffsets, eraserSide, linePoints } from './line';
import { getPixel, rgbaToHex, setPixel, type Box, type Point, type RGBA, type Raster } from './raster';
import { constrainLine45, constrainSquare, ellipseOutline, ellipseSpans, normalizeBox, rectOutline, rectSpans } from './shapes';

export type FreehandTool = 'pencil' | 'brush' | 'eraser';
export type ShapeTool = 'line' | 'rect' | 'ellipse';
export type Tool = FreehandTool | ShapeTool | 'fill' | 'picker';

/** Style des rectangles et des ellipses : contour seul, contour + fond, ou plein de la couleur du contour. */
export type FillStyle = 'outline' | 'filled' | 'solid';

/** Épaisseurs proposées (en pixels). */
export const SIZES: readonly number[] = [1, 2, 4, 8];

/** Épaisseur réellement utilisée : celle choisie, la gomme étant plus large que le trait. */
export function effectiveSize(tool: FreehandTool, size: number): number {
  return tool === 'eraser' ? eraserSide(size) : size;
}

function stamp(r: Raster, offsets: readonly Point[], cx: number, cy: number, color: RGBA): void {
  for (const o of offsets) setPixel(r, cx + o.x, cy + o.y, color);
}

/** Un trait d'une position du pointeur à la suivante, sans trou. Départ = arrivée : un point. */
export function strokeSegment(r: Raster, tool: FreehandTool, from: Point, to: Point, size: number, color: RGBA): void {
  const offsets = brushOffsets(tool === 'eraser' ? 'square' : 'round', effectiveSize(tool, size));
  for (const p of linePoints(from.x, from.y, to.x, to.y)) stamp(r, offsets, p.x, p.y, color);
}

/** La zone modifiée par un trait (à rafraîchir à l'écran), bornée à l'image. */
export function strokeBounds(r: Raster, from: Point, to: Point, tool: FreehandTool, size: number): Box {
  const margin = Math.ceil(effectiveSize(tool, size) / 2) + 1;
  return {
    x0: Math.max(0, Math.min(from.x, to.x) - margin),
    y0: Math.max(0, Math.min(from.y, to.y) - margin),
    x1: Math.min(r.width - 1, Math.max(from.x, to.x) + margin),
    y1: Math.min(r.height - 1, Math.max(from.y, to.y) + margin),
  };
}

export interface ShapeOptions {
  size: number;
  /** Couleur du trait. */
  color: RGBA;
  /** Couleur du fond (remplissage de l'intérieur) ; `null` : contour seul. */
  fillColor: RGBA | null;
  /** Maj : carré, cercle ou ligne à 45°. */
  constrain: boolean;
}

/** Dessine une ligne, un rectangle ou une ellipse allant du point de départ à la position courante. */
export function drawShape(r: Raster, tool: ShapeTool, start: Point, end: Point, options: ShapeOptions): void {
  const { size, color, fillColor, constrain } = options;
  const brush = brushOffsets('round', size);
  if (tool === 'line') {
    const to = constrain ? constrainLine45(start, end) : end;
    for (const p of linePoints(start.x, start.y, to.x, to.y)) stamp(r, brush, p.x, p.y, color);
    return;
  }
  const to = constrain ? constrainSquare(start, end) : end;
  const box = normalizeBox(start, to);
  if (fillColor) {
    for (const span of tool === 'rect' ? rectSpans(box) : ellipseSpans(box)) {
      for (let x = span.x0; x <= span.x1; x++) setPixel(r, x, span.y, fillColor);
    }
  }
  for (const p of tool === 'rect' ? rectOutline(box) : ellipseOutline(box)) stamp(r, brush, p.x, p.y, color);
}

/** La couleur (« #rrggbb ») du pixel sous le pointeur, ou `null` hors de l'image. */
export function pickColor(r: Raster, x: number, y: number): string | null {
  const pixel = getPixel(r, Math.floor(x), Math.floor(y));
  return pixel ? rgbaToHex(pixel) : null;
}
