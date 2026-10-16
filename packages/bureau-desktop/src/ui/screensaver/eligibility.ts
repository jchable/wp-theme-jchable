export interface ClassListLike {
  contains(className: string): boolean;
}

const ELIGIBLE = ['home', 'blog', 'archive', 'search', 'error404'] as const;

/**
 * L'écran de veille n'est autorisé que sur l'accueil, les archives, la
 * recherche et la 404 (jamais pendant la lecture d'un article ou d'une page).
 * Classes `body` de WordPress ; `home`/`blog` priment sur `page`
 * (page d'accueil statique).
 */
export function isScreensaverEligiblePage(body: { classList: ClassListLike }): boolean {
  const has = (c: string): boolean => body.classList.contains(c);
  if (has('home') || has('blog')) return true;
  if (has('single') || has('page')) return false;
  return ELIGIBLE.some(has);
}
