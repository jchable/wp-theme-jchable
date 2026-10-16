import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createScreensaver } from './overlay';

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

const ACTIVITY = ['pointermove', 'pointerdown', 'keydown', 'touchstart', 'wheel'] as const;
const overlay = () => document.querySelector<HTMLElement>('.bscr-overlay');
const jcDraws = (calls: Call[]) => calls.filter((c) => c.name === 'fillText' && c.args[0] === 'JC').length;

describe('createScreensaver', () => {
  let ctxRec: ReturnType<typeof fakeContext>;
  let frames: Array<(t: number) => void>;
  let requestFrame: ReturnType<typeof vi.fn>;
  let cancelFrame: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    ctxRec = fakeContext();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => ctxRec.ctx) as never);
    frames = [];
    requestFrame = vi.fn((cb: (t: number) => void) => frames.push(cb));
    cancelFrame = vi.fn();
  });
  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const make = (reduced = false) =>
    createScreensaver({ reducedMotion: () => reduced, requestFrame: requestFrame as never, cancelFrame: cancelFrame as never });

  it('start() ajoute l overlay accessible, stop() le retire', () => {
    const s = make();
    expect(s.isRunning()).toBe(false);
    s.start();
    expect(s.isRunning()).toBe(true);
    const o = overlay()!;
    expect(o).not.toBeNull();
    expect(o.getAttribute('role')).toBe('presentation');
    expect(o.parentElement).toBe(document.body);
    expect(o.querySelector('canvas')).not.toBeNull();
    expect(o.textContent).toContain('Écran de veille. Bougez la souris ou appuyez sur une touche pour revenir.');
    s.stop();
    expect(s.isRunning()).toBe(false);
    expect(overlay()).toBeNull();
  });

  it('start() deux fois n ajoute qu un seul overlay', () => {
    const s = make();
    s.start();
    s.start();
    expect(document.querySelectorAll('.bscr-overlay')).toHaveLength(1);
    s.stop();
  });

  it('ne vole pas le focus et ne verrouille pas le défilement', () => {
    const btn = document.createElement('button');
    document.body.append(btn);
    btn.focus();
    const s = make();
    s.start();
    expect(document.activeElement).toBe(btn);
    expect(document.body.style.overflow).toBe('');
    s.stop();
  });

  it('anime avec requestFrame et arrête la boucle au stop()', () => {
    const s = make();
    s.start();
    expect(requestFrame).toHaveBeenCalledTimes(1);
    frames.shift()!(1000);
    frames.shift()!(1016);
    expect(jcDraws(ctxRec.calls)).toBeGreaterThanOrEqual(2);
    expect(requestFrame.mock.calls.length).toBeGreaterThanOrEqual(3);
    s.stop();
    expect(cancelFrame).toHaveBeenCalled();
  });

  it.each(ACTIVITY)('ignore %s pendant les 300 premières ms puis s arrête', (type) => {
    const s = make();
    s.start();
    vi.advanceTimersByTime(299);
    window.dispatchEvent(new Event(type));
    expect(s.isRunning()).toBe(true);
    vi.advanceTimersByTime(1);
    window.dispatchEvent(new Event(type));
    expect(s.isRunning()).toBe(false);
    expect(overlay()).toBeNull();
  });

  it('la touche qui réveille est consommée (rien ne se déclenche sur la page dessous)', () => {
    const s = make();
    s.start();
    vi.advanceTimersByTime(400);
    const e = new KeyboardEvent('keydown', { key: 'a', cancelable: true, bubbles: true });
    window.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
    expect(s.isRunning()).toBe(false);
  });

  it('un simple mouvement de souris réveille sans être consommé', () => {
    const s = make();
    s.start();
    vi.advanceTimersByTime(400);
    const e = new Event('pointermove', { cancelable: true, bubbles: true });
    window.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(false);
    expect(s.isRunning()).toBe(false);
  });

  it('mouvement réduit : une seule image, pas de boucle', () => {
    const s = make(true);
    s.start();
    expect(requestFrame).not.toHaveBeenCalled();
    expect(jcDraws(ctxRec.calls)).toBe(1);
    expect(overlay()).not.toBeNull();
    s.stop();
  });

  it('redimensionne le canvas selon devicePixelRatio', () => {
    vi.stubGlobal('devicePixelRatio', 2);
    const s = make();
    s.start();
    const c = overlay()!.querySelector('canvas')!;
    expect(c.width).toBe(window.innerWidth * 2);
    expect(c.height).toBe(window.innerHeight * 2);
    vi.stubGlobal('innerWidth', 500);
    vi.stubGlobal('innerHeight', 300);
    window.dispatchEvent(new Event('resize'));
    expect(c.width).toBe(1000);
    expect(c.height).toBe(600);
    s.stop();
  });

  it('mouvement réduit : redessine une image au redimensionnement', () => {
    const s = make(true);
    s.start();
    const before = jcDraws(ctxRec.calls);
    window.dispatchEvent(new Event('resize'));
    expect(jcDraws(ctxRec.calls)).toBe(before + 1);
    expect(requestFrame).not.toHaveBeenCalled();
    s.stop();
  });

  it('destroy() retire l overlay et les écouteurs, et empêche tout redémarrage', () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const s = make();
    s.start();
    s.destroy();
    expect(overlay()).toBeNull();
    expect(remove).toHaveBeenCalledWith('resize', expect.any(Function), expect.anything());
    for (const t of ACTIVITY) expect(remove).toHaveBeenCalledWith(t, expect.any(Function), expect.anything());
    s.start();
    expect(overlay()).toBeNull();
    expect(s.isRunning()).toBe(false);
  });

  it('reducedMotion par défaut lit matchMedia', () => {
    const mm = vi.fn(() => ({ matches: true }));
    vi.stubGlobal('matchMedia', mm);
    const s = createScreensaver({ requestFrame: requestFrame as never, cancelFrame: cancelFrame as never });
    s.start();
    expect(mm).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
    expect(requestFrame).not.toHaveBeenCalled();
    s.stop();
  });

  it('survit à un canvas sans contexte 2D', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => null) as never);
    const s = make();
    expect(() => s.start()).not.toThrow();
    s.stop();
  });
});
