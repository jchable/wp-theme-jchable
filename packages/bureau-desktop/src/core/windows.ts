import { createAppStorage } from './prefs';
import type { PrefsApi } from './prefs';
import { findApp } from './registry';
import { t } from './ui-i18n';
import type { AppContext, AppModule, BureauApp, BureauConfig, SoundName } from './types';
import { WindowStack, clampPosition, fitBox } from './windowStack';

const BASE_Z = 1000;
const GRAB = 56;

export interface WindowInfo {
  id: string;
  title: string;
  minimized: boolean;
  active: boolean;
}

export interface WindowManagerOptions {
  layer: HTMLElement;
  config: BureauConfig;
  prefs: PrefsApi;
  storage: Storage | null;
  isMobile: () => boolean;
  /** Largeur de la bande d'icônes : les fenêtres ne passent jamais dessus. */
  leftInset: () => number;
  playSound: (name: SoundName) => void;
  openBsod: (message?: string) => void;
  /** Capacités transmises aux applis qui en ont besoin (Préférences). */
  settings?: AppContext['settings'];
  previewScreensaver?: AppContext['previewScreensaver'];
  resetIcons?: AppContext['resetIcons'];
}

interface OpenWindow {
  app: BureauApp;
  el: HTMLElement;
  titleEl: HTMLElement;
  body: HTMLElement;
  module: AppModule | null;
  opener: Element | null;
  maximized: boolean;
  restoreBox: { left: string; top: string; width: string; height: string } | null;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** L'icône du bouton d'agrandissement : un carré pour agrandir, deux carrés superposés pour restaurer la taille. */
function sizeIcon(restore: boolean): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 12 12');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const square = (x: number, y: number, size: number): SVGRectElement => {
    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('x', String(x));
    rect.setAttribute('y', String(y));
    rect.setAttribute('width', String(size));
    rect.setAttribute('height', String(size));
    return rect;
  };
  if (restore) svg.append(square(3.5, 1, 7.5), square(1, 3.5, 7.5));
  else svg.append(square(1.5, 1.5, 9));
  return svg;
}

/** Fenêtres des applis : ouverture, déplacement, réduction, fermeture, empilement. */
export class WindowManager {
  private readonly windows = new Map<string, OpenWindow>();
  private readonly stack = new WindowStack(BASE_Z);
  private readonly listeners = new Set<() => void>();
  private cascade = 0;

  private fitTimer: number | undefined;

  constructor(private readonly options: WindowManagerOptions) {
    window.addEventListener('resize', () => {
      window.clearTimeout(this.fitTimer);
      this.fitTimer = window.setTimeout(() => this.fit(), 120);
    });
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  list(): WindowInfo[] {
    const top = this.stack.top();
    return this.stack.order().map((id) => {
      const win = this.windows.get(id);
      return { id, title: win?.titleEl.textContent ?? id, minimized: this.isMinimized(id), active: id === top };
    });
  }

  isOpen(id: string): boolean {
    return this.windows.has(id);
  }

  /** Ouvre l'appli, ou ramène sa fenêtre au premier plan si elle est déjà ouverte. */
  open(appId: string, args: Record<string, unknown> = {}): void {
    const app = findApp(appId);
    if (app) this.openApp(app, args);
  }

  /** Comme `open`, pour une appli qui n'est pas dans le registre (fenêtre de page). */
  openApp(app: BureauApp, args: Record<string, unknown> = {}): void {
    const appId = app.id;
    const existing = this.windows.get(appId);
    if (existing) {
      this.restore(appId);
      return;
    }
    const win = this.createWindow(app);
    this.windows.set(appId, win);
    this.stack.open(appId);
    this.options.layer.append(win.el);
    this.applyZ();
    this.position(win);
    this.notify();
    win.el.focus({ preventScroll: true });
    void this.mountApp(win, args);
  }

  close(id: string): void {
    const win = this.windows.get(id);
    if (!win) return;
    try {
      win.module?.unmount();
    } catch {
      /* une appli qui plante à la fermeture ne doit pas bloquer le bureau */
    }
    win.el.remove();
    this.windows.delete(id);
    this.stack.close(id);
    this.applyZ();
    this.notify();
    const opener = win.opener;
    if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true });
    else if (this.stack.top()) this.focusTop();
    else document.querySelector<HTMLElement>('.start-button')?.focus({ preventScroll: true });
  }

  minimize(id: string): void {
    const win = this.windows.get(id);
    if (!win) return;
    this.savePosition(id); // avant de masquer : un élément masqué n'a plus de position mesurable
    this.stack.setMinimized(id, true);
    win.el.hidden = true;
    this.notify();
    if (this.stack.top()) this.focusTop();
    else {
      // Plus aucune fenêtre visible : le focus va à son onglet de la barre des tâches.
      const tab = document.querySelector<HTMLElement>(`.bwin-tab[data-id="${id}"]`) ?? document.querySelector<HTMLElement>('.start-button');
      tab?.focus({ preventScroll: true });
    }
  }

  restore(id: string): void {
    const win = this.windows.get(id);
    if (!win) return;
    this.stack.setMinimized(id, false);
    this.stack.bringToFront(id);
    win.el.hidden = false;
    this.applyZ();
    this.savePosition(id);
    this.notify();
    win.el.focus({ preventScroll: true });
  }

  /**
   * Échap, quand le focus est sur la page et non dans une fenêtre : ferme la fenêtre du dessus,
   * sauf si le focus est dans un champ de la page ou dans une appli qui garde toutes les touches (DOOM).
   */
  closeTopOnEscape(target: EventTarget | null): boolean {
    const top = this.stack.top();
    if (!top) return false;
    const win = this.windows.get(top);
    if (!win) return false;
    const el = target instanceof HTMLElement ? target : null;
    if (win.app.capturesKeyboard && el && win.el.contains(el)) return false;
    const inPageField =
      el !== null && !el.closest('#bureau-windows, #bureau-desktop') && el.matches('input, textarea, select, [contenteditable="true"]');
    if (inPageField) return false;
    this.close(top);
    return true;
  }

  /** Recadre les fenêtres quand le navigateur rétrécit : elles restent atteignables. */
  fit(): void {
    if (this.options.isMobile()) return;
    const area = { w: window.innerWidth, h: window.innerHeight };
    for (const win of this.windows.values()) {
      if (win.maximized) continue;
      const x = parseFloat(win.el.style.left) || 0;
      const y = parseFloat(win.el.style.top) || 0;
      const w = parseFloat(win.el.style.width) || win.app.defaultSize.w;
      const h = parseFloat(win.el.style.height) || win.app.defaultSize.h;
      const next = fitBox({ x, y, w, h }, area, GRAB, this.options.leftInset());
      Object.assign(win.el.style, { left: `${next.x}px`, top: `${next.y}px`, width: `${next.w}px`, height: `${next.h}px` });
    }
  }

  focus(id: string): void {
    if (!this.windows.has(id) || this.stack.top() === id) return;
    this.stack.bringToFront(id);
    this.applyZ();
    this.notify();
  }

  toggleMaximize(id: string): void {
    const win = this.windows.get(id);
    if (!win || this.options.isMobile()) return;
    if (win.maximized && win.restoreBox) {
      Object.assign(win.el.style, win.restoreBox);
      win.maximized = false;
      win.el.classList.remove('bwin--maximized');
    } else {
      const { left, top, width, height } = win.el.style;
      win.restoreBox = { left, top, width, height };
      win.maximized = true;
      win.el.classList.add('bwin--maximized');
    }
    // Agrandie, la fenêtre propose de rétrécir (double carré), pas de se réduire dans la barre des tâches.
    const button = win.el.querySelector<HTMLElement>('[data-action="maximize"]');
    if (button) {
      button.setAttribute('aria-label', win.maximized ? t('win.restore') : t('win.maximize'));
      button.replaceChildren(sizeIcon(win.maximized));
    }
    this.notify();
  }

  /** Quand on passe d'un grand écran à un petit : les fenêtres passent en plein écran. */
  refreshMode(): void {
    const mobile = this.options.isMobile();
    for (const win of this.windows.values()) {
      win.el.classList.toggle('bwin--full', mobile);
      if (!mobile) this.position(win);
    }
  }

  private isMinimized(id: string): boolean {
    return Boolean(this.windows.get(id)?.el.hidden);
  }

  private notify(): void {
    const top = this.stack.top();
    for (const [id, win] of this.windows) win.el.classList.toggle('bwin--active', id === top);
    this.listeners.forEach((listener) => listener());
  }

  private applyZ(): void {
    for (const [id, win] of this.windows) win.el.style.zIndex = String(this.stack.zIndex(id));
  }

  private focusTop(): void {
    const top = this.stack.top();
    if (top) this.windows.get(top)?.el.focus({ preventScroll: true });
  }

  private createWindow(app: BureauApp): OpenWindow {
    const el = document.createElement('section');
    el.className = 'bwin';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', app.title);
    el.dataset['app'] = app.id;
    el.tabIndex = -1;

    const titlebar = document.createElement('header');
    titlebar.className = 'bwin-titlebar';
    const titleEl = document.createElement('span');
    titleEl.className = 'bwin-title';
    titleEl.textContent = app.title;
    const controls = document.createElement('span');
    controls.className = 'bwin-controls';
    for (const [action, label, glyph] of [
      ['minimize', t('win.minimize'), '_'],
      ['maximize', t('win.maximize'), ''],
      ['close', t('win.close'), '×'],
    ] as const) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'bwin-btn';
      button.dataset['action'] = action;
      button.setAttribute('aria-label', label);
      if (action === 'maximize') {
        button.append(sizeIcon(false));
      } else {
        const glyphEl = document.createElement('span');
        glyphEl.setAttribute('aria-hidden', 'true');
        glyphEl.textContent = glyph;
        button.append(glyphEl);
      }
      controls.append(button);
    }
    titlebar.append(titleEl, controls);

    const body = document.createElement('div');
    body.className = 'bwin-body';
    body.textContent = t('win.loading');
    el.append(titlebar, body);

    const win: OpenWindow = {
      app,
      el,
      titleEl,
      body,
      module: null,
      opener: document.activeElement,
      maximized: false,
      restoreBox: null,
    };

    controls.addEventListener('click', (event) => {
      const action = (event.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset['action'];
      if (action === 'close') this.close(app.id);
      else if (action === 'minimize') this.minimize(app.id);
      else if (action === 'maximize') this.toggleMaximize(app.id);
    });
    el.addEventListener('pointerdown', () => this.focus(app.id), true);
    el.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !app.capturesKeyboard) {
        event.stopPropagation();
        this.close(app.id);
      }
    });
    this.enableDrag(win, titlebar);
    el.classList.toggle('bwin--full', this.options.isMobile());
    return win;
  }

  private position(win: OpenWindow): void {
    if (this.options.isMobile()) return;
    const saved = this.options.prefs.get().windows[win.app.id];
    const size = win.app.defaultSize;
    const area = { w: window.innerWidth, h: window.innerHeight };
    const width = Math.min(size.w, area.w - this.options.leftInset() - 24);
    const height = Math.min(size.h, area.h - 24);
    // Les fenêtres s'ouvrent à droite des deux colonnes d'icônes, en cascade.
    const inset = this.options.leftInset();
    const fallback = { x: Math.max(250, inset + 24) + this.cascade * 28, y: 70 + this.cascade * 28 };
    this.cascade = (this.cascade + 1) % 8;
    const start = saved ? { x: saved.x, y: saved.y } : fallback;
    const at = clampPosition(start, { w: width, h: height }, area, GRAB, inset);
    Object.assign(win.el.style, { left: `${at.x}px`, top: `${at.y}px`, width: `${width}px`, height: `${height}px` });
  }

  private savePosition(id: string): void {
    const win = this.windows.get(id);
    if (!win || this.options.isMobile() || win.maximized || win.el.hidden) return;
    const rect = win.el.getBoundingClientRect();
    this.options.prefs.update((p) => {
      p.windows[id] = { x: Math.round(rect.left), y: Math.round(rect.top), minimized: false };
    });
  }

  private enableDrag(win: OpenWindow, handle: HTMLElement): void {
    handle.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || this.options.isMobile() || win.maximized) return;
      if ((event.target as HTMLElement).closest('button')) return;
      event.preventDefault();
      const startX = event.clientX;
      const startY = event.clientY;
      const rect = win.el.getBoundingClientRect();
      handle.setPointerCapture(event.pointerId);
      handle.classList.add('bwin-dragging');
      const move = (e: PointerEvent): void => {
        const next = clampPosition(
          { x: rect.left + e.clientX - startX, y: rect.top + e.clientY - startY },
          { w: rect.width, h: rect.height },
          { w: window.innerWidth, h: window.innerHeight },
          GRAB,
          this.options.leftInset(),
        );
        win.el.style.left = `${next.x}px`;
        win.el.style.top = `${next.y}px`;
      };
      const end = (): void => {
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', end);
        handle.removeEventListener('pointercancel', end);
        handle.classList.remove('bwin-dragging');
        this.savePosition(win.app.id);
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', end);
      handle.addEventListener('pointercancel', end);
    });
  }

  private buildContext(win: OpenWindow, args: Record<string, unknown>): AppContext {
    const { config, storage, settings, previewScreensaver, resetIcons } = this.options;
    const id = win.app.id;
    return {
      ...(settings ? { settings } : {}),
      ...(previewScreensaver ? { previewScreensaver } : {}),
      ...(resetIcons ? { resetIcons } : {}),
      config,
      args,
      storage: createAppStorage(id, storage),
      setTitle: (title) => {
        win.titleEl.textContent = title;
        win.el.setAttribute('aria-label', title);
        this.notify();
      },
      close: () => this.close(id),
      openApp: (appId, appArgs) => this.open(appId, appArgs),
      openBsod: (message) => this.options.openBsod(message),
      playSound: (name) => this.options.playSound(name),
      fetchJson: async <T>(url: string): Promise<T> => {
        const target = new URL(url, location.href);
        if (target.origin !== location.origin) throw new Error(t('win.offsite'));
        const response = await fetch(target, { headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return (await response.json()) as T;
      },
    };
  }

  private async mountApp(win: OpenWindow, args: Record<string, unknown>): Promise<void> {
    const { app, body } = win;
    if (this.options.isMobile() && app.mobile === 'unsupported') {
      this.showMessage(win, app.unsupportedMessage ?? t('win.unsupported'));
      return;
    }
    try {
      const module = await app.load();
      if (!this.windows.has(app.id)) return; // fermée pendant le chargement
      win.module = module;
      body.textContent = '';
      await module.mount(body, this.buildContext(win, args));
    } catch (error) {
      if (!this.windows.has(app.id)) return;
      this.options.playSound('error');
      this.showError(win, error);
    }
  }

  private showMessage(win: OpenWindow, message: string): void {
    const p = document.createElement('p');
    p.className = 'bwin-message';
    p.textContent = message;
    win.body.replaceChildren(p);
  }

  private showError(win: OpenWindow, error: unknown): void {
    const box = document.createElement('div');
    box.className = 'bwin-error';
    const title = document.createElement('p');
    title.className = 'bwin-error-title';
    title.textContent = t('win.crashed', { title: win.app.title });
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = t('win.details');
    const pre = document.createElement('pre');
    pre.textContent = error instanceof Error ? error.message : String(error);
    details.append(summary, pre);
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = t('win.close');
    close.addEventListener('click', () => this.close(win.app.id));
    box.append(title, details, close);
    win.body.replaceChildren(box);
  }
}
