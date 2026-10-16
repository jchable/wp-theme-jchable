import { getLang } from '../../core/i18n';

/** Fonctions pures de texte pour le WordPad : échappement, export HTML/texte, nom de fichier. */

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Document HTML autonome. `bodyHtml` doit déjà avoir été passé par `sanitizeHtml`. */
export function buildHtmlDocument(title: string, bodyHtml: string): string {
  return [
    '<!DOCTYPE html>',
    `<html lang="${getLang()}">`,
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(title)}</title>`,
    '<style>body{font-family:sans-serif;max-width:48rem;margin:2rem auto;padding:0 1rem;line-height:1.5}</style>',
    '</head>',
    '<body>',
    bodyHtml,
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

const BLOCKS = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'pre', 'tr', 'table', 'section', 'article', 'header', 'footer']);
const SKIPPED = new Set(['script', 'style', 'noscript', 'template', 'head', 'title', 'iframe', 'object', 'embed', 'svg', 'math', 'textarea']);

/** Texte brut : les blocs deviennent des lignes, les entités sont décodées, aucun script n'est lu. */
export function htmlToText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  let out = '';

  const newline = (): void => {
    if (out !== '' && !out.endsWith('\n')) out += '\n';
  };

  const walk = (node: Node): void => {
    if (node.nodeType === 3) {
      out += (node as Text).data.replace(/[ \t\r\n\f]+/g, ' ');
      return;
    }
    if (node.nodeType !== 1) return;
    const el = node as Element;
    const tag = el.localName.toLowerCase();
    if (SKIPPED.has(tag)) return;
    if (tag === 'br') {
      out += '\n';
      return;
    }
    const block = BLOCKS.has(tag);
    if (block) {
      newline();
      if (tag === 'li') out += '- ';
    }
    for (const child of Array.from(el.childNodes)) walk(child);
    if (block) newline();
  };

  walk(doc.body);

  return out
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .replace(/ /g, ' ');
}

const FORBIDDEN_IN_NAME = /[\\/:*?"<>|\u0000-\u001f]/g;

/** Nom de fichier sûr : caractères interdits retirés, extension ajoutée sans doublon. */
export function makeFileName(name: string, ext: 'html' | 'txt'): string {
  const clean = name.replace(FORBIDDEN_IN_NAME, '').trim().replace(/^\.+/, '');
  const suffix = `.${ext}`;
  if (clean.toLowerCase().endsWith(suffix) && clean.length > suffix.length) {
    return clean.slice(0, 100 + suffix.length);
  }
  const base = clean.toLowerCase() === suffix ? '' : clean;
  return `${(base === '' ? 'document' : base).slice(0, 100)}${suffix}`;
}
