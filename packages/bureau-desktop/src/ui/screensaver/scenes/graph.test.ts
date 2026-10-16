import { describe, expect, it, vi } from 'vitest';
import { mulberry32 } from './math3d';
import { create } from './graph';
import { expectSceneConforms, recordingContext, testContext } from './testing';
import type { SceneContext } from './types';

/** Fait tourner la scène (100 ms par pas) et renvoie tous les textes dessinés sur l'ensemble des images. */
function textsDrawn(context: SceneContext, frames = 200): string[] {
  const scene = create(context);
  const texts = new Set<string>();
  for (let i = 0; i < frames; i++) {
    scene.step(100);
    const { ctx, calls } = recordingContext();
    scene.draw(ctx);
    for (const call of calls) if (call.name === 'fillText') texts.add(String(call.args[0]));
  }
  return [...texts];
}

describe('scène graph', () => {
  expectSceneConforms(create);

  it('les libellés des sujets suivent la langue', () => {
    const fr = textsDrawn(testContext({ lang: 'fr' }));
    const en = textsDrawn(testContext({ lang: 'en' }));
    expect(fr).toContain('Mémoire');
    expect(fr).toContain('Outils');
    expect(fr).not.toContain('Memory');
    expect(fr).not.toContain('Tools');
    expect(en).toContain('Memory');
    expect(en).toContain('Tools');
    expect(en).not.toContain('Mémoire');
    expect(en).not.toContain('Outils');
  });

  it('un titre de context.titles peut apparaître, tronqué avec « … » s’il est long', () => {
    const texts = textsDrawn(testContext({ width: 1920, height: 1080 }));
    expect(texts).toContain('Bloc de code');
    const truncated = texts.filter((t) => t.endsWith('…'));
    expect(truncated.length).toBeGreaterThan(0);
    expect(Math.max(...texts.map((t) => t.length))).toBeLessThanOrEqual(26);
  });

  it('fonctionne sans titres : seuls les sujets sont étiquetés', () => {
    const texts = textsDrawn(testContext({ titles: [] }), 60);
    expect(texts.length).toBeGreaterThan(0);
    const subjects = ['Code', 'Mémoire', 'Agents', 'Docs', 'Outils', 'Web'];
    for (const text of texts) expect(subjects).toContain(text);
  });

  it('le nombre de disques par image reste borné', () => {
    const scene = create(testContext());
    for (let i = 0; i < 100; i++) {
      scene.step(100);
      const { ctx, calls } = recordingContext();
      scene.draw(ctx);
      const arcs = calls.filter((c) => c.name === 'arc').length;
      expect(arcs).toBeGreaterThan(20);
      expect(arcs).toBeLessThanOrEqual(80);
    }
  });

  it('redessine tout le fond à chaque image', () => {
    const scene = create(testContext({ width: 320, height: 240 }));
    scene.step(16);
    const { ctx, calls } = recordingContext();
    scene.draw(ctx);
    const first = calls.find((c) => c.name === 'fillRect');
    expect(first?.args).toEqual([0, 0, 320, 240]);
  });

  it('tout l’aléatoire passe par context.rng', () => {
    const random = vi.spyOn(Math, 'random');
    const now = vi.spyOn(Date, 'now');
    const rng = vi.fn(mulberry32(3));
    const scene = create(testContext({ rng }));
    for (let i = 0; i < 100; i++) scene.step(100);
    scene.draw(recordingContext().ctx);
    expect(rng).toHaveBeenCalled();
    expect(random).not.toHaveBeenCalled();
    expect(now).not.toHaveBeenCalled();
    random.mockRestore();
    now.mockRestore();
  });

  it('une autre graine donne un autre graphe', () => {
    const draw = (seed: number): string => {
      const scene = create(testContext({ rng: mulberry32(seed) }));
      const { ctx, calls } = recordingContext();
      scene.draw(ctx);
      return JSON.stringify(calls);
    };
    expect(draw(1)).not.toBe(draw(2));
  });
});
