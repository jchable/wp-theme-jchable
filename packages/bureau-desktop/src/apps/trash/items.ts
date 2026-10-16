import { t } from './i18n';

/*
 * Corbeille : brouillons « supprimés » (faux, bien sûr).
 *
 * ATTENTION : tous les textes sont des PLACEHOLDERS (voir i18n.ts), à valider
 * (ou réécrire) par le propriétaire du blog. Modifiez librement les noms,
 * tailles, dates et aperçus : l'appli s'adapte toute seule.
 * Le nom et l'aperçu sont résolus dans la langue courante à chaque lecture.
 */

export interface TrashItem {
  /** Nom du fichier (dans la langue courante). */
  readonly name: string;
  /** Taille en Ko. */
  readonly sizeKo: number;
  /** Date de suppression, au format AAAA-MM-JJ. */
  readonly deletedOn: string;
  /** Aperçu d'une ligne, affiché quand la ligne est sélectionnée (dans la langue courante). */
  readonly preview: string;
}

type ItemKey = 'item0' | 'item1' | 'item2' | 'item3' | 'item4' | 'item5' | 'item6' | 'item7';

function item(key: ItemKey, sizeKo: number, deletedOn: string): TrashItem {
  return {
    get name() {
      return t(`${key}Name` as `${ItemKey}Name`);
    },
    sizeKo,
    deletedOn,
    get preview() {
      return t(`${key}Preview` as `${ItemKey}Preview`);
    },
  };
}

export const TRASH_ITEMS: readonly TrashItem[] = [
  item('item0', 14, '2025-03-14'),
  item('item1', 38, '2025-06-02'),
  item('item2', 22, '2025-01-27'),
  item('item3', 9, '2025-04-18'),
  item('item4', 3, '2025-09-09'),
  item('item5', 17, '2025-02-11'),
  item('item6', 1, '2025-07-21'),
  item('item7', 56, '2025-10-05'),
];
