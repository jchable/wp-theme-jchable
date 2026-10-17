import { getLang } from '../../core/i18n';
import type { AppContext } from '../../core/types';
import { hasMemory, initialState, localizeDisplay, reduce, type Action, type CalcError, type CalcState } from './engine';
import { t } from './i18n';
import { actionForKey } from './keys';
import './style.css';

type MessageKey = Parameters<typeof t>[0];

interface KeySpec {
  label: string | (() => string);
  /** Nom parlé de la touche ; absent pour un chiffre, dont le texte visible suffit. */
  name?: MessageKey;
  action: Action;
  kind: 'digit' | 'op' | 'memory' | 'clear' | 'function';
  data: string;
}

const digit = (d: number): KeySpec => ({
  label: String(d),
  action: { type: 'digit', digit: d },
  kind: 'digit',
  data: String(d),
});

const KEYS = {
  mc: { label: 'MC', name: 'mc', action: { type: 'memory', op: 'MC' }, kind: 'memory', data: 'mc' },
  mr: { label: 'MR', name: 'mr', action: { type: 'memory', op: 'MR' }, kind: 'memory', data: 'mr' },
  ms: { label: 'MS', name: 'ms', action: { type: 'memory', op: 'MS' }, kind: 'memory', data: 'ms' },
  mplus: { label: 'M+', name: 'mplus', action: { type: 'memory', op: 'M+' }, kind: 'memory', data: 'mplus' },
  divide: { label: '÷', name: 'divide', action: { type: 'op', op: '/' }, kind: 'op', data: 'divide' },
  times: { label: '×', name: 'times', action: { type: 'op', op: '*' }, kind: 'op', data: 'times' },
  minus: { label: '−', name: 'minus', action: { type: 'op', op: '-' }, kind: 'op', data: 'minus' },
  plus: { label: '+', name: 'plus', action: { type: 'op', op: '+' }, kind: 'op', data: 'plus' },
  equals: { label: '=', name: 'equals', action: { type: 'equals' }, kind: 'op', data: 'equals' },
  sqrt: { label: '√', name: 'sqrt', action: { type: 'sqrt' }, kind: 'function', data: 'sqrt' },
  percent: { label: '%', name: 'percent', action: { type: 'percent' }, kind: 'function', data: 'percent' },
  reciprocal: { label: '1/x', name: 'reciprocal', action: { type: 'reciprocal' }, kind: 'function', data: 'reciprocal' },
  sign: { label: '±', name: 'sign', action: { type: 'negate' }, kind: 'function', data: 'sign' },
  decimal: { label: () => localizeDisplay('.', getLang()), name: 'decimal', action: { type: 'decimal' }, kind: 'digit', data: 'decimal' },
  backspace: { label: '←', name: 'backspace', action: { type: 'backspace' }, kind: 'clear', data: 'backspace' },
  clearEntry: { label: 'CE', name: 'clearEntry', action: { type: 'clearEntry' }, kind: 'clear', data: 'ce' },
  clear: { label: 'C', name: 'clear', action: { type: 'clear' }, kind: 'clear', data: 'c' },
} satisfies Record<string, KeySpec>;

/** Disposition de Windows 95 : une colonne de mémoire, puis quatre rangées de cinq touches. */
const GRID: readonly KeySpec[] = [
  KEYS.mc, digit(7), digit(8), digit(9), KEYS.divide, KEYS.sqrt,
  KEYS.mr, digit(4), digit(5), digit(6), KEYS.times, KEYS.percent,
  KEYS.ms, digit(1), digit(2), digit(3), KEYS.minus, KEYS.reciprocal,
  KEYS.mplus, digit(0), KEYS.sign, KEYS.decimal, KEYS.plus, KEYS.equals,
];

const ERROR_TEXT: Record<CalcError, MessageKey> = {
  divZero: 'errDivZero',
  invalid: 'errInvalid',
  overflow: 'errOverflow',
};

let teardown: (() => void) | null = null;

function h<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

/** Tout est effacé : un nouvel Échap n'a plus rien à faire, il peut fermer la fenêtre. */
function isCleared(state: CalcState): boolean {
  return state.display === '0' && !state.error && !state.op && !state.entering && !state.repeatOp;
}

export function mount(el: HTMLElement, ctx: AppContext): void {
  teardown?.();
  ctx.setTitle(t('title'));

  let state = initialState();

  const root = h('div', 'bapp-calc');
  root.tabIndex = -1;

  const screen = h('div', 'bapp-calc-display');
  screen.setAttribute('role', 'status');
  screen.setAttribute('aria-live', 'polite');
  screen.setAttribute('aria-atomic', 'true');

  const top = h('div', 'bapp-calc-top');
  const memoryBox = h('div', 'bapp-calc-memory');
  const memoryMark = h('span', 'bapp-calc-memory-mark');
  memoryMark.setAttribute('role', 'img');
  memoryMark.setAttribute('aria-label', t('memoryOn'));
  memoryMark.textContent = 'M';
  memoryMark.hidden = true;
  memoryBox.append(memoryMark);
  const clears = h('div', 'bapp-calc-clears');
  top.append(memoryBox, clears);

  const grid = h('div', 'bapp-calc-grid');
  grid.setAttribute('role', 'group');
  grid.setAttribute('aria-label', t('keypad'));

  const makeButton = (spec: KeySpec): HTMLButtonElement => {
    const button = h('button', `bapp-calc-key bapp-calc-key--${spec.kind}`);
    button.type = 'button';
    button.dataset['key'] = spec.data;
    const label = typeof spec.label === 'function' ? spec.label() : spec.label;
    button.textContent = label;
    // Le nom accessible contient toujours le texte visible (« MC Effacer la mémoire »), pour la commande vocale.
    // Les touches faites de symboles seulement (+, ÷, √…) sont nommées par un mot.
    if (spec.name) button.setAttribute('aria-label', /[0-9A-Za-z]/.test(label) ? `${label} ${t(spec.name)}` : t(spec.name));
    button.addEventListener('click', () => dispatch(spec.action));
    return button;
  };
  clears.append(makeButton(KEYS.backspace), makeButton(KEYS.clearEntry), makeButton(KEYS.clear));
  grid.append(...GRID.map(makeButton));

  root.append(screen, top, grid);
  el.replaceChildren(root);

  function render(): void {
    screen.textContent = state.error ? t(ERROR_TEXT[state.error]) : localizeDisplay(state.display, getLang());
    screen.classList.toggle('bapp-calc-display--error', state.error !== null);
    memoryMark.hidden = !hasMemory(state);
  }

  function dispatch(action: Action): void {
    state = reduce(state, action);
    render();
  }

  // Le clavier n'est écouté que sur la fenêtre de la calculatrice : jamais sur toute la page.
  const host = el.closest<HTMLElement>('.bwin') ?? el;
  // Entrée active le bouton qui a le focus seulement si on y est arrivé avec Tab ; après un clic ou une frappe de
  // calcul, elle fait « = » (sans quoi elle répéterait le dernier bouton cliqué).
  let tabbed = false;
  const onPointerDown = (): void => {
    tabbed = false;
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'Tab') tabbed = true;
    const action = actionForKey(event.key);
    if (!action) return;
    if (event.key === 'Enter' && tabbed && event.target instanceof HTMLButtonElement) return; // le bouton s'active
    if (event.key !== 'Enter') tabbed = false;
    // Échap efface ; quand tout est déjà effacé il ferme la fenêtre, comme partout ailleurs.
    if (event.key === 'Escape' && isCleared(state)) return;
    event.preventDefault();
    event.stopPropagation();
    dispatch(action);
  };
  host.addEventListener('keydown', onKeyDown, true);
  host.addEventListener('pointerdown', onPointerDown, true);

  render();
  root.focus({ preventScroll: true });

  teardown = () => {
    host.removeEventListener('keydown', onKeyDown, true);
    host.removeEventListener('pointerdown', onPointerDown, true);
    el.replaceChildren();
    teardown = null;
  };
}

export function unmount(): void {
  teardown?.();
}
