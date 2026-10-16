import type { AppContext } from '../../core/types';
import * as commands from './commands';
import { initialDocumentHtml } from './document';
import { sanitizeHtml } from './sanitize';
import { buildHtmlDocument, htmlToText, makeFileName } from './text';
import './style.css';

const DRAFT_KEY = 'draft';
const DRAFT_DELAY_MS = 500;
const REVOKE_DELAY_MS = 1000;
const UNTITLED = 'Sans titre';
const APP_NAME = 'WordPad';

const FONTS: readonly { label: string; value: string }[] = [
  { label: 'Chivo', value: 'Chivo, sans-serif' },
  { label: 'Chivo Mono', value: '"Chivo Mono", monospace' },
  { label: 'Serif', value: 'serif' },
];

const SIZES: readonly { label: string; value: string; px: number }[] = [
  { label: 'Petite', value: 'small', px: 12 },
  { label: 'Normale', value: 'normal', px: 16 },
  { label: 'Grande', value: 'large', px: 22 },
  { label: 'Très grande', value: 'x-large', px: 32 },
];

type Format = 'html' | 'txt';

let idCounter = 0;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  attrs: Record<string, string> = {},
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
}

interface Instance {
  dispose(): void;
}

function createWordPad(root: HTMLElement, ctx: AppContext): Instance {
  const uid = `bapp-wordpad-${++idCounter}`;
  const cleanups: (() => void)[] = [];
  const on = <T extends EventTarget>(target: T, type: string, handler: (e: never) => void): void => {
    target.addEventListener(type, handler as EventListener);
    cleanups.push(() => target.removeEventListener(type, handler as EventListener));
  };

  const setWindowTitle = (name: string): void => ctx.setTitle(`${name} - ${APP_NAME}`);
  setWindowTitle(UNTITLED);

  // --- Construction de l'interface ---------------------------------------------------------
  const wrapper = el('div', 'bapp-wordpad');
  const toolbar = el('div', 'bapp-wordpad-toolbar', { role: 'toolbar', 'aria-label': 'Mise en forme' });

  const makeButton = (label: string, text: string, extraClass = '', toggle = false): HTMLButtonElement => {
    const b = el('button', `bapp-wordpad-btn ${extraClass}`.trim(), { type: 'button', 'aria-label': label, title: label }, text);
    if (toggle) b.setAttribute('aria-pressed', 'false');
    // Garde la sélection du texte dans l'éditeur lors d'un clic à la souris.
    on(b, 'mousedown', (e: MouseEvent) => e.preventDefault());
    return b;
  };
  const separator = (): HTMLElement => el('span', 'bapp-wordpad-sep', { role: 'separator', 'aria-orientation': 'vertical' });

  const newBtn = makeButton('Nouveau', 'Nouveau');
  const saveBtn = makeButton('Enregistrer sous…', 'Enregistrer sous…');
  const boldBtn = makeButton('Gras', 'G', 'bapp-wordpad-btn-bold', true);
  const italicBtn = makeButton('Italique', 'I', 'bapp-wordpad-btn-italic', true);
  const underlineBtn = makeButton('Souligné', 'S', 'bapp-wordpad-btn-underline', true);
  const leftBtn = makeButton('Aligner à gauche', 'Gauche', '', true);
  const centerBtn = makeButton('Centrer', 'Centre', '', true);
  const rightBtn = makeButton('Aligner à droite', 'Droite', '', true);

  const fontSelect = el('select', 'bapp-wordpad-select', { 'aria-label': 'Police' });
  for (const f of FONTS) fontSelect.append(new Option(f.label, f.value));
  const sizeSelect = el('select', 'bapp-wordpad-select', { 'aria-label': 'Taille' });
  for (const s of SIZES) sizeSelect.append(new Option(s.label, s.value));
  sizeSelect.value = 'normal';
  const colorInput = el('input', 'bapp-wordpad-color', { type: 'color', 'aria-label': 'Couleur du texte', title: 'Couleur du texte', value: '#101010' });

  toolbar.append(
    newBtn, saveBtn, separator(),
    boldBtn, italicBtn, underlineBtn, separator(),
    fontSelect, sizeSelect, colorInput, separator(),
    leftBtn, centerBtn, rightBtn,
  );

  // Formulaire « Enregistrer sous… » en ligne (pas de window.prompt).
  const form = el('form', 'bapp-wordpad-saveform', { 'aria-label': 'Enregistrer sous…' });
  form.hidden = true;
  const nameId = `${uid}-name`;
  const formatId = `${uid}-format`;
  const nameLabel = el('label', 'bapp-wordpad-label', { for: nameId }, 'Nom du fichier');
  const nameInput = el('input', 'bapp-wordpad-input', { type: 'text', id: nameId, maxlength: '100', autocomplete: 'off' });
  nameInput.value = 'document';
  const formatLabel = el('label', 'bapp-wordpad-label', { for: formatId }, 'Format');
  const formatSelect = el('select', 'bapp-wordpad-select', { id: formatId });
  formatSelect.append(new Option('Page web (.html)', 'html'), new Option('Texte brut (.txt)', 'txt'));
  const submitBtn = el('button', 'bapp-wordpad-btn', { type: 'submit' }, 'Enregistrer');
  const cancelBtn = el('button', 'bapp-wordpad-btn', { type: 'button' }, 'Annuler');
  form.append(nameLabel, nameInput, formatLabel, formatSelect, submitBtn, cancelBtn);

  const editor = el('div', 'bapp-wordpad-editor', {
    contenteditable: 'true',
    role: 'textbox',
    'aria-multiline': 'true',
    'aria-label': 'Document',
    spellcheck: 'true',
    lang: 'fr',
  });

  wrapper.append(toolbar, form, editor);
  root.replaceChildren(wrapper);

  // --- Contenu initial ---------------------------------------------------------------------
  const draft = ctx.storage.get(DRAFT_KEY);
  editor.innerHTML = sanitizeHtml(draft !== null ? draft : initialDocumentHtml(ctx.config.siteName, ctx.args));
  commands.enableCssStyling();

  // --- Brouillon ---------------------------------------------------------------------------
  const currentHtml = (): string => sanitizeHtml(editor.innerHTML);
  let draftTimer: ReturnType<typeof setTimeout> | null = null;
  const saveDraft = (): void => {
    draftTimer = null;
    ctx.storage.set(DRAFT_KEY, currentHtml());
  };
  const scheduleDraft = (): void => {
    if (draftTimer !== null) clearTimeout(draftTimer);
    draftTimer = setTimeout(saveDraft, DRAFT_DELAY_MS);
  };
  on(editor, 'input', scheduleDraft);

  // --- Sélection ---------------------------------------------------------------------------
  let savedRange: Range | null = null;
  const selectionInEditor = (): Range | null => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    return editor.contains(range.commonAncestorContainer) ? range : null;
  };
  const updateStates = (): void => {
    const set = (b: HTMLButtonElement, on_: boolean): void => b.setAttribute('aria-pressed', String(on_));
    set(boldBtn, commands.queryState('bold'));
    set(italicBtn, commands.queryState('italic'));
    set(underlineBtn, commands.queryState('underline'));
    set(leftBtn, commands.queryState('justifyLeft'));
    set(centerBtn, commands.queryState('justifyCenter'));
    set(rightBtn, commands.queryState('justifyRight'));
  };
  on(document, 'selectionchange', () => {
    const range = selectionInEditor();
    if (range) {
      savedRange = range.cloneRange();
      updateStates();
    }
  });

  /** Remet le curseur dans l'éditeur (là où il était, sinon à la fin). */
  const ensureSelection = (): void => {
    if (selectionInEditor()) return;
    const sel = window.getSelection();
    if (!sel) return;
    const range = savedRange ?? (() => {
      const r = document.createRange();
      r.selectNodeContents(editor);
      r.collapse(false);
      return r;
    })();
    sel.removeAllRanges();
    sel.addRange(range);
  };

  const run = (action: () => void): void => {
    editor.focus();
    ensureSelection();
    action();
    scheduleDraft();
    updateStates();
  };

  // --- Barre d'outils ----------------------------------------------------------------------
  on(boldBtn, 'click', () => run(() => commands.toggle('bold')));
  on(italicBtn, 'click', () => run(() => commands.toggle('italic')));
  on(underlineBtn, 'click', () => run(() => commands.toggle('underline')));
  on(leftBtn, 'click', () => run(() => commands.align('left')));
  on(centerBtn, 'click', () => run(() => commands.align('center')));
  on(rightBtn, 'click', () => run(() => commands.align('right')));
  on(fontSelect, 'change', () => run(() => commands.setFontFamily(fontSelect.value)));
  on(sizeSelect, 'change', () => {
    const size = SIZES.find((s) => s.value === sizeSelect.value);
    if (size) run(() => commands.setFontSizePx(editor, size.px));
  });
  on(colorInput, 'input', () => run(() => commands.setColor(colorInput.value)));

  on(newBtn, 'click', () => {
    editor.innerHTML = '';
    savedRange = null;
    closeForm(false);
    setWindowTitle(UNTITLED);
    if (draftTimer !== null) clearTimeout(draftTimer);
    saveDraft();
    editor.focus();
    updateStates();
  });

  // --- Enregistrer sous… -------------------------------------------------------------------
  function closeForm(refocus: boolean): void {
    form.hidden = true;
    if (refocus) saveBtn.focus();
  }
  on(saveBtn, 'click', () => {
    form.hidden = false;
    nameInput.focus();
    nameInput.select();
  });
  on(cancelBtn, 'click', () => closeForm(true));
  on(form, 'keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      closeForm(true);
    }
  });

  const pendingRevokes = new Map<ReturnType<typeof setTimeout>, string>();
  const download = (fileName: string, mime: string, content: string): void => {
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.hidden = true;
    root.appendChild(link);
    link.click();
    link.remove();
    const timer = setTimeout(() => {
      pendingRevokes.delete(timer);
      URL.revokeObjectURL(url);
    }, REVOKE_DELAY_MS);
    pendingRevokes.set(timer, url);
  };

  on(form, 'submit', (e: Event) => {
    e.preventDefault();
    const format: Format = formatSelect.value === 'txt' ? 'txt' : 'html';
    const fileName = makeFileName(nameInput.value, format);
    const html = currentHtml();
    if (format === 'html') {
      download(fileName, 'text/html;charset=utf-8', buildHtmlDocument(fileName, html));
    } else {
      download(fileName, 'text/plain;charset=utf-8', htmlToText(html));
    }
    setWindowTitle(fileName);
    closeForm(true);
  });

  // --- Collage et dépôt : tout passe par le nettoyeur --------------------------------------
  const insertFromTransfer = (dt: DataTransfer): boolean => {
    const html = sanitizeHtml(dt.getData('text/html'));
    const text = dt.getData('text/plain');
    if (html === '' && text === '') return false;
    run(() => {
      if (html !== '') commands.insertHtml(html);
      else commands.insertText(text);
    });
    return true;
  };

  on(editor, 'paste', (e: ClipboardEvent) => {
    if (!e.clipboardData) return;
    e.preventDefault();
    insertFromTransfer(e.clipboardData);
  });
  on(editor, 'dragover', (e: DragEvent) => e.preventDefault());
  on(editor, 'drop', (e: DragEvent) => {
    e.preventDefault();
    if (!e.dataTransfer) return;
    const doc = document as Document & { caretRangeFromPoint?: (x: number, y: number) => Range | null };
    const range = typeof doc.caretRangeFromPoint === 'function' ? doc.caretRangeFromPoint(e.clientX, e.clientY) : null;
    if (range && editor.contains(range.commonAncestorContainer)) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
    insertFromTransfer(e.dataTransfer);
  });

  return {
    dispose(): void {
      if (draftTimer !== null) {
        clearTimeout(draftTimer);
        saveDraft();
      }
      for (const [timer, url] of pendingRevokes) {
        clearTimeout(timer);
        URL.revokeObjectURL(url);
      }
      pendingRevokes.clear();
      for (const cleanup of cleanups) cleanup();
      root.replaceChildren();
    },
  };
}

let current: Instance | null = null;

export function mount(container: HTMLElement, ctx: AppContext): void {
  current?.dispose();
  current = createWordPad(container, ctx);
}

export function unmount(): void {
  current?.dispose();
  current = null;
}
