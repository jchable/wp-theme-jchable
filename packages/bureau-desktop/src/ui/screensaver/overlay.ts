import './style.css';
import { createScene, resize, step, type Scene } from './physics';
import { t } from './i18n';

export interface ScreensaverOptions {
  reducedMotion?: () => boolean;
  requestFrame?: (cb: (time: number) => void) => number;
  cancelFrame?: (handle: number) => void;
}

export interface Screensaver {
  start(): void;
  stop(): void;
  isRunning(): boolean;
  destroy(): void;
}

const GRACE_MS = 300;
const MAX_DT_MS = 100;
const ACTIVITY_EVENTS = ['pointermove', 'touchstart', 'wheel'] as const;
const LISTEN: AddEventListenerOptions = { passive: true, capture: true };
// Touche et clic qui réveillent l'écran : consommés, pour ne rien déclencher sur la page dessous.
const CONSUME: AddEventListenerOptions = { capture: true };
const CONSUMED_EVENTS = ['keydown', 'pointerdown'] as const;
const RESIZE: AddEventListenerOptions = { passive: true };

function draw(ctx: CanvasRenderingContext2D, scene: Scene, dpr: number): void {
  const { width, height, badge } = scene;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = 1;

  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#0000AA');
  sky.addColorStop(1, '#00002a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#ffffff';
  for (const star of scene.stars) {
    ctx.globalAlpha = star.alpha;
    ctx.fillRect(Math.round(star.x), Math.round(star.y), star.size, star.size);
  }
  ctx.globalAlpha = 1;

  const border = Math.max(2, Math.round(badge.w / 24));
  ctx.fillStyle = '#000000';
  ctx.fillRect(badge.x, badge.y, badge.w, badge.h);
  ctx.strokeStyle = '#ffd800';
  ctx.lineWidth = border;
  ctx.strokeRect(badge.x + border / 2, badge.y + border / 2, badge.w - border, badge.h - border);
  ctx.fillStyle = '#ffd800';
  ctx.font = `bold ${Math.round(badge.h * 0.46)}px "Courier New", Courier, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('JC', badge.x + badge.w / 2, badge.y + badge.h / 2 + badge.h * 0.03);
}

export function createScreensaver(options: ScreensaverOptions = {}): Screensaver {
  const reducedMotion =
    options.reducedMotion ?? (() => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const requestFrame = options.requestFrame ?? ((cb) => window.requestAnimationFrame(cb));
  const cancelFrame = options.cancelFrame ?? ((h) => window.cancelAnimationFrame(h));

  let root: HTMLDivElement | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let scene: Scene | null = null;
  let frame: number | null = null;
  let lastTime: number | null = null;
  let startedAt = 0;
  let dpr = 1;
  let destroyed = false;
  let animated = true;

  const render = (): void => {
    if (ctx && scene) draw(ctx, scene, dpr);
  };

  const fit = (): void => {
    if (!canvas) return;
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    if (scene) resize(scene, w, h);
  };

  const onResize = (): void => {
    fit();
    if (!animated) render();
  };

  const loop = (time: number): void => {
    frame = null;
    if (!root || !scene) return;
    const dt = lastTime === null ? 0 : Math.min(MAX_DT_MS, Math.max(0, time - lastTime));
    lastTime = time;
    step(scene, dt);
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

  const api: Screensaver = {
    start() {
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
      scene = createScene(Math.max(1, window.innerWidth), Math.max(1, window.innerHeight), Math.random);
      fit();
      document.body.append(root);
      live.textContent = t('liveText');

      startedAt = Date.now();
      lastTime = null;
      for (const type of ACTIVITY_EVENTS) window.addEventListener(type, onActivity, LISTEN);
      for (const type of CONSUMED_EVENTS) window.addEventListener(type, onConsumedActivity, CONSUME);
      window.addEventListener('resize', onResize, RESIZE);

      render();
      if (animated) frame = requestFrame(loop);
    },

    stop() {
      if (frame !== null) {
        cancelFrame(frame);
        frame = null;
      }
      for (const type of ACTIVITY_EVENTS) window.removeEventListener(type, onActivity, LISTEN as EventListenerOptions);
      for (const type of CONSUMED_EVENTS) window.removeEventListener(type, onConsumedActivity, CONSUME as EventListenerOptions);
      window.removeEventListener('resize', onResize, RESIZE);
      root?.remove();
      root = canvas = ctx = scene = null;
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
