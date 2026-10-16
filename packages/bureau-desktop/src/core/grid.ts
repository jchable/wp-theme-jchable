/** Grille invisible sur laquelle les icônes du bureau s'alignent. */

export const CELL_SIZE = 96;

export interface Cell {
  col: number;
  row: number;
}

export const cellKey = (cell: Cell): string => `${cell.col},${cell.row}`;

/** Case la plus proche d'un point (coin haut gauche d'une icône). */
export function pointToCell(x: number, y: number): Cell {
  return { col: Math.max(0, Math.round(x / CELL_SIZE)), row: Math.max(0, Math.round(y / CELL_SIZE)) };
}

export function cellToPoint(cell: Cell): { x: number; y: number } {
  return { x: cell.col * CELL_SIZE, y: cell.row * CELL_SIZE };
}

export function clampCell(cell: Cell, cols: number, rows: number): Cell {
  return {
    col: Math.min(Math.max(cell.col, 0), Math.max(cols - 1, 0)),
    row: Math.min(Math.max(cell.row, 0), Math.max(rows - 1, 0)),
  };
}

/** Case libre la plus proche de la case voulue ; la case voulue (ramenée dans la grille) si tout est plein. */
export function nearestFreeCell(target: Cell, occupied: ReadonlySet<string>, cols: number, rows: number): Cell {
  const start = clampCell(target, cols, rows);
  if (!occupied.has(cellKey(start))) return start;
  const maxDistance = cols + rows;
  for (let d = 1; d <= maxDistance; d++) {
    for (let dy = -d; dy <= d; dy++) {
      const dx = d - Math.abs(dy);
      const candidates = dx === 0 ? [0] : [-dx, dx];
      for (const offset of candidates) {
        const cell = { col: start.col + offset, row: start.row + dy };
        if (cell.col < 0 || cell.row < 0 || cell.col >= cols || cell.row >= rows) continue;
        if (!occupied.has(cellKey(cell))) return cell;
      }
    }
  }
  return start;
}

/**
 * Place toutes les icônes : celles qui ont une position enregistrée la gardent (ramenée dans la grille
 * si l'écran a rétréci, décalée si la case est prise), les autres se rangent en colonnes de haut en bas.
 */
export function layoutIcons(
  ids: readonly string[],
  saved: Readonly<Record<string, Cell | undefined>>,
  cols: number,
  rows: number,
): Record<string, Cell> {
  const placed: Record<string, Cell> = {};
  const occupied = new Set<string>();

  for (const id of ids) {
    const wanted = saved[id];
    if (!wanted) continue;
    const cell = nearestFreeCell(wanted, occupied, cols, rows);
    placed[id] = cell;
    occupied.add(cellKey(cell));
  }

  let col = 0;
  let row = 0;
  for (const id of ids) {
    if (placed[id]) continue;
    while (occupied.has(cellKey({ col, row })) && col < cols) {
      row += 1;
      if (row >= rows) {
        row = 0;
        col += 1;
      }
    }
    const cell = clampCell({ col, row }, cols, rows);
    const free = nearestFreeCell(cell, occupied, cols, rows);
    placed[id] = free;
    occupied.add(cellKey(free));
  }
  return placed;
}
