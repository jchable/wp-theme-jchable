import { describe, expect, it } from 'vitest';
import { depthSort, lerp, mulberry32, project, rotateX, rotateY, rotateZ, v3, type Camera } from './math3d';

const CAM: Camera = { width: 800, height: 600, fov: 400, near: 0.1 };
const close = (a: number, b: number): void => expect(Math.abs(a - b)).toBeLessThan(1e-9);

describe('rotations', () => {
  it('rotateY d’un quart de tour envoie +x vers -z', () => {
    const p = rotateY(v3(1, 0, 0), Math.PI / 2);
    close(p.x, 0);
    close(p.z, -1);
  });

  it('rotateX d’un quart de tour envoie +y vers +z', () => {
    const p = rotateX(v3(0, 1, 0), Math.PI / 2);
    close(p.y, 0);
    close(p.z, 1);
  });

  it('rotateZ d’un quart de tour envoie +x vers +y', () => {
    const p = rotateZ(v3(1, 0, 0), Math.PI / 2);
    close(p.x, 0);
    close(p.y, 1);
  });

  it('une rotation conserve la distance à l’origine', () => {
    const p = rotateZ(rotateY(rotateX(v3(1, 2, 3), 0.7), 1.3), -0.4);
    close(Math.hypot(p.x, p.y, p.z), Math.hypot(1, 2, 3));
  });
});

describe('project', () => {
  it('un point sur l’axe est au centre de l’écran', () => {
    const p = project(v3(0, 0, 5), CAM);
    expect(p).not.toBeNull();
    close(p!.x, 400);
    close(p!.y, 300);
  });

  it('plus un point est loin, plus il est petit et proche du centre', () => {
    const near = project(v3(1, 1, 2), CAM)!;
    const far = project(v3(1, 1, 8), CAM)!;
    expect(far.scale).toBeLessThan(near.scale);
    expect(Math.abs(far.x - 400)).toBeLessThan(Math.abs(near.x - 400));
  });

  it('+y est vers le haut de l’écran', () => {
    expect(project(v3(0, 1, 4), CAM)!.y).toBeLessThan(300);
  });

  it('un point derrière la caméra n’est pas projeté', () => {
    expect(project(v3(0, 0, -1), CAM)).toBeNull();
    expect(project(v3(0, 0, 0.05), CAM)).toBeNull();
  });

  it('renvoie la profondeur pour le tri', () => {
    expect(project(v3(0, 0, 7), CAM)!.depth).toBe(7);
  });
});

describe('mulberry32', () => {
  it('est déterministe et reste dans [0, 1[', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it('deux graines donnent deux suites différentes', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
});

describe('lerp et depthSort', () => {
  it('interpole', () => {
    expect(lerp(10, 20, 0)).toBe(10);
    expect(lerp(10, 20, 1)).toBe(20);
    expect(lerp(10, 20, 0.25)).toBe(12.5);
  });

  it('trie du plus loin au plus proche (algorithme du peintre) sans modifier l’original', () => {
    const items = [{ z: 1 }, { z: 9 }, { z: 4 }];
    expect(depthSort(items, (i) => i.z).map((i) => i.z)).toEqual([9, 4, 1]);
    expect(items.map((i) => i.z)).toEqual([1, 9, 4]);
  });
});
