import type { AppContext } from '../../core/types';
import { floodFill } from './fill';
import { createHistory } from './history';
import { t, type MessageKey } from './i18n';
import { DEFAULT_BACKGROUND, DEFAULT_FOREGROUND, PALETTE, colorName } from './palette';
import { createRaster, hexToRgba, type Box, type Point, type RGBA } from './raster';
import {
  SIZES,
  drawShape,
  pickColor,
  strokeBounds,
  strokeSegment,
  type FillStyle,
  type FreehandTool,
  type ShapeTool,
  type Tool,
} from './tools';
import './style.css';

const SVG_NS = 'http://www.w3.org/2000/svg';
const WIDTH = 640;
const HEIGHT = 400;
const HISTORY_LIMIT = 30;

const TOOLS: ReadonlyArray<{ id: Tool; name: MessageKey; paths: readonly string[] }> = [
  { id: 'pencil', name: 'tool_pencil', paths: ['M4 20l1-5L16 4l4 4L9 19z', 'M14 6l4 4'] },
  { id: 'brush', name: 'tool_brush', paths: ['M20 4L12 12', 'M12 12c-3 0-5 2-5 5 0 2-2 3-3 3 4 1 9 0 9-5 0-1-1-3-1-3z'] },
  { id: 'eraser', name: 'tool_eraser', paths: ['M3 16L12 5l8 7-7 8H7z', 'M8 10l8 7'] },
  { id: 'line', name: 'tool_line', paths: ['M4 20L20 4'] },
  { id: 'rect', name: 'tool_rect', paths: ['M4 6h16v12H4z'] },
  { id: 'ellipse', name: 'tool_ellipse', paths: ['M12 5c5 0 9 3 9 7s-4 7-9 7-9-3-9-7 4-7 9-7z'] },
  { id: 'fill', name: 'tool_fill', paths: ['M5 12l7-7 7 7-7 7z', 'M19 15c1 2 2 3 2 4a2 2 0 0 1-4 0c0-1 1-2 2-4z'] },
  { id: 'picker', name: 'tool_picker', paths: ['M16 3l5 5-3 3-5-5z', 'M13 8L5 16v3h3l8-8'] },
];

const STYLES: ReadonlyArray<{ id: FillStyle; name: MessageKey }> = [
  { id: 'outline', name: 'style_outline' },
  { id: 'filled', name: 'style_filled' },
  { id: 'solid', name: 'style_solid' },
];

let teardown: (() => void) | null = null;

function h<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(className: string, label: string): HTMLButtonElement {
  const b = h('button', className);
  b.type = 'button';
  b.setAttribute('aria-label', label);
  return b;
}

function icon(paths: readonly string[]): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('class', 'bapp-paint-icon');
  for (const d of paths) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}

/** Un geste en cours : un trait, une forme à l'aperçu, avec l'image d'avant pour annuler ou pour redessiner l'aperçu. */
interface Gesture {
  pointerId: number;
  tool: FreehandTool | ShapeTool;
  /** Couleur du trait (pour la gomme : la couleur de fond). */
  color: RGBA;
  /** Couleur de remplissage d'une forme, ou `null` pour un contour seul. */
  fillColor: RGBA | null;
  start: Point;
  last: Point;
  before: Uint8ClampedArray;
}

export function mount(el: HTMLElement, ctx: AppContext): void {
  teardown?.();
  ctx.setTitle(t('title'));

  const raster = createRaster(WIDTH, HEIGHT);
  const history = createHistory<Uint8ClampedArray>(HISTORY_LIMIT);
  let tool: Tool = 'pencil';
  let size = SIZES[0] ?? 1;
  let style: FillStyle = 'outline';
  let fg = DEFAULT_FOREGROUND;
  let bg = DEFAULT_BACKGROUND;
  let gesture: Gesture | null = null;

  // ---------- Construction ----------

  const root = h('div', 'bapp-paint');
  root.tabIndex = -1;

  const bar = h('div', 'bapp-paint-bar');
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', t('fileBar'));
  const barButton = (label: string): HTMLButtonElement => {
    const b = h('button', 'bapp-paint-btn', label);
    b.type = 'button';
    return b;
  };
  const newBtn = barButton(t('newDrawing'));
  const undoBtn = barButton(t('undo'));
  const redoBtn = barButton(t('redo'));
  const saveBtn = barButton(t('save'));
  bar.append(newBtn, undoBtn, redoBtn, saveBtn);

  const confirm = h('div', 'bapp-paint-confirm');
  confirm.setAttribute('role', 'group');
  confirm.setAttribute('aria-label', t('confirmGroup'));
  confirm.hidden = true;
  const confirmText = h('p', 'bapp-paint-confirm-text', t('confirmText'));
  const confirmYes = barButton(t('confirmYes'));
  const confirmNo = barButton(t('confirmNo'));
  confirm.append(confirmText, confirmYes, confirmNo);

  const side = h('div', 'bapp-paint-side');
  const toolGroup = h('div', 'bapp-paint-tools');
  toolGroup.setAttribute('role', 'group');
  toolGroup.setAttribute('aria-label', t('toolsLabel'));
  const toolButtons = new Map<Tool, HTMLButtonElement>();
  for (const def of TOOLS) {
    const b = button('bapp-paint-tool', t(def.name));
    b.dataset['tool'] = def.id;
    b.title = t(def.name);
    b.append(icon(def.paths));
    toolButtons.set(def.id, b);
    toolGroup.append(b);
  }

  const sizeGroup = h('div', 'bapp-paint-sizes');
  sizeGroup.setAttribute('role', 'group');
  sizeGroup.setAttribute('aria-label', t('sizesLabel'));
  const sizeButtons = new Map<number, HTMLButtonElement>();
  for (const n of SIZES) {
    const b = button('bapp-paint-size', t('size', { n }));
    b.dataset['size'] = String(n);
    const sample = h('span', 'bapp-paint-size-line');
    sample.style.setProperty('--bapp-paint-n', `${n}px`);
    sample.setAttribute('aria-hidden', 'true');
    b.append(sample);
    sizeButtons.set(n, b);
    sizeGroup.append(b);
  }

  const styleGroup = h('div', 'bapp-paint-styles');
  styleGroup.setAttribute('role', 'group');
  styleGroup.setAttribute('aria-label', t('styleLabel'));
  const styleButtons = new Map<FillStyle, HTMLButtonElement>();
  for (const def of STYLES) {
    const b = button(`bapp-paint-style bapp-paint-style--${def.id}`, t(def.name));
    b.dataset['style'] = def.id;
    b.title = t(def.name);
    const sample = h('span', 'bapp-paint-style-sample');
    sample.setAttribute('aria-hidden', 'true');
    b.append(sample);
    styleButtons.set(def.id, b);
    styleGroup.append(b);
  }
  side.append(toolGroup, sizeGroup, styleGroup);

  // La zone qui défile se prend au clavier (flèches, Page précédente / suivante) : elle est donc focalisable.
  const scroller = h('div', 'bapp-paint-scroll');
  scroller.tabIndex = 0;
  scroller.setAttribute('role', 'group');
  scroller.setAttribute('aria-label', t('scrollLabel'));
  const canvas = h('canvas', 'bapp-paint-canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', t('canvasLabel'));
  scroller.append(canvas);
  const context = canvas.getContext('2d');

  const paletteBox = h('div', 'bapp-paint-palette');
  const colorsEl = h('div', 'bapp-paint-colors');
  colorsEl.setAttribute('role', 'img');
  const bgEl = h('span', 'bapp-paint-bg');
  const fgEl = h('span', 'bapp-paint-fg');
  colorsEl.append(bgEl, fgEl);
  const swatches = h('div', 'bapp-paint-swatches');
  swatches.setAttribute('role', 'group');
  swatches.setAttribute('aria-label', t('paletteLabel'));
  const hint = h('span', 'bapp-paint-sr', t('paletteHint'));
  hint.id = `bapp-paint-hint-${Math.random().toString(36).slice(2, 8)}`;
  swatches.setAttribute('aria-describedby', hint.id);
  for (const color of PALETTE) {
    const b = button('bapp-paint-swatch', t(color.nameKey));
    b.dataset['color'] = color.hex;
    b.style.backgroundColor = color.hex;
    b.addEventListener('click', (event) => setColor(event.shiftKey ? 'bg' : 'fg', color.hex));
    b.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      setColor('bg', color.hex);
    });
    swatches.append(b);
  }
  paletteBox.append(colorsEl, swatches, hint);

  const statusBar = h('div', 'bapp-paint-statusbar');
  const message = h('span', 'bapp-paint-message', t('statusReady'));
  message.setAttribute('role', 'status');
  const coords = h('span', 'bapp-paint-coords');
  coords.setAttribute('aria-hidden', 'true');
  statusBar.append(message, coords);

  root.append(bar, confirm, side, scroller, paletteBox, statusBar);
  el.replaceChildren(root);

  // ---------- État affiché ----------

  const colorLabel = (hex: string): string => {
    const key = colorName(hex);
    return key ? t(key) : hex;
  };
  const say = (text: string): void => {
    message.textContent = text;
  };

  function setColor(which: 'fg' | 'bg', hex: string): void {
    if (which === 'fg') fg = hex;
    else bg = hex;
    refreshColors();
    say(t(which === 'fg' ? 'statusFg' : 'statusBg', { color: colorLabel(hex) }));
  }

  function refreshColors(): void {
    fgEl.style.backgroundColor = fg;
    bgEl.style.backgroundColor = bg;
    colorsEl.setAttribute('aria-label', t('colorsLabel', { fg: colorLabel(fg), bg: colorLabel(bg) }));
  }

  /** Désactiver un bouton qui a le focus le ferait perdre : le focus reste alors dans la fenêtre. */
  function setDisabled(b: HTMLButtonElement, disabled: boolean): void {
    if (disabled && document.activeElement === b) root.focus({ preventScroll: true });
    b.disabled = disabled;
  }

  function refreshHistory(): void {
    setDisabled(undoBtn, !history.canUndo());
    setDisabled(redoBtn, !history.canRedo());
  }

  function refreshTools(): void {
    for (const [id, b] of toolButtons) b.setAttribute('aria-pressed', String(id === tool));
    for (const [n, b] of sizeButtons) b.setAttribute('aria-pressed', String(n === size));
    for (const [id, b] of styleButtons) b.setAttribute('aria-pressed', String(id === style));
    styleGroup.hidden = tool !== 'rect' && tool !== 'ellipse';
  }

  /** Envoie l'image (ou seulement une zone) au canevas. */
  function present(area?: Box): void {
    if (!context) return;
    const image = new ImageData(raster.data, WIDTH, HEIGHT);
    if (area) context.putImageData(image, 0, 0, area.x0, area.y0, area.x1 - area.x0 + 1, area.y1 - area.y0 + 1);
    else context.putImageData(image, 0, 0);
  }

  const rgba = (hex: string): RGBA => hexToRgba(hex);

  // ---------- Dessin ----------

  function toPoint(event: PointerEvent): Point {
    const rect = canvas.getBoundingClientRect();
    const sx = rect.width > 0 ? WIDTH / rect.width : 1;
    const sy = rect.height > 0 ? HEIGHT / rect.height : 1;
    return { x: Math.floor((event.clientX - rect.left) * sx), y: Math.floor((event.clientY - rect.top) * sy) };
  }

  function renderShape(g: Gesture, to: Point, constrain: boolean): void {
    raster.data.set(g.before);
    drawShape(raster, g.tool as ShapeTool, g.start, to, { size, color: g.color, fillColor: g.fillColor, constrain });
    present();
  }

  function commit(g: Gesture): void {
    history.push(g.before);
    gesture = null;
    refreshHistory();
  }

  function abort(g: Gesture): void {
    raster.data.set(g.before);
    present();
    gesture = null;
  }

  function strokeTo(g: Gesture, to: Point): void {
    strokeSegment(raster, g.tool as FreehandTool, g.last, to, size, g.color);
    const a = strokeBounds(raster, g.last, to, g.tool as FreehandTool, size);
    present(a);
    g.last = to;
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (gesture || (event.button !== 0 && event.button !== 2)) return;
    event.preventDefault();
    root.focus({ preventScroll: true });
    const at = toPoint(event);
    const right = event.button === 2;
    const main = rgba(right ? bg : fg);
    const other = rgba(right ? fg : bg);

    if (tool === 'picker') {
      const hex = pickColor(raster, at.x, at.y);
      if (hex) {
        setColor(right ? 'bg' : 'fg', hex);
        say(t('statusPicked', { color: hex }));
      }
      return;
    }
    if (tool === 'fill') {
      const before = raster.data.slice();
      if (floodFill(raster, at.x, at.y, main) > 0) {
        history.push(before);
        present();
        refreshHistory();
      }
      return;
    }

    canvas.setPointerCapture?.(event.pointerId);
    const freehand = tool === 'pencil' || tool === 'brush' || tool === 'eraser';
    const g: Gesture = {
      pointerId: event.pointerId,
      tool,
      color: tool === 'eraser' ? other : main,
      fillColor: !freehand && style === 'filled' ? other : style === 'solid' ? main : null,
      start: at,
      last: at,
      before: raster.data.slice(),
    };
    gesture = g;
    if (freehand) strokeTo(g, at);
    else renderShape(g, at, event.shiftKey);
  });

  canvas.addEventListener('pointermove', (event) => {
    const at = toPoint(event);
    coords.textContent = at.x >= 0 && at.y >= 0 && at.x < WIDTH && at.y < HEIGHT ? `${at.x}, ${at.y}` : '';
    const g = gesture;
    if (!g || g.pointerId !== event.pointerId) return;
    if (g.tool === 'pencil' || g.tool === 'brush' || g.tool === 'eraser') {
      // Le navigateur regroupe parfois plusieurs positions en un événement : on les relie toutes.
      const steps = typeof event.getCoalescedEvents === 'function' ? event.getCoalescedEvents() : [];
      for (const step of steps.length > 0 ? steps : [event]) strokeTo(g, toPoint(step));
    } else {
      renderShape(g, at, event.shiftKey);
    }
  });

  const finish = (event: PointerEvent, cancelled: boolean): void => {
    const g = gesture;
    if (!g || g.pointerId !== event.pointerId) return;
    const freehand = g.tool === 'pencil' || g.tool === 'brush' || g.tool === 'eraser';
    if (freehand) {
      if (!cancelled) strokeTo(g, toPoint(event));
      commit(g);
    } else if (cancelled) {
      abort(g);
    } else {
      renderShape(g, toPoint(event), event.shiftKey);
      commit(g);
    }
    if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture?.(event.pointerId);
  };
  canvas.addEventListener('pointerup', (event) => finish(event, false));
  canvas.addEventListener('pointercancel', (event) => finish(event, true));
  canvas.addEventListener('pointerleave', () => {
    coords.textContent = '';
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  // ---------- Commandes ----------

  function undo(): void {
    if (gesture) return;
    const previous = history.undo(raster.data.slice());
    if (!previous) return;
    raster.data.set(previous);
    present();
    refreshHistory();
    say(t('statusUndone'));
  }

  function redo(): void {
    if (gesture) return;
    const next = history.redo(raster.data.slice());
    if (!next) return;
    raster.data.set(next);
    present();
    refreshHistory();
    say(t('statusRedone'));
  }

  function closeConfirm(): void {
    confirm.hidden = true;
    newBtn.focus({ preventScroll: true });
  }

  function save(): void {
    canvas.toBlob((blob) => {
      if (!blob) {
        say(t('statusSaveFail'));
        return;
      }
      const name = t('fileName');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      link.hidden = true;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      say(t('statusSaved', { name }));
    }, 'image/png');
  }

  for (const [id, b] of toolButtons) {
    b.addEventListener('click', () => {
      tool = id;
      refreshTools();
    });
  }
  for (const [n, b] of sizeButtons) {
    b.addEventListener('click', () => {
      size = n;
      refreshTools();
    });
  }
  for (const [id, b] of styleButtons) {
    b.addEventListener('click', () => {
      style = id;
      refreshTools();
    });
  }
  undoBtn.addEventListener('click', undo);
  redoBtn.addEventListener('click', redo);
  saveBtn.addEventListener('click', save);
  newBtn.addEventListener('click', () => {
    confirm.hidden = false;
    confirmNo.focus({ preventScroll: true });
  });
  confirmNo.addEventListener('click', closeConfirm);
  confirmYes.addEventListener('click', () => {
    history.push(raster.data.slice());
    raster.data.set(createRaster(WIDTH, HEIGHT).data);
    present();
    refreshHistory();
    say(t('statusNew'));
    closeConfirm();
  });

  // Le clavier n'est écouté que sur la fenêtre de Paint : jamais sur toute la page.
  const host = el.closest<HTMLElement>('.bwin') ?? el;
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      // Échap annule d'abord le geste en cours, puis la confirmation ; sinon il ferme la fenêtre.
      if (gesture) abort(gesture);
      else if (!confirm.hidden) closeConfirm();
      else return;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if ((!event.ctrlKey && !event.metaKey) || event.altKey) return;
    const k = event.key.toLowerCase();
    if (k === 'z' && !event.shiftKey) undo();
    else if (k === 'y' || (k === 'z' && event.shiftKey)) redo();
    else return;
    event.preventDefault();
    event.stopPropagation();
  };
  host.addEventListener('keydown', onKeyDown, true);

  refreshTools();
  refreshColors();
  refreshHistory();
  present();
  root.focus({ preventScroll: true });

  teardown = () => {
    host.removeEventListener('keydown', onKeyDown, true);
    gesture = null;
    el.replaceChildren();
    teardown = null;
  };
}

export function unmount(): void {
  teardown?.();
}
