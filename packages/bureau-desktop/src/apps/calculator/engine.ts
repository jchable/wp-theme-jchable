/**
 * Moteur de la calculatrice : pur, sans DOM. Un état + une action donnent un nouvel état.
 * Comportement « calculatrice simple » de Windows 95 : pas de priorité des opérateurs
 * (2 + 3 × 4 = 20), « = » répété refait la dernière opération.
 */

export type Op = '+' | '-' | '*' | '/';
export type MemoryOp = 'MC' | 'MR' | 'MS' | 'M+';
export type CalcError = 'divZero' | 'invalid' | 'overflow';

export type Action =
  | { type: 'digit'; digit: number }
  | { type: 'decimal' }
  | { type: 'op'; op: Op }
  | { type: 'equals' }
  | { type: 'negate' }
  | { type: 'percent' }
  | { type: 'sqrt' }
  | { type: 'reciprocal' }
  | { type: 'clear' }
  | { type: 'clearEntry' }
  | { type: 'backspace' }
  | { type: 'memory'; op: MemoryOp };

export interface CalcState {
  /** Texte affiché, toujours avec un point comme séparateur décimal (voir `localizeDisplay`). */
  readonly display: string;
  /** Vrai : le visiteur est en train de taper le nombre affiché (il peut le corriger). */
  readonly entering: boolean;
  /** Vrai : l'affichage est un second opérande valable (tapé, rappelé de la mémoire, calculé). */
  readonly operandReady: boolean;
  /** Premier opérande de l'opération en attente. */
  readonly acc: number | null;
  readonly op: Op | null;
  /** Pour « = » répété. */
  readonly repeatOp: Op | null;
  readonly repeatOperand: number | null;
  readonly memory: number;
  readonly error: CalcError | null;
}

/** Nombre maximal de chiffres saisis (et de chiffres significatifs affichés). */
export const MAX_DIGITS = 12;
/** À partir de cette valeur absolue, c'est un dépassement. */
const OVERFLOW_AT = 1e100;

export function initialState(): CalcState {
  return {
    display: '0',
    entering: false,
    operandReady: false,
    acc: null,
    op: null,
    repeatOp: null,
    repeatOperand: null,
    memory: 0,
    error: null,
  };
}

export const hasMemory = (state: CalcState): boolean => state.memory !== 0;

/** Arrondit à 12 chiffres significatifs, ce qui efface les erreurs de flottants (0,1 + 0,2). */
function round(value: number): number {
  return Number(value.toPrecision(MAX_DIGITS));
}

/** Retire les zéros inutiles à la fin d'une partie décimale (« 1.500 » devient « 1.5 », « 2.000 » devient « 2 »). */
function trimZeros(text: string): string {
  if (!text.includes('.')) return text;
  let end = text.length;
  while (text[end - 1] === '0') end--;
  if (text[end - 1] === '.') end--;
  return text.slice(0, end);
}

/** Texte d'un nombre : 12 chiffres significatifs, sans zéros inutiles, exponentielle pour les extrêmes. */
export function formatNumber(value: number): string {
  const rounded = round(value);
  if (rounded === 0) return '0';
  const text = rounded.toPrecision(MAX_DIGITS); // exponentielle d'office au-delà de 1e12 ou sous 1e-6
  const e = text.indexOf('e');
  return e === -1 ? trimZeros(text) : `${trimZeros(text.slice(0, e))}${text.slice(e)}`;
}

/** Le texte affiché dans la langue de l'interface : virgule décimale en français. */
export function localizeDisplay(display: string, lang: 'fr' | 'en'): string {
  return lang === 'fr' ? display.replace('.', ',') : display;
}

const valueOf = (state: CalcState): number => Number(state.display);

const fail = (state: CalcState, error: CalcError): CalcState => ({ ...initialState(), memory: state.memory, error });

/** Un résultat devient l'affichage, ou une erreur s'il est démesuré. */
function withResult(state: CalcState, value: number, patch: Partial<CalcState> = {}): CalcState {
  if (!Number.isFinite(value)) return fail(state, 'divZero');
  if (Math.abs(value) >= OVERFLOW_AT) return fail(state, 'overflow');
  return { ...state, display: formatNumber(value), entering: false, operandReady: true, ...patch };
}

function compute(left: number, op: Op, right: number): number | CalcError {
  switch (op) {
    case '+':
      return left + right;
    case '-':
      return left - right;
    case '*':
      return left * right;
    case '/':
      return right === 0 ? 'divZero' : left / right;
  }
}

/** Calcule `left op right` et l'affiche ; `patch` précise le reste de l'état (opération suivante, répétition…). */
function applyOp(state: CalcState, left: number, op: Op, right: number, patch: Partial<CalcState>): CalcState {
  const result = compute(left, op, right);
  if (typeof result === 'string') return fail(state, result);
  return withResult(state, round(result), patch);
}

const digitCount = (entry: string): number => entry.split('').filter((c) => c >= '0' && c <= '9').length;

function typeDigit(state: CalcState, digit: number): CalcState {
  const text = String(digit);
  if (!state.entering) return { ...state, display: text, entering: true, operandReady: true };
  if (digitCount(state.display) >= MAX_DIGITS) return state;
  let display = state.display + text;
  if (state.display === '0') display = text;
  else if (state.display === '-0') display = `-${text}`;
  return { ...state, display, operandReady: true };
}

function typeDecimal(state: CalcState): CalcState {
  if (!state.entering) return { ...state, display: '0.', entering: true, operandReady: true };
  if (state.display.includes('.')) return state;
  return { ...state, display: `${state.display}.`, operandReady: true };
}

/** Un opérateur : calcule l'opération en attente (s'il y a un second opérande) puis en prépare une nouvelle. */
function pressOp(state: CalcState, op: Op): CalcState {
  if (state.op && !state.operandReady) return { ...state, op }; // deux opérateurs de suite : le dernier gagne
  const current = valueOf(state);
  if (state.op && state.acc !== null) {
    const next = applyOp(state, state.acc, state.op, current, { op, operandReady: false, repeatOp: null, repeatOperand: null });
    return next.error ? next : { ...next, acc: Number(next.display) };
  }
  return { ...state, acc: current, op, entering: false, operandReady: false, repeatOp: null, repeatOperand: null };
}

function pressEquals(state: CalcState): CalcState {
  const current = valueOf(state);
  if (state.op && state.acc !== null) {
    return applyOp(state, state.acc, state.op, current, {
      acc: null,
      op: null,
      operandReady: false,
      repeatOp: state.op,
      repeatOperand: current,
    });
  }
  if (state.repeatOp && state.repeatOperand !== null) {
    return applyOp(state, current, state.repeatOp, state.repeatOperand, { operandReady: false });
  }
  return { ...state, entering: false };
}

function negate(state: CalcState): CalcState {
  if (!state.entering) return withResult(state, -valueOf(state));
  if (state.display === '0') return state;
  return { ...state, display: state.display.startsWith('-') ? state.display.slice(1) : `-${state.display}` };
}

function percent(state: CalcState): CalcState {
  const current = valueOf(state);
  if (!state.op || state.acc === null) return withResult(state, 0);
  if (state.op === '+' || state.op === '-') return withResult(state, round((state.acc * current) / 100));
  // × et ÷ : « 200 × 25 % » donne directement 25 % de 200.
  return applyOp(state, state.acc, state.op, current / 100, { acc: null, op: null, operandReady: false });
}

function backspace(state: CalcState): CalcState {
  if (!state.entering) return state;
  const next = state.display.slice(0, -1);
  return { ...state, display: next === '' || next === '-' ? '0' : next };
}

function pressMemory(state: CalcState, op: MemoryOp): CalcState {
  switch (op) {
    case 'MC':
      return { ...state, memory: 0 };
    case 'MR':
      return { ...state, display: formatNumber(state.memory), entering: false, operandReady: true };
    case 'MS':
      return { ...state, memory: round(valueOf(state)), entering: false };
    case 'M+':
      return { ...state, memory: round(state.memory + valueOf(state)), entering: false };
  }
}

/** En erreur, tout est ignoré sauf C et CE (qui repartent à zéro) et MC. */
function reduceInError(state: CalcState, action: Action): CalcState {
  if (action.type === 'clear' || action.type === 'clearEntry') return { ...initialState(), memory: state.memory };
  if (action.type === 'memory' && action.op === 'MC') return { ...state, memory: 0 };
  return state;
}

export function reduce(state: CalcState, action: Action): CalcState {
  if (state.error) return reduceInError(state, action);
  switch (action.type) {
    case 'digit':
      return typeDigit(state, action.digit);
    case 'decimal':
      return typeDecimal(state);
    case 'op':
      return pressOp(state, action.op);
    case 'equals':
      return pressEquals(state);
    case 'negate':
      return negate(state);
    case 'percent':
      return percent(state);
    case 'sqrt': {
      const current = valueOf(state);
      return current < 0 ? fail(state, 'invalid') : withResult(state, round(Math.sqrt(current)));
    }
    case 'reciprocal': {
      const current = valueOf(state);
      return current === 0 ? fail(state, 'divZero') : withResult(state, round(1 / current));
    }
    case 'clear':
      return { ...initialState(), memory: state.memory };
    case 'clearEntry':
      return { ...state, display: '0', entering: true, operandReady: true };
    case 'backspace':
      return backspace(state);
    case 'memory':
      return pressMemory(state, action.op);
  }
}
