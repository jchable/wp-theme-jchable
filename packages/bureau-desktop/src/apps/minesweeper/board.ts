/** Logique pure du Démineur : aucun accès au DOM, tirage aléatoire injectable. */

export type Rng = () => number;
export type Status = 'ready' | 'playing' | 'won' | 'lost';

export interface Level {
  cols: number;
  rows: number;
  mines: number;
}

export type LevelId = 'beginner' | 'intermediate' | 'expert';

export const LEVELS: Readonly<Record<LevelId, Level>> = {
  beginner: { cols: 9, rows: 9, mines: 10 },
  intermediate: { cols: 16, rows: 16, mines: 40 },
  expert: { cols: 30, rows: 16, mines: 99 },
};

export interface Cell {
  mine: boolean;
  adjacent: number;
  revealed: boolean;
  flagged: boolean;
}

export interface Board {
  readonly cols: number;
  readonly rows: number;
  readonly mines: number;
  cells: Cell[];
  /** Les mines ne sont posées qu'au premier dévoilement. */
  placed: boolean;
  status: Status;
  flags: number;
  revealedCount: number;
  /** Case sur laquelle le joueur a perdu. */
  exploded: number | null;
}

export function createBoard(level: Level): Board {
  const total = level.cols * level.rows;
  const mines = Math.max(0, Math.min(level.mines, total - 1));
  const cells: Cell[] = [];
  for (let i = 0; i < total; i++) {
    cells.push({ mine: false, adjacent: 0, revealed: false, flagged: false });
  }
  return {
    cols: level.cols,
    rows: level.rows,
    mines,
    cells,
    placed: false,
    status: 'ready',
    flags: 0,
    revealedCount: 0,
    exploded: null,
  };
}

export function neighbors(board: Board, index: number): number[] {
  const x = index % board.cols;
  const y = Math.floor(index / board.cols);
  const out: number[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= board.cols || ny >= board.rows) continue;
      out.push(ny * board.cols + nx);
    }
  }
  return out;
}

export function flagsLeft(board: Board): number {
  return board.mines - board.flags;
}

export function isWrongFlag(board: Board, index: number): boolean {
  const c = board.cells[index];
  return board.status === 'lost' && !!c && c.flagged && !c.mine;
}

function placeMines(board: Board, safe: number, rng: Rng): void {
  const total = board.cells.length;
  const around = new Set<number>([safe, ...neighbors(board, safe)]);
  let candidates: number[] = [];
  for (let i = 0; i < total; i++) if (!around.has(i)) candidates.push(i);
  if (candidates.length < board.mines) {
    // Plateau trop dense : on ne protège que la case cliquée.
    candidates = [];
    for (let i = 0; i < total; i++) if (i !== safe) candidates.push(i);
  }
  // Mélange partiel de Fisher-Yates : les `mines` premiers éléments suffisent.
  for (let i = 0; i < board.mines; i++) {
    const r = Math.min(candidates.length - 1 - i, Math.floor(rng() * (candidates.length - i)));
    const j = i + Math.max(0, r);
    const tmp = candidates[i]!;
    candidates[i] = candidates[j]!;
    candidates[j] = tmp;
    board.cells[candidates[i]!]!.mine = true;
  }
  for (let i = 0; i < total; i++) {
    board.cells[i]!.adjacent = neighbors(board, i).filter((n) => board.cells[n]!.mine).length;
  }
  board.placed = true;
}

function finish(board: Board, changed: number[]): void {
  if (board.status !== 'playing') return;
  if (board.revealedCount === board.cells.length - board.mines) {
    board.status = 'won';
    board.cells.forEach((c, i) => {
      if (c.mine && !c.flagged) {
        c.flagged = true;
        board.flags++;
        changed.push(i);
      }
    });
  }
}

function lose(board: Board, index: number, changed: number[]): void {
  board.status = 'lost';
  board.exploded = index;
  board.cells.forEach((c, i) => {
    if (c.mine && !c.flagged && !c.revealed) {
      c.revealed = true;
      changed.push(i);
    }
  });
}

/** Dévoile une case (cascade sur les zéros). Retourne les index modifiés. */
export function reveal(board: Board, index: number, rng: Rng = Math.random): number[] {
  const cell = board.cells[index];
  if (!cell || board.status === 'won' || board.status === 'lost') return [];
  if (cell.flagged || cell.revealed) return [];
  if (!board.placed) {
    placeMines(board, index, rng);
    board.status = 'playing';
  }
  const changed: number[] = [];
  if (cell.mine) {
    cell.revealed = true;
    changed.push(index);
    lose(board, index, changed);
    return changed;
  }
  const stack = [index];
  while (stack.length > 0) {
    const i = stack.pop()!;
    const c = board.cells[i]!;
    if (c.revealed || c.flagged || c.mine) continue;
    c.revealed = true;
    board.revealedCount++;
    changed.push(i);
    if (c.adjacent === 0) stack.push(...neighbors(board, i));
  }
  finish(board, changed);
  return changed;
}

/** Pose ou retire un drapeau. Faux si l'action est impossible. */
export function toggleFlag(board: Board, index: number): boolean {
  const cell = board.cells[index];
  if (!cell || cell.revealed || board.status === 'won' || board.status === 'lost') return false;
  cell.flagged = !cell.flagged;
  board.flags += cell.flagged ? 1 : -1;
  return true;
}

/** Sur un chiffre dont les drapeaux suffisent, dévoile les voisins non marqués. */
export function chord(board: Board, index: number, rng: Rng = Math.random): number[] {
  const cell = board.cells[index];
  if (!cell || !cell.revealed || cell.adjacent === 0 || board.status !== 'playing') return [];
  const around = neighbors(board, index);
  if (around.filter((n) => board.cells[n]!.flagged).length !== cell.adjacent) return [];
  const changed: number[] = [];
  for (const n of around) {
    for (const k of reveal(board, n, rng)) changed.push(k);
  }
  return changed;
}
