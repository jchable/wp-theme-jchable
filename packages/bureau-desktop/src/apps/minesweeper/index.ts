import type { AppContext } from '../../core/types';
import {
  LEVELS,
  chord,
  createBoard,
  flagsLeft,
  isWrongFlag,
  reveal,
  toggleFlag,
  type Board,
  type LevelId,
} from './board';
import { t } from './i18n';
import './style.css';

const SVG_NS = 'http://www.w3.org/2000/svg';
const LONG_PRESS_MS = 500;
const LONG_PRESS_MOVE_PX = 10;
const MAX_SECONDS = 999;

function levelLabel(id: LevelId): string {
  return id === 'beginner' ? t('levelBeginner') : id === 'intermediate' ? t('levelIntermediate') : t('levelExpert');
}

type Face = 'smile' | 'surprise' | 'dead' | 'cool';

interface State {
  ctx: AppContext;
  root: HTMLElement;
  levelId: LevelId;
  board: Board;
  buttons: HTMLButtonElement[];
  grid: HTMLElement;
  select: HTMLSelectElement;
  face: HTMLButtonElement;
  mineLcd: HTMLElement;
  timeLcd: HTMLElement;
  best: HTMLElement;
  status: HTMLElement;
  focusIndex: number;
  timerId: number | null;
  startedAt: number;
  seconds: number;
  pressTimer: number | null;
  pressStart: { x: number; y: number } | null;
  longPressed: boolean;
  touchActive: boolean;
}

let state: State | null = null;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function svg(viewBox: string, ...shapes: Array<[string, Record<string, string>]>): SVGSVGElement {
  const root = document.createElementNS(SVG_NS, 'svg');
  root.setAttribute('viewBox', viewBox);
  root.setAttribute('aria-hidden', 'true');
  root.setAttribute('focusable', 'false');
  for (const [name, attrs] of shapes) {
    const shape = document.createElementNS(SVG_NS, name);
    for (const [k, v] of Object.entries(attrs)) shape.setAttribute(k, v);
    root.appendChild(shape);
  }
  return root;
}

function flagIcon(): SVGSVGElement {
  return svg(
    '0 0 16 16',
    ['path', { d: 'M5 2 L12 5 L5 8 Z', fill: '#c01818' }],
    ['rect', { x: '5', y: '2', width: '1.5', height: '10', fill: '#101010' }],
    ['rect', { x: '3', y: '12', width: '8', height: '2', fill: '#101010' }],
  );
}

function mineIcon(): SVGSVGElement {
  return svg(
    '0 0 16 16',
    ['circle', { cx: '8', cy: '8', r: '4.2', fill: '#101010' }],
    ['path', { d: 'M8 1.5V14.5M1.5 8H14.5M3.4 3.4L12.6 12.6M12.6 3.4L3.4 12.6', stroke: '#101010', 'stroke-width': '1.4' }],
    ['rect', { x: '6.2', y: '6.2', width: '1.8', height: '1.8', fill: '#ffffff' }],
  );
}

function crossIcon(): SVGSVGElement {
  return svg(
    '0 0 16 16',
    ['path', { d: 'M3 3L13 13M13 3L3 13', stroke: '#c01818', 'stroke-width': '2' }],
  );
}

function faceIcon(kind: Face): SVGSVGElement {
  const shapes: Array<[string, Record<string, string>]> = [
    ['circle', { cx: '12', cy: '12', r: '10', fill: 'var(--wp--preset--color--yellow, #FFE14D)', stroke: '#101010', 'stroke-width': '1.5' }],
  ];
  if (kind === 'cool') {
    shapes.push(
      ['rect', { x: '5', y: '8.5', width: '6', height: '3.5', rx: '1', fill: '#101010' }],
      ['rect', { x: '13', y: '8.5', width: '6', height: '3.5', rx: '1', fill: '#101010' }],
      ['path', { d: 'M5 9H19', stroke: '#101010', 'stroke-width': '1.4' }],
      ['path', { d: 'M7.5 15.5Q12 19.5 16.5 15.5', fill: 'none', stroke: '#101010', 'stroke-width': '1.6' }],
    );
  } else if (kind === 'dead') {
    shapes.push(
      ['path', { d: 'M6.5 8L10 11.5M10 8L6.5 11.5M14 8L17.5 11.5M17.5 8L14 11.5', stroke: '#101010', 'stroke-width': '1.5' }],
      ['path', { d: 'M7.5 17.5Q12 13.5 16.5 17.5', fill: 'none', stroke: '#101010', 'stroke-width': '1.6' }],
    );
  } else if (kind === 'surprise') {
    shapes.push(
      ['circle', { cx: '8.5', cy: '9.5', r: '1.6', fill: '#101010' }],
      ['circle', { cx: '15.5', cy: '9.5', r: '1.6', fill: '#101010' }],
      ['ellipse', { cx: '12', cy: '16.5', rx: '2.2', ry: '2.8', fill: '#101010' }],
    );
  } else {
    shapes.push(
      ['circle', { cx: '8.5', cy: '9.5', r: '1.6', fill: '#101010' }],
      ['circle', { cx: '15.5', cy: '9.5', r: '1.6', fill: '#101010' }],
      ['path', { d: 'M7 14.5Q12 19.5 17 14.5', fill: 'none', stroke: '#101010', 'stroke-width': '1.6' }],
    );
  }
  return svg('0 0 24 24', ...shapes);
}

function faceLabel(kind: Face): string {
  if (kind === 'dead') return t('faceLost');
  if (kind === 'cool') return t('faceWon');
  return t('faceNew');
}

function setFace(s: State, kind: Face): void {
  s.face.replaceChildren(faceIcon(kind));
  s.face.setAttribute('aria-label', faceLabel(kind));
}

function lcd(n: number): string {
  if (n < 0) return '-' + String(Math.min(99, -n)).padStart(2, '0');
  return String(Math.min(999, n)).padStart(3, '0');
}

function isLevelId(v: string | null): v is LevelId {
  return v === 'beginner' || v === 'intermediate' || v === 'expert';
}

function bestKey(id: LevelId): string {
  return 'best-' + id;
}

function readBest(s: State, id: LevelId): number | null {
  const raw = s.ctx.storage.get(bestKey(id));
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function renderBest(s: State): void {
  const best = readBest(s, s.levelId);
  s.best.textContent = best === null ? t('bestNone') : t('best', { seconds: best });
}

function cellLabel(s: State, i: number): string {
  const c = s.board.cells[i]!;
  const pos = t('cellPos', { row: Math.floor(i / s.board.cols) + 1, col: (i % s.board.cols) + 1 });
  if (isWrongFlag(s.board, i)) return t('cellWrongFlag', { pos });
  if (c.flagged) return t('cellFlag', { pos });
  if (!c.revealed) return t('cellClosed', { pos });
  if (c.mine) return t('cellMine', { pos });
  if (c.adjacent === 0) return t('cellNoNeighbor', { pos });
  return c.adjacent === 1 ? t('cellOneNeighbor', { pos }) : t('cellNeighbors', { pos, n: c.adjacent });
}

function renderCell(s: State, i: number): void {
  const btn = s.buttons[i]!;
  const c = s.board.cells[i]!;
  const classes = ['bapp-minesweeper-cell'];
  btn.replaceChildren();
  if (isWrongFlag(s.board, i)) {
    classes.push('bapp-minesweeper-wrong');
    btn.append(flagIcon(), crossIcon());
  } else if (c.flagged) {
    classes.push('bapp-minesweeper-flagged');
    btn.append(flagIcon());
  } else if (c.revealed) {
    classes.push('bapp-minesweeper-open');
    if (c.mine) {
      classes.push('bapp-minesweeper-mine');
      if (s.board.exploded === i) classes.push('bapp-minesweeper-exploded');
      btn.append(mineIcon());
    } else if (c.adjacent > 0) {
      classes.push(`bapp-minesweeper-n${c.adjacent}`);
      btn.textContent = String(c.adjacent);
    }
  }
  btn.className = classes.join(' ');
  btn.setAttribute('aria-label', cellLabel(s, i));
}

function renderCounters(s: State): void {
  s.mineLcd.textContent = lcd(flagsLeft(s.board));
  s.mineLcd.setAttribute('aria-label', t('minesLeft', { n: flagsLeft(s.board) }));
  s.timeLcd.textContent = lcd(s.seconds);
  s.timeLcd.setAttribute('aria-label', t('time', { seconds: s.seconds }));
}

function stopTimer(s: State): void {
  if (s.timerId !== null) {
    window.clearInterval(s.timerId);
    s.timerId = null;
  }
}

function tick(s: State): void {
  s.seconds = Math.min(MAX_SECONDS, Math.floor((Date.now() - s.startedAt) / 1000));
  renderCounters(s);
}

function startTimer(s: State): void {
  stopTimer(s);
  s.startedAt = Date.now();
  s.seconds = 0;
  s.timerId = window.setInterval(() => tick(s), 1000);
}

function focusCell(s: State, i: number, move: boolean): void {
  const prev = s.buttons[s.focusIndex];
  if (prev) prev.tabIndex = -1;
  s.focusIndex = i;
  const next = s.buttons[i]!;
  next.tabIndex = 0;
  if (move) next.focus();
}

function newGame(s: State): void {
  stopTimer(s);
  cancelPress(s);
  s.board = createBoard(LEVELS[s.levelId]);
  s.seconds = 0;
  s.status.textContent = '';
  s.buttons = [];
  const rows: HTMLElement[] = [];
  for (let y = 0; y < s.board.rows; y++) {
    const row = el('div', 'bapp-minesweeper-row');
    row.setAttribute('role', 'row');
    for (let x = 0; x < s.board.cols; x++) {
      const i = y * s.board.cols + x;
      const btn = el('button', 'bapp-minesweeper-cell');
      btn.type = 'button';
      btn.tabIndex = -1;
      btn.setAttribute('role', 'gridcell');
      btn.dataset.index = String(i);
      s.buttons.push(btn);
      row.appendChild(btn);
    }
    rows.push(row);
  }
  s.grid.replaceChildren(...rows);
  s.grid.setAttribute('aria-rowcount', String(s.board.rows));
  s.grid.setAttribute('aria-colcount', String(s.board.cols));
  s.grid.style.setProperty('--bapp-minesweeper-cols', String(s.board.cols));
  s.focusIndex = 0;
  s.buttons.forEach((_, i) => renderCell(s, i));
  s.buttons[0]!.tabIndex = 0;
  setFace(s, 'smile');
  renderCounters(s);
  renderBest(s);
}

/** Met à jour l'affichage après une action, et gère la fin de partie. */
function afterAction(s: State, before: Board['status'], changed: number[]): void {
  if (before === 'ready' && s.board.status !== 'ready') startTimer(s);
  const redraw = new Set(changed);
  if (s.board.status === 'lost') s.board.cells.forEach((_, i) => redraw.add(i));
  redraw.forEach((i) => renderCell(s, i));
  if (s.board.status === 'playing') {
    renderCounters(s);
    return;
  }
  if (s.board.status === 'won' || s.board.status === 'lost') {
    tick(s);
    stopTimer(s);
    renderCounters(s);
    if (s.board.status === 'won') {
      const seconds = Math.max(1, s.seconds);
      const best = readBest(s, s.levelId);
      let message = t('won', { seconds: s.seconds });
      if (best === null || seconds < best) {
        s.ctx.storage.set(bestKey(s.levelId), String(seconds));
        message += t('newRecord');
      }
      s.status.textContent = message;
      renderBest(s);
      setFace(s, 'cool');
    } else {
      s.status.textContent = t('lost');
      setFace(s, 'dead');
    }
  }
}

function doReveal(s: State, i: number): void {
  const before = s.board.status;
  const cell = s.board.cells[i]!;
  const changed = cell.revealed ? chord(s.board, i) : reveal(s.board, i);
  afterAction(s, before, changed);
}

function doChord(s: State, i: number): void {
  const before = s.board.status;
  afterAction(s, before, chord(s.board, i));
}

function doFlag(s: State, i: number): void {
  if (!toggleFlag(s.board, i)) return;
  renderCell(s, i);
  renderCounters(s);
}

function cancelPress(s: State): void {
  if (s.pressTimer !== null) {
    window.clearTimeout(s.pressTimer);
    s.pressTimer = null;
  }
  s.pressStart = null;
}

function indexOf(target: EventTarget | null): number | null {
  if (!(target instanceof Element)) return null;
  const btn = target.closest<HTMLElement>('.bapp-minesweeper-cell');
  if (!btn || btn.dataset.index === undefined) return null;
  return Number(btn.dataset.index);
}

function bindGrid(s: State): void {
  const grid = s.grid;

  grid.addEventListener('click', (e) => {
    const i = indexOf(e.target);
    if (i === null) return;
    focusCell(s, i, false);
    if (s.longPressed) {
      s.longPressed = false;
      return;
    }
    if (!s.board.cells[i]!.revealed) doReveal(s, i);
    else if (e.detail === 0) doChord(s, i); // Entrée sur un chiffre au clavier
  });

  grid.addEventListener('dblclick', (e) => {
    const i = indexOf(e.target);
    if (i !== null && s.board.cells[i]!.revealed) doChord(s, i);
  });

  grid.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (s.touchActive) return; // l'appui long tactile gère déjà le drapeau
    const i = indexOf(e.target);
    if (i === null) return;
    focusCell(s, i, false);
    doFlag(s, i);
  });

  grid.addEventListener('auxclick', (e) => {
    if (e.button !== 1) return;
    e.preventDefault();
    const i = indexOf(e.target);
    if (i !== null) doChord(s, i);
  });

  grid.addEventListener('mousedown', (e) => {
    if (e.button === 1) e.preventDefault(); // évite le défilement par clic molette
  });

  grid.addEventListener('pointerdown', (e) => {
    if (e.button === 0 && s.board.status !== 'won' && s.board.status !== 'lost') setFace(s, 'surprise');
    if (e.pointerType !== 'touch') return;
    const i = indexOf(e.target);
    if (i === null) return;
    s.touchActive = true;
    s.longPressed = false;
    cancelPress(s);
    s.pressStart = { x: e.clientX, y: e.clientY };
    s.pressTimer = window.setTimeout(() => {
      s.pressTimer = null;
      s.longPressed = true;
      focusCell(s, i, false);
      doFlag(s, i);
    }, LONG_PRESS_MS);
  });

  grid.addEventListener('pointermove', (e) => {
    if (s.pressTimer === null || !s.pressStart) return;
    if (Math.hypot(e.clientX - s.pressStart.x, e.clientY - s.pressStart.y) > LONG_PRESS_MOVE_PX) {
      cancelPress(s);
    }
  });

  const endPress = (): void => {
    cancelPress(s);
    const { status } = s.board;
    if (status === 'ready' || status === 'playing') setFace(s, 'smile');
    // Garde touchActive jusqu'au contextmenu éventuel, puis le relâche.
    window.setTimeout(() => {
      if (state === s) s.touchActive = false;
    }, 600);
  };
  grid.addEventListener('pointerup', endPress);
  grid.addEventListener('pointercancel', endPress);
  grid.addEventListener('pointerleave', () => {
    cancelPress(s);
    const { status } = s.board;
    if (status === 'ready' || status === 'playing') setFace(s, 'smile');
  });

  grid.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const i = indexOf(e.target);
    if (i === null) return;
    const { cols, rows } = s.board;
    const x = i % cols;
    const y = Math.floor(i / cols);
    let next: number | null = null;
    switch (e.key) {
      case 'ArrowLeft':
        next = x > 0 ? i - 1 : i;
        break;
      case 'ArrowRight':
        next = x < cols - 1 ? i + 1 : i;
        break;
      case 'ArrowUp':
        next = y > 0 ? i - cols : i;
        break;
      case 'ArrowDown':
        next = y < rows - 1 ? i + cols : i;
        break;
      case 'Home':
        next = y * cols;
        break;
      case 'End':
        next = y * cols + cols - 1;
        break;
      case 'f':
      case 'F':
        e.preventDefault();
        doFlag(s, i);
        return;
      default:
        return;
    }
    e.preventDefault();
    focusCell(s, next, true);
  });
}

function build(ctx: AppContext, root: HTMLElement): State {
  const savedLevel = ctx.storage.get('level');
  const levelId: LevelId = isLevelId(savedLevel) ? savedLevel : 'beginner';

  const wrap = el('div', 'bapp-minesweeper');

  const bar = el('div', 'bapp-minesweeper-bar');
  const selectId = 'bapp-minesweeper-level-' + Math.random().toString(36).slice(2, 8);
  const label = el('label', 'bapp-minesweeper-label', t('levelLabel'));
  label.htmlFor = selectId;
  const select = el('select', 'bapp-minesweeper-select');
  select.id = selectId;
  (Object.keys(LEVELS) as LevelId[]).forEach((id) => {
    const l = LEVELS[id];
    const opt = el('option', undefined, t('levelOption', { name: levelLabel(id), cols: l.cols, rows: l.rows, mines: l.mines }));
    opt.value = id;
    select.appendChild(opt);
  });
  select.value = levelId;
  const best = el('span', 'bapp-minesweeper-best');
  bar.append(label, select, best);

  const head = el('div', 'bapp-minesweeper-head');
  const mineLcd = el('span', 'bapp-minesweeper-lcd');
  mineLcd.setAttribute('role', 'img');
  const face = el('button', 'bapp-minesweeper-face');
  face.type = 'button';
  const timeLcd = el('span', 'bapp-minesweeper-lcd');
  timeLcd.setAttribute('role', 'img');
  head.append(mineLcd, face, timeLcd);

  const scroll = el('div', 'bapp-minesweeper-scroll');
  const grid = el('div', 'bapp-minesweeper-grid');
  grid.setAttribute('role', 'grid');
  grid.setAttribute('aria-label', t('gridLabel'));
  scroll.appendChild(grid);

  const status = el('p', 'bapp-minesweeper-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');

  const help = el('p', 'bapp-minesweeper-help', t('help'));

  wrap.append(bar, head, scroll, status, help);
  root.replaceChildren(wrap);

  const s: State = {
    ctx,
    root,
    levelId,
    board: createBoard(LEVELS[levelId]),
    buttons: [],
    grid,
    select,
    face,
    mineLcd,
    timeLcd,
    best,
    status,
    focusIndex: 0,
    timerId: null,
    startedAt: 0,
    seconds: 0,
    pressTimer: null,
    pressStart: null,
    longPressed: false,
    touchActive: false,
  };

  select.addEventListener('change', () => {
    if (!isLevelId(select.value)) return;
    s.levelId = select.value;
    ctx.storage.set('level', s.levelId);
    newGame(s);
  });
  face.addEventListener('click', () => {
    newGame(s);
    focusCell(s, 0, false);
  });
  bindGrid(s);
  newGame(s);
  return s;
}

export function mount(host: HTMLElement, ctx: AppContext): void {
  if (state) unmount();
  ctx.setTitle(t('title'));
  state = build(ctx, host);
}

export function unmount(): void {
  if (!state) return;
  stopTimer(state);
  cancelPress(state);
  state.root.replaceChildren();
  state = null;
}
