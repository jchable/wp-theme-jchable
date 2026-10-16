import { LISTED_APPS } from './registry';
import { readConfig } from './config';
import { createPrefs } from './prefs';
import { createSound } from './sound';
import { WindowManager } from './windows';
import { showContextMenu } from '../ui/contextMenu';
import { DesktopIcons } from '../ui/desktopIcons';
import type { IconItem } from '../ui/desktopIcons';
import { showBsod, showShutdown } from '../ui/overlays';
import { SidebarWindows } from '../ui/sidebarWindows';
import { IdleWatcher, createScreensaver, isScreensaverEligiblePage } from '../ui/screensaver';
import { StartMenu } from '../ui/startMenu';
import { Taskbar } from '../ui/taskbar';

const DESKTOP_QUERY = '(min-width: 900px)';
const SCREENSAVER_DELAY_MS = 3 * 60 * 1000;

const ICON_BY_CLASS: ReadonlyArray<readonly [string, string]> = [
  ['icon-text', 'document'],
  ['icon-folder-blue', 'folder-blue'],
  ['icon-search', 'search'],
  ['icon-rss', 'rss'],
];

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Icônes tirées du menu du site : le menu WordPress reste la source (gérée dans l'admin). */
function readMenuIcons(assetsUrl: string): IconItem[] {
  const links = document.querySelectorAll<HTMLAnchorElement>('.desktop-icons a.wp-block-navigation-item__content');
  return [...links].map((link) => {
    const item = link.closest('li');
    const label = link.textContent?.trim() ?? '';
    const icon = ICON_BY_CLASS.find(([cls]) => item?.classList.contains(cls))?.[1] ?? 'folder';
    const href = link.getAttribute('href') ?? '';
    return {
      id: `nav:${label.toLowerCase()}`,
      label,
      iconUrl: `${assetsUrl}icons/${icon}.svg`,
      kind: href.startsWith('#') ? 'anchor' : 'link',
      href: href.startsWith('#') ? href : link.href,
    } satisfies IconItem;
  });
}

/** Démarre le bureau : préférences, fenêtres, icônes, barre des tâches, menu Démarrer, écran de veille. */
export function bootstrap(): void {
  const root = document.documentElement;
  root.classList.add('bureau-js');
  if (document.querySelector('.bsod')) return; // la page 404 est un écran bleu, pas un bureau

  const config = readConfig();
  const storage = safeStorage();
  const prefs = createPrefs(storage);
  const sound = createSound(() => prefs.get().sound);
  const mq = window.matchMedia(DESKTOP_QUERY);
  const isMobile = (): boolean => !mq.matches;

  const windowsLayer = document.createElement('div');
  windowsLayer.id = 'bureau-windows';
  document.body.append(windowsLayer);

  const fetchJson = async <T>(url: string): Promise<T> => {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as T;
  };

  const manager = new WindowManager({
    layer: windowsLayer,
    config,
    prefs,
    storage,
    isMobile,
    playSound: (name) => sound.play(name),
    openBsod: (message) => showBsod(message),
  });

  // --- Icônes du bureau (grand écran) et fenêtres déplaçables de la barre latérale ---
  const desktopHost = document.createElement('div');
  desktopHost.id = 'bureau-desktop';
  desktopHost.setAttribute('role', 'group');
  desktopHost.setAttribute('aria-label', 'Icônes du bureau');
  document.body.prepend(desktopHost);

  const sidebar = new SidebarWindows(prefs);
  const items: IconItem[] = [
    ...readMenuIcons(config.assetsUrl),
    ...LISTED_APPS.map(
      (app): IconItem => ({
        id: `app:${app.id}`,
        label: app.title,
        iconUrl: `${config.assetsUrl}icons/${app.icon}.svg`,
        kind: 'app',
        appId: app.id,
      }),
    ),
  ];

  const icons = new DesktopIcons({
    host: desktopHost,
    items,
    prefs,
    openApp: (id) => manager.open(id),
    navigate: (url) => location.assign(url),
    onAnchor: (hash) => {
      const target = document.querySelector<HTMLElement>(hash);
      target?.scrollIntoView({ block: 'center' });
      target?.querySelector<HTMLElement>('input, button')?.focus();
    },
    onContextMenu: (x, y) =>
      showContextMenu(x, y, [
        { label: 'Réorganiser les icônes', action: () => resetAll() },
        { label: 'Propriétés', action: () => manager.open('properties') },
      ]),
  });

  const resetAll = (): void => {
    icons.reset();
    sidebar.reset();
  };

  // --- Écran de veille : pages d'accueil, d'archives et 404 seulement ---
  const saver = createScreensaver();
  const idle = new IdleWatcher({
    timeoutMs: SCREENSAVER_DELAY_MS,
    onIdle: () => {
      if (prefs.get().screensaver && !isMobile() && !document.querySelector('.bbsod, .bshutdown')) saver.start();
    },
  });
  const saverEligible = isScreensaverEligiblePage(document.body);
  if (saverEligible) idle.start();

  // --- Barre des tâches et menu Démarrer ---
  const taskbarRoot = document.querySelector<HTMLElement>('.taskbar');
  let taskbar: Taskbar | null = null;
  let startMenu: StartMenu | null = null;
  if (taskbarRoot) {
    taskbar = new Taskbar({ root: taskbarRoot, windows: manager, locale: config.locale, onStart: () => startMenu?.toggle() });
    taskbar.mount();
    const button = taskbar.startButton;
    if (button) {
      startMenu = new StartMenu({
        button,
        config,
        prefs,
        apps: LISTED_APPS,
        openApp: (id) => manager.open(id),
        resetIcons: () => resetAll(),
        startScreensaver: () => saver.start(),
        shutdown: () => showShutdown(),
        fetchJson,
        onToggle: (open) => taskbar?.setStartExpanded(open),
        screensaverAvailable: saverEligible,
      });
    }
  }

  // --- Grand écran / petit écran ---
  let desktopOn = false;
  const applyMode = (): void => {
    const wantDesktop = !isMobile();
    root.classList.toggle('bureau-desktop-on', wantDesktop);
    if (wantDesktop && !desktopOn) {
      icons.mount();
      sidebar.mount();
    } else if (!wantDesktop && desktopOn) {
      icons.destroy();
      sidebar.destroy();
    }
    desktopOn = wantDesktop;
    manager.refreshMode();
  };
  applyMode();
  mq.addEventListener('change', applyMode);
}
