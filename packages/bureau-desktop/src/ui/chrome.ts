import { getLang } from '../core/i18n';

/** Textes écrits en dur dans les gabarits du thème (français), avec leur traduction anglaise. */
const CHROME_EN: Readonly<Record<string, string>> = {
  'Accueil': 'Home',
  'À propos': 'About',
  'Plan du site': 'Site map',
  'Recherche': 'Search',
  'Rechercher…': 'Search…',
  'Nom contient :': 'Name contains:',
  'Chercher': 'Search',
  'bienvenue.txt': 'welcome.txt',
  'commentaires.log': 'comments.log',
  'plan-du-site.md': 'sitemap.md',
  'Derniers articles': 'Latest posts',
  'Articles plus anciens': 'Older posts',
  'Articles plus récents': 'Newer posts',
  '◂ Précédent': '◂ Previous',
  'Suivant ▸': 'Next ▸',
  'Explorateur': 'Explorer',
  'Nom': 'Name',
  'Catégorie': 'Category',
  'Archives par mois': 'Archives by month',
  'Catégories': 'Categories',
  '✦ Démarrer': '✦ Start',
  'Propulsé par': 'Powered by',
  'Page introuvable': 'Page not found',
  'Une erreur fatale est survenue à l’adresse :': 'A fatal error occurred at address:',
  "Une erreur fatale est survenue à l'adresse :": 'A fatal error occurred at address:',
  "La page demandée n'existe pas ou a été déplacée. Vous pouvez poursuivre, mais le blog risque d'être instable.":
    'The requested page does not exist or has been moved. You may continue, but the blog may become unstable.',
  'Appuyez sur une touche pour continuer _': 'Press any key to continue _',
  'Aucun article pour le moment.': 'No posts yet.',
  'Aucun article dans cette archive.': 'No posts in this archive.',
  "Aucun résultat pour cette recherche. Essayez d'autres mots :": 'No results for this search. Try other words:',
  'Flux RSS': 'RSS feed',
};

/** Parties de la page qui appartiennent au thème : le contenu des articles n'est jamais traduit. */
const SCOPES = [
  '.menubar',
  '.window-titlebar',
  '.welcome',
  '.feed-title',
  '.retro-pagination',
  '.post-nav',
  '.sidebar-windows',
  '.explorer-head',
  '.explorer .wp-block-query-no-results',
  '.explorer .wp-block-search',
  '.wp-block-query .wp-block-query-no-results',
  '.window-body > h2.wp-block-heading',
  '.taskbar',
  '.bsod',
  '.home-link',
];

const ATTRIBUTES = ['aria-label', 'placeholder', 'title', 'value'] as const;

/** Libellé du menu du site (Accueil, À propos…) dans la langue courante. */
export function chromeLabel(text: string): string {
  return getLang() === 'en' ? (CHROME_EN[text.trim()] ?? text) : text;
}

function translateText(text: string): string {
  const trimmed = text.trim();
  const english = CHROME_EN[trimmed];
  if (!english) return text;
  return text.replace(trimmed, english);
}

/** Traduit les textes du thème en anglais (aucun effet en français). Idempotent. */
export function translateChrome(root: ParentNode): void {
  if (getLang() !== 'en') return;
  for (const selector of SCOPES) {
    for (const scope of root.querySelectorAll(selector)) {
      const nodes = [scope, ...scope.querySelectorAll('*')];
      for (const node of nodes) {
        for (const name of ATTRIBUTES) {
          const value = node.getAttribute(name);
          if (value && CHROME_EN[value.trim()]) node.setAttribute(name, translateText(value));
        }
      }
      const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
      for (let text = walker.nextNode(); text; text = walker.nextNode()) {
        const value = text.nodeValue ?? '';
        const next = translateText(value);
        if (next !== value) text.nodeValue = next;
      }
    }
  }
}
