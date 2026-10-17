import type { BureauApp } from './types';
import { t } from './ui-i18n';

/**
 * Les applis du bureau. Chaque `load()` est un import dynamique : le code d'une appli
 * n'est téléchargé qu'à son premier lancement.
 */
export const APPS: readonly BureauApp[] = [
  {
    id: 'terminal',
    get title() {
      return t('app.terminal');
    },
    icon: 'terminal',
    defaultSize: { w: 640, h: 420 },
    mobile: 'fullscreen',
    load: () => import('../apps/terminal/index'),
  },
  {
    id: 'calculator',
    get title() {
      return t('app.calculator');
    },
    icon: 'calculator',
    defaultSize: { w: 280, h: 360 },
    mobile: 'fullscreen',
    load: () => import('../apps/calculator/index'),
  },
  {
    id: 'paint',
    get title() {
      return t('app.paint');
    },
    icon: 'paint',
    defaultSize: { w: 740, h: 590 }, // assez grande pour montrer tout le canevas de 640×400, sans barres de défilement
    mobile: 'fullscreen',
    load: () => import('../apps/paint/index'),
  },
  {
    id: 'minesweeper',
    get title() {
      return t('app.minesweeper');
    },
    icon: 'minesweeper',
    defaultSize: { w: 460, h: 540 },
    mobile: 'fullscreen',
    load: () => import('../apps/minesweeper/index'),
  },
  {
    id: 'wordpad',
    get title() {
      return t('app.wordpad');
    },
    icon: 'wordpad',
    defaultSize: { w: 680, h: 480 },
    mobile: 'fullscreen',
    load: () => import('../apps/wordpad/index'),
  },
  {
    id: 'messenger',
    get title() {
      return t('app.messenger');
    },
    icon: 'messenger',
    defaultSize: { w: 360, h: 500 },
    mobile: 'fullscreen',
    load: () => import('../apps/messenger/index'),
  },
  {
    id: 'trash',
    get title() {
      return t('app.trash');
    },
    icon: 'trash',
    defaultSize: { w: 540, h: 400 },
    mobile: 'fullscreen',
    load: () => import('../apps/trash/index'),
  },
  {
    id: 'doom',
    get title() {
      return t('app.doom');
    },
    icon: 'doom',
    defaultSize: { w: 700, h: 520 },
    mobile: 'unsupported',
    get unsupportedMessage() {
      return t('app.doomUnsupported');
    },
    capturesKeyboard: true,
    load: () => import('../apps/doom/index'),
  },
  {
    id: 'properties',
    get title() {
      return t('app.properties');
    },
    icon: 'properties',
    defaultSize: { w: 420, h: 340 },
    mobile: 'fullscreen',
    load: () => import('../apps/properties/index'),
  },
  {
    id: 'settings',
    get title() {
      return t('app.settings');
    },
    icon: 'properties',
    defaultSize: { w: 520, h: 600 },
    mobile: 'fullscreen',
    load: () => import('../apps/settings/index'),
  },
];

/** Applis visibles comme icônes du bureau et dans le menu Démarrer (« Propriétés » et « Préférences » ont leur propre entrée). */
export const LISTED_APPS: readonly BureauApp[] = APPS.filter((app) => app.id !== 'properties' && app.id !== 'settings');

/** Fenêtre de lecture d'une page du site (À propos…) : une fenêtre par page. */
export function pageApp(slug: string): BureauApp {
  return {
    id: `page-${slug}`,
    title: `${slug}.md`,
    icon: 'wordpad',
    defaultSize: { w: 620, h: 480 },
    mobile: 'fullscreen',
    load: () => import('../apps/page/index'),
  };
}

export function findApp(id: string): BureauApp | undefined {
  return APPS.find((app) => app.id === id);
}
