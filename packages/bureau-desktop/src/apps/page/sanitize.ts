/**
 * Nettoie le HTML d'une page WordPress avant de l'afficher dans une fenêtre.
 * On ne garde rien de l'arbre d'origine : un arbre neuf est reconstruit à partir d'une liste blanche.
 */

const ALLOWED = new Set([
  'p', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'strong', 'b', 'em', 'i', 'u', 's', 'del', 'ins', 'sub', 'sup', 'small', 'mark', 'abbr', 'cite',
  'code', 'pre', 'kbd', 'blockquote', 'figure', 'figcaption', 'img', 'a',
  'table', 'caption', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'span', 'div', 'details', 'summary',
]);

/** Éléments supprimés avec tout leur contenu. */
const DROPPED = new Set([
  'script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'form', 'input', 'button',
  'textarea', 'select', 'option', 'optgroup', 'datalist', 'svg', 'math', 'noscript', 'template', 'link',
  'meta', 'base', 'audio', 'video', 'source', 'track', 'canvas', 'head', 'title', 'xmp', 'plaintext', 'dialog',
]);

const LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);
const IMAGE_PROTOCOLS = new Set(['http:', 'https:']);

function safeUrl(raw: string | null, base: string, protocols: ReadonlySet<string>): string | null {
  if (raw === null) return null;
  const value = raw.trim();
  if (value === '' || value.startsWith('#')) return null;
  try {
    const url = new URL(value, base);
    return protocols.has(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

const digits = (value: string | null, max: number): string | null =>
  value !== null && /^\d{1,4}$/.test(value.trim()) && Number(value) <= max ? String(Number(value)) : null;

function copyChildren(from: Node, to: Node, base: string): void {
  for (const child of from.childNodes) copyNode(child, to, base);
}

function copyNode(node: Node, parent: Node, base: string): void {
  if (node.nodeType === Node.TEXT_NODE) {
    parent.appendChild(document.createTextNode(node.textContent ?? ''));
    return;
  }
  if (!(node instanceof Element)) return; // commentaires, instructions : ignorés
  const tag = node.tagName.toLowerCase();
  if (DROPPED.has(tag)) return;
  if (!ALLOWED.has(tag)) {
    copyChildren(node, parent, base); // élément inconnu : on garde son contenu
    return;
  }

  const out = document.createElement(tag);
  if (tag === 'a') {
    const href = safeUrl(node.getAttribute('href'), base, LINK_PROTOCOLS);
    const title = node.getAttribute('title');
    if (href) {
      out.setAttribute('href', href);
      if (title) out.setAttribute('title', title);
      if (new URL(href).origin !== new URL(base).origin && href.startsWith('http')) {
        out.setAttribute('target', '_blank');
        out.setAttribute('rel', 'noopener noreferrer');
      }
    } else if (title) {
      out.setAttribute('title', title);
    }
  } else if (tag === 'img') {
    const src = safeUrl(node.getAttribute('src'), base, IMAGE_PROTOCOLS);
    if (!src) return; // une image sans adresse sûre disparaît
    out.setAttribute('src', src);
    out.setAttribute('alt', node.getAttribute('alt') ?? '');
    const width = digits(node.getAttribute('width'), 4000);
    const height = digits(node.getAttribute('height'), 4000);
    if (width) out.setAttribute('width', width);
    if (height) out.setAttribute('height', height);
    const title = node.getAttribute('title');
    if (title) out.setAttribute('title', title);
    out.setAttribute('loading', 'lazy');
  } else if (tag === 'th' || tag === 'td') {
    const colspan = digits(node.getAttribute('colspan'), 100);
    const rowspan = digits(node.getAttribute('rowspan'), 100);
    if (colspan) out.setAttribute('colspan', colspan);
    if (rowspan) out.setAttribute('rowspan', rowspan);
  }
  parent.appendChild(out);
  if (tag !== 'img' && tag !== 'br' && tag !== 'hr') copyChildren(node, out, base);
}

/** Renvoie un fragment prêt à insérer dans le document (aucun innerHTML). */
export function sanitizePageHtml(html: string, baseUrl: string): DocumentFragment {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const fragment = document.createDocumentFragment();
  copyChildren(parsed.body, fragment, baseUrl);
  return fragment;
}
