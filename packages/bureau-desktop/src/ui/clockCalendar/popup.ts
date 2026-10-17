import { getLang, type Lang } from '../../core/i18n';
import {
  MAX_YEAR,
  MIN_YEAR,
  addDays,
  addMonths,
  addYears,
  clampDate,
  endOfWeek,
  firstWeekday,
  fromDate,
  monthGrid,
  sameDate,
  startOfWeek,
  weekdayOrder,
  type CalDate,
} from './calendar';
import { t } from './i18n';
import './style.css';

const SVG_NS = 'http://www.w3.org/2000/svg';
const FACE = 160;
const CENTER = FACE / 2;
const GAP = 6;
const MARGIN = 8;

export interface ClockCalendarOptions {
  /** L'horloge de la barre des tâches : la fenêtre s'aligne dessus et le focus y revient. */
  anchor: HTMLElement;
  /** L'heure (injectable pour les tests). */
  now?: () => Date;
  /** Vrai : l'aiguille des secondes avance par pas, sans transition. */
  reducedMotion?: () => boolean;
  onToggle?: (open: boolean) => void;
}

export interface ClockCalendar {
  readonly isOpen: boolean;
  open(): void;
  close(restoreFocus: boolean): void;
  toggle(): void;
  destroy(): void;
}

function h<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string>): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  return node;
}

const localeOf = (lang: Lang): string => (lang === 'fr' ? 'fr-FR' : 'en-US');
const utc = (d: CalDate): Date => new Date(Date.UTC(d.year, d.month, d.day));

const defaultReducedMotion = (): boolean =>
  typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Nom du fuseau horaire du navigateur, en toutes lettres si possible, et son identifiant (Europe/Paris). */
function timeZoneNames(locale: string, now: Date): { name: string; id: string } {
  let id = '';
  try {
    id = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    /* navigateur sans Intl complet */
  }
  let name = '';
  try {
    name = new Intl.DateTimeFormat(locale, { timeZoneName: 'long' }).formatToParts(now).find((p) => p.type === 'timeZoneName')?.value ?? '';
  } catch {
    /* idem */
  }
  return { name: name || id, id: name && id ? id : '' };
}

/** Cadran : douze repères, soixante graduations, quatre chiffres et trois aiguilles. */
function buildFace(): { root: SVGSVGElement; hour: SVGGElement; minute: SVGGElement; second: SVGGElement } {
  const root = svg('svg', { viewBox: `0 0 ${FACE} ${FACE}`, class: 'bclock-face', 'aria-hidden': 'true', focusable: 'false' });
  root.append(svg('circle', { cx: String(CENTER), cy: String(CENTER), r: '76', class: 'bclock-dial' }));
  for (let i = 0; i < 60; i++) {
    const major = i % 5 === 0;
    const angle = (i * 6 * Math.PI) / 180;
    const inner = major ? 62 : 68;
    root.append(
      svg('line', {
        x1: String(CENTER + Math.sin(angle) * inner),
        y1: String(CENTER - Math.cos(angle) * inner),
        x2: String(CENTER + Math.sin(angle) * 72),
        y2: String(CENTER - Math.cos(angle) * 72),
        class: major ? 'bclock-tick bclock-tick--major' : 'bclock-tick',
      }),
    );
  }
  for (const [label, x, y] of [['12', 80, 34], ['3', 126, 85], ['6', 80, 136], ['9', 34, 85]] as const) {
    const text = svg('text', { x: String(x), y: String(y), class: 'bclock-num', 'text-anchor': 'middle' });
    text.textContent = label;
    root.append(text);
  }
  const hand = (name: string, length: number, tail: number): SVGGElement => {
    const group = svg('g', { class: `bclock-hand bclock-hand--${name}`, 'data-hand': name });
    group.append(svg('line', { x1: String(CENTER), y1: String(CENTER + tail), x2: String(CENTER), y2: String(CENTER - length) }));
    return group;
  };
  const hour = hand('hour', 36, 6);
  const minute = hand('minute', 52, 8);
  const second = hand('second', 60, 14);
  root.append(hour, minute, second, svg('circle', { cx: String(CENTER), cy: String(CENTER), r: '4', class: 'bclock-pin' }));
  return { root, hour, minute, second };
}

export function createClockCalendar(options: ClockCalendarOptions): ClockCalendar {
  const { anchor } = options;
  const now = options.now ?? ((): Date => new Date());
  const reducedMotion = options.reducedMotion ?? defaultReducedMotion;

  let pop: HTMLElement | null = null;
  let timer: number | undefined;
  let secondAngle = 0;

  // Vue du calendrier (rendue à chaque changement) : `selected` est le jour qui a le focus.
  let lang: Lang = 'fr';
  let selected: CalDate = fromDate(now());
  let tbody: HTMLTableSectionElement;
  let table: HTMLTableElement;
  let monthSelect: HTMLSelectElement;
  let yearInput: HTMLInputElement;
  let liveRegion: HTMLElement;
  let lastMonthLabel = '';
  let digital: HTMLTimeElement;
  let zone: HTMLElement;
  let hands: ReturnType<typeof buildFace>;

  const fmt = (opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat =>
    new Intl.DateTimeFormat(localeOf(lang), { timeZone: 'UTC', ...opts });

  // ---------- Calendrier ----------

  function renderGrid(focusSelected: boolean): void {
    const first = firstWeekday(lang);
    const today = fromDate(now());
    const dayLabel = fmt({ weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const cells = monthGrid(selected.year, selected.month, first, 6);
    tbody.replaceChildren(
      ...cells.map((week) => {
        const row = h('tr');
        for (const cell of week) {
          const isSelected = sameDate(cell, selected);
          const td = h('td', 'bclock-day');
          td.classList.toggle('bclock-out', !cell.inMonth);
          td.classList.toggle('bclock-today', sameDate(cell, today));
          td.setAttribute('aria-selected', String(isSelected));
          const button = h('button', 'bclock-day-btn', String(cell.day));
          button.type = 'button';
          button.tabIndex = isSelected ? 0 : -1;
          button.setAttribute('aria-label', dayLabel.format(utc(cell)));
          button.dataset['year'] = String(cell.year);
          button.dataset['month'] = String(cell.month);
          button.dataset['day'] = String(cell.day);
          if (sameDate(cell, today)) button.setAttribute('aria-current', 'date');
          td.append(button);
          row.append(td);
        }
        return row;
      }),
    );
    const label = fmt({ month: 'long', year: 'numeric' }).format(utc(selected));
    table.setAttribute('aria-label', label);
    monthSelect.value = String(selected.month);
    yearInput.value = String(selected.year);
    if (label !== lastMonthLabel) {
      lastMonthLabel = label;
      liveRegion.textContent = label; // annoncé poliment quand le mois change
    }
    if (focusSelected) tbody.querySelector<HTMLButtonElement>('button[tabindex="0"]')?.focus();
  }

  function select(next: CalDate, focusGrid: boolean): void {
    selected = clampDate(next);
    renderGrid(focusGrid);
  }

  function onGridClick(event: Event): void {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-day]');
    if (!button) return;
    select({ year: Number(button.dataset['year']), month: Number(button.dataset['month']), day: Number(button.dataset['day']) }, true);
  }

  function onGridKey(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const first = firstWeekday(lang);
    let next: CalDate | null = null;
    switch (event.key) {
      case 'ArrowLeft':
        next = addDays(selected, -1);
        break;
      case 'ArrowRight':
        next = addDays(selected, 1);
        break;
      case 'ArrowUp':
        next = addDays(selected, -7);
        break;
      case 'ArrowDown':
        next = addDays(selected, 7);
        break;
      case 'Home':
        next = startOfWeek(selected, first);
        break;
      case 'End':
        next = endOfWeek(selected, first);
        break;
      case 'PageUp':
        next = event.shiftKey ? addYears(selected, -1) : addMonths(selected, -1);
        break;
      case 'PageDown':
        next = event.shiftKey ? addYears(selected, 1) : addMonths(selected, 1);
        break;
    }
    if (!next) return;
    event.preventDefault();
    select(next, true);
  }

  function buildCalendar(): HTMLElement {
    const box = h('div', 'bclock-cal');
    const nav = h('div', 'bclock-nav');
    const prev = h('button', 'bclock-nav-btn', '◂');
    prev.type = 'button';
    prev.setAttribute('aria-label', t('prevMonth'));
    prev.addEventListener('click', () => select(addMonths(selected, -1), false));
    const next = h('button', 'bclock-nav-btn', '▸');
    next.type = 'button';
    next.setAttribute('aria-label', t('nextMonth'));
    next.addEventListener('click', () => select(addMonths(selected, 1), false));

    monthSelect = h('select', 'bclock-month');
    monthSelect.setAttribute('aria-label', t('month'));
    const monthName = fmt({ month: 'long' });
    for (let m = 0; m < 12; m++) {
      const option = h('option', undefined, monthName.format(new Date(Date.UTC(2026, m, 1))));
      option.value = String(m);
      monthSelect.append(option);
    }
    monthSelect.addEventListener('change', () => select(addMonths(selected, Number(monthSelect.value) - selected.month), false));

    yearInput = h('input', 'bclock-year');
    yearInput.type = 'number';
    yearInput.min = String(MIN_YEAR);
    yearInput.max = String(MAX_YEAR);
    yearInput.step = '1';
    yearInput.setAttribute('aria-label', t('year'));
    yearInput.addEventListener('change', () => {
      const year = Number.parseInt(yearInput.value, 10);
      if (Number.isNaN(year)) {
        renderGrid(false); // valeur invalide : on remet l'année affichée
        return;
      }
      select(addYears(selected, Math.min(MAX_YEAR, Math.max(MIN_YEAR, year)) - selected.year), false);
    });
    nav.append(prev, monthSelect, yearInput, next);

    table = h('table', 'bclock-grid');
    table.setAttribute('role', 'grid');
    const head = h('thead');
    const headRow = h('tr');
    const longName = fmt({ weekday: 'long' });
    const shortName = fmt({ weekday: 'short' });
    for (const weekday of weekdayOrder(firstWeekday(lang))) {
      const date = new Date(Date.UTC(2026, 9, 4 + weekday)); // le 4 octobre 2026 est un dimanche
      const th = h('th', undefined, shortName.format(date));
      th.scope = 'col';
      th.abbr = longName.format(date);
      headRow.append(th);
    }
    head.append(headRow);
    tbody = h('tbody');
    tbody.addEventListener('click', onGridClick);
    tbody.addEventListener('keydown', onGridKey);
    table.append(head, tbody);

    liveRegion = h('div', 'bclock-sr');
    liveRegion.setAttribute('role', 'status');
    liveRegion.setAttribute('aria-live', 'polite');

    const todayBtn = h('button', 'bclock-today-btn', t('today'));
    todayBtn.type = 'button';
    todayBtn.addEventListener('click', () => select(fromDate(now()), false));

    box.append(nav, table, liveRegion, todayBtn);
    return box;
  }

  // ---------- Horloge ----------

  const angle = (deg: number): string => `rotate(${Number(deg.toFixed(3))}deg)`;

  function tick(): void {
    const date = now();
    const s = date.getSeconds();
    const m = date.getMinutes();
    const hr = date.getHours();
    // L'aiguille des secondes ne revient jamais en arrière (354° → 0° se ferait en tournant à l'envers).
    const target = s * 6;
    secondAngle += (target - (secondAngle % 360) + 360) % 360;
    hands.second.style.transform = angle(secondAngle);
    hands.minute.style.transform = angle(m * 6 + s * 0.1);
    hands.hour.style.transform = angle((hr % 12) * 30 + m * 0.5);
    digital.textContent = new Intl.DateTimeFormat(localeOf(lang), {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: lang === 'en',
    }).format(date);
    digital.dateTime = date.toISOString();
  }

  function scheduleTick(): void {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      tick();
      scheduleTick();
    }, 1000 - (now().getTime() % 1000));
  }

  function buildClock(): HTMLElement {
    const box = h('div', 'bclock-time');
    hands = buildFace();
    digital = h('time', 'bclock-digital');
    const names = timeZoneNames(localeOf(lang), now());
    zone = h('div', 'bclock-tz');
    zone.append(h('span', 'bclock-tz-name', names.name));
    if (names.id) zone.append(h('span', 'bclock-tz-id', names.id));
    box.append(hands.root, digital, zone);
    return box;
  }

  // ---------- Fenêtre ----------

  function place(): void {
    if (!pop) return;
    const rect = anchor.getBoundingClientRect();
    // Verticalement, la fenêtre se place par rapport à la barre des tâches entière (pas seulement à l'heure).
    const bar = anchor.closest('.taskbar')?.getBoundingClientRect() ?? rect;
    const viewW = document.documentElement.clientWidth || window.innerWidth;
    const viewH = window.innerHeight;
    const width = pop.offsetWidth;
    const height = pop.offsetHeight;
    // Alignée à droite sur l'horloge, au-dessus ; en dessous si la place manque en haut.
    const left = Math.max(MARGIN, Math.min(rect.right - width, viewW - width - MARGIN));
    let top = bar.top - height - GAP;
    if (top < MARGIN) top = bar.bottom + GAP;
    top = Math.max(MARGIN, Math.min(top, viewH - height - MARGIN));
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
  }

  const onPointerDown = (event: Event): void => {
    const target = event.target as Node;
    if (pop && !pop.contains(target) && !anchor.contains(target)) close(false);
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || !pop) return;
    event.preventDefault();
    event.stopPropagation(); // ni les fenêtres du bureau ni le menu Démarrer ne se ferment avec
    close(true);
  };
  const onFocusIn = (event: Event): void => {
    const target = event.target as Node;
    if (pop && !pop.contains(target) && !anchor.contains(target)) close(false);
  };

  function open(): void {
    if (pop) return;
    lang = getLang();
    selected = fromDate(now());
    lastMonthLabel = '';
    secondAngle = 0;
    anchor.scrollIntoView?.({ block: 'nearest' });

    const root = h('div', 'bclock-pop');
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', t('title'));
    root.tabIndex = -1;
    root.classList.toggle('bclock--still', reducedMotion());
    root.append(buildCalendar(), buildClock());
    pop = root;
    document.body.append(root);
    renderGrid(false);
    tick();
    scheduleTick();
    place();

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('focusin', onFocusIn, true);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);

    tbody.querySelector<HTMLButtonElement>('button[tabindex="0"]')?.focus({ preventScroll: true });
    options.onToggle?.(true);
  }

  function close(restoreFocus: boolean): void {
    if (!pop) return;
    window.clearTimeout(timer);
    document.removeEventListener('pointerdown', onPointerDown, true);
    document.removeEventListener('keydown', onKeyDown, true);
    document.removeEventListener('focusin', onFocusIn, true);
    window.removeEventListener('resize', place);
    window.removeEventListener('scroll', place, true);
    pop.remove();
    pop = null;
    options.onToggle?.(false);
    if (restoreFocus) anchor.focus({ preventScroll: true });
  }

  return {
    get isOpen() {
      return pop !== null;
    },
    open,
    close,
    toggle: () => (pop ? close(true) : open()),
    destroy: () => close(false),
  };
}
