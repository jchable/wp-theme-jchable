import { describe, expect, it } from 'vitest';
import {
  MAX_YEAR,
  MIN_YEAR,
  addDays,
  addMonths,
  addYears,
  clampDate,
  compareDates,
  daysInMonth,
  endOfWeek,
  firstWeekday,
  fromDate,
  isLeapYear,
  monthGrid,
  sameDate,
  startOfWeek,
  weekdayOf,
  weekdayOrder,
} from './calendar';

const d = (year: number, month: number, day: number) => ({ year, month, day });

describe('années bissextiles', () => {
  it('multiples de 4, sauf siècles non multiples de 400', () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2000)).toBe(true);
    expect(isLeapYear(2400)).toBe(true);
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2100)).toBe(false);
    expect(isLeapYear(2023)).toBe(false);
    expect(isLeapYear(2026)).toBe(false);
  });
});

describe('daysInMonth', () => {
  it('28 ou 29 jours en février', () => {
    expect(daysInMonth(2023, 1)).toBe(28);
    expect(daysInMonth(2024, 1)).toBe(29);
    expect(daysInMonth(1900, 1)).toBe(28);
    expect(daysInMonth(2000, 1)).toBe(29);
  });
  it('30 jours : avril, juin, septembre, novembre', () => {
    for (const m of [3, 5, 8, 10]) expect(daysInMonth(2026, m)).toBe(30);
  });
  it('31 jours pour les autres', () => {
    for (const m of [0, 2, 4, 6, 7, 9, 11]) expect(daysInMonth(2026, m)).toBe(31);
  });
});

describe('jour de la semaine', () => {
  it('0 = dimanche', () => {
    expect(weekdayOf(d(2026, 9, 1))).toBe(4); // jeudi 1er octobre 2026
    expect(weekdayOf(d(2026, 1, 1))).toBe(0); // dimanche 1er février 2026
    expect(weekdayOf(d(2024, 1, 29))).toBe(4); // jeudi 29 février 2024
    expect(weekdayOf(d(2000, 0, 1))).toBe(6); // samedi 1er janvier 2000
  });
  it('le premier jour de la semaine suit la langue : lundi en français, dimanche en anglais', () => {
    expect(firstWeekday('fr')).toBe(1);
    expect(firstWeekday('en')).toBe(0);
  });
  it('ordre des colonnes', () => {
    expect(weekdayOrder(1)).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(weekdayOrder(0)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
  it('début et fin de semaine', () => {
    expect(startOfWeek(d(2026, 9, 15), 1)).toEqual(d(2026, 9, 12)); // jeudi -> lundi
    expect(endOfWeek(d(2026, 9, 15), 1)).toEqual(d(2026, 9, 18)); // -> dimanche
    expect(startOfWeek(d(2026, 9, 15), 0)).toEqual(d(2026, 9, 11)); // -> dimanche
    expect(endOfWeek(d(2026, 9, 15), 0)).toEqual(d(2026, 9, 17)); // -> samedi
    expect(startOfWeek(d(2026, 9, 12), 1)).toEqual(d(2026, 9, 12)); // déjà lundi
    expect(startOfWeek(d(2026, 9, 1), 1)).toEqual(d(2026, 8, 28)); // chevauche le mois précédent
  });
});

describe('addDays', () => {
  it('traverse les fins de mois et d’année', () => {
    expect(addDays(d(2026, 11, 31), 1)).toEqual(d(2027, 0, 1));
    expect(addDays(d(2027, 0, 1), -1)).toEqual(d(2026, 11, 31));
    expect(addDays(d(2026, 9, 31), 1)).toEqual(d(2026, 10, 1));
    expect(addDays(d(2024, 1, 28), 1)).toEqual(d(2024, 1, 29));
    expect(addDays(d(2023, 1, 28), 1)).toEqual(d(2023, 2, 1));
    expect(addDays(d(2026, 9, 15), 7)).toEqual(d(2026, 9, 22));
    expect(addDays(d(2026, 9, 15), 0)).toEqual(d(2026, 9, 15));
  });
});

describe('addMonths', () => {
  it('décembre → janvier de l’année suivante, et inversement', () => {
    expect(addMonths(d(2026, 11, 15), 1)).toEqual(d(2027, 0, 15));
    expect(addMonths(d(2027, 0, 15), -1)).toEqual(d(2026, 11, 15));
    expect(addMonths(d(2026, 11, 15), 13)).toEqual(d(2028, 0, 15));
  });
  it('ramène le jour à la fin du mois d’arrivée', () => {
    expect(addMonths(d(2026, 0, 31), 1)).toEqual(d(2026, 1, 28));
    expect(addMonths(d(2028, 0, 31), 1)).toEqual(d(2028, 1, 29));
    expect(addMonths(d(2026, 2, 31), -1)).toEqual(d(2026, 1, 28));
    expect(addMonths(d(2026, 4, 31), 1)).toEqual(d(2026, 5, 30));
  });
  it('addYears : le 29 février devient le 28 en année non bissextile', () => {
    expect(addYears(d(2024, 1, 29), 1)).toEqual(d(2025, 1, 28));
    expect(addYears(d(2024, 1, 29), 4)).toEqual(d(2028, 1, 29));
    expect(addYears(d(2026, 5, 10), -1)).toEqual(d(2025, 5, 10));
  });
});

describe('comparaisons et bornes', () => {
  it('compareDates et sameDate', () => {
    expect(compareDates(d(2026, 0, 1), d(2026, 0, 2))).toBeLessThan(0);
    expect(compareDates(d(2027, 0, 1), d(2026, 11, 31))).toBeGreaterThan(0);
    expect(compareDates(d(2026, 5, 5), d(2026, 5, 5))).toBe(0);
    expect(sameDate(d(2026, 5, 5), d(2026, 5, 5))).toBe(true);
    expect(sameDate(d(2026, 5, 5), d(2026, 5, 6))).toBe(false);
  });
  it('clampDate borne l’année', () => {
    expect(clampDate(d(MIN_YEAR - 5, 3, 3)).year).toBe(MIN_YEAR);
    expect(clampDate(d(MAX_YEAR + 50, 3, 3)).year).toBe(MAX_YEAR);
    expect(clampDate(d(2026, 3, 3))).toEqual(d(2026, 3, 3));
    expect(clampDate(d(MIN_YEAR - 1, 0, 1))).toEqual(d(MIN_YEAR, 0, 1));
  });
  it('les opérations ne sortent jamais des bornes', () => {
    expect(addDays(d(MAX_YEAR, 11, 31), 1).year).toBe(MAX_YEAR);
    expect(addMonths(d(MIN_YEAR, 0, 10), -1).year).toBe(MIN_YEAR);
    expect(addYears(d(MAX_YEAR, 5, 5), 3).year).toBe(MAX_YEAR);
  });
  it('fromDate lit la date locale', () => {
    expect(fromDate(new Date(2026, 9, 17, 23, 59))).toEqual(d(2026, 9, 17));
  });
});

describe('monthGrid', () => {
  it('octobre 2026, semaine du lundi : 5 semaines, jours du mois voisin avant et après', () => {
    const grid = monthGrid(2026, 9, 1);
    expect(grid).toHaveLength(5);
    for (const week of grid) expect(week).toHaveLength(7);
    expect(grid[0]!.map((c) => c.day)).toEqual([28, 29, 30, 1, 2, 3, 4]);
    expect(grid[0]!.map((c) => c.inMonth)).toEqual([false, false, false, true, true, true, true]);
    expect(grid[0]![0]).toMatchObject({ year: 2026, month: 8 });
    expect(grid[4]!.map((c) => c.day)).toEqual([26, 27, 28, 29, 30, 31, 1]);
    expect(grid[4]![6]).toMatchObject({ year: 2026, month: 10, day: 1, inMonth: false });
  });

  it('octobre 2026, semaine du dimanche : commence le dimanche 27 septembre', () => {
    const grid = monthGrid(2026, 9, 0);
    expect(grid[0]!.map((c) => c.day)).toEqual([27, 28, 29, 30, 1, 2, 3]);
    expect(grid[4]!.map((c) => c.day)).toEqual([25, 26, 27, 28, 29, 30, 31]);
    expect(grid).toHaveLength(5);
  });

  it('février 2026 commence un dimanche : 4 semaines pleines (dimanche) ou 5 (lundi)', () => {
    expect(monthGrid(2026, 1, 0)).toHaveLength(4);
    expect(monthGrid(2026, 1, 0).flat().every((c) => c.inMonth)).toBe(true);
    expect(monthGrid(2026, 1, 1)).toHaveLength(5);
  });

  it('janvier : les jours d’avant sont en décembre de l’année précédente', () => {
    const grid = monthGrid(2027, 0, 1); // 1er janvier 2027 = vendredi
    expect(grid[0]!.slice(0, 4).map((c) => [c.year, c.month, c.day])).toEqual([
      [2026, 11, 28],
      [2026, 11, 29],
      [2026, 11, 30],
      [2026, 11, 31],
    ]);
  });

  it('décembre : les jours d’après sont en janvier de l’année suivante', () => {
    const grid = monthGrid(2026, 11, 1); // 31 décembre 2026 = jeudi
    const last = grid[grid.length - 1]!;
    expect(last.map((c) => [c.year, c.month, c.day])).toEqual([
      [2026, 11, 28],
      [2026, 11, 29],
      [2026, 11, 30],
      [2026, 11, 31],
      [2027, 0, 1],
      [2027, 0, 2],
      [2027, 0, 3],
    ]);
  });

  it('février bissextile : 29 jours dans le mois', () => {
    const inMonth = monthGrid(2024, 1, 1).flat().filter((c) => c.inMonth);
    expect(inMonth).toHaveLength(29);
    expect(inMonth[28]!.day).toBe(29);
  });

  it('un mois de 31 jours qui commence un dimanche tient sur 6 semaines (lundi)', () => {
    // mars 2026 : 1er mars = dimanche, 31 jours → lundi-premier : 6 semaines
    expect(monthGrid(2026, 2, 1)).toHaveLength(6);
  });

  it('peut être complétée à 6 semaines pour une hauteur stable', () => {
    const padded = monthGrid(2026, 1, 0, 6);
    expect(padded).toHaveLength(6);
    expect(padded[4]![0]).toMatchObject({ month: 2, day: 1, inMonth: false });
    expect(padded[5]![6]).toMatchObject({ month: 2, day: 14, inMonth: false });
  });

  it('chaque jour du mois apparaît une seule fois, dans l’ordre', () => {
    for (const first of [0, 1]) {
      for (const [y, m] of [[2026, 0], [2026, 1], [2024, 1], [2026, 9], [2027, 11]] as const) {
        const days = monthGrid(y, m, first).flat().filter((c) => c.inMonth).map((c) => c.day);
        expect(days).toEqual(Array.from({ length: daysInMonth(y, m) }, (_, i) => i + 1));
      }
    }
  });
});
