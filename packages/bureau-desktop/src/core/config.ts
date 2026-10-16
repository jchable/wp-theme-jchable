import type { BureauConfig } from './types';

declare global {
  interface Window {
    jchableBureau?: Partial<BureauConfig>;
  }
}

/** Ajoute une barre oblique finale si elle manque. */
export const withTrailingSlash = (url: string): string => (url.endsWith('/') ? url : `${url}/`);

/** Réglages transmis par le PHP, avec des valeurs de repli pour que le bureau ne plante jamais. */
export function readConfig(source: Partial<BureauConfig> | undefined = window.jchableBureau): BureauConfig {
  const origin = typeof location === 'undefined' ? 'http://localhost/' : `${location.origin}/`;
  const raw = source ?? {};
  return {
    homeUrl: withTrailingSlash(raw.homeUrl ?? origin),
    restUrl: withTrailingSlash(raw.restUrl ?? `${origin}wp-json/`),
    locale: raw.locale ?? 'fr-FR',
    assetsUrl: withTrailingSlash(raw.assetsUrl ?? `${origin}`),
    siteName: raw.siteName ?? document.title,
    sitemapUrl: raw.sitemapUrl ?? origin,
    feedUrl: raw.feedUrl ?? `${origin}feed/`,
    doomBaseUrl: withTrailingSlash(raw.doomBaseUrl ?? `${origin}doom/`),
  };
}
