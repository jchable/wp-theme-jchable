/** Aides pour ouvrir une page WordPress dans une fenêtre du bureau. */

/**
 * Slug d'une page du site (un seul segment de chemin : « /a-propos/ »).
 * Renvoie null pour l'accueil, les archives, les ancres, les autres origines et tout lien douteux.
 */
export function slugOf(href: string, origin: string): string | null {
  if (!href || href.startsWith('#')) return null;
  let url: URL;
  try {
    url = new URL(href, `${origin}/`);
  } catch {
    return null;
  }
  if (url.origin !== origin) return null;
  const segments = url.pathname.split('/').filter(Boolean);
  if (segments.length !== 1) return null;
  try {
    return decodeURIComponent(segments[0] ?? '') || null;
  } catch {
    return null;
  }
}

/** Vrai si le contenu a du texte ou une image : une page vide (plan du site…) s'ouvre normalement. */
export function hasReadableContent(html: string | undefined): boolean {
  if (!html) return false;
  const body = new DOMParser().parseFromString(html, 'text/html').body;
  return (body.textContent ?? '').trim().length > 0 || body.querySelector('img') !== null;
}
