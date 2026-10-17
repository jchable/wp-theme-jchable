import { getPixel, inBounds, sameColor, type RGBA, type Raster } from './raster';

/**
 * Remplissage par balayage de lignes, itératif : une pile de segments à visiter, jamais de récursion,
 * donc aucun dépassement de pile même sur une grande image. Tolérance 0 : seuls les pixels exactement
 * de la couleur de départ sont remplis, et chacun l'est une seule fois (le travail est borné par la taille
 * de l'image). Renvoie le nombre de pixels peints.
 */
export function floodFill(r: Raster, startX: number, startY: number, color: RGBA): number {
  const sx = Math.floor(startX);
  const sy = Math.floor(startY);
  if (!inBounds(r, sx, sy)) return 0;
  const target = getPixel(r, sx, sy)!;
  if (sameColor(target, color)) return 0;

  const { width, height, data } = r;
  const matches = (x: number, y: number): boolean => {
    const i = (y * width + x) * 4;
    return data[i] === target[0] && data[i + 1] === target[1] && data[i + 2] === target[2] && data[i + 3] === target[3];
  };
  const paint = (x: number, y: number): void => {
    const i = (y * width + x) * 4;
    data[i] = color[0];
    data[i + 1] = color[1];
    data[i + 2] = color[2];
    data[i + 3] = color[3];
  };

  let painted = 0;
  const stack: number[] = [sx, sy];
  while (stack.length > 0) {
    const y = stack.pop()!;
    let x = stack.pop()!;
    if (!matches(x, y)) continue; // déjà peint par un balayage voisin
    while (x > 0 && matches(x - 1, y)) x--; // jusqu'au bord gauche de la plage
    let above = false;
    let below = false;
    while (x < width && matches(x, y)) {
      paint(x, y);
      painted++;
      // Une seule graine par plage contiguë de la ligne du dessus et de celle du dessous.
      if (y > 0) {
        const open = matches(x, y - 1);
        if (open && !above) stack.push(x, y - 1);
        above = open;
      }
      if (y < height - 1) {
        const open = matches(x, y + 1);
        if (open && !below) stack.push(x, y + 1);
        below = open;
      }
      x++;
    }
  }
  return painted;
}
