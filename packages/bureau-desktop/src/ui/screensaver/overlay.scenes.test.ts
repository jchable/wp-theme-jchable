import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createScreensaver } from './overlay';
import { mulberry32 } from './scenes/math3d';
import { DEFAULT_COLORS, type Scene, type SceneContext, type SceneFactory, type SceneId } from './scenes/types';

interface Call {
  name: string;
  args: unknown[];
}

function fakeContext() {
  const calls: Call[] = [];
  const target: Record<string, unknown> = {};
  const ctx = new Proxy(target, {
    get(t, prop: string) {
      if (prop in t) return t[prop];
      return (...args: unknown[]) => {
        calls.push({ name: prop, args });
        if (prop === 'createLinearGradient') return { addColorStop: () => undefined };
        return undefined;
      };
    },
    set(t, prop: string, value) {
      t[prop] = value;
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

const overlay = () => document.querySelector<HTMLElement>('.bscr-overlay');
const flush = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

describe('createScreensaver : scènes 3D', () => {
  let rec: ReturnType<typeof fakeContext>;
  let frames: Array<(t: number) => void>;
  let requestFrame: ReturnType<typeof vi.fn>;
  let created: SceneContext[];
  let log: string[];
  let factory: SceneFactory;
  let loadScene: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    rec = fakeContext();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => rec.ctx) as never);
    frames = [];
    requestFrame = vi.fn((cb: (t: number) => void) => frames.push(cb));
    created = [];
    log = [];
    factory = (context) => {
      created.push(context);
      const scene: Scene = {
        step: (dt) => void log.push(`step:${dt}`),
        draw: (ctx) => {
          log.push('draw');
          ctx.fillRect(0, 0, 1, 1);
        },
        resize: (w, h) => void log.push(`resize:${w}x${h}`),
      };
      return scene;
    };
    loadScene = vi.fn(async (id: SceneId) => {
      void id;
      return factory;
    });
  });
  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const context = (): SceneContext => ({
    width: 0,
    height: 0,
    rng: mulberry32(1),
    colors: DEFAULT_COLORS,
    titles: ['Un article'],
    siteName: 'Site',
    lang: 'fr',
  });

  const make = (options: { reduced?: boolean; scene?: () => SceneId } = {}) =>
    createScreensaver({
      reducedMotion: () => Boolean(options.reduced),
      requestFrame: requestFrame as never,
      cancelFrame: vi.fn() as never,
      scene: options.scene ?? (() => 'planet'),
      loadScene: loadScene as never,
      context,
    });

  it('charge la scène choisie, la crée aux dimensions de la fenêtre puis l anime', async () => {
    const s = make();
    s.start();
    expect(overlay()).not.toBeNull();
    expect(loadScene).toHaveBeenCalledWith('planet');
    await flush();
    expect(created).toHaveLength(1);
    expect(created[0]!.width).toBe(window.innerWidth);
    expect(created[0]!.height).toBe(window.innerHeight);
    expect(created[0]!.titles).toEqual(['Un article']);
    frames.shift()!(1000);
    frames.shift()!(1016);
    expect(log).toContain('step:16');
    expect(log.filter((entry) => entry === 'draw').length).toBeGreaterThanOrEqual(2);
    s.stop();
  });

  it('start(id) prend le dessus sur la préférence (aperçu)', async () => {
    const s = make();
    s.start('voxel');
    expect(loadScene).toHaveBeenCalledWith('voxel');
    s.stop();
  });

  it('pendant le chargement : fond bleu seulement, sans erreur', () => {
    const s = make();
    s.start();
    expect(rec.calls.some((c) => c.name === 'fillRect')).toBe(true);
    expect(created).toHaveLength(0);
    s.stop();
  });

  it('un stop() avant la fin du chargement ne crée rien', async () => {
    const s = make();
    s.start();
    s.stop();
    await flush();
    expect(created).toHaveLength(0);
    expect(overlay()).toBeNull();
  });

  it('un redémarrage ignore le chargement de l ancienne scène', async () => {
    let release: (f: SceneFactory) => void = () => undefined;
    loadScene.mockImplementationOnce(() => new Promise<SceneFactory>((resolve) => (release = resolve)));
    const s = make();
    s.start('tunnel');
    s.stop();
    s.start('graph');
    await flush();
    release(factory);
    await flush();
    expect(created).toHaveLength(1);
    s.stop();
  });

  it('suit le redimensionnement de la fenêtre', async () => {
    const s = make();
    s.start();
    await flush();
    vi.stubGlobal('innerWidth', 500);
    vi.stubGlobal('innerHeight', 300);
    window.dispatchEvent(new Event('resize'));
    expect(log).toContain('resize:500x300');
    s.stop();
  });

  it('mouvement réduit : une seule image de la scène, pas de boucle', async () => {
    const s = make({ reduced: true });
    s.start();
    await flush();
    expect(requestFrame).not.toHaveBeenCalled();
    expect(log.filter((entry) => entry === 'draw')).toHaveLength(1);
    s.stop();
  });

  it('une scène qui ne se charge pas retombe sur le badge JC', async () => {
    loadScene.mockRejectedValueOnce(new Error('réseau'));
    const s = make();
    s.start();
    await flush();
    expect(rec.calls.some((c) => c.name === 'fillText' && c.args[0] === 'JC')).toBe(true);
    s.stop();
  });

  it('une scène qui plante en dessinant retombe sur le badge JC', async () => {
    factory = () => ({
      step: () => undefined,
      draw: () => {
        throw new Error('bug');
      },
      resize: () => undefined,
    });
    const s = make();
    s.start();
    await flush();
    expect(rec.calls.some((c) => c.name === 'fillText' && c.args[0] === 'JC')).toBe(true);
    expect(s.isRunning()).toBe(true);
    s.stop();
  });

  it('sans contexte 2D, ne télécharge pas de scène et ne boucle pas pour rien', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => null) as never);
    const s = make();
    expect(() => s.start()).not.toThrow();
    expect(loadScene).not.toHaveBeenCalled();
    expect(requestFrame).not.toHaveBeenCalled();
    s.stop();
  });

  it('la scène « classic » reste synchrone et ne charge rien', () => {
    const s = make({ scene: () => 'classic' });
    s.start();
    expect(loadScene).not.toHaveBeenCalled();
    expect(rec.calls.some((c) => c.name === 'fillText' && c.args[0] === 'JC')).toBe(true);
    s.stop();
  });
});
