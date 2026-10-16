import { afterEach, describe, expect, it, vi } from 'vitest';
import { mulberry32 } from './math3d';
import { expectSceneConforms, recordingContext, testContext, type DrawCall } from './testing';
import { create } from './tunnel';

function frame(scene: ReturnType<typeof create>): DrawCall[] {
  const { ctx, calls } = recordingContext();
  scene.draw(ctx);
  return calls;
}

const count = (calls: DrawCall[], name: string): number => calls.filter((c) => c.name === name).length;

afterEach(() => vi.restoreAllMocks());

describe('scène Tunnel néon', () => {
  it('respecte le contrat des scènes', () => {
    expectSceneConforms(create);
  });

  it('efface tout le canevas, dessine la grille en lignes puis le JC en polygones pleins', () => {
    const scene = create(testContext({ width: 640, height: 360 }));
    scene.step(500);
    const calls = frame(scene);
    expect(calls.find((c) => c.name === 'fillRect')).toMatchObject({ args: [0, 0, 640, 360] });
    expect(count(calls, 'lineTo')).toBeGreaterThan(100);
    expect(count(calls, 'lineTo')).toBeLessThan(2000);
    expect(count(calls, 'stroke')).toBeGreaterThan(10);
    // Les deux lettres (face avant) sont des polygones remplis.
    expect(count(calls, 'fill')).toBeGreaterThanOrEqual(2);
    scene.resize(200, 100);
    expect(frame(scene).find((c) => c.name === 'fillRect')).toMatchObject({ args: [0, 0, 200, 100] });
  });

  it('avance dans le tunnel : l’image change avec le temps mais reste identique à temps égal', () => {
    const scene = create(testContext());
    scene.step(300);
    const a = JSON.stringify(frame(scene));
    expect(JSON.stringify(frame(scene))).toBe(a);
    scene.step(400);
    expect(JSON.stringify(frame(scene))).not.toBe(a);
  });

  it('n’utilise jamais Math.random ni Date.now : tout l’aléatoire passe par context.rng', () => {
    vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random interdit');
    });
    vi.spyOn(Date, 'now').mockImplementation(() => {
      throw new Error('Date.now interdit');
    });
    const run = (seed: number): string => {
      const scene = create(testContext({ rng: mulberry32(seed) }));
      for (let i = 0; i < 40; i++) scene.step(50);
      return JSON.stringify(frame(scene));
    };
    expect(run(1)).toBe(run(1));
    expect(run(1)).not.toBe(run(2));
  });
});
