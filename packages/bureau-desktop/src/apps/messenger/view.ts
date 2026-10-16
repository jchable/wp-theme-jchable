import type { AppContext } from '../../core/types';
import { countNew, formatRelative, maxId, parseComments, replyUrl, type Message } from './logic';

export interface MessengerDeps {
  navigate: (url: string) => void;
  now: () => Date;
}

export interface Messenger {
  /** Résolu quand la première requête est terminée et affichée. */
  ready: Promise<void>;
  destroy(): void;
}

const TITLE = 'Oh-Oh! Messenger';
const SVG_NS = 'http://www.w3.org/2000/svg';

function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Petite icône originale : une bulle de dialogue avec deux yeux ronds (« oh-oh »). */
function buildIcon(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '28');
  svg.setAttribute('height', '28');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('class', 'bapp-messenger-icon');
  const bubble = document.createElementNS(SVG_NS, 'path');
  bubble.setAttribute('d', 'M4 3h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-7l-5 4v-4H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z');
  bubble.setAttribute('fill', 'var(--wp--preset--color--yellow, #FFE14D)');
  bubble.setAttribute('stroke', 'var(--wp--preset--color--contrast, #101010)');
  bubble.setAttribute('stroke-width', '1.5');
  svg.append(bubble);
  for (const cx of [8.5, 15.5]) {
    const eye = document.createElementNS(SVG_NS, 'circle');
    eye.setAttribute('cx', String(cx));
    eye.setAttribute('cy', '10');
    eye.setAttribute('r', '1.8');
    eye.setAttribute('fill', 'var(--wp--preset--color--contrast, #101010)');
    svg.append(eye);
  }
  return svg;
}

export function createMessenger(el: HTMLElement, ctx: AppContext, deps: MessengerDeps): Messenger {
  let destroyed = false;
  let token = 0;

  const root = h('div', 'bapp-messenger');
  const header = h('div', 'bapp-messenger-header');
  const titles = h('div', 'bapp-messenger-titles');
  titles.append(h('div', 'bapp-messenger-name', TITLE), h('div', 'bapp-messenger-status', 'En ligne'));
  header.append(buildIcon(), titles);
  const body = h('div', 'bapp-messenger-body');
  root.append(header, body);
  el.replaceChildren(root);

  const url = `${ctx.config.restUrl}wp/v2/comments?per_page=10&status=approve&_fields=id,author_name,date_gmt,content,link,post&order=desc`;

  function showLoading(): void {
    const p = h('p', 'bapp-messenger-state', 'Connexion…');
    p.setAttribute('role', 'status');
    body.replaceChildren(p);
  }

  function showEmpty(): void {
    body.replaceChildren(h('p', 'bapp-messenger-state', 'Aucun message pour le moment. Soyez le premier à commenter !'));
  }

  function showError(): void {
    const box = h('div', 'bapp-messenger-state bapp-messenger-error');
    box.setAttribute('role', 'alert');
    const retry = h('button', 'bapp-messenger-retry', 'Réessayer');
    retry.type = 'button';
    retry.addEventListener('click', () => void load());
    box.append(h('p', undefined, 'Impossible de joindre le serveur.'), retry);
    body.replaceChildren(box);
  }

  function bubble(m: Message, isNew: boolean, now: Date): HTMLElement {
    const li = h('article', 'bapp-messenger-bubble');
    const meta = h('div', 'bapp-messenger-meta');
    meta.append(h('span', 'bapp-messenger-author', m.author));
    if (m.date) meta.append(h('time', 'bapp-messenger-date', formatRelative(m.date, now, ctx.config.locale)));
    if (isNew) meta.append(h('span', 'bapp-messenger-new', 'nouveau'));
    li.append(meta, h('p', 'bapp-messenger-text', m.text));
    const target = replyUrl(m.link);
    if (target) {
      const reply = h('button', 'bapp-messenger-reply', 'Répondre');
      reply.type = 'button';
      reply.setAttribute('aria-label', `Répondre à ${m.author}`);
      reply.addEventListener('click', () => deps.navigate(target));
      li.append(reply);
    }
    return li;
  }

  function showMessages(messages: Message[], seen: string | null): void {
    const now = deps.now();
    const seenNum = seen === null ? 0 : Number.parseInt(seen, 10) || 0;
    const log = h('div', 'bapp-messenger-log');
    log.setAttribute('role', 'log');
    log.setAttribute('aria-live', 'polite');
    log.setAttribute('aria-label', 'Conversation');
    log.tabIndex = 0;
    for (const m of messages) log.append(bubble(m, m.id > seenNum, now));
    body.replaceChildren(log);
    log.scrollTop = log.scrollHeight;
  }

  async function load(): Promise<void> {
    const mine = ++token;
    showLoading();
    let raw: unknown;
    try {
      raw = await ctx.fetchJson<unknown>(url);
    } catch {
      if (!destroyed && mine === token) showError();
      return;
    }
    if (destroyed || mine !== token) return;
    const messages = parseComments(raw);
    if (messages.length === 0) {
      showEmpty();
      return;
    }
    const seen = ctx.storage.get('seen');
    const fresh = countNew(messages, seen);
    showMessages(messages, seen);
    if (fresh > 0) {
      ctx.setTitle(`${TITLE} (${fresh})`);
      ctx.playSound('ohoh');
    } else {
      ctx.setTitle(TITLE);
    }
    ctx.storage.set('seen', String(maxId(messages)));
  }

  return {
    ready: load(),
    destroy() {
      destroyed = true;
      token++;
      el.replaceChildren();
    },
  };
}
