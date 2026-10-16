import './style.css';
import { t } from './i18n';
import { readSceneContext } from './scenes/context';
import { DEFAULT_SCENE } from './scenes/catalog';
import { loadScene as defaultLoadScene } from './scenes/loader';
import type { SceneContext, SceneFactory, SceneId } from './scenes/types';

export interface ScreensaverOptions {
  reducedMotion?: () => boolean;
  requestFrame?: (cb: (time: number) => void) => number;
  cancelFrame?: (handle: number) => void;
  /** L'écran de veille choisi par le visiteur (le tunnel néon si absent). */
  scene?: () => SceneId;
  /** Charge une scène 3D à la demande. */
  loadScene?: (id: SceneId) => Promise<SceneFactory>;
  /** Le contexte d'une scène (titres, couleurs, langue) ; les dimensions sont ajoutées par l'écran de veille. */
  context?: () => SceneContext;
}

export interface Screensaver {
  /** Lance l'écran de veille ; `sceneId` (aperçu) l'emporte sur le choix du visiteur. */
  start(sceneId?: SceneId): void;
  stop(): void;
  isRunning(): boolean;
  destroy(): void;
}

/** Ce que l'écran de veille fait tourner : une scène 3D, ou le ciel bleu (chargement en cours, ou repli si la scène échoue). */
interface Renderer {
  step(dtMs: number): void;
  draw(ctx: CanvasRenderingContext2D, dpr: number): void;
  resize(width: number, height: number): void;
}

const GRACE_MS = 300;
const MAX_DT_MS = 100;
const ACTIVITY_EVENTS = ['pointermove', 'touchstart', 'wheel'] as const;
const LISTEN: AddEventListenerOptions = { passive: true, capture: true };
// Touche et clic qui réveillent l'écran : consommés, pour ne rien déclencher sur la page dessous.
const CONSUME: AddEventListenerOptions = { capture: true };
const CONSUMED_EVENTS = ['keydown', 'pointerdown'] as const;
const RESIZE: AddEventListenerOptions = { passive: true };

function paintSky(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#0000AA');
  sky.addColorStop(1, '#00002a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);
}

/** Le ciel bleu : le temps que la scène choisie se charge, et en repli si elle ne peut pas tourner. */
const skyRenderer = (width: number, height: number): Renderer => {
  let w = width;
  let h = height;
  return {
    step: () => undefined,
    draw: (ctx, dpr) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 1;
      paintSky(ctx, w, h);
    },
    resize: (nw, nh) => {
      w = nw;
      h = nh;
    },
  };
};

const sceneRenderer = (scene: ReturnType<SceneFactory>): Renderer => ({
  step: (dtMs) => scene.step(dtMs),
  draw: (ctx, dpr) => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    scene.draw(ctx);
  },
  resize: (w, h) => scene.resize(w, h),
});

export function createScreensaver(options: ScreensaverOptions = {}): Screensaver {
  const reducedMotion =
    options.reducedMotion ?? (() => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const requestFrame = options.requestFrame ?? ((cb) => window.requestAnimationFrame(cb));
  const cancelFrame = options.cancelFrame ?? ((h) => window.cancelAnimationFrame(h));

  let root: HTMLDivElement | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let renderer: Renderer | null = null;
  let generation = 0;
  let frame: number | null = null;
  let lastTime: number | null = null;
  let startedAt = 0;
  let dpr = 1;
  let destroyed = false;
  let animated = true;

  const size = (): { w: number; h: number } => ({ w: Math.max(1, window.innerWidth), h: Math.max(1, window.innerHeight) });

  /** Une scène qui plante ne doit jamais casser la page : on retombe sur le ciel bleu. */
  const guarded = (action: (r: Renderer) => void): void => {
    if (!renderer) return;
    try {
      action(renderer);
    } catch {
      const { w, h } = size();
      renderer = skyRenderer(w, h);
      try {
        action(renderer);
      } catch {
        /* le ciel ne devrait pas échouer ; en tout cas on ne casse pas la page */
      }
    }
  };

  const render = (): void => {
    const target = ctx;
    if (target) guarded((r) => r.draw(target, dpr));
  };

  const fit = (): void => {
    if (!canvas) return;
    const { w, h } = size();
    dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    guarded((r) => r.resize(w, h));
  };

  const onResize = (): void => {
    fit();
    if (!animated) render();
  };

  const loop = (time: number): void => {
    frame = null;
    if (!root || !renderer) return;
    const dt = lastTime === null ? 0 : Math.min(MAX_DT_MS, Math.max(0, time - lastTime));
    lastTime = time;
    guarded((r) => r.step(dt));
    render();
    frame = requestFrame(loop);
  };

  const onActivity = (): void => {
    if (Date.now() - startedAt < GRACE_MS) return;
    api.stop();
  };

  const onConsumedActivity = (event: Event): void => {
    if (Date.now() - startedAt < GRACE_MS) return;
    event.preventDefault();
    event.stopPropagation();
    api.stop();
  };

  /** Charge la scène 3D puis prend sa place ; un arrêt ou un redémarrage entre-temps annule tout. */
  const switchTo = async (id: SceneId, mine: number): Promise<void> => {
    let next: Renderer;
    try {
      const factory = await (options.loadScene ?? defaultLoadScene)(id);
      if (mine !== generation || !root) return;
      const { w, h } = size();
      next = sceneRenderer(factory({ ...(options.context ?? readSceneContext)(), width: w, height: h }));
    } catch {
      if (mine !== generation || !root) return;
      const { w, h } = size();
      next = skyRenderer(w, h);
    }
    renderer = next;
    render();
  };

  const api: Screensaver = {
    start(sceneId) {
      if (destroyed || root) return;
      animated = !reducedMotion();

      root = document.createElement('div');
      root.className = 'bscr-overlay';
      root.setAttribute('role', 'presentation');

      canvas = document.createElement('canvas');
      canvas.className = 'bscr-canvas';
      canvas.setAttribute('aria-hidden', 'true');
      ctx = canvas.getContext('2d');

      const live = document.createElement('p');
      live.className = 'bscr-sr';
      live.setAttribute('aria-live', 'polite');

      root.append(canvas, live);
      const { w, h } = size();
      const id = sceneId ?? options.scene?.() ?? DEFAULT_SCENE;
      renderer = skyRenderer(w, h);
      fit();
      document.body.append(root);
      live.textContent = t('liveText');

      startedAt = Date.now();
      lastTime = null;
      for (const type of ACTIVITY_EVENTS) window.addEventListener(type, onActivity, LISTEN);
      for (const type of CONSUMED_EVENTS) window.addEventListener(type, onConsumedActivity, CONSUME);
      window.addEventListener('resize', onResize, RESIZE);

      render();
      if (!ctx) return; // pas de canevas 2D : un fond uni, sans rien charger ni animer
      if (animated) frame = requestFrame(loop);
      void switchTo(id, ++generation);
    },

    stop() {
      generation++;
      if (frame !== null) {
        cancelFrame(frame);
        frame = null;
      }
      for (const type of ACTIVITY_EVENTS) window.removeEventListener(type, onActivity, LISTEN as EventListenerOptions);
      for (const type of CONSUMED_EVENTS) window.removeEventListener(type, onConsumedActivity, CONSUME as EventListenerOptions);
      window.removeEventListener('resize', onResize, RESIZE);
      root?.remove();
      root = canvas = ctx = renderer = null;
      lastTime = null;
    },

    isRunning() {
      return root !== null;
    },

    destroy() {
      api.stop();
      destroyed = true;
    },
  };
  return api;
}
