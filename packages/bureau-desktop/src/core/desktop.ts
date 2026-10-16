import { focusAnchor } from './anchor';
import { getLang, resolveLang, setLang } from './i18n';
import { hasReadableContent, slugOf } from './pages';
import { LISTED_APPS, pageApp } from './registry';
import { readConfig } from './config';
import { createPrefs } from './prefs';
import { createSound } from './sound';
import { t } from './ui-i18n';
import { WindowManager } from './windows';
import { showContextMenu } from '../ui/contextMenu';
import { DesktopIcons } from '../ui/desktopIcons';
import type { IconItem } from '../ui/desktopIcons';
import { showBsod, showShutdown } from '../ui/overlays';
import { SidebarWindows } from '../ui/sidebarWindows';
import { chromeLabel, translateChrome } from '../ui/chrome';
import { readMenuIcons } from '../ui/menuIcons';
import { IdleWatcher, createScreensaver, isScreensaverEligiblePage } from '../ui/screensaver';
import { StartMenu } from '../ui/startMenu';
import { Taskbar } from '../ui/taskbar';

const DESKTOP_QUERY = '(min-width: 900px)';
const SCREENSAVER_DELAY_MS = 3 * 60 * 1000;

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Démarre le bureau : préférences, fenêtres, icônes, barre des tâches, menu Démarrer, écran de veille. */
export function bootstrap(): void {
  const root = document.documentElement;
  root.classList.add('bureau-js');

  const storage = safeStorage();
  const prefs = createPrefs(storage);

  // Langue de l'interface : le choix du visiteur, sinon celle de son navigateur (français ou anglais).
  setLang(resolveLang(prefs.get().lang, navigator.languages?.length ? navigator.languages : [navigator.language]));
  root.dataset['bureauLang'] = getLang();
  translateChrome(document);

  if (document.querySelector('.bsod')) return; // la page 404 est un écran bleu, pas un bureau

  const config = readConfig();
  const sound = createSound(() => prefs.get().sound);
  const mq = window.matchMedia(DESKTOP_QUERY);
  const leftInset = (): number => parseFloat(getComputedStyle(root).getPropertyValue('--bureau-band')) || 0;
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
    leftInset,
    playSound: (name) => sound.play(name),
    openBsod: (message) => showBsod(message),
  });

  // --- Icônes du bureau (grand écran) et fenêtres déplaçables de la barre latérale ---
  const desktopHost = document.createElement('div');
  desktopHost.id = 'bureau-desktop';
  desktopHost.setAttribute('role', 'group');
  desktopHost.setAttribute('aria-label', t('icons.group'));
  // Placé après le contenu : la première tabulation tombe sur le lien d'évitement, pas sur les icônes.
  const siteBlocks = document.querySelector('.wp-site-blocks');
  if (siteBlocks) siteBlocks.after(desktopHost);
  else document.body.append(desktopHost);

  const sidebar = new SidebarWindows(prefs, document, leftInset);
  const items: IconItem[] = [
    ...readMenuIcons(document, config.assetsUrl, config.feedUrl).map((item) => ({ ...item, label: chromeLabel(item.label) })),
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

  // Une page avec du contenu (À propos…) s'ouvre dans une fenêtre ; tout le reste est une navigation normale.
  const openPage = async (href: string): Promise<void> => {
    const slug = href === config.feedUrl ? null : slugOf(href, location.origin);
    if (!slug) {
      location.assign(href);
      return;
    }
    try {
      const pages = await fetchJson<Array<{ content?: { rendered?: string } }>>(
        `${config.restUrl}wp/v2/pages?slug=${encodeURIComponent(slug)}&_fields=title,content,link`,
      );
      const page = Array.isArray(pages) ? pages[0] : undefined;
      if (page && hasReadableContent(page.content?.rendered)) {
        manager.openApp(pageApp(slug), { slug, page });
        return;
      }
    } catch {
      /* l'API ne répond pas : on ouvre la page normalement */
    }
    location.assign(href);
  };

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
    navigate: (url) => void openPage(url),
    onAnchor: focusAnchor,
    onContextMenu: (x, y) =>
      showContextMenu(x, y, [
        { label: t('menu.reset'), action: () => resetAll() },
        { label: t('menu.properties'), action: () => manager.open('properties') },
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
          ...items.filter((item) => item.kind === 'link' && item.href && item.href !== config.feedUrl).map((item) => ({ label: item.label, href: item.href as string })),
          { label: t('menu.rss'), href: config.feedUrl },
        ],
        openPage: (href) => void openPage(href),
        setLanguage: (lang) => {
          prefs.update((p) => {
            p.lang = lang;
          });
          location.reload();
        },
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
