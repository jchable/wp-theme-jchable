/**
 * Calendrier : logique pure (aucun DOM). Les dates sont de simples triplets année / mois (0 à 11) / jour,
 * calculés en UTC pour ne jamais dépendre du fuseau ni de l'heure d'été.
 */

export interface CalDate {
  year: number;
  /** 0 = janvier … 11 = décembre. */
  month: number;
  day: number;
}

export interface GridCell extends CalDate {
  /** Faux pour les jours des mois voisins, qui complètent la première et la dernière semaine. */
  inMonth: boolean;
}

export const MIN_YEAR = 1900;
export const MAX_YEAR = 2999;

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  if (month === 1) return isLeapYear(year) ? 29 : 28;
  return [3, 5, 8, 10].includes(month) ? 30 : 31;
}

const toUtc = (d: CalDate): number => Date.UTC(d.year, d.month, d.day);

function fromUtc(ms: number): CalDate {
  const date = new Date(ms);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth(), day: date.getUTCDate() };
}

/** Ramène une date dans les années gérées (1900 à 2999). */
export function clampDate(d: CalDate): CalDate {
  if (d.year < MIN_YEAR) return { year: MIN_YEAR, month: 0, day: 1 };
  if (d.year > MAX_YEAR) return { year: MAX_YEAR, month: 11, day: 31 };
  return d;
}

/** La date locale d'un instant. */
export function fromDate(date: Date): CalDate {
  return { year: date.getFullYear(), month: date.getMonth(), day: date.getDate() };
}

/** 0 = dimanche … 6 = samedi. */
export function weekdayOf(d: CalDate): number {
  return new Date(toUtc(d)).getUTCDay();
}

/** Premier jour de la semaine : lundi (1) en français, dimanche (0) en anglais. */
export function firstWeekday(lang: 'fr' | 'en'): number {
  return lang === 'fr' ? 1 : 0;
}

/** Les sept jours de la semaine dans l'ordre des colonnes. */
export function weekdayOrder(first: number): number[] {
  return Array.from({ length: 7 }, (_, i) => (first + i) % 7);
}

export function addDays(d: CalDate, n: number): CalDate {
  return clampDate(fromUtc(toUtc(d) + n * 86_400_000));
}

/** Ajoute des mois ; le jour est ramené à la fin du mois d'arrivée (31 janvier + 1 mois = 28 ou 29 février). */
export function addMonths(d: CalDate, n: number): CalDate {
  const index = d.year * 12 + d.month + n;
  const year = Math.floor(index / 12);
  const month = index - year * 12;
  if (year < MIN_YEAR || year > MAX_YEAR) return clampDate({ year, month, day: 1 });
  return { year, month, day: Math.min(d.day, daysInMonth(year, month)) };
}

export function addYears(d: CalDate, n: number): CalDate {
  return addMonths(d, n * 12);
}

export function compareDates(a: CalDate, b: CalDate): number {
  return toUtc(a) - toUtc(b);
}

export function sameDate(a: CalDate, b: CalDate): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

export function startOfWeek(d: CalDate, first: number): CalDate {
  return addDays(d, -((weekdayOf(d) - first + 7) % 7));
}

export function endOfWeek(d: CalDate, first: number): CalDate {
  return addDays(startOfWeek(d, first), 6);
}

/**
 * Les semaines d'un mois, de sept jours chacune. `minWeeks` complète avec les jours du mois suivant
 * (6 donne une grille de hauteur constante).
 */
export function monthGrid(year: number, month: number, first: number, minWeeks = 0): GridCell[][] {
  const monthFirst: CalDate = { year, month, day: 1 };
  const lead = (weekdayOf(monthFirst) - first + 7) % 7;
  const weeks = Math.max(minWeeks, Math.ceil((lead + daysInMonth(year, month)) / 7));
  const start = addDays(monthFirst, -lead);
  const grid: GridCell[][] = [];
  for (let w = 0; w < weeks; w++) {
    grid.push(
      Array.from({ length: 7 }, (_, i) => {
        const day = addDays(start, w * 7 + i);
        return { ...day, inMonth: day.year === year && day.month === month };
      }),
    );
  }
  return grid;
}
