import { afterEach, describe, expect, it, vi } from 'vitest';
import { mulberry32 } from './math3d';
import { expectSceneConforms, recordingContext, testContext } from './testing';
import type { Scene, SceneContext } from './types';
import { create } from './voxel';

/** Contexte factice qui note, à chaque `fill()`, la couleur de remplissage courante. */
function fillRecorder(): { ctx: CanvasRenderingContext2D; fills: string[]; calls: ReturnType<typeof recordingContext>['calls'] } {
  const { ctx: inner, calls } = recordingContext();
  const fills: string[] = [];
  const ctx = new Proxy(inner, {
    get(target, prop: string) {
      const value = (target as unknown as Record<string, unknown>)[prop];
      if (prop === 'fill' && typeof value === 'function') {
        return (...args: unknown[]) => {
          fills.push(String((target as unknown as Record<string, unknown>).fillStyle));
          return (value as (...a: unknown[]) => unknown)(...args);
        };
      }
      return value;
    },
    set(target, prop: string, value) {
      (target as unknown as Record<string, unknown>)[prop] = value;
      return true;
    },
  });
  return { ctx: ctx as CanvasRenderingContext2D, fills, calls };
}

/** Avance la scène de `seconds` secondes par pas de 50 ms. */
function advance(scene: Scene, seconds: number): void {
  for (let elapsed = 0; elapsed < seconds * 1000 - 1e-6; elapsed += 50) scene.step(50);
}

function frameAt(seconds: number, context: SceneContext = testContext()) {
  const scene = create(context);
  advance(scene, seconds);
  const recorder = fillRecorder();
  scene.draw(recorder.ctx);
  return recorder;
}

afterEach(() => vi.restoreAllMocks());

describe('scène voxel : contrat commun', () => {
  it('respecte le contrat des scènes', () => {
    expectSceneConforms(create);
  });
});

describe('scène voxel : dessin', () => {
  it('dessine un nombre borné de polygones remplis par image, à toutes les tailles', () => {
    for (const [width, height] of [[1, 1], [320, 240], [800, 600], [1920, 1080]] as const) {
      for (const seconds of [0, 5, 12, 25]) {
        const { fills } = frameAt(seconds, testContext({ width, height }));
        expect(fills.length, `${width}×${height} à ${seconds}s`).toBeGreaterThan(50);
        expect(fills.length, `${width}×${height} à ${seconds}s`).toBeLessThanOrEqual(2500);
      }
    }
  });

  it('redessine le fond en entier à chaque image', () => {
    const { calls } = frameAt(1);
    const first = calls.find((c) => c.name === 'fillRect');
    expect(first?.args).toEqual([0, 0, 800, 600]);
  });

  it('l’écran allumé dessine d’autres couleurs que l’écran éteint', () => {
    const off = new Set(frameAt(0).fills);
    const on = new Set(frameAt(5).fills);
    const added = [...on].filter((style) => !off.has(style));
    expect(added.length).toBeGreaterThanOrEqual(3);
  });

  it('le bureau tourne : l’image change avec le temps', () => {
    const a = frameAt(1).calls;
    const b = frameAt(3).calls;
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it('resize met à jour les dimensions du fond', () => {
    const scene = create(testContext());
    scene.resize(640, 360);
    const { ctx, calls } = fillRecorder();
    scene.draw(ctx);
    expect(calls.find((c) => c.name === 'fillRect')?.args).toEqual([0, 0, 640, 360]);
  });
});

describe('scène voxel : déterminisme', () => {
  it('tout l’aléatoire passe par context.rng (ni Math.random ni Date.now)', () => {
    const random = vi.spyOn(Math, 'random');
    const now = vi.spyOn(Date, 'now');
    const rng = vi.fn(mulberry32(3));
    const scene = create(testContext({ rng }));
    advance(scene, 30);
    scene.draw(fillRecorder().ctx);
    expect(rng).toHaveBeenCalled();
    expect(random).not.toHaveBeenCalled();
    expect(now).not.toHaveBeenCalled();
  });

  it('deux graines différentes donnent deux images différentes', () => {
    const a = frameAt(10, testContext({ rng: mulberry32(1) })).calls;
    const b = frameAt(10, testContext({ rng: mulberry32(2) })).calls;
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });
});
