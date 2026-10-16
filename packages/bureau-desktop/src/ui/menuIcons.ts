import type { IconItem } from './desktopIcons';

const ICON_BY_CLASS: ReadonlyArray<readonly [string, string]> = [
  ['icon-text', 'document'],
  ['icon-folder-blue', 'folder-blue'],
  ['icon-search', 'search'],
  ['icon-rss', 'rss'],
];

/** Identifiant stable d'une icône : il ne dépend ni du libellé ni du nom de domaine. */
function stableId(link: HTMLAnchorElement, raw: string): string {
  if (raw.startsWith('#')) return `nav:${raw}`;
  try {
    const url = new URL(link.href, location.href);
    return `nav:${url.pathname}${url.search}${url.hash}`;
  } catch {
    return `nav:${raw}`;
  }
}

/**
 * Icônes tirées du menu du site : le menu WordPress reste la source (gérée dans l'admin).
 * L'icône RSS suit l'adresse du flux donnée par WordPress, pas un chemin écrit en dur.
 */
export function readMenuIcons(root: ParentNode, assetsUrl: string, feedUrl: string): IconItem[] {
  const links = root.querySelectorAll<HTMLAnchorElement>('.desktop-icons a.wp-block-navigation-item__content');
  return [...links].map((link) => {
    const item = link.closest('li');
    const label = link.textContent?.trim() ?? '';
    const icon = ICON_BY_CLASS.find(([cls]) => item?.classList.contains(cls))?.[1] ?? 'folder';
    const raw = link.getAttribute('href') ?? '';
    const isFeed = icon === 'rss';
    const isAnchor = raw.startsWith('#');
    return {
      id: isFeed ? 'nav:rss' : stableId(link, raw),
      label,
      iconUrl: `${assetsUrl}icons/${icon}.svg`,
      kind: isAnchor ? 'anchor' : 'link',
      href: isAnchor ? raw : isFeed ? feedUrl : link.href,
    } satisfies IconItem;
  });
}
