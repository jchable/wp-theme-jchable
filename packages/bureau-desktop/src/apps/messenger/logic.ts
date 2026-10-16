/** Logique pure de « Oh-Oh! Messenger » : aucune dépendance au DOM de l'appli. */

import { t } from './i18n';

export interface Message {
  id: number;
  author: string;
  /** Date de publication (UTC) ou null si absente / illisible. */
  date: Date | null;
  /** Texte brut, déjà tronqué. */
  text: string;
  /** Adresse du commentaire (http/https) ou chaîne vide. */
  link: string;
}

export const MAX_TEXT = 280;
const MIN = 60_000;
const HOUR = 60 * MIN;

/** Réduit du HTML à du texte brut : balises retirées, entités décodées, espaces compactés. */
function toPlainText(html: unknown): string {
  if (typeof html !== 'string' || html === '') return '';
  // Un saut de bloc doit séparer les mots (</p><p> ne doit pas coller le texte).
  const spaced = html.replace(/<\/(p|div|li|h[1-6]|blockquote|pre)>|<br\s*\/?>/gi, ' ');
  const doc = new DOMParser().parseFromString(spaced, 'text/html');
  doc.querySelectorAll('script, style, template').forEach((n) => n.remove());
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** Texte brut d'un extrait HTML, tronqué sur une limite de mot avec une ellipse. */
export function excerptText(html: string, max: number): string {
  const text = toPlainText(html);
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  // Coupe au dernier espace si cela ne gâche pas plus de la moitié de l'extrait.
  const base = lastSpace > max / 2 ? cut.slice(0, lastSpace) : cut;
  return base.replace(/[\s,;:.!?-]+$/, '') + '…';
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Date relative dans la langue courante (« il y a 3 h » / « 3 h ago », « hier » / « yesterday »), sinon dd.mm.yyyy. */
export function formatRelative(date: Date, now: Date, _locale: string = 'fr'): string {
  const time = date.getTime();
  if (Number.isNaN(time)) return '';
  const diff = now.getTime() - time;
  if (diff < MIN) return t('justNow');
  if (diff < HOUR) return t('minutesAgo', { n: Math.floor(diff / MIN) });
  if (diff < 24 * HOUR) return t('hoursAgo', { n: Math.floor(diff / HOUR) });
  if (diff < 48 * HOUR) return t('yesterday');
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
}

function safeLink(value: unknown): string {
  if (typeof value !== 'string' || value === '') return '';
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:' ? value : '';
  } catch {
    return '';
  }
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string' || value === '') return null;
  // date_gmt est en UTC mais sans suffixe : on l'ajoute.
  const d = new Date(/(Z|[+-]\d\d:?\d\d)$/.test(value) ? value : value + 'Z');
  return Number.isNaN(d.getTime()) ? null : d;
}

function renderedOf(content: unknown): string {
  if (typeof content === 'string') return content;
  if (content && typeof content === 'object') {
    const r = (content as { rendered?: unknown }).rendered;
    if (typeof r === 'string') return r;
  }
  return '';
}

/** Transforme la réponse de l'API en messages, du plus ancien au plus récent. Ne lève jamais. */
export function parseComments(raw: unknown): Message[] {
  if (!Array.isArray(raw)) return [];
  const out: Message[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const o = item as Record<string, unknown>;
    const id = Number(o.id);
    if (!Number.isInteger(id) || id <= 0) continue;
    const text = excerptText(renderedOf(o.content), MAX_TEXT);
    if (text === '') continue;
    const author = typeof o.author_name === 'string' ? toPlainText(o.author_name) : '';
    out.push({
      id,
      author: author || t('anonymous'),
      date: parseDate(o.date_gmt),
      text,
      link: safeLink(o.link),
    });
  }
  return out.sort((a, b) => a.id - b.id);
}

export function maxId(messages: readonly Message[]): number {
  let max = 0;
  for (const m of messages) if (m.id > max) max = m.id;
  return max;
}

/** Nombre de messages plus récents que le dernier id vu (null ou illisible : tout est nouveau). */
export function countNew(messages: readonly Message[], seenId: string | null): number {
  const seen = seenId === null ? 0 : Number.parseInt(seenId, 10);
  const floor = Number.isFinite(seen) && seen > 0 ? seen : 0;
  return messages.filter((m) => m.id > floor).length;
}

/** Adresse du formulaire de commentaire du billet, ou null si le lien est inutilisable. */
export function replyUrl(link: string): string | null {
  if (!link) return null;
  return link.split('#')[0] + '#respond';
}
