import type { AppContext } from '../../core/types';
import { sanitizePageHtml } from './sanitize';
import './style.css';

interface PageData {
  title?: { rendered?: unknown };
  content?: { rendered?: unknown };
  link?: unknown;
}

let root: HTMLElement | null = null;

const plainText = (html: string): string => new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '';

/**
 * Lecteur de page : le contenu d'une page WordPress (À propos…) dans une fenêtre du bureau.
 * Les données arrivent déjà chargées dans `ctx.args.page` ; le HTML est nettoyé avant affichage.
 */
export function mount(el: HTMLElement, ctx: AppContext): void {
  root = el;
  const slug = typeof ctx.args['slug'] === 'string' ? ctx.args['slug'] : 'page';
  const page = (ctx.args['page'] ?? {}) as PageData;
  ctx.setTitle(`${slug}.md`);

  const article = document.createElement('article');
  article.className = 'bapp-page';

  const title = document.createElement('h1');
  title.className = 'bapp-page-title';
  title.textContent = typeof page.title?.rendered === 'string' ? plainText(page.title.rendered) : slug;

  const content = document.createElement('div');
  content.className = 'bapp-page-content';
  if (typeof page.content?.rendered === 'string') {
    content.append(sanitizePageHtml(page.content.rendered, ctx.config.homeUrl));
  }

  const footer = document.createElement('p');
  footer.className = 'bapp-page-footer';
  const link = document.createElement('a');
  const target = typeof page.link === 'string' ? page.link : '';
  link.href = /^https?:\/\//.test(target) ? target : `${ctx.config.homeUrl}${encodeURIComponent(slug)}/`;
  link.textContent = 'Ouvrir la page ↗';
  footer.append(link);

  article.append(title, content, footer);
  el.replaceChildren(article);
  article.tabIndex = -1;
  article.focus({ preventScroll: true });
}

export function unmount(): void {
  root?.replaceChildren();
  root = null;
}
