import { describe, expect, it } from 'vitest';
import { createScene, mulberry32, resize, step, type Scene } from './physics';

const make = (w = 800, h = 600): Scene => createScene(w, h, mulberry32(42));
const place = (s: Scene, x: number, y: number, vx: number, vy: number) => {
  Object.assign(s.badge, { x, y, vx, vy });
};

describe('createScene', () => {
  it('est déterministe pour un même générateur', () => {
    expect(createScene(800, 600, mulberry32(7))).toEqual(createScene(800, 600, mulberry32(7)));
  });

  it('place le badge et les étoiles dans la scène', () => {
    const s = make();
    expect(s.badge.x).toBeGreaterThanOrEqual(0);
    expect(s.badge.x + s.badge.w).toBeLessThanOrEqual(800);
    expect(s.badge.y + s.badge.h).toBeLessThanOrEqual(600);
    expect(s.badge.vx).not.toBe(0);
    expect(s.badge.vy).not.toBe(0);
    expect(s.stars.length).toBeGreaterThan(10);
    for (const st of s.stars) {
      expect(st.x).toBeGreaterThanOrEqual(0);
      expect(st.x).toBeLessThan(800);
      expect(st.y).toBeGreaterThanOrEqual(0);
      expect(st.y).toBeLessThan(600);
      expect(st.vx).toBeLessThan(0);
    }
  });

  it('supporte une très petite fenêtre', () => {
    const s = createScene(20, 20, mulberry32(1));
    expect(s.badge.w).toBeLessThanOrEqual(20);
    expect(s.badge.x).toBeGreaterThanOrEqual(0);
  });
});

describe('step : rebonds', () => {
  it('avance à vitesse constante sans obstacle', () => {
    const s = make();
    place(s, 100, 100, 0.1, 0.05);
    step(s, 100);
    expect(s.badge.x).toBeCloseTo(110);
    expect(s.badge.y).toBeCloseTo(105);
  });

  it('rebondit sur le mur droit', () => {
    const s = make();
    const max = 800 - s.badge.w;
    place(s, max - 5, 100, 0.1, 0);
    step(s, 100); // +10 => 5 de dépassement
    expect(s.badge.x).toBeCloseTo(max - 5);
    expect(s.badge.vx).toBeCloseTo(-0.1);
  });

  it('rebondit sur le mur gauche', () => {
    const s = make();
    place(s, 5, 100, -0.1, 0);
    step(s, 100);
    expect(s.badge.x).toBeCloseTo(5);
    expect(s.badge.vx).toBeCloseTo(0.1);
  });

  it('rebondit sur le mur du bas', () => {
    const s = make();
    const max = 600 - s.badge.h;
    place(s, 100, max - 2, 0, 0.1);
    step(s, 100);
    expect(s.badge.y).toBeCloseTo(max - 8);
    expect(s.badge.vy).toBeCloseTo(-0.1);
  });

  it('rebondit sur le mur du haut', () => {
    const s = make();
    place(s, 100, 3, 0, -0.1);
    step(s, 100);
    expect(s.badge.y).toBeCloseTo(7);
    expect(s.badge.vy).toBeCloseTo(0.1);
  });

  it('rebondit dans un coin sur les deux axes', () => {
    const s = make();
    const mx = 800 - s.badge.w;
    const my = 600 - s.badge.h;
    place(s, mx - 1, my - 1, 0.1, 0.1);
    step(s, 100);
    expect(s.badge.vx).toBeCloseTo(-0.1);
    expect(s.badge.vy).toBeCloseTo(-0.1);
    expect(s.badge.x).toBeCloseTo(mx - 9);
    expect(s.badge.y).toBeCloseTo(my - 9);
  });

  it('reste dans les bornes avec un très grand pas de temps', () => {
    const s = make();
    place(s, 100, 100, 0.13, 0.07);
    for (const dt of [5000, 123456, 99999]) {
      step(s, dt);
      expect(s.badge.x).toBeGreaterThanOrEqual(0);
      expect(s.badge.x).toBeLessThanOrEqual(800 - s.badge.w);
      expect(s.badge.y).toBeGreaterThanOrEqual(0);
      expect(s.badge.y).toBeLessThanOrEqual(600 - s.badge.h);
      expect(Math.hypot(s.badge.vx, s.badge.vy)).toBeCloseTo(Math.hypot(0.13, 0.07));
    }
  });

  it('ignore un dt nul, négatif ou non fini', () => {
    const s = make();
    const before = structuredClone(s);
    step(s, 0);
    step(s, -10);
    step(s, Number.NaN);
    expect(s).toEqual(before);
  });
});

describe('step : indépendance du pas de temps', () => {
  it('deux demi-pas ≈ un pas complet, rebonds compris', () => {
    for (const dt of [16, 250, 3000, 20000]) {
      const a = make();
      const b = make();
      step(a, dt);
      step(b, dt / 2);
      step(b, dt / 2);
      expect(b.badge.x).toBeCloseTo(a.badge.x, 6);
      expect(b.badge.y).toBeCloseTo(a.badge.y, 6);
      expect(b.badge.vx).toBeCloseTo(a.badge.vx, 6);
      expect(b.badge.vy).toBeCloseTo(a.badge.vy, 6);
      for (let i = 0; i < a.stars.length; i++) {
        expect(b.stars[i]!.x).toBeCloseTo(a.stars[i]!.x, 6);
      }
    }
  });
});

describe('step : étoiles', () => {
  it('dérivent vers la gauche', () => {
    const s = make();
    const st = s.stars[0]!;
    st.x = 400;
    st.vx = -0.01;
    step(s, 1000);
    expect(st.x).toBeCloseTo(390);
  });

  it('reviennent par la droite (wraparound)', () => {
    const s = make();
    const st = s.stars[0]!;
    st.x = 2;
    st.vx = -0.01;
    step(s, 1000); // -10 => -8 => 792
    expect(st.x).toBeCloseTo(792);
    for (const e of s.stars) {
      expect(e.x).toBeGreaterThanOrEqual(0);
      expect(e.x).toBeLessThan(800);
    }
  });

  it('wrap après de très longues durées', () => {
    const s = make();
    step(s, 10_000_000);
    for (const e of s.stars) {
      expect(e.x).toBeGreaterThanOrEqual(0);
      expect(e.x).toBeLessThan(800);
    }
  });
});

describe('resize', () => {
  it('ramène un badge hors-champ à l intérieur', () => {
    const s = make(1000, 800);
    place(s, 900, 700, 0.1, 0.1);
    resize(s, 400, 300);
    expect(s.width).toBe(400);
    expect(s.height).toBe(300);
    expect(s.badge.x + s.badge.w).toBeLessThanOrEqual(400);
    expect(s.badge.y + s.badge.h).toBeLessThanOrEqual(300);
    expect(s.badge.x).toBeGreaterThanOrEqual(0);
  });

  it('garde les étoiles dans la nouvelle fenêtre', () => {
    const s = make(1000, 800);
    resize(s, 300, 200);
    for (const e of s.stars) {
      expect(e.x).toBeGreaterThanOrEqual(0);
      expect(e.x).toBeLessThan(300);
      expect(e.y).toBeGreaterThanOrEqual(0);
      expect(e.y).toBeLessThan(200);
    }
  });

  it('réduit le badge si la fenêtre est plus petite que lui', () => {
    const s = make(800, 600);
    resize(s, 30, 30);
    expect(s.badge.w).toBeLessThanOrEqual(30);
    expect(s.badge.h).toBeLessThanOrEqual(30);
    expect(s.badge.x).toBeGreaterThanOrEqual(0);
  });

  it('ne touche pas à la direction du badge', () => {
    const s = make();
    place(s, 10, 10, -0.1, 0.1);
    resize(s, 700, 500);
    expect(s.badge.vx).toBe(-0.1);
    expect(s.badge.vy).toBe(0.1);
  });
});
