import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { IdleWatcher } from './idle';

type Timer = { at: number; fn: () => void };

/** Horloge et minuteries factices, avancées à la main. */
function fakeClock() {
  let t = 0;
  let nextId = 1;
  const timers = new Map<number, Timer>();
  return {
    now: () => t,
    setTimer: (fn: () => void, ms: number) => {
      const id = nextId++;
      timers.set(id, { at: t + ms, fn });
      return id;
    },
    clearTimer: (h: unknown) => {
      timers.delete(h as number);
    },
    pending: () => timers.size,
    advance(ms: number) {
      const end = t + ms;
      for (;;) {
        let best: [number, Timer] | undefined;
        for (const e of timers) if (e[1].at <= end && (!best || e[1].at < best[1].at)) best = e;
        if (!best) break;
        timers.delete(best[0]);
        t = Math.max(t, best[1].at);
        best[1].fn();
      }
      t = end;
    },
  };
}

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('IdleWatcher', () => {
  let clock: ReturnType<typeof fakeClock>;
  let onIdle: Mock<() => void>;
  let onActive: Mock<() => void>;
  const make = () =>
    new IdleWatcher({ timeoutMs: 1000, onIdle, onActive, now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer });

  beforeEach(() => {
    clock = fakeClock();
    onIdle = vi.fn<() => void>();
    onActive = vi.fn<() => void>();
    setVisibility('visible');
  });
  afterEach(() => setVisibility('visible'));

  it('ne fait rien avant start()', () => {
    make();
    clock.advance(5000);
    expect(onIdle).not.toHaveBeenCalled();
  });

  it('déclenche onIdle une seule fois après le délai', () => {
    const w = make();
    w.start();
    clock.advance(999);
    expect(onIdle).not.toHaveBeenCalled();
    clock.advance(1);
    expect(onIdle).toHaveBeenCalledTimes(1);
    clock.advance(10_000);
    expect(onIdle).toHaveBeenCalledTimes(1);
    w.stop();
  });

  it.each(['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'])(
    'l activité %s repousse l échéance',
    (type) => {
      const w = make();
      w.start();
      clock.advance(900);
      window.dispatchEvent(new Event(type));
      clock.advance(900);
      expect(onIdle).not.toHaveBeenCalled();
      clock.advance(100);
      expect(onIdle).toHaveBeenCalledTimes(1);
      w.stop();
    },
  );

  it('appelle onActive à la première activité après inactivité puis se réarme', () => {
    const w = make();
    w.start();
    clock.advance(1000);
    expect(onActive).not.toHaveBeenCalled();
    window.dispatchEvent(new Event('keydown'));
    expect(onActive).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event('keydown'));
    expect(onActive).toHaveBeenCalledTimes(1);
    clock.advance(1000);
    expect(onIdle).toHaveBeenCalledTimes(2);
    w.stop();
  });

  it('ne déclenche pas quand l onglet est masqué, et repart de zéro au retour', () => {
    const w = make();
    w.start();
    setVisibility('hidden');
    clock.advance(5000);
    expect(onIdle).not.toHaveBeenCalled();
    setVisibility('visible');
    clock.advance(999);
    expect(onIdle).not.toHaveBeenCalled();
    clock.advance(1);
    expect(onIdle).toHaveBeenCalledTimes(1);
    w.stop();
  });

  it('stop() annule la minuterie et retire les écouteurs', () => {
    const w = make();
    w.start();
    w.stop();
    expect(clock.pending()).toBe(0);
    window.dispatchEvent(new Event('pointermove'));
    expect(clock.pending()).toBe(0);
    clock.advance(5000);
    expect(onIdle).not.toHaveBeenCalled();
  });

  it('enregistre des écouteurs passifs puis les retire', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    const w = make();
    w.start();
    const names = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'];
    const activity = add.mock.calls.filter(([t]) => names.includes(t));
    expect(activity).toHaveLength(6);
    for (const c of activity) expect(c[2]).toMatchObject({ passive: true });
    w.stop();
    for (const [t, fn] of activity) expect(remove).toHaveBeenCalledWith(t, fn, expect.anything());
  });

  it('start() est idempotent', () => {
    const w = make();
    w.start();
    w.start();
    clock.advance(1000);
    expect(onIdle).toHaveBeenCalledTimes(1);
    w.stop();
  });

  it('fonctionne avec les minuteries par défaut', () => {
    vi.useFakeTimers();
    try {
      const cb = vi.fn();
      const w = new IdleWatcher({ timeoutMs: 500, onIdle: cb });
      w.start();
      vi.advanceTimersByTime(500);
      expect(cb).toHaveBeenCalledTimes(1);
      w.stop();
    } finally {
      vi.useRealTimers();
    }
  });
});
