import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { missingKeys, setLang } from '../../core/i18n';
import { messages } from './i18n';
import { createClockCalendar, type ClockCalendar } from './popup';

const NOW = new Date(2026, 9, 17, 15, 4, 5); // samedi 17 octobre 2026, 15:04:05

let anchor: HTMLButtonElement;
let cal: ClockCalendar;
let onToggle: Mock<(open: boolean) => void>;

function make(options: { reducedMotion?: boolean } = {}): ClockCalendar {
  onToggle = vi.fn<(open: boolean) => void>();
  cal = createClockCalendar({
    anchor,
    now: () => new Date(),
    reducedMotion: () => options.reducedMotion ?? false,
    onToggle,
  });
  return cal;
}

/** Minuteries restantes une fois vidées celles de jsdom (le focus() en programme une, sans lien avec le calendrier). */
const pendingTimers = (): number => {
  vi.advanceTimersByTime(10);
  return vi.getTimerCount();
};
const dialog = (): HTMLElement | null => document.querySelector<HTMLElement>('.bclock-pop');
const grid = (): HTMLElement => document.querySelector<HTMLElement>('table[role="grid"]')!;
const dayButtons = (): HTMLButtonElement[] => Array.from(grid().querySelectorAll<HTMLButtonElement>('tbody button'));
const inMonth = (): HTMLButtonElement[] => dayButtons().filter((b) => !b.closest('td')!.classList.contains('bclock-out'));
const focused = (): HTMLElement => document.activeElement as HTMLElement;
const key = (k: string, init: KeyboardEventInit = {}): void => {
  focused().dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init }));
};
const rotation = (hand: string): number => {
  const el = document.querySelector<SVGElement>(`[data-hand="${hand}"]`)!;
  return Number(/rotate\((-?[\d.]+)deg\)/.exec(el.style.transform)?.[1]);
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  anchor = document.createElement('button');
  anchor.textContent = '15:04';
  document.body.append(anchor);
});
afterEach(() => {
  cal?.destroy();
  anchor.remove();
  vi.useRealTimers();
});

describe('messages du calendrier', () => {
  it('les deux langues ont les mêmes clés, toutes renseignées', () => {
    expect(missingKeys(messages)).toEqual([]);
  });
});

describe('ouverture', () => {
  it('une fenêtre de dialogue non modale, avec un nom', () => {
    make().open();
    const pop = dialog()!;
    expect(pop.getAttribute('role')).toBe('dialog');
    expect(pop.getAttribute('aria-label')).toBe('Date et heure');
    expect(pop.hasAttribute('aria-modal')).toBe(false);
    expect(cal.isOpen).toBe(true);
    expect(onToggle).toHaveBeenLastCalledWith(true);
  });

  it('ouvrir deux fois ne crée pas deux fenêtres ; toggle ferme', () => {
    make().open();
    cal.open();
    expect(document.querySelectorAll('.bclock-pop')).toHaveLength(1);
    cal.toggle();
    expect(dialog()).toBeNull();
    cal.toggle();
    expect(dialog()).not.toBeNull();
  });

  it('place le focus sur le jour courant', () => {
    make().open();
    expect(focused().textContent).toBe('17');
    expect(focused().getAttribute('aria-current')).toBe('date');
  });
});

describe('calendrier du mois', () => {
  it('octobre 2026 en français : la semaine commence le lundi', () => {
    make().open();
    expect(grid().getAttribute('aria-label')).toBe('octobre 2026');
    const heads = Array.from(grid().querySelectorAll('thead th'));
    expect(heads).toHaveLength(7);
    expect(heads[0]!.getAttribute('abbr')).toBe('lundi');
    expect(heads[6]!.getAttribute('abbr')).toBe('dimanche');
    expect(inMonth()).toHaveLength(31);
    // les jours des mois voisins sont là, grisés
    const first = dayButtons()[0]!;
    expect(first.textContent).toBe('28');
    expect(first.closest('td')!.classList.contains('bclock-out')).toBe(true);
    expect(dayButtons()).toHaveLength(42); // 6 semaines : hauteur constante
  });

  it('chaque jour a un nom complet pour les lecteurs d’écran, le jour courant est signalé', () => {
    make().open();
    const today = inMonth()[16]!;
    expect(today.getAttribute('aria-label')).toBe('samedi 17 octobre 2026');
    expect(today.getAttribute('aria-current')).toBe('date');
    expect(inMonth().filter((b) => b.hasAttribute('aria-current'))).toHaveLength(1);
    expect(today.closest('td')!.classList.contains('bclock-today')).toBe(true);
  });

  it('un seul jour est tabulable à la fois', () => {
    make().open();
    expect(dayButtons().filter((b) => b.tabIndex === 0)).toHaveLength(1);
    expect(dayButtons().filter((b) => b.tabIndex === 0)[0]!.textContent).toBe('17');
  });

  it('en anglais : la semaine commence le dimanche', () => {
    setLang('en');
    make().open();
    expect(grid().getAttribute('aria-label')).toBe('October 2026');
    const heads = Array.from(grid().querySelectorAll('thead th'));
    expect(heads[0]!.getAttribute('abbr')).toBe('Sunday');
    expect(heads[6]!.getAttribute('abbr')).toBe('Saturday');
    expect(dayButtons()[0]!.textContent).toBe('27'); // dimanche 27 septembre
    expect(document.querySelector('.bclock-pop')!.getAttribute('aria-label')).toBe('Date and time');
    expect(inMonth()[16]!.getAttribute('aria-label')).toMatch(/Saturday, October 17, 2026/);
  });

  it('boutons de navigation nommés, mois suivant et précédent (décembre → janvier)', () => {
    make().open();
    const next = document.querySelector<HTMLButtonElement>('button[aria-label="Mois suivant"]')!;
    const prev = document.querySelector<HTMLButtonElement>('button[aria-label="Mois précédent"]')!;
    next.click();
    expect(grid().getAttribute('aria-label')).toBe('novembre 2026');
    next.click();
    expect(grid().getAttribute('aria-label')).toBe('décembre 2026');
    next.click();
    expect(grid().getAttribute('aria-label')).toBe('janvier 2027');
    prev.click();
    prev.click();
    prev.click();
    expect(grid().getAttribute('aria-label')).toBe('octobre 2026');
  });

  it('la sélection de mois et le choix de l’année', () => {
    make().open();
    const month = document.querySelector<HTMLSelectElement>('select[aria-label="Mois"]')!;
    const year = document.querySelector<HTMLInputElement>('input[aria-label="Année"]')!;
    expect(month.options).toHaveLength(12);
    expect(month.value).toBe('9');
    expect(year.value).toBe('2026');
    month.value = '1';
    month.dispatchEvent(new Event('change', { bubbles: true }));
    expect(grid().getAttribute('aria-label')).toBe('février 2026');
    year.value = '2024';
    year.dispatchEvent(new Event('change', { bubbles: true }));
    expect(grid().getAttribute('aria-label')).toBe('février 2024');
    expect(inMonth()).toHaveLength(29); // bissextile
    year.value = '5000';
    year.dispatchEvent(new Event('change', { bubbles: true }));
    expect(year.value).toBe('2999'); // borné
    year.value = 'abc';
    year.dispatchEvent(new Event('change', { bubbles: true }));
    expect(year.value).toBe('2999'); // invalide : ignoré
  });

  it('« Aujourd’hui » revient au jour courant', () => {
    make().open();
    document.querySelector<HTMLButtonElement>('button[aria-label="Mois suivant"]')!.click();
    document.querySelector<HTMLButtonElement>('.bclock-today-btn')!.click();
    expect(grid().getAttribute('aria-label')).toBe('octobre 2026');
  });

  it('cliquer un jour le sélectionne ; un jour du mois voisin change de mois', () => {
    make().open();
    inMonth()[4]!.click();
    expect(inMonth()[4]!.closest('td')!.getAttribute('aria-selected')).toBe('true');
    expect(dayButtons().filter((b) => b.closest('td')!.getAttribute('aria-selected') === 'true')).toHaveLength(1);
    dayButtons()[0]!.click(); // 28 septembre
    expect(grid().getAttribute('aria-label')).toBe('septembre 2026');
  });
});

describe('clavier dans la grille', () => {
  it('flèches : jour et semaine', () => {
    make().open();
    key('ArrowRight');
    expect(focused().getAttribute('aria-label')).toBe('dimanche 18 octobre 2026');
    key('ArrowLeft');
    key('ArrowLeft');
    expect(focused().getAttribute('aria-label')).toBe('vendredi 16 octobre 2026');
    key('ArrowDown');
    expect(focused().getAttribute('aria-label')).toBe('vendredi 23 octobre 2026');
    key('ArrowUp');
    key('ArrowUp');
    expect(focused().getAttribute('aria-label')).toBe('vendredi 9 octobre 2026');
  });

  it('les flèches passent au mois voisin et le focus suit', () => {
    make().open();
    for (let i = 0; i < 15; i++) key('ArrowDown'); // 17 octobre + 105 jours
    expect(grid().getAttribute('aria-label')).toBe('janvier 2027');
    expect(focused().tagName).toBe('BUTTON');
    expect(focused().closest('table')).toBe(grid());
  });

  it('Début / Fin : début et fin de semaine (lundi → dimanche)', () => {
    make().open();
    key('Home');
    expect(focused().getAttribute('aria-label')).toBe('lundi 12 octobre 2026');
    key('End');
    expect(focused().getAttribute('aria-label')).toBe('dimanche 18 octobre 2026');
  });

  it('PageHaut / PageBas : un mois (le jour est ramené à la fin du mois)', () => {
    make().open();
    key('PageDown');
    expect(grid().getAttribute('aria-label')).toBe('novembre 2026');
    expect(focused().getAttribute('aria-label')).toBe('mardi 17 novembre 2026');
    key('PageUp');
    key('PageUp');
    expect(grid().getAttribute('aria-label')).toBe('septembre 2026');
    expect(focused().getAttribute('aria-label')).toBe('jeudi 17 septembre 2026');
  });

  it('Maj + PageHaut / PageBas : une année', () => {
    make().open();
    key('PageDown', { shiftKey: true });
    expect(grid().getAttribute('aria-label')).toBe('octobre 2027');
  });

  it('le jour tabulable suit la navigation', () => {
    make().open();
    key('ArrowRight');
    expect(dayButtons().filter((b) => b.tabIndex === 0)).toHaveLength(1);
    expect(dayButtons().filter((b) => b.tabIndex === 0)[0]).toBe(focused());
  });

  it('une touche inconnue n’est pas prise', () => {
    make().open();
    const event = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });
    focused().dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });
});

describe('horloge analogique et heure numérique', () => {
  it('les aiguilles indiquent 15:04:05', () => {
    make().open();
    expect(rotation('hour')).toBeCloseTo(3 * 30 + 4 * 0.5, 5);
    expect(rotation('minute')).toBeCloseTo(4 * 6 + 5 * 0.1, 5);
    expect(rotation('second')).toBeCloseTo(30, 5);
    expect(document.querySelector('.bclock-digital')!.textContent).toBe('15:04:05');
    expect(document.querySelector('svg.bclock-face')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('avance chaque seconde', () => {
    make().open();
    vi.advanceTimersByTime(1000);
    expect(document.querySelector('.bclock-digital')!.textContent).toBe('15:04:06');
    expect(rotation('second')).toBeCloseTo(36, 5);
    vi.advanceTimersByTime(55_000);
    expect(document.querySelector('.bclock-digital')!.textContent).toBe('15:05:01');
  });

  it('l’aiguille des secondes ne repart pas en arrière en passant par zéro', () => {
    make().open();
    vi.advanceTimersByTime(54_000); // 15:04:59
    const before = rotation('second');
    vi.advanceTimersByTime(1000); // 15:05:00
    expect(rotation('second')).toBeGreaterThan(before);
  });

  it('affiche le fuseau horaire', () => {
    make().open();
    expect(document.querySelector('.bclock-tz')!.textContent!.length).toBeGreaterThan(2);
  });

  it('« moins d’animations » : les secondes avancent par pas, sans transition', () => {
    make({ reducedMotion: true }).open();
    expect(dialog()!.classList.contains('bclock--still')).toBe(true);
    cal.close(false);
    make({ reducedMotion: false }).open();
    expect(dialog()!.classList.contains('bclock--still')).toBe(false);
  });
});

describe('fermeture, focus et fuites', () => {
  it('Échap ferme et rend le focus à l’horloge', () => {
    make().open();
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    focused().dispatchEvent(event);
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(anchor);
    expect(event.defaultPrevented).toBe(true);
    expect(onToggle).toHaveBeenLastCalledWith(false);
  });

  it('Échap ne remonte pas jusqu’aux fenêtres du bureau', () => {
    make().open();
    const onDoc = vi.fn();
    document.body.addEventListener('keydown', onDoc);
    key('Escape');
    document.body.removeEventListener('keydown', onDoc);
    expect(onDoc).not.toHaveBeenCalled();
  });

  it('un clic ailleurs ferme, un clic dedans non', () => {
    make().open();
    dialog()!.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(dialog()).not.toBeNull();
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(dialog()).toBeNull();
  });

  it('un clic sur l’horloge elle-même ne ferme pas par l’extérieur (c’est le bouton qui bascule)', () => {
    make().open();
    anchor.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(dialog()).not.toBeNull();
  });

  it('le focus qui part ailleurs ferme la fenêtre', () => {
    make().open();
    const other = document.createElement('button');
    document.body.append(other);
    other.focus();
    expect(dialog()).toBeNull();
    other.remove();
  });

  it('la minuterie est arrêtée à la fermeture', () => {
    make().open();
    expect(pendingTimers()).toBeGreaterThan(0);
    cal.close(false);
    expect(pendingTimers()).toBe(0);
  });

  it('tous les écouteurs ajoutés sont retirés à la fermeture', () => {
    const added: Array<[EventTarget, string, unknown, boolean]> = [];
    const removed: Array<[EventTarget, string, unknown, boolean]> = [];
    const capture = (opts: unknown): boolean => (typeof opts === 'boolean' ? opts : Boolean((opts as { capture?: boolean } | undefined)?.capture));
    for (const target of [document, window]) {
      const add = target.addEventListener.bind(target);
      const remove = target.removeEventListener.bind(target);
      vi.spyOn(target, 'addEventListener').mockImplementation(((type: string, fn: never, opts?: never) => {
        added.push([target, type, fn, capture(opts)]);
        add(type, fn, opts);
      }) as never);
      vi.spyOn(target, 'removeEventListener').mockImplementation(((type: string, fn: never, opts?: never) => {
        removed.push([target, type, fn, capture(opts)]);
        remove(type, fn, opts);
      }) as never);
    }
    make().open();
    expect(added.length).toBeGreaterThan(0);
    cal.close(false);
    for (const entry of added) expect(removed, `${entry[1]} retiré`).toContainEqual(entry);
  });

  it('rouvrir après fermeture redonne un calendrier neuf, sans minuterie en double', () => {
    make().open();
    cal.close(false);
    cal.open();
    expect(document.querySelectorAll('.bclock-pop')).toHaveLength(1);
    vi.advanceTimersByTime(1000);
    expect(document.querySelector('.bclock-digital')!.textContent).toBe('15:04:06');
    cal.close(false);
    expect(pendingTimers()).toBe(0);
  });

  it('destroy ferme et retire tout', () => {
    make().open();
    cal.destroy();
    expect(dialog()).toBeNull();
    expect(pendingTimers()).toBe(0);
  });
});
