import type { BureauApp } from './types';

/**
 * Les applis du bureau. Chaque `load()` est un import dynamique : le code d'une appli
 * n'est téléchargé qu'à son premier lancement.
 */
export const APPS: readonly BureauApp[] = [
  {
    id: 'terminal',
    title: 'Terminal',
    icon: 'terminal',
    defaultSize: { w: 640, h: 420 },
    mobile: 'fullscreen',
    load: () => import('../apps/terminal/index'),
  },
  {
    id: 'minesweeper',
    title: 'Démineur.exe',
    icon: 'minesweeper',
    defaultSize: { w: 460, h: 540 },
    mobile: 'fullscreen',
    load: () => import('../apps/minesweeper/index'),
  },
  {
    id: 'wordpad',
    title: 'WORDPAD.EXE',
    icon: 'wordpad',
    defaultSize: { w: 680, h: 480 },
    mobile: 'fullscreen',
    load: () => import('../apps/wordpad/index'),
  },
  {
    id: 'messenger',
    title: 'Oh-Oh! Messenger',
    icon: 'messenger',
    defaultSize: { w: 360, h: 500 },
    mobile: 'fullscreen',
    load: () => import('../apps/messenger/index'),
  },
  {
    id: 'trash',
    title: 'Corbeille',
    icon: 'trash',
    defaultSize: { w: 540, h: 400 },
    mobile: 'fullscreen',
    load: () => import('../apps/trash/index'),
  },
  {
    id: 'doom',
    title: 'DOOM.EXE',
    icon: 'doom',
    defaultSize: { w: 700, h: 520 },
    mobile: 'unsupported',
    unsupportedMessage: 'DOOM.EXE demande un clavier : ouvrez ce blog sur un ordinateur pour jouer.',
    capturesKeyboard: true,
    load: () => import('../apps/doom/index'),
  },
  {
    id: 'properties',
    title: 'Propriétés système',
    icon: 'properties',
    defaultSize: { w: 420, h: 340 },
    mobile: 'fullscreen',
    load: () => import('../apps/properties/index'),
  },
];

/** Applis visibles comme icônes du bureau et dans le menu Démarrer (« Propriétés » n'y est pas). */
export const LISTED_APPS: readonly BureauApp[] = APPS.filter((app) => app.id !== 'properties');

export function findApp(id: string): BureauApp | undefined {
  return APPS.find((app) => app.id === id);
}
