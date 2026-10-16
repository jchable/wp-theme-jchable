import type { AppContext } from '../../core/types';
import { formatCount, formatDate, formatSize, moveSelection, totalSize } from './helpers';
import { TRASH_ITEMS, type TrashItem } from './items';
import './style.css';

const SVG_NS = 'http://www.w3.org/2000/svg';
const SHRED_DURATION_MS = 600;
const SHRED_STEP_MS = 50;
const RESTORE_GAG = 'Impossible de restaurer : le brouillon a été supprimé pour de bonnes raisons.';
const NO_SELECTION_HINT = 'Sélectionnez un fichier pour voir un aperçu.';

/** Réglages injectables (tests) : attente et détection du mouvement réduit. */
export interface TrashOptions {
  wait?: (ms: number) => Promise<void>;
  reducedMotion?: () => boolean;
}

/** État de la session uniquement (pas de stockage) : un rechargement remplit à nouveau la corbeille. */
let emptied = false;
let teardown: (() => void) | null = null;

/** Remplit à nouveau la corbeille (tests). */
export function resetTrashSession(): void {
  emptied = false;
}

const defaultWait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const defaultReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string>,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

/** Corbeille en papier, vide. */
function binIcon(): SVGSVGElement {
  const root = svg('svg', {
    viewBox: '0 0 64 64',
    width: '64',
    height: '64',
    'aria-hidden': 'true',
    focusable: 'false',
    class: 'bapp-trash-icon',
  });
  root.append(
    svg('path', { d: 'M14 16h36l-4 40H18z', fill: 'none', stroke: 'currentColor', 'stroke-width': '3', 'stroke-linejoin': 'round' }),
    svg('path', { d: 'M10 16h44', stroke: 'currentColor', 'stroke-width': '3', 'stroke-linecap': 'round' }),
    svg('path', { d: 'M26 10h12l2 6H24z', fill: 'none', stroke: 'currentColor', 'stroke-width': '3', 'stroke-linejoin': 'round' }),
    svg('path', { d: 'M24 26l2 22M32 26v22M40 26l-2 22', stroke: 'currentColor', 'stroke-width': '2.5', 'stroke-linecap': 'round' }),
  );
  return root;
}

export function mountTrash(el: HTMLElement, ctx: AppContext, options: TrashOptions = {}): void {
  teardown?.();
  const wait = options.wait ?? defaultWait;
  const reducedMotion = options.reducedMotion ?? defaultReducedMotion;

  ctx.setTitle('Corbeille');

  let items: readonly TrashItem[] = emptied ? [] : TRASH_ITEMS;
  let selected = -1;
  let busy = false;
  let alive = true;

  const root = h('div', 'bapp-trash');

  const toolbar = h('div', 'bapp-trash-toolbar');
  toolbar.setAttribute('role', 'toolbar');
  toolbar.setAttribute('aria-label', 'Actions de la corbeille');
  const restoreBtn = h('button', 'bapp-trash-btn', 'Restaurer');
  restoreBtn.type = 'button';
  const emptyBtn = h('button', 'bapp-trash-btn', 'Vider la corbeille');
  emptyBtn.type = 'button';
  toolbar.append(restoreBtn, emptyBtn);

  const header = h('div', 'bapp-trash-row bapp-trash-head');
  header.setAttribute('aria-hidden', 'true');
  header.append(h('span', '', 'Nom'), h('span', 'bapp-trash-num', 'Taille'), h('span', '', 'Supprimé le'));

  const listbox = h('div', 'bapp-trash-list');
  listbox.setAttribute('role', 'listbox');
  listbox.setAttribute('aria-label', 'Brouillons supprimés');

  const empty = h('div', 'bapp-trash-empty');
  const emptyTitle = h('p', 'bapp-trash-empty-title', 'Corbeille vide');
  empty.append(binIcon(), emptyTitle, h('p', 'bapp-trash-empty-text', 'Rien à voir ici. Circulez.'));

  const preview = h('p', 'bapp-trash-preview', NO_SELECTION_HINT);
  preview.setAttribute('aria-live', 'polite');

  const status = h('p', 'bapp-trash-status');
  status.setAttribute('role', 'status');

  const bar = h('div', 'bapp-trash-bar');
  const count = h('span', 'bapp-trash-count');
  const total = h('span', 'bapp-trash-total');
  bar.append(count, total);

  root.append(toolbar, header, listbox, empty, preview, status, bar);
  el.replaceChildren(root);

  const rowEls = (): HTMLElement[] => Array.from(listbox.querySelectorAll<HTMLElement>('[role="option"]'));

  function updateSelection(focus: boolean): void {
    const rows = rowEls();
    rows.forEach((row, i) => {
      const on = i === selected;
      row.setAttribute('aria-selected', String(on));
      // Roving tabindex : un seul arrêt de tabulation (la sélection, ou la première ligne).
      row.tabIndex = i === (selected >= 0 ? selected : 0) ? 0 : -1;
    });
    const item = items[selected];
    preview.textContent = item ? item.preview : NO_SELECTION_HINT;
    if (focus) rows[selected]?.focus();
  }

  function select(index: number, focus = false): void {
    if (busy || index < 0 || index >= items.length) return;
    selected = index;
    updateSelection(focus);
  }

  function renderList(): void {
    const rows = items.map((item, i) => {
      const row = h('div', 'bapp-trash-row bapp-trash-item');
      row.setAttribute('role', 'option');
      row.id = `bapp-trash-opt-${i}`;
      row.style.setProperty('--bapp-trash-i', String(i));
      const name = h('span', 'bapp-trash-name', item.name);
      name.title = item.name;
      row.append(name, h('span', 'bapp-trash-num', formatSize(item.sizeKo)), h('span', '', formatDate(item.deletedOn)));
      row.addEventListener('click', () => select(i));
      row.addEventListener('keydown', (event) => onKey(event, i));
      return row;
    });
    listbox.replaceChildren(...rows);
    const isEmpty = items.length === 0;
    listbox.hidden = isEmpty;
    header.hidden = isEmpty;
    empty.hidden = !isEmpty;
    preview.hidden = isEmpty;
    emptyBtn.disabled = isEmpty || busy;
    count.textContent = formatCount(items.length);
    total.textContent = formatSize(totalSize(items));
    selected = -1;
    updateSelection(false);
  }

  function onKey(event: KeyboardEvent, index: number): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      select(index);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      select(moveSelection(index, event.key, items.length), true);
    }
  }

  restoreBtn.addEventListener('click', () => {
    status.textContent = items[selected] ? RESTORE_GAG : 'Sélectionnez d’abord un brouillon.';
  });

  emptyBtn.addEventListener('click', () => {
    if (busy || items.length === 0) return;
    busy = true;
    emptyBtn.disabled = true;
    status.textContent = '';
    ctx.playSound('recycle');
    if (reducedMotion()) {
      finishEmptying();
      return;
    }
    root.classList.add('bapp-trash-shredding');
    rowEls().forEach((row, i) => {
      row.style.setProperty('--bapp-trash-delay', `${i * SHRED_STEP_MS}ms`);
      row.classList.add('bapp-trash-shred');
    });
    void wait(SHRED_DURATION_MS).then(() => {
      if (alive) finishEmptying();
    });
  });

  function finishEmptying(): void {
    emptied = true;
    busy = false;
    items = [];
    root.classList.remove('bapp-trash-shredding');
    renderList();
  }

  renderList();

  teardown = () => {
    alive = false;
    el.replaceChildren();
    teardown = null;
  };
}

export function mount(el: HTMLElement, ctx: AppContext): void {
  mountTrash(el, ctx);
}

export function unmount(): void {
  teardown?.();
}
