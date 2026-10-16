import { describe, expect, it } from 'vitest';
import { WindowStack, clampPosition, fitBox } from './windowStack';

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

describe('fitBox', () => {
  it('ramène une fenêtre qui sort de l’écran quand le navigateur rétrécit', () => {
    const got = fitBox({ x: 1298, y: 400, w: 700, h: 520 }, { w: 1000, h: 700 }, 56);
    expect(got.x).toBeLessThanOrEqual(1000 - 56);
    expect(got.w).toBeLessThanOrEqual(1000 - 24);
    expect(got.h).toBeLessThanOrEqual(700 - 24);
  });

  it('laisse intacte une fenêtre qui tient', () => {
    expect(fitBox({ x: 100, y: 80, w: 400, h: 300 }, { w: 1000, h: 700 }, 56)).toEqual({ x: 100, y: 80, w: 400, h: 300 });
  });

  it('ne renvoie jamais une taille négative sur un écran minuscule', () => {
    const got = fitBox({ x: 0, y: 0, w: 700, h: 500 }, { w: 20, h: 10 }, 56);
    expect(got.w).toBeGreaterThan(0);
    expect(got.h).toBeGreaterThan(0);
  });
});

describe('clampPosition : la bande d’icônes reste libre', () => {
  it('une fenêtre ne passe jamais à gauche de la limite donnée', () => {
    const got = clampPosition({ x: -300, y: 50 }, { w: 400, h: 300 }, { w: 1000, h: 800 }, 40, 230);
    expect(got.x).toBe(230);
  });

  it('sans limite, le comportement d’avant est inchangé', () => {
    expect(clampPosition({ x: -500, y: 0 }, { w: 400, h: 300 }, { w: 1000, h: 800 }, 40).x).toBe(-360);
  });

  it('fitBox respecte aussi la limite', () => {
    expect(fitBox({ x: 10, y: 10, w: 400, h: 300 }, { w: 1000, h: 700 }, 56, 230).x).toBe(230);
  });
});
