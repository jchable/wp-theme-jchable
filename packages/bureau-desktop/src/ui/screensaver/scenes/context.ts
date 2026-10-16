import { getLang } from '../../../core/i18n';
import { DEFAULT_COLORS, type SceneColors, type SceneContext } from './types';

const MAX_TITLES = 12;
const MAX_TITLE_LENGTH = 80;

/** Un seul espace, sans retour à la ligne ni excès de longueur : le texte part sur un canevas. */
const clean = (text: string | null | undefined): string => (text ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_TITLE_LENGTH);

/** Les titres d'articles visibles sur la page (accueil, archives), sans doublon. */
export function readTitles(doc: Document): string[] {
  const seen = new Set<string>();
  for (const node of doc.querySelectorAll('.wp-block-post-title, .post-feed h2, .post-feed h3')) {
    const title = clean(node.textContent);
    if (title) seen.add(title);
    if (seen.size >= MAX_TITLES) break;
  }
  return [...seen];
}

const COLOR_VARS: Record<keyof SceneColors, string> = {
  desk: '--wp--preset--color--desk',
  paper: '--wp--preset--color--base',
  ink: '--wp--preset--color--contrast',
  yellow: '--wp--preset--color--yellow',
  sky: '--wp--preset--color--sky',
  accent: '--wp--preset--color--accent',
};

/** Les couleurs du thème (variables CSS de WordPress) ; une valeur absente ou vide garde le défaut. */
export function readColors(doc: Document): SceneColors {
  const style = doc.defaultView?.getComputedStyle(doc.documentElement);
  const colors = { ...DEFAULT_COLORS };
  if (!style) return colors;
  for (const key of Object.keys(COLOR_VARS) as Array<keyof SceneColors>) {
    const value = style.getPropertyValue(COLOR_VARS[key]).trim();
    if (value) colors[key] = value;
  }
  return colors;
}

/** Le contexte d'une scène, lu sur la page ; les dimensions sont fixées par l'écran de veille. */
export function readSceneContext(doc: Document = document): SceneContext {
  const siteName = clean(doc.querySelector('.wp-block-site-title')?.textContent) || 'Julien Chable';
  return {
    width: 1,
    height: 1,
    rng: Math.random,
    colors: readColors(doc),
    titles: readTitles(doc),
    siteName,
    lang: getLang(),
  };
}
