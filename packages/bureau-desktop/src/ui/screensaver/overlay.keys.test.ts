import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createScreensaver } from './overlay';

describe('écran de veille : le geste qui le réveille est consommé', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => null) as never);
  });
  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const run = (type: 'keydown' | 'pointerdown'): { prevented: boolean; reachedPage: boolean; stopped: boolean } => {
    const saver = createScreensaver({ reducedMotion: () => true, requestFrame: () => 1, cancelFrame: () => undefined });
    saver.start();
    vi.advanceTimersByTime(400);
    let reachedPage = false;
    document.addEventListener(type, () => (reachedPage = true));
    const event = new Event(type, { bubbles: true, cancelable: true });
    document.body.dispatchEvent(event);
    return { prevented: event.defaultPrevented, reachedPage, stopped: !saver.isRunning() };
  };

  it('une touche (Échap…) réveille sans atteindre l’élément qui a le focus', () => {
    const got = run('keydown');
    expect(got.stopped).toBe(true);
    expect(got.prevented).toBe(true);
    expect(got.reachedPage).toBe(false);
  });

  it('un clic réveille sans cliquer ce qui se trouve dessous', () => {
    const got = run('pointerdown');
    expect(got.stopped).toBe(true);
    expect(got.prevented).toBe(true);
    expect(got.reachedPage).toBe(false);
  });
});
