import { describe, expect, it } from 'vitest';
import { actionForKey } from './keys';

describe('actionForKey', () => {
  it('les chiffres', () => {
    for (let d = 0; d <= 9; d++) expect(actionForKey(String(d))).toEqual({ type: 'digit', digit: d });
  });
  it('point et virgule donnent la même touche décimale', () => {
    expect(actionForKey('.')).toEqual({ type: 'decimal' });
    expect(actionForKey(',')).toEqual({ type: 'decimal' });
  });
  it('les quatre opérations', () => {
    expect(actionForKey('+')).toEqual({ type: 'op', op: '+' });
    expect(actionForKey('-')).toEqual({ type: 'op', op: '-' });
    expect(actionForKey('*')).toEqual({ type: 'op', op: '*' });
    expect(actionForKey('/')).toEqual({ type: 'op', op: '/' });
  });
  it('Entrée et = calculent', () => {
    expect(actionForKey('Enter')).toEqual({ type: 'equals' });
    expect(actionForKey('=')).toEqual({ type: 'equals' });
  });
  it('effacements', () => {
    expect(actionForKey('Backspace')).toEqual({ type: 'backspace' });
    expect(actionForKey('Escape')).toEqual({ type: 'clear' });
    expect(actionForKey('Delete')).toEqual({ type: 'clearEntry' });
  });
  it('%, @ (racine, comme Windows) et r (inverse)', () => {
    expect(actionForKey('%')).toEqual({ type: 'percent' });
    expect(actionForKey('@')).toEqual({ type: 'sqrt' });
    expect(actionForKey('r')).toEqual({ type: 'reciprocal' });
  });
  it('les autres touches sont laissées au navigateur', () => {
    for (const key of ['a', 'Tab', ' ', 'ArrowLeft', 'F5', 'Shift', 'x']) expect(actionForKey(key)).toBeNull();
  });
});
