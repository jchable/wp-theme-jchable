/**
 * Nettoyeur HTML du WordPad (sécurité critique).
 *
 * Principe : le HTML est analysé dans un document inerte (DOMParser : ni script, ni chargement),
 * puis on RECONSTRUIT un arbre neuf en ne copiant que ce qui figure sur la liste blanche.
 * Rien n'est jamais « retiré » d'un arbre existant : ce qui n'est pas explicitement reconnu n'est pas copié.
 */

const XHTML_NS = 'http://www.w3.org/1999/xhtml';

/** Éléments conservés tels quels (avec leurs enfants nettoyés). */
const ALLOWED = new Set([
  'b', 'strong', 'i', 'em', 'u', 's', 'p', 'br', 'div', 'span', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'a', 'font',
]);

/** Éléments supprimés AVEC leur contenu (le texte qu'ils contiennent n'est pas du texte de document). */
const OPAQUE = new Set([
  'script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'noscript', 'noembed', 'noframes',
  'template', 'svg', 'math', 'head', 'title', 'meta', 'link', 'base', 'textarea', 'select', 'option', 'xmp',
  'plaintext', 'audio', 'video', 'canvas', 'img', 'picture', 'source', 'track', 'map', 'area', 'portal', 'dialog',
]);

/** Polices autorisées (noms en minuscules) et leur écriture canonique. */
const FONT_NAMES: Readonly<Record<string, string>> = {
  chivo: 'Chivo',
  'chivo mono': '"Chivo Mono"',
  'sans-serif': 'sans-serif',
  serif: 'serif',
  monospace: 'monospace',
};

const FONT_SIZE_KEYWORDS = new Set(['xx-small', 'x-small', 'small', 'medium', 'large', 'x-large', 'xx-large']);
const COLOR_HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const COLOR_RGB = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(?:,\s*(?:0|1|0?\.\d{1,3}|1\.0{1,3})\s*)?\)$/i;
const COLOR_NAME = /^[a-z]{3,20}$/i;
const SIZE_NUMBER = /^(\d{1,3}(?:\.\d{1,2})?)(px|em|rem)$/;
const WEIGHT = /^(?:normal|bold|bolder|lighter|[1-9]00)$/;
const STYLE_VALUES = /^(?:normal|italic|oblique)$/;
const DECORATION = /^(?:none|(?:underline|line-through)(?: (?:underline|line-through))?)$/;
const ALIGN = /^(?:left|center|right)$/;
// Autorise seulement les URL absolues http(s) et mailto: (après retrait des caractères que les navigateurs ignorent).
const SAFE_HREF = /^(?:https?:\/\/[^\s]+|mailto:[^\s]+)$/i;

function cleanColor(value: string, allowNames = false): string | null {
  const v = value.trim();
  if (COLOR_HEX.test(v) || COLOR_RGB.test(v)) return v.toLowerCase();
  if (allowNames && COLOR_NAME.test(v)) return v.toLowerCase();
  return null;
}

function cleanFontFamily(value: string): string | null {
  const parts = value.split(',').map((p) => p.trim().replace(/^(["'])(.*)\1$/, '$2').trim().toLowerCase());
  if (parts.length === 0 || parts.length > 4) return null;
  const out: string[] = [];
  for (const part of parts) {
    const canonical = FONT_NAMES[part];
    if (canonical === undefined || !Object.hasOwn(FONT_NAMES, part)) return null;
    out.push(canonical);
  }
  return out.join(', ');
}

function cleanFontSize(value: string): string | null {
  const v = value.trim().toLowerCase();
  if (FONT_SIZE_KEYWORDS.has(v)) return v;
  const m = SIZE_NUMBER.exec(v);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2];
  if (unit === 'px') return n >= 6 && n <= 96 ? v : null;
  return n >= 0.5 && n <= 6 ? v : null;
}

/** Valide une déclaration CSS ; renvoie la déclaration canonique ou null. */
function cleanDeclaration(prop: string, rawValue: string): [string, string] | null {
  const value = rawValue.trim();
  switch (prop) {
    case 'font-family': {
      const v = cleanFontFamily(value);
      return v === null ? null : ['font-family', v];
    }
    case 'font-size': {
      const v = cleanFontSize(value);
      return v === null ? null : ['font-size', v];
    }
    case 'color': {
      const v = cleanColor(value);
      return v === null ? null : ['color', v];
    }
    case 'text-align':
      return ALIGN.test(value.toLowerCase()) ? ['text-align', value.toLowerCase()] : null;
    case 'font-weight':
      return WEIGHT.test(value.toLowerCase()) ? ['font-weight', value.toLowerCase()] : null;
    case 'font-style':
      return STYLE_VALUES.test(value.toLowerCase()) ? ['font-style', value.toLowerCase()] : null;
    case 'text-decoration':
    case 'text-decoration-line': {
      const v = value.toLowerCase().replace(/\s+/g, ' ');
      return DECORATION.test(v) ? ['text-decoration', v] : null;
    }
    default:
      return null;
  }
}

/** Filtre un attribut style : une déclaration à la fois, tout ce qui n'est pas reconnu est perdu. */
function cleanStyle(style: string): string {
  const kept = new Map<string, string>();
  for (const chunk of style.split(';')) {
    const idx = chunk.indexOf(':');
    if (idx < 0) continue;
    const prop = chunk.slice(0, idx).trim().toLowerCase();
    const decl = cleanDeclaration(prop, chunk.slice(idx + 1));
    if (decl) kept.set(decl[0], decl[1]);
  }
  return Array.from(kept, ([k, v]) => `${k}: ${v}`).join('; ');
}

/** Caractères que les navigateurs ignorent dans une URL (ou qui ressemblent à des espaces). */
function isIgnorable(code: number): boolean {
  return (
    code <= 0x20 ||
    (code >= 0x7f && code <= 0xa0) ||
    code === 0x1680 ||
    (code >= 0x2000 && code <= 0x200d) ||
    code === 0x2028 ||
    code === 0x2029 ||
    code === 0x202f ||
    code === 0x205f ||
    code === 0x2060 ||
    code === 0x3000 ||
    code === 0xfeff
  );
}

/** On retire ces caractères du schéma avant de juger l'URL. */
function cleanHref(href: string): string | null {
  let compact = '';
  for (let i = 0; i < href.length; i++) {
    if (!isIgnorable(href.charCodeAt(i))) compact += href.charAt(i);
  }
  return SAFE_HREF.test(compact) ? compact : null;
}

function copyChildren(from: Node, to: Node, doc: Document): void {
  for (const child of Array.from(from.childNodes)) clean(child, to, doc);
}

function clean(node: Node, into: Node, doc: Document): void {
  if (node.nodeType === 3) {
    into.appendChild(doc.createTextNode((node as Text).data));
    return;
  }
  if (node.nodeType !== 1) return; // commentaires, instructions, CDATA : perdus.

  const el = node as Element;
  if (el.namespaceURI !== XHTML_NS) return; // SVG, MathML… : perdus entièrement.
  const tag = el.localName.toLowerCase();

  if (OPAQUE.has(tag)) return;
  if (!ALLOWED.has(tag)) {
    copyChildren(el, into, doc); // élément inconnu : on garde son contenu.
    return;
  }

  let out: HTMLElement;
  if (tag === 'a') {
    const href = cleanHref(el.getAttribute('href') ?? '');
    if (href === null) {
      copyChildren(el, into, doc); // lien non sûr : le texte reste, le lien disparaît.
      return;
    }
    out = doc.createElement('a');
    out.setAttribute('href', href);
    out.setAttribute('rel', 'noopener noreferrer');
  } else if (tag === 'font') {
    out = doc.createElement('font');
    const color = cleanColor(el.getAttribute('color') ?? '', true);
    if (color !== null) out.setAttribute('color', color);
    const face = cleanFontFamily(el.getAttribute('face') ?? '');
    if (face !== null) out.setAttribute('face', face);
    const size = (el.getAttribute('size') ?? '').trim();
    if (/^[1-7]$/.test(size)) out.setAttribute('size', size);
  } else {
    out = doc.createElement(tag);
  }

  const style = cleanStyle(el.getAttribute('style') ?? '');
  if (style !== '') out.setAttribute('style', style);

  if (tag !== 'br') copyChildren(el, out, doc);
  into.appendChild(out);
}

/** Nettoie du HTML non fiable. Le résultat ne contient que des éléments et attributs de la liste blanche. */
export function sanitizeHtml(html: string): string {
  if (html === '') return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const holder = doc.createElement('div');
  copyChildren(doc.body, holder, doc);
  return holder.innerHTML;
}
