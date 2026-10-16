/** Aides de test partagées par les scènes d'écran de veille (n'est pas chargé en production). */
import { expect } from 'vitest';
import { mulberry32 } from './math3d';
import { DEFAULT_COLORS, type Scene, type SceneContext, type SceneFactory } from './types';

export interface DrawCall {
  name: string;
  args: unknown[];
}

/** Un contexte 2D factice : enregistre chaque appel de dessin (jsdom n'a pas de canevas). */
export function recordingContext(): { ctx: CanvasRenderingContext2D; calls: DrawCall[] } {
  const calls: DrawCall[] = [];
  const state: Record<string, unknown> = {};
  const ctx = new Proxy(state, {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      return (...args: unknown[]) => {
        calls.push({ name: prop, args });
        if (prop === 'createLinearGradient' || prop === 'createRadialGradient' || prop === 'createConicGradient') {
          return { addColorStop: () => undefined };
        }
        if (prop === 'measureText') return { width: String(args[0] ?? '').length * 7 };
        return undefined;
      };
    },
    set(target, prop: string, value) {
      target[prop] = value;
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

export function testContext(overrides: Partial<SceneContext> = {}): SceneContext {
  return {
    width: 800,
    height: 600,
    rng: mulberry32(7),
    colors: DEFAULT_COLORS,
    titles: [
      'A folder of markdown you can actually browse',
      'OKF4net 0.6.0: two months, 642 commits',
      'OKF4net agent memory you can git blame',
      'Un titre très long avec un mot interminable',
      'Bloc de code',
    ],
    siteName: 'Julien Chable',
    lang: 'fr',
    ...overrides,
  };
}

function numbersIn(value: unknown, out: number[] = []): number[] {
  if (typeof value === 'number') out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => numbersIn(item, out));
  return out;
}

function run(scene: Scene, frames: number): DrawCall[] {
  const { ctx, calls } = recordingContext();
  for (let i = 0; i < frames; i++) {
    scene.step(16);
    if (i % 10 === 0) scene.draw(ctx);
  }
  return calls;
}

/**
 * Vérifications communes à toute scène : elle tourne sans erreur à toutes les tailles (même minuscules),
 * dessine quelque chose, n'envoie jamais de valeur absurde au canevas (NaN, infini) et est déterministe.
 */
export function expectSceneConforms(create: SceneFactory): void {
  for (const [width, height] of [[1, 1], [320, 240], [800, 600], [1920, 1080]] as const) {
    const scene = create(testContext({ width, height }));
    const calls = run(scene, 120);
    expect(calls.length, `${width}×${height} : la scène doit dessiner`).toBeGreaterThan(0);
    for (const call of calls) {
      for (const n of numbersIn(call.args)) {
        expect(Number.isFinite(n), `${width}×${height} : ${call.name} a reçu ${n}`).toBe(true);
      }
    }
  }

  const a = run(create(testContext()), 90);
  const b = run(create(testContext()), 90);
  expect(JSON.stringify(a)).toBe(JSON.stringify(b));

  const scene = create(testContext());
  run(scene, 20);
  scene.resize(500, 300);
  scene.step(0);
  scene.step(100);
  const { ctx, calls } = recordingContext();
  scene.draw(ctx);
  expect(calls.length).toBeGreaterThan(0);
  scene.resize(1, 1);
  scene.draw(ctx);
}
