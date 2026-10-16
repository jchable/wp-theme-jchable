import { describe, expect, it } from 'vitest';
import { WindowStack, clampPosition } from './windowStack';

describe('WindowStack', () => {
  it('ouvre au premier plan et attribue des z-index croissants', () => {
    const stack = new WindowStack(100);
    stack.open('a');
    stack.open('b');
    expect(stack.top()).toBe('b');
    expect(stack.zIndex('a')).toBeLessThan(stack.zIndex('b'));
  });

  it('ramène une fenêtre au premier plan', () => {
    const stack = new WindowStack(100);
    stack.open('a');
    stack.open('b');
    stack.bringToFront('a');
    expect(stack.top()).toBe('a');
    expect(stack.order()).toEqual(['b', 'a']);
  });

  it('ouvrir une fenêtre déjà ouverte la ramène devant sans doublon', () => {
    const stack = new WindowStack(100);
    stack.open('a');
    stack.open('b');
    stack.open('a');
    expect(stack.order()).toEqual(['b', 'a']);
  });

  it('retire une fenêtre et désigne la suivante', () => {
    const stack = new WindowStack(100);
    stack.open('a');
    stack.open('b');
    stack.close('b');
    expect(stack.top()).toBe('a');
    expect(stack.has('b')).toBe(false);
  });

  it('ignore les fenêtres réduites pour trouver celle du dessus', () => {
    const stack = new WindowStack(100);
    stack.open('a');
    stack.open('b');
    stack.setMinimized('b', true);
    expect(stack.top()).toBe('a');
    stack.setMinimized('b', false);
    expect(stack.top()).toBe('b');
  });

  it('renvoie undefined sans fenêtre', () => {
    expect(new WindowStack(100).top()).toBeUndefined();
  });

  it('ne plante pas sur un identifiant inconnu', () => {
    const stack = new WindowStack(100);
    expect(() => stack.bringToFront('x')).not.toThrow();
    expect(() => stack.close('x')).not.toThrow();
    expect(stack.zIndex('x')).toBe(100);
  });
});

describe('clampPosition', () => {
  it('garde la fenêtre dans la zone visible', () => {
    expect(clampPosition({ x: -500, y: -500 }, { w: 400, h: 300 }, { w: 1000, h: 800 }, 40)).toEqual({ x: -360, y: 0 });
    expect(clampPosition({ x: 5000, y: 5000 }, { w: 400, h: 300 }, { w: 1000, h: 800 }, 40)).toEqual({ x: 960, y: 760 });
  });

  it('laisse intacte une position valide', () => {
    expect(clampPosition({ x: 100, y: 120 }, { w: 400, h: 300 }, { w: 1000, h: 800 }, 40)).toEqual({ x: 100, y: 120 });
  });

  it('gère une zone plus petite que la fenêtre', () => {
    const got = clampPosition({ x: 300, y: 300 }, { w: 400, h: 300 }, { w: 200, h: 100 }, 40);
    expect(got.x).toBeLessThanOrEqual(160);
    expect(got.y).toBeLessThanOrEqual(60);
  });
});
