/**
 * Pile d'annulation bornée. On y range l'état d'AVANT chaque modification ; annuler rend le dernier état rangé
 * (en gardant l'état courant pour pouvoir rétablir), et toute nouvelle modification efface les états à rétablir.
 */
export interface History<T> {
  /** Range l'état d'avant une modification. */
  push(before: T): void;
  /** Revient en arrière : renvoie l'état à afficher, ou `undefined` s'il n'y en a plus. */
  undo(current: T): T | undefined;
  redo(current: T): T | undefined;
  canUndo(): boolean;
  canRedo(): boolean;
  undoDepth(): number;
  redoDepth(): number;
  clear(): void;
}

export const DEFAULT_HISTORY_LIMIT = 30;

export function createHistory<T>(limit: number = DEFAULT_HISTORY_LIMIT): History<T> {
  let undoStack: T[] = [];
  let redoStack: T[] = [];
  const bounded = (stack: T[]): void => {
    while (stack.length > limit) stack.shift(); // les plus anciens états sont oubliés
  };
  return {
    push(before) {
      undoStack.push(before);
      bounded(undoStack);
      redoStack = [];
    },
    undo(current) {
      const previous = undoStack.pop();
      if (previous === undefined) return undefined;
      redoStack.push(current);
      bounded(redoStack);
      return previous;
    },
    redo(current) {
      const next = redoStack.pop();
      if (next === undefined) return undefined;
      undoStack.push(current);
      bounded(undoStack);
      return next;
    },
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
    undoDepth: () => undoStack.length,
    redoDepth: () => redoStack.length,
    clear() {
      undoStack = [];
      redoStack = [];
    },
  };
}
