import type { IconItem } from '../ui/desktopIcons';

export interface IconPlaces {
  homeUrl: string;
  sitemapUrl: string;
  feedUrl: string;
}

/** Chemin d'une adresse sans barre oblique finale (« /plan-du-site ») ; `null` si ce n'est pas une adresse. */
function pathOf(href: string | undefined): string | null {
  if (!href) return null;
  try {
    const path = new URL(href, location.href).pathname.replace(/\/+$/, '');
    return path === '' ? '/' : path;
  } catch {
    return null;
  }
}

/**
 * Icônes du bureau : le plan du site et le flux RSS vivent dans la barre des tâches (près de l'heure),
 * et la corbeille se place juste sous l'icône Accueil. Le menu Démarrer garde, lui, tous les liens du menu.
 */
export function arrangeDesktopIcons(
  menu: readonly IconItem[],
  apps: readonly IconItem[],
  places: IconPlaces,
): { desktop: IconItem[]; menuLinks: IconItem[] } {
  const home = pathOf(places.homeUrl);
  const sitemap = pathOf(places.sitemapUrl);
  const feed = pathOf(places.feedUrl);
  // Sans page « Plan du site », WordPress renvoie l'accueil : on ne retire alors pas l'icône Accueil.
  const sitemapIsHome = sitemap === home;

  const isShortcut = (item: IconItem): boolean => {
    if (item.id === 'nav:rss') return true;
    const path = item.kind === 'link' ? pathOf(item.href) : null;
    if (path === null) return false;
    return path === feed || (!sitemapIsHome && path === sitemap);
  };

  const rest = menu.filter((item) => !isShortcut(item));
  const trash = apps.find((item) => item.appId === 'trash');
  const others = apps.filter((item) => item !== trash);

  const homeIndex = rest.findIndex((item) => item.kind === 'link' && pathOf(item.href) === home);
  const at = (homeIndex === -1 ? 0 : homeIndex) + 1;
  const desktop = trash ? [...rest.slice(0, at), trash, ...rest.slice(at)] : [...rest];
  desktop.push(...others);

  const menuLinks = menu.filter((item) => item.kind === 'link' && item.href && pathOf(item.href) !== feed && item.id !== 'nav:rss');
  return { desktop, menuLinks };
}
