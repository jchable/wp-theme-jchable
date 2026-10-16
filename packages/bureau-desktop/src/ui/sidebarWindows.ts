import { clampPosition } from '../core/windowStack';
import type { PrefsApi } from '../core/prefs';

const GRAB = 56;

/**
 * Les fenêtres de la barre latérale se déplacent par leur barre de titre, comme sur un vrai bureau.
 * Le décalage (par rapport à leur place normale) est mémorisé. Les fenêtres des articles ne bougent jamais.
 */
export class SidebarWindows {
  private cleanups: Array<() => void> = [];

  constructor(
    private readonly prefs: PrefsApi,
    private readonly root: ParentNode = document,
  ) {}

  private windows(): HTMLElement[] {
    return [...this.root.querySelectorAll<HTMLElement>('.sidebar-windows > .window')];
  }

  mount(): void {
    this.windows().forEach((el, index) => {
      const id = `side-${index}`;
      const saved = this.prefs.get().windows[id];
      if (saved) this.apply(el, saved.x, saved.y);
      const handle = el.querySelector<HTMLElement>('.window-titlebar');
      if (!handle) return;
      handle.classList.add('bwin-handle');
      const down = (event: PointerEvent): void => this.startDrag(event, el, handle, id);
      handle.addEventListener('pointerdown', down);
      this.cleanups.push(() => {
        handle.removeEventListener('pointerdown', down);
        handle.classList.remove('bwin-handle');
      });
    });
  }

  /** Remet les fenêtres à leur place d'origine et oublie leur position. */
  reset(): void {
    this.windows().forEach((el, index) => {
      el.style.transform = '';
      this.prefs.update((p) => {
        delete p.windows[`side-${index}`];
      });
    });
  }

  destroy(): void {
    this.cleanups.forEach((cleanup) => cleanup());
    this.cleanups = [];
    this.windows().forEach((el) => (el.style.transform = ''));
  }

  private apply(el: HTMLElement, x: number, y: number): void {
    el.style.transform = `translate(${x}px, ${y}px)`;
  }

  private currentOffset(el: HTMLElement): { x: number; y: number } {
    const match = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(el.style.transform);
    return { x: Number(match?.[1] ?? 0), y: Number(match?.[2] ?? 0) };
  }

  private startDrag(event: PointerEvent, el: HTMLElement, handle: HTMLElement, id: string): void {
    if (event.button !== 0) return;
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const offset = this.currentOffset(el);
    const rect = el.getBoundingClientRect();
    handle.setPointerCapture(event.pointerId);
    el.classList.add('window--dragging');
    const move = (e: PointerEvent): void => {
      const absolute = clampPosition(
        { x: rect.left + e.clientX - startX, y: rect.top + e.clientY - startY },
        { w: rect.width, h: rect.height },
        { w: window.innerWidth, h: window.innerHeight },
        GRAB,
      );
      this.apply(el, offset.x + absolute.x - rect.left, offset.y + absolute.y - rect.top);
    };
    const end = (): void => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
      handle.removeEventListener('pointercancel', end);
      el.classList.remove('window--dragging');
      const final = this.currentOffset(el);
      this.prefs.update((p) => {
        p.windows[id] = { x: Math.round(final.x), y: Math.round(final.y), minimized: false };
      });
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  }
}
