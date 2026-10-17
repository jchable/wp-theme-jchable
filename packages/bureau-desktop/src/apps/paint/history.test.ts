import { describe, expect, it } from 'vitest';
import { createHistory } from './history';

describe('pile d’annulation', () => {
  it('annule puis rétablit', () => {
    const h = createHistory<string>(30);
    expect(h.canUndo()).toBe(false);
    expect(h.canRedo()).toBe(false);
    h.push('A'); // état avant le changement vers B
    expect(h.canUndo()).toBe(true);
    expect(h.undo('B')).toBe('A');
    expect(h.canUndo()).toBe(false);
    expect(h.canRedo()).toBe(true);
    expect(h.redo('A')).toBe('B');
    expect(h.canRedo()).toBe(false);
    expect(h.canUndo()).toBe(true);
  });

  it('plusieurs niveaux, dans l’ordre', () => {
    const h = createHistory<number>(30);
    h.push(1);
    h.push(2);
    h.push(3);
    expect(h.undo(4)).toBe(3);
    expect(h.undo(3)).toBe(2);
    expect(h.undo(2)).toBe(1);
    expect(h.undo(1)).toBeUndefined();
    expect(h.redo(1)).toBe(2);
    expect(h.redo(2)).toBe(3);
    expect(h.redo(3)).toBe(4);
    expect(h.redo(4)).toBeUndefined();
  });

  it('un nouveau changement efface la pile de rétablissement', () => {
    const h = createHistory<number>(30);
    h.push(1);
    h.push(2);
    h.undo(3);
    expect(h.canRedo()).toBe(true);
    h.push(2);
    expect(h.canRedo()).toBe(false);
  });

  it('bornée : les plus anciens états sont oubliés', () => {
    const h = createHistory<number>(3);
    for (let i = 1; i <= 10; i++) h.push(i);
    expect(h.undoDepth()).toBe(3);
    expect(h.undo(11)).toBe(10);
    expect(h.undo(10)).toBe(9);
    expect(h.undo(9)).toBe(8);
    expect(h.undo(8)).toBeUndefined();
  });

  it('la pile de rétablissement est bornée aussi', () => {
    const h = createHistory<number>(3);
    for (let i = 1; i <= 3; i++) h.push(i);
    h.undo(4);
    h.undo(3);
    h.undo(2);
    expect(h.redoDepth()).toBe(3);
    for (let i = 0; i < 10; i++) {
      h.undo(i); // rien à annuler
      h.push(i);
      h.undo(i);
    }
    expect(h.redoDepth()).toBeLessThanOrEqual(3);
  });

  it('clear vide tout', () => {
    const h = createHistory<number>(5);
    h.push(1);
    h.undo(2);
    h.clear();
    expect(h.canUndo()).toBe(false);
    expect(h.canRedo()).toBe(false);
  });

  it('limite par défaut : 30 états', () => {
    const h = createHistory<number>();
    for (let i = 0; i < 100; i++) h.push(i);
    expect(h.undoDepth()).toBe(30);
  });
});
