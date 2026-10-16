const ACTIVITY_EVENTS = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;

export interface IdleWatcherOptions {
  timeoutMs: number;
  onIdle: () => void;
  /** Appelé à la première activité qui suit un `onIdle`. */
  onActive?: () => void;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

/**
 * Détecte l'inactivité de l'utilisateur. Se déclenche une fois par période
 * d'inactivité, et seulement si l'onglet est visible.
 */
export class IdleWatcher {
  private readonly timeoutMs: number;
  private readonly onIdle: () => void;
  private readonly onActive: (() => void) | undefined;
  private readonly now: () => number;
  private readonly setTimer: (fn: () => void, ms: number) => unknown;
  private readonly clearTimer: (handle: unknown) => void;

  private handle: unknown = undefined;
  private running = false;
  private idle = false;
  private lastActivity = 0;

  constructor(options: IdleWatcherOptions) {
    this.timeoutMs = options.timeoutMs;
    this.onIdle = options.onIdle;
    this.onActive = options.onActive;
    this.now = options.now ?? (() => Date.now());
    this.setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer = options.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.idle = false;
    for (const type of ACTIVITY_EVENTS) window.addEventListener(type, this.handleActivity, { passive: true });
    document.addEventListener('visibilitychange', this.handleVisibility);
    this.lastActivity = this.now();
    this.arm(this.timeoutMs);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    for (const type of ACTIVITY_EVENTS) window.removeEventListener(type, this.handleActivity, { passive: true } as EventListenerOptions);
    document.removeEventListener('visibilitychange', this.handleVisibility);
    this.disarm();
  }

  private arm(ms: number): void {
    this.disarm();
    this.handle = this.setTimer(this.onTimer, ms);
  }

  private disarm(): void {
    if (this.handle !== undefined) {
      this.clearTimer(this.handle);
      this.handle = undefined;
    }
  }

  private readonly handleActivity = (): void => {
    this.lastActivity = this.now();
    if (this.idle) {
      this.idle = false;
      this.arm(this.timeoutMs);
      this.onActive?.();
    }
    // Sinon, l'échéance est repoussée au déclenchement de la minuterie :
    // inutile de la recréer à chaque pointermove.
  };

  private readonly handleVisibility = (): void => {
    if (document.visibilityState !== 'visible' || this.idle) return;
    this.lastActivity = this.now();
    this.arm(this.timeoutMs);
  };

  private readonly onTimer = (): void => {
    this.handle = undefined;
    if (!this.running || this.idle) return;
    if (document.visibilityState !== 'visible') return; // réarmé au retour de l'onglet
    const remaining = this.timeoutMs - (this.now() - this.lastActivity);
    if (remaining > 0) {
      this.arm(remaining);
      return;
    }
    this.idle = true;
    this.onIdle();
  };
}
