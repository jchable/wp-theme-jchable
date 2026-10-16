/** Ordre d'empilement des fenêtres (logique pure, sans DOM). */
export class WindowStack {
  private readonly ids: string[] = [];
  private readonly minimized = new Set<string>();

  constructor(private readonly baseZ: number) {}

  open(id: string): void {
    this.remove(id);
    this.ids.push(id);
    this.minimized.delete(id);
  }

  bringToFront(id: string): void {
    if (!this.ids.includes(id)) return;
    this.remove(id);
    this.ids.push(id);
  }

  close(id: string): void {
    this.remove(id);
    this.minimized.delete(id);
  }

  setMinimized(id: string, value: boolean): void {
    if (!this.ids.includes(id)) return;
    if (value) this.minimized.add(id);
    else this.minimized.delete(id);
  }

  has(id: string): boolean {
    return this.ids.includes(id);
  }

  /** Fenêtre visible la plus en avant. */
  top(): string | undefined {
    for (let i = this.ids.length - 1; i >= 0; i--) {
      const id = this.ids[i];
      if (id !== undefined && !this.minimized.has(id)) return id;
    }
    return undefined;
  }

  /** Du fond vers le premier plan. */
  order(): string[] {
    return [...this.ids];
  }

  zIndex(id: string): number {
    const index = this.ids.indexOf(id);
    return index < 0 ? this.baseZ : this.baseZ + index;
  }

  private remove(id: string): void {
    const index = this.ids.indexOf(id);
    if (index >= 0) this.ids.splice(index, 1);
  }
}

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  w: number;
  h: number;
}

/**
 * Garde une fenêtre atteignable : au moins `grab` pixels restent visibles sur les côtés et en bas,
 * et la barre de titre ne sort jamais par le haut.
 */
export function clampPosition(position: Point, size: Size, area: Size, grab: number): Point {
  const minX = -(size.w - grab);
  const maxX = Math.max(area.w - grab, minX);
  const maxY = Math.max(area.h - grab, 0);
  return {
    x: Math.min(Math.max(position.x, minX), maxX),
    y: Math.min(Math.max(position.y, 0), maxY),
  };
}

export interface Box extends Point, Size {}

/** Recadre une fenêtre dans l'écran quand celui-ci rétrécit : taille bornée, position atteignable. */
export function fitBox(box: Point & { w: number; h: number }, area: Size, grab: number): Box {
  const w = Math.max(1, Math.min(box.w, area.w - 24));
  const h = Math.max(1, Math.min(box.h, area.h - 24));
  const at = clampPosition({ x: box.x, y: box.y }, { w, h }, area, grab);
  return { x: at.x, y: at.y, w, h };
}
