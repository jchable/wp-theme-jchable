import { BAND_PAD_X, BAND_TOP, CELL_SIZE, bandLayout, cellKey, cellToPoint, clampCell, layoutIcons, nearestFreeCell, pointToCell } from '../core/grid';
import type { Cell } from '../core/grid';
import type { PrefsApi } from '../core/prefs';
import { t } from '../core/ui-i18n';

export interface IconItem {
  id: string;
  label: string;
  iconUrl: string;
  /** « link » : ouvre une page ; « anchor » : un lien #ancre de la page ; « app » : lance une appli. */
  kind: 'link' | 'anchor' | 'app';
  href?: string;
  appId?: string;
}

export interface DesktopIconsOptions {
  host: HTMLElement;
  items: readonly IconItem[];
  prefs: PrefsApi;
  openApp: (appId: string) => void;
  navigate: (url: string) => void;
  onAnchor: (hash: string) => void;
  onContextMenu: (x: number, y: number) => void;
}

const ORIGIN_X = BAND_PAD_X;
const ORIGIN_Y = BAND_TOP;
const DRAG_THRESHOLD = 5;

/**
 * Les icônes du bureau, posées sur une grille invisible : on peut les déplacer à la souris, au doigt
 * ou au clavier (Maj + flèches). Un double-clic (ou un appui au doigt, ou Entrée) les ouvre.
 */
export class DesktopIcons {
  private readonly buttons = new Map<string, HTMLButtonElement>();
  private cells: Record<string, Cell> = {};
  private cols = 1;
  private rows = 1;
  private resizeTimer: number | undefined;
  private abort: AbortController | null = null;
  private readonly onResize = (): void => {
    window.clearTimeout(this.resizeTimer);
    this.resizeTimer = window.setTimeout(() => this.layout(), 120);
  };

  constructor(private readonly options: DesktopIconsOptions) {}

  mount(): void {
    const { host, items } = this.options;
    host.replaceChildren();
    for (const item of items) {
      const button = this.createButton(item);
      this.buttons.set(item.id, button);
      host.append(button);
    }
    this.abort = new AbortController();
    const { signal } = this.abort;
    host.addEventListener(
      'pointerdown',
      (event) => {
        if (event.target === host) this.select(null);
      },
      { signal },
    );
    host.addEventListener(
      'contextmenu',
      (event) => {
        event.preventDefault();
        this.options.onContextMenu(event.clientX, event.clientY);
      },
      { signal },
    );
    window.addEventListener('resize', this.onResize, { signal });
    this.layout();
  }

  destroy(): void {
    document.documentElement.style.removeProperty('--bureau-band');
    this.abort?.abort();
    this.abort = null;
    window.clearTimeout(this.resizeTimer);
    this.options.host.replaceChildren();
    this.buttons.clear();
  }

  /** Remet les icônes dans leur rangement d'origine. */
  reset(): void {
    this.options.prefs.resetIcons();
    this.layout();
  }

  /** La bande s'adapte à l'écran ; sa largeur est publiée pour que le contenu et les fenêtres la laissent libre. */
  private measure(): void {
    const band = bandLayout(this.options.items.length, window.innerWidth, window.innerHeight);
    this.cols = band.cols;
    this.rows = band.rows;
    document.documentElement.style.setProperty('--bureau-band', `${band.widthPx}px`);
  }

  private layout(): void {
    this.measure();
    const ids = this.options.items.map((item) => item.id);
    this.cells = layoutIcons(ids, this.options.prefs.get().icons, this.cols, this.rows);
    for (const id of ids) this.place(id);
  }

  private place(id: string): void {
    const button = this.buttons.get(id);
    const cell = this.cells[id];
    if (!button || !cell) return;
    const point = cellToPoint(cell);
    button.style.left = `${ORIGIN_X + point.x + (CELL_SIZE - 92) / 2}px`;
    button.style.top = `${ORIGIN_Y + point.y}px`;
  }

  private occupiedExcept(id: string): Set<string> {
    const set = new Set<string>();
    for (const [other, cell] of Object.entries(this.cells)) if (other !== id) set.add(cellKey(cell));
    return set;
  }

  private moveTo(id: string, wanted: Cell): void {
    const cell = nearestFreeCell(wanted, this.occupiedExcept(id), this.cols, this.rows);
    this.cells[id] = cell;
    this.place(id);
    this.options.prefs.update((p) => {
      p.icons[id] = { col: cell.col, row: cell.row };
    });
  }

  /** Au tout premier simple clic : une bulle rappelle qu'il faut double-cliquer. Une seule fois. */
  private showHint(button: HTMLElement): void {
    const { prefs, host } = this.options;
    if (prefs.get().seen['iconHint']) return;
    prefs.update((p) => {
      p.seen['iconHint'] = true;
    });
    const hint = document.createElement('div');
    hint.className = 'bicon-hint';
    hint.setAttribute('role', 'status');
    hint.textContent = t('icons.hint');
    hint.style.left = `${button.offsetLeft}px`;
    hint.style.top = `${button.offsetTop + button.offsetHeight + 4}px`;
    host.append(hint);
    window.setTimeout(() => hint.remove(), 3500);
  }

  private select(id: string | null): void {
    for (const [other, button] of this.buttons) button.classList.toggle('bicon--selected', other === id);
  }

  private activate(item: IconItem): void {
    if (item.kind === 'app' && item.appId) this.options.openApp(item.appId);
    else if (item.kind === 'anchor' && item.href) this.options.onAnchor(item.href);
    else if (item.href) this.options.navigate(item.href);
  }

  private createButton(item: IconItem): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'bicon';
    button.dataset['id'] = item.id;
    button.setAttribute('aria-label', item.label);
    const image = document.createElement('span');
    image.className = 'bicon-img';
    image.setAttribute('aria-hidden', 'true');
    image.style.backgroundImage = `url("${item.iconUrl}")`;
    const label = document.createElement('span');
    label.className = 'bicon-label';
    label.setAttribute('aria-hidden', 'true');
    label.textContent = item.label;
    button.append(image, label);

    let pointerType = 'mouse';
    let dragged = false;

    button.addEventListener('click', (event) => {
      if (dragged) {
        dragged = false;
        return;
      }
      this.select(item.id);
      // detail === 0 : activation au clavier (Entrée, Espace). Au doigt, un appui suffit.
      if (event.detail === 0 || pointerType === 'touch') this.activate(item);
      else this.showHint(button);
    });
    button.addEventListener('dblclick', () => this.activate(item));

    button.addEventListener('keydown', (event) => {
      const cell = this.cells[item.id];
      if (!cell) return;
      const delta: Record<string, Cell | undefined> = {
        ArrowLeft: { col: -1, row: 0 },
        ArrowRight: { col: 1, row: 0 },
        ArrowUp: { col: 0, row: -1 },
        ArrowDown: { col: 0, row: 1 },
      };
      const step = delta[event.key];
      if (!step) return;
      event.preventDefault();
      if (event.shiftKey) {
        this.moveTo(item.id, clampCell({ col: cell.col + step.col, row: cell.row + step.row }, this.cols, this.rows));
      } else {
        this.focusNeighbour(item.id, step);
      }
    });

    button.addEventListener('pointerdown', (event) => {
      pointerType = event.pointerType;
      if (event.button !== 0) return;
      const startX = event.clientX;
      const startY = event.clientY;
      const hostRect = this.options.host.getBoundingClientRect();
      const rect = button.getBoundingClientRect();
      const grabX = event.clientX - rect.left;
      const grabY = event.clientY - rect.top;
      let moving = false;
      // Capture dès l'appui : un geste rapide qui sort du bouton avant le seuil déplace quand même l'icône.
      try {
        button.setPointerCapture(event.pointerId);
      } catch {
        /* pointeur déjà relâché */
      }

      const move = (e: PointerEvent): void => {
        if (!moving && Math.hypot(e.clientX - startX, e.clientY - startY) < DRAG_THRESHOLD) return;
        if (!moving) {
          moving = true;
          dragged = true;
          button.classList.add('bicon--dragging');
          this.select(item.id);
        }
        button.style.left = `${e.clientX - hostRect.left - grabX}px`;
        button.style.top = `${e.clientY - hostRect.top - grabY}px`;
      };
      const end = (e: PointerEvent): void => {
        button.removeEventListener('pointermove', move);
        button.removeEventListener('pointerup', end);
        button.removeEventListener('pointercancel', end);
        button.classList.remove('bicon--dragging');
        if (!moving) return;
        const x = e.clientX - hostRect.left - grabX - ORIGIN_X;
        const y = e.clientY - hostRect.top - grabY - ORIGIN_Y;
        this.moveTo(item.id, pointToCell(x, y));
      };
      button.addEventListener('pointermove', move);
      button.addEventListener('pointerup', end);
      button.addEventListener('pointercancel', end);
    });
    return button;
  }

  private focusNeighbour(id: string, step: Cell): void {
    const from = this.cells[id];
    if (!from) return;
    const target = { col: from.col + step.col, row: from.row + step.row };
    for (const [other, cell] of Object.entries(this.cells)) {
      if (cell.col === target.col && cell.row === target.row) this.buttons.get(other)?.focus();
    }
  }
}
