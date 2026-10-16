/**
 * Seul endroit du WordPad qui appelle `document.execCommand` (obsolète mais toujours pris en charge).
 * Pour s'en passer un jour, il suffira de remplacer ce module.
 */

export type Alignment = 'left' | 'center' | 'right';
export type ToggleCommand = 'bold' | 'italic' | 'underline';

function exec(command: string, value?: string): boolean {
  if (typeof document.execCommand !== 'function') return false;
  try {
    return document.execCommand(command, false, value);
  } catch {
    return false;
  }
}

/** Demande des styles CSS (span style=…) plutôt que des balises obsolètes (font). À appeler avant de formater. */
export function enableCssStyling(): void {
  exec('styleWithCSS', 'true');
}

export function toggle(command: ToggleCommand): void {
  enableCssStyling();
  exec(command);
}

export function setFontFamily(family: string): void {
  enableCssStyling();
  exec('fontName', family);
}

/** Taille exacte en px : on passe par la taille 7 (la plus grande) puis on la remplace par la valeur voulue. */
export function setFontSizePx(editor: HTMLElement, px: number): void {
  enableCssStyling();
  if (!exec('fontSize', '7')) return;
  for (const el of Array.from(editor.querySelectorAll<HTMLElement>('font[size="7"], [style*="xxx-large"]'))) {
    el.removeAttribute('size');
    el.style.fontSize = `${px}px`;
  }
}

export function setColor(color: string): void {
  enableCssStyling();
  exec('foreColor', color);
}

export function align(alignment: Alignment): void {
  enableCssStyling();
  exec(alignment === 'left' ? 'justifyLeft' : alignment === 'center' ? 'justifyCenter' : 'justifyRight');
}

/** Insère du HTML DÉJÀ nettoyé à la sélection courante. */
export function insertHtml(html: string): void {
  if (exec('insertHTML', html)) return;
  const range = currentRange();
  if (!range) return;
  const template = document.createElement('template'); // contenu inerte
  template.innerHTML = html;
  range.deleteContents();
  range.insertNode(template.content);
  range.collapse(false);
}

export function insertText(text: string): void {
  if (exec('insertText', text)) return;
  const range = currentRange();
  if (!range) return;
  range.deleteContents();
  const node = document.createTextNode(text);
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
}

/** État d'une commande à bascule à l'endroit du curseur (faux si le navigateur ne sait pas répondre). */
export function queryState(command: ToggleCommand | 'justifyLeft' | 'justifyCenter' | 'justifyRight'): boolean {
  if (typeof document.queryCommandState !== 'function') return false;
  try {
    return document.queryCommandState(command);
  } catch {
    return false;
  }
}

function currentRange(): Range | null {
  const sel = window.getSelection();
  return sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
}
