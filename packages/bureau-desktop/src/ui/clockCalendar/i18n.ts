import { makeT } from '../../core/i18n';

/** Textes de la fenêtre calendrier + horloge (ouverte en cliquant sur l'heure de la barre des tâches). */
export const messages = {
  fr: {
    title: 'Date et heure',
    prevMonth: 'Mois précédent',
    nextMonth: 'Mois suivant',
    month: 'Mois',
    year: 'Année',
    today: 'Aujourd’hui',
    calendar: 'Calendrier',
    clock: 'Horloge',
  },
  en: {
    title: 'Date and time',
    prevMonth: 'Previous month',
    nextMonth: 'Next month',
    month: 'Month',
    year: 'Year',
    today: 'Today',
    calendar: 'Calendar',
    clock: 'Clock',
  },
};

export const t = makeT(messages);
