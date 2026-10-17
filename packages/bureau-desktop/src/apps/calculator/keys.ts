import type { Action } from './engine';

/** Touche du clavier (`event.key`) vers action de la calculatrice ; `null` : la touche n'est pas pour nous. */
export function actionForKey(key: string): Action | null {
  if (key.length === 1 && key >= '0' && key <= '9') return { type: 'digit', digit: Number(key) };
  switch (key) {
    case '.':
    case ',':
      return { type: 'decimal' };
    case '+':
    case '-':
    case '*':
    case '/':
      return { type: 'op', op: key };
    case 'Enter':
    case '=':
      return { type: 'equals' };
    case 'Backspace':
      return { type: 'backspace' };
    case 'Escape':
      return { type: 'clear' };
    case 'Delete':
      return { type: 'clearEntry' };
    case '%':
      return { type: 'percent' };
    case '@':
      return { type: 'sqrt' };
    case 'r':
      return { type: 'reciprocal' };
    default:
      return null;
  }
}
