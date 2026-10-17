import type { Box, Point } from './raster';

/** Une plage de pixels d'une ligne (bornes comprises). */
export interface Span {
  y: number;
  x0: number;
  x1: number;
}

/** La boîte (bornes comprises) qui contient les deux coins d'un glisser, quel que soit son sens. */
export function normalizeBox(a: Point, b: Point): Box {
  const ax = Math.round(a.x);
  const ay = Math.round(a.y);
  const bx = Math.round(b.x);
  const by = Math.round(b.y);
  return { x0: Math.min(ax, bx), y0: Math.min(ay, by), x1: Math.max(ax, bx), y1: Math.max(ay, by) };
}

const sign = (n: number): number => (n < 0 ? -1 : 1);

/** Maj enfoncée pour un rectangle ou une ellipse : un carré (un cercle) dans le sens du glisser. */
export function constrainSquare(start: Point, end: Point): Point {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const size = Math.max(Math.abs(dx), Math.abs(dy));
  return { x: start.x + sign(dx) * size, y: start.y + sign(dy) * size };
}

/** Maj enfoncée pour une ligne : horizontale, verticale ou à 45°, selon le multiple de 45° le plus proche. */
export function constrainLine45(start: Point, end: Point): Point {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return { ...end };
  const octant = ((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8;
  if (octant === 0 || octant === 4) return { x: end.x, y: start.y };
  if (octant === 2 || octant === 6) return { x: start.x, y: end.y };
  const size = Math.max(Math.abs(dx), Math.abs(dy));
  return { x: start.x + sign(dx) * size, y: start.y + sign(dy) * size };
}

/** Le tour d'un rectangle, sans doublon. */
export function rectOutline(box: Box): Point[] {
  const points: Point[] = [];
  for (let x = box.x0; x <= box.x1; x++) {
    points.push({ x, y: box.y0 });
    if (box.y1 !== box.y0) points.push({ x, y: box.y1 });
  }
  for (let y = box.y0 + 1; y < box.y1; y++) {
    points.push({ x: box.x0, y });
    if (box.x1 !== box.x0) points.push({ x: box.x1, y });
  }
  return points;
}

/** Les lignes pleines d'un rectangle. */
export function rectSpans(box: Box): Span[] {
  const spans: Span[] = [];
  for (let y = box.y0; y <= box.y1; y++) spans.push({ y, x0: box.x0, x1: box.x1 });
  return spans;
}

/**
 * Les lignes pleines de l'ellipse inscrite dans la boîte : un pixel est dedans quand son centre l'est.
 * Aucune ligne de la boîte n'est vide.
 */
export function ellipseSpans(box: Box): Span[] {
  const cx = (box.x0 + box.x1 + 1) / 2;
  const cy = (box.y0 + box.y1 + 1) / 2;
  const rx = (box.x1 - box.x0 + 1) / 2;
  const ry = (box.y1 - box.y0 + 1) / 2;
  const spans: Span[] = [];
  for (let y = box.y0; y <= box.y1; y++) {
    const dy = (y + 0.5 - cy) / ry;
    const half = rx * Math.sqrt(Math.max(0, 1 - dy * dy));
    const x0 = Math.max(box.x0, Math.ceil(cx - half - 0.5 - 1e-9));
    const x1 = Math.min(box.x1, Math.floor(cx + half - 0.5 + 1e-9));
    if (x0 <= x1) spans.push({ y, x0, x1 });
  }
  return spans;
}

/** Le contour d'une ellipse : les pixels de l'ellipse pleine qui ont un voisin (haut, bas, gauche, droite) dehors. */
export function ellipseOutline(box: Box): Point[] {
  const spans = ellipseSpans(box);
  const inSpan = (span: Span | undefined, x: number): boolean => span !== undefined && x >= span.x0 && x <= span.x1;
  const points: Point[] = [];
  spans.forEach((span, i) => {
    // Une ligne manquante (ellipse très plate) compte comme « dehors » : la ligne voisine est donc tout en contour.
    const above = spans[i - 1]?.y === span.y - 1 ? spans[i - 1] : undefined;
    const below = spans[i + 1]?.y === span.y + 1 ? spans[i + 1] : undefined;
    for (let x = span.x0; x <= span.x1; x++) {
      if (x === span.x0 || x === span.x1 || !inSpan(above, x) || !inSpan(below, x)) points.push({ x, y: span.y });
    }
  });
  return points;
}
