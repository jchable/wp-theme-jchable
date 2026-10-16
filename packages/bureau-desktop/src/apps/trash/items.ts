/*
 * Corbeille : brouillons « supprimés » (faux, bien sûr).
 *
 * ATTENTION : tous les textes de ce fichier sont des PLACEHOLDERS, à valider
 * (ou réécrire) par le propriétaire du blog. Modifiez librement les noms,
 * tailles, dates et aperçus : l'appli s'adapte toute seule.
 */

export interface TrashItem {
  /** Nom du fichier. */
  readonly name: string;
  /** Taille en Ko. */
  readonly sizeKo: number;
  /** Date de suppression, au format AAAA-MM-JJ. */
  readonly deletedOn: string;
  /** Aperçu d'une ligne, affiché quand la ligne est sélectionnée. */
  readonly preview: string;
}

export const TRASH_ITEMS: readonly TrashItem[] = [
  {
    name: 'sharepoint-est-mort-vive-sharepoint.md',
    sizeKo: 14,
    deletedOn: '2025-03-14',
    preview: "SharePoint est mort. Enfin, il est surtout en pleine migration, ce qui revient au même.",
  },
  {
    name: 'mon-premier-billet-sur-les-agents-v7-final-FINAL.md',
    sizeKo: 38,
    deletedOn: '2025-06-02',
    preview: 'Version 7, relue, corrigée, puis reprise de zéro par un agent qui avait des idées.',
  },
  {
    name: 'office-365-pour-les-nuls-(et-les-admins).md',
    sizeKo: 22,
    deletedOn: '2025-01-27',
    preview: 'Chapitre 1 : pourquoi le bouton que vous cherchez vient de changer de place.',
  },
  {
    name: 'dotnet-9-ca-compile-chez-moi.md',
    sizeKo: 9,
    deletedOn: '2025-04-18',
    preview: "Tout fonctionne parfaitement. Sur ma machine. Aujourd'hui. Avec la bonne version du SDK.",
  },
  {
    name: 'prompt-parfait-vraiment-cette-fois.md',
    sizeKo: 3,
    deletedOn: '2025-09-09',
    preview: 'Tu es un assistant extrêmement précis. Réponds toujours juste. (Spoiler : non.)',
  },
  {
    name: 'markdown-vs-tout-le-reste.md',
    sizeKo: 17,
    deletedOn: '2025-02-11',
    preview: "Les titres avec des dièses, c'est bien. Les tableaux en Markdown, on en reparlera.",
  },
  {
    name: 'liste-des-trucs-a-ecrire-un-jour.md',
    sizeKo: 1,
    deletedOn: '2025-07-21',
    preview: '1. Écrire le billet sur la liste des billets à écrire. 2. Voir point 1.',
  },
  {
    name: 'conference-sans-diapositives-brouillon.md',
    sizeKo: 56,
    deletedOn: '2025-10-05',
    preview: 'Plan : parler vingt minutes sans montrer une seule diapositive. Statut : très ambitieux.',
  },
];
