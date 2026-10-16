import { describe, expect, it, vi } from 'vitest';
import { mulberry32 } from './math3d';
import { create } from './planet';
import { expectSceneConforms, recordingContext, testContext, type DrawCall } from './testing';

function frame(scene: ReturnType<typeof create>): DrawCall[] {
  const { ctx, calls } = recordingContext();
  scene.draw(ctx);
  return calls;
}

describe('scène Planète de code', () => {
  it('respecte le contrat des scènes', () => {
    expectSceneConforms(create);
  });

  it('dessine des glyphes avec fillText', () => {
    const calls = frame(create(testContext()));
    const texts = calls.filter((c) => c.name === 'fillText');
    expect(texts.length).toBeGreaterThan(100);
    expect(texts.some((c) => typeof c.args[0] === 'string' && (c.args[0] as string).length > 0)).toBe(true);
  });

  it('écrit le nom du site et les étiquettes des satellites', () => {
    const scene = create(testContext({ siteName: 'Mon Site' }));
    const texts = frame(scene).filter((c) => c.name === 'fillText').map((c) => c.args[0]);
    expect(texts).toContain('Mon Site');
    expect(texts.some((t) => typeof t === 'string' && t.startsWith('.'))).toBe(true);
  });

  it('borne le nombre de fillText par image', () => {
    for (const [width, height] of [[320, 240], [800, 600], [1920, 1080]] as const) {
      const scene = create(testContext({ width, height }));
      for (let i = 0; i < 60; i++) {
        scene.step(100);
        const n = frame(scene).filter((c) => c.name === 'fillText').length;
        expect(n).toBeLessThanOrEqual(900);
      }
    }
  });

  it('redessine le fond complet à chaque image', () => {
    const calls = frame(create(testContext()));
    const rects = calls.filter((c) => c.name === 'fillRect');
    expect(rects.some((c) => c.args[0] === 0 && c.args[1] === 0 && c.args[2] === 800 && c.args[3] === 600)).toBe(true);
  });

  it('la rotation fait changer l’image entre deux instants', () => {
    const scene = create(testContext());
    const before = JSON.stringify(frame(scene));
    scene.step(100);
    scene.step(100);
    scene.step(100);
    expect(JSON.stringify(frame(scene))).not.toBe(before);
  });

  it('resize met à jour les dimensions du fond', () => {
    const scene = create(testContext());
    scene.resize(500, 300);
    const rects = frame(scene).filter((c) => c.name === 'fillRect');
    expect(rects.some((c) => c.args[2] === 500 && c.args[3] === 300)).toBe(true);
  });

  it('n’envoie jamais de taille de police nulle ou négative', () => {
    for (const [width, height] of [[1, 1], [3, 2], [800, 600]] as const) {
      const scene = create(testContext({ width, height }));
      const fonts: string[] = [];
      const { ctx } = recordingContext();
      const spy = new Proxy(ctx, {
        set(target, prop, value) {
          if (prop === 'font') fonts.push(String(value));
          (target as unknown as Record<string | symbol, unknown>)[prop] = value;
          return true;
        },
      });
      for (let i = 0; i < 5; i++) {
        scene.step(50);
        scene.draw(spy);
      }
      for (const font of fonts) {
        const size = Number(/(-?[\d.]+(?:e-?\d+)?)px/.exec(font)?.[1]);
        expect(size, font).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('tout l’aléatoire passe par context.rng', () => {
    const random = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random interdit');
    });
    const now = vi.spyOn(Date, 'now').mockImplementation(() => {
      throw new Error('Date.now interdit');
    });
    try {
      let calls = 0;
      const base = mulberry32(3);
      const rng = (): number => {
        calls++;
        return base();
      };
      const scene = create(testContext({ rng }));
      scene.step(16);
      frame(scene);
      expect(calls).toBeGreaterThan(0);

      // Deux graines différentes donnent deux ciels différents.
      const a = JSON.stringify(frame(create(testContext({ rng: mulberry32(1) }))));
      const b = JSON.stringify(frame(create(testContext({ rng: mulberry32(2) }))));
      expect(a).not.toBe(b);
    } finally {
      random.mockRestore();
      now.mockRestore();
    }
  });
});
