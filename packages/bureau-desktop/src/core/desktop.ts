import { focusAnchor } from './anchor';
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
    const target = new URL(url, location.href);
    if (target.origin !== location.origin) throw new Error('Adresse refusée : hors du site');
    const response = await fetch(target, { headers: { Accept: 'application/json' } });
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
  // Placé après le contenu : la première tabulation tombe sur le lien d'évitement, pas sur les icônes.
  const siteBlocks = document.querySelector('.wp-site-blocks');
  if (siteBlocks) siteBlocks.after(desktopHost);
  else document.body.append(desktopHost);

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

  // WordPad ouvert depuis un article part de cet article.
  const launch = (id: string): void => {
    const title = document.querySelector('h1')?.textContent?.trim();
    const onArticle = document.body.classList.contains('single') && Boolean(title);
    manager.open(id, id === 'wordpad' && onArticle ? { title, url: location.href } : {});
  };

  const icons = new DesktopIcons({
    host: desktopHost,
    items,
    prefs,
    openApp: launch,
    navigate: (url) => location.assign(url),
    onAnchor: focusAnchor,
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
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (saverEligible && !reducedMotion) idle.start(); // « moins d'animations » : jamais tout seul

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
        openApp: launch,
        links: [
          ...items.filter((item) => item.kind === 'link' && item.href).map((item) => ({ label: item.label, href: item.href as string })),
          { label: 'Flux RSS', href: config.feedUrl },
        ],
        resetIcons: () => resetAll(),
        startScreensaver: () => saver.start(),
        shutdown: () => showShutdown(),
        fetchJson,
        onToggle: (open) => taskbar?.setStartExpanded(open),
        screensaverAvailable: saverEligible,
      });
    }
  }

  // Échap, quand le focus est sur la page : ferme la fenêtre du dessus.
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !event.defaultPrevented && manager.closeTopOnEscape(event.target)) event.preventDefault();
  });

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
