import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppContext, AppStorage, BureauConfig } from '../../core/types';
import { mount, unmount } from './index';

function makeStorage(initial: Record<string, string> = {}): AppStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    get: (k) => data.get(k) ?? null,
    set: (k, v) => void data.set(k, v),
    remove: (k) => void data.delete(k),
  };
}

function makeCtx(args: Record<string, unknown> = {}, storage = makeStorage()) {
  const setTitle = vi.fn();
  const config = { siteName: 'Le Blog Test', homeUrl: 'https://exemple.fr/' } as BureauConfig;
  const ctx: AppContext = {
    config,
    args,
    storage,
    setTitle,
    close: vi.fn(),
    openApp: vi.fn(),
    openBsod: vi.fn(),
    playSound: vi.fn(),
    fetchJson: vi.fn(),
  };
  return { ctx, setTitle, storage };
}

let host: HTMLElement;

const editorOf = (): HTMLElement => host.querySelector<HTMLElement>('[role="textbox"]')!;
const buttonByLabel = (label: string): HTMLButtonElement => {
  const b = Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find((x) => x.getAttribute('aria-label') === label);
  if (!b) throw new Error(`Bouton introuvable : ${label}`);
  return b;
};

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
});

afterEach(() => {
  unmount();
  host.remove();
  vi.useRealTimers();
});

describe('WordPad : montage', () => {
  it('affiche le document de présentation par défaut et le titre', () => {
    const { ctx, setTitle } = makeCtx();
    mount(host, ctx);
    const editor = editorOf();
    expect(editor.getAttribute('contenteditable')).toBe('true');
    expect(editor.getAttribute('aria-multiline')).toBe('true');
    expect(editor.getAttribute('aria-label')).toBeTruthy();
    expect(editor.textContent).toContain('Le Blog Test');
    expect(editor.textContent).toContain('Enregistrer sous');
    expect(setTitle).toHaveBeenCalledWith('Sans titre - WordPad');
  });

  it('affiche la note d\'article quand title et url sont fournis', () => {
    const { ctx } = makeCtx({ title: 'Mon article', url: 'https://exemple.fr/a/' });
    mount(host, ctx);
    const text = editorOf().textContent ?? '';
    expect(text).toContain('Mon article');
    expect(text).toContain('https://exemple.fr/a/');
    expect(text).toContain('Tapez ici');
  });

  it('restaure le brouillon par-dessus le document par défaut', () => {
    const { ctx } = makeCtx({}, makeStorage({ draft: '<p>Mon brouillon</p>' }));
    mount(host, ctx);
    expect(editorOf().innerHTML).toBe('<p>Mon brouillon</p>');
  });

  it('nettoie un brouillon corrompu ou hostile', () => {
    const { ctx } = makeCtx({}, makeStorage({ draft: '<p onclick="x">a</p><script>alert(1)</script><img src=x onerror=alert(1)>' }));
    mount(host, ctx);
    expect(editorOf().innerHTML).toBe('<p>a</p>');
  });

  it('expose une barre d\'outils accessible', () => {
    const { ctx } = makeCtx();
    mount(host, ctx);
    const toolbar = host.querySelector('[role="toolbar"]');
    expect(toolbar).not.toBeNull();
    for (const label of ['Nouveau', 'Enregistrer sous…', 'Gras', 'Italique', 'Souligné', 'Aligner à gauche', 'Centrer', 'Aligner à droite']) {
      expect(buttonByLabel(label).type).toBe('button');
    }
    for (const label of ['Gras', 'Italique', 'Souligné']) {
      expect(buttonByLabel(label).getAttribute('aria-pressed')).toBe('false');
    }
    expect(host.querySelector('select[aria-label="Police"]')).not.toBeNull();
    expect(host.querySelector('select[aria-label="Taille"]')).not.toBeNull();
    expect(host.querySelector('input[type="color"]')?.getAttribute('aria-label')).toBeTruthy();
  });

  it('démonte proprement', () => {
    const { ctx } = makeCtx();
    mount(host, ctx);
    unmount();
    expect(host.childNodes.length).toBe(0);
  });
});

describe('WordPad : brouillon', () => {
  it('enregistre le brouillon nettoyé après 500 ms', () => {
    vi.useFakeTimers();
    const { ctx, storage } = makeCtx();
    mount(host, ctx);
    const editor = editorOf();
    editor.innerHTML = '<p>Salut</p>';
    // Du contenu dangereux injecté par un autre moyen (ex. extension) ne doit pas finir dans le brouillon.
    const evil = document.createElement('span');
    evil.setAttribute('onclick', 'alert(1)');
    evil.textContent = '!';
    editor.appendChild(evil);
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    vi.advanceTimersByTime(499);
    expect(storage.data.has('draft')).toBe(false);
    vi.advanceTimersByTime(2);
    expect(storage.data.get('draft')).toBe('<p>Salut</p><span>!</span>');
  });

  it('regroupe les frappes rapprochées (anti-rebond)', () => {
    vi.useFakeTimers();
    const { ctx, storage } = makeCtx();
    const setSpy = vi.spyOn(storage, 'set');
    mount(host, ctx);
    const editor = editorOf();
    for (let i = 0; i < 5; i++) {
      editor.textContent = `v${i}`;
      editor.dispatchEvent(new Event('input', { bubbles: true }));
      vi.advanceTimersByTime(100);
    }
    vi.advanceTimersByTime(600);
    expect(setSpy.mock.calls.filter((c) => c[0] === 'draft').length).toBe(1);
    expect(storage.data.get('draft')).toBe('v4');
  });

  it('enregistre le brouillon en attente au démontage', () => {
    vi.useFakeTimers();
    const { ctx, storage } = makeCtx();
    mount(host, ctx);
    editorOf().textContent = 'dernier mot';
    editorOf().dispatchEvent(new Event('input', { bubbles: true }));
    unmount();
    expect(storage.data.get('draft')).toBe('dernier mot');
  });
});

describe('WordPad : Nouveau', () => {
  it('vide le document sans confirmation et remet le titre', () => {
    const confirmSpy = vi.fn();
    vi.stubGlobal('confirm', confirmSpy);
    const { ctx, setTitle, storage } = makeCtx();
    mount(host, ctx);
    buttonByLabel('Nouveau').click();
    expect(editorOf().innerHTML).toBe('');
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(setTitle).toHaveBeenLastCalledWith('Sans titre - WordPad');
    expect(storage.data.get('draft')).toBe('');
    vi.unstubAllGlobals();
  });
});

describe('WordPad : Enregistrer sous…', () => {
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;
  let clicked: { download: string; href: string }[];

  beforeEach(() => {
    clicked = [];
    createObjectURL = vi.fn(() => 'blob:wordpad-test');
    revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true, writable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true, writable: true });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push({ download: this.download, href: this.href });
    });
  });

  const readBlob = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(blob);
    });

  function openForm(): { form: HTMLFormElement; name: HTMLInputElement; format: HTMLSelectElement } {
    buttonByLabel('Enregistrer sous…').click();
    const form = host.querySelector<HTMLFormElement>('form.bapp-wordpad-saveform')!;
    return {
      form,
      name: form.querySelector<HTMLInputElement>('input[type="text"]')!,
      format: form.querySelector<HTMLSelectElement>('select')!,
    };
  }

  it('ouvre un formulaire en ligne (sans window.prompt)', () => {
    const promptSpy = vi.fn();
    vi.stubGlobal('prompt', promptSpy);
    const { ctx } = makeCtx();
    mount(host, ctx);
    const form = host.querySelector<HTMLFormElement>('form.bapp-wordpad-saveform')!;
    expect(form.hidden).toBe(true);
    const { name, format } = openForm();
    expect(form.hidden).toBe(false);
    expect(name.getAttribute('aria-label') ?? form.querySelector('label')?.textContent).toBeTruthy();
    expect(Array.from(format.options).map((o) => o.value)).toEqual(['html', 'txt']);
    expect(promptSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('télécharge un document HTML autonome', async () => {
    vi.useFakeTimers();
    const { ctx, setTitle } = makeCtx();
    mount(host, ctx);
    editorOf().innerHTML = '<p>Contenu <b>gras</b></p><script>alert(1)</script>';
    const { form, name, format } = openForm();
    name.value = 'ma lettre';
    format.value = 'html';
    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0]![0] as Blob;
    expect(blob.type).toContain('text/html');
    vi.useRealTimers();
    const text = await readBlob(blob);
    expect(text).toContain('<meta charset="utf-8">');
    expect(text).toContain('<title>ma lettre.html</title>');
    expect(text).toContain('<p>Contenu <b>gras</b></p>');
    expect(text).not.toContain('<script>alert');
    expect(clicked).toEqual([{ download: 'ma lettre.html', href: 'blob:wordpad-test' }]);
    expect(setTitle).toHaveBeenLastCalledWith('ma lettre.html - WordPad');
    expect(form.hidden).toBe(true);
    // Aucun lien temporaire ne traîne dans le document.
    expect(document.querySelector('a[download]')).toBeNull();
  });

  it('télécharge un fichier texte', async () => {
    const { ctx } = makeCtx();
    mount(host, ctx);
    editorOf().innerHTML = '<h1>Titre</h1><p>Ligne&nbsp;un</p><p>Deux</p>';
    const { form, name, format } = openForm();
    name.value = 'notes';
    format.value = 'txt';
    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    const blob = createObjectURL.mock.calls[0]![0] as Blob;
    expect(blob.type).toContain('text/plain');
    expect(await readBlob(blob)).toBe('Titre\nLigne un\nDeux');
    expect(clicked[0]?.download).toBe('notes.txt');
  });

  it('révoque l\'URL de l\'objet', () => {
    vi.useFakeTimers();
    const { ctx } = makeCtx();
    mount(host, ctx);
    const { form } = openForm();
    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:wordpad-test');
  });

  it('révoque aussi au démontage si le délai n\'est pas écoulé', () => {
    vi.useFakeTimers();
    const { ctx } = makeCtx();
    mount(host, ctx);
    const { form } = openForm();
    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:wordpad-test');
  });

  it('Annuler et Échap ferment le formulaire sans télécharger', () => {
    const { ctx } = makeCtx();
    mount(host, ctx);
    const { form, name } = openForm();
    const cancel = Array.from(form.querySelectorAll('button')).find((b) => b.textContent === 'Annuler')!;
    cancel.click();
    expect(form.hidden).toBe(true);
    openForm();
    name.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(form.hidden).toBe(true);
    expect(createObjectURL).not.toHaveBeenCalled();
  });
});

describe('WordPad : collage', () => {
  function pasteEvent(data: Record<string, string>): Event {
    const ev = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(ev, 'clipboardData', { value: { getData: (t: string) => data[t] ?? '' } });
    return ev;
  }

  function caretIn(el: HTMLElement): void {
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);
  }

  it('insère du HTML nettoyé et bloque l\'événement natif', () => {
    const { ctx } = makeCtx({}, makeStorage({ draft: '<p>début</p>' }));
    mount(host, ctx);
    const editor = editorOf();
    caretIn(editor);
    const ev = pasteEvent({
      'text/html': '<b>gras</b><script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)">lien</a>',
      'text/plain': 'gras',
    });
    editor.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(editor.querySelector('script')).toBeNull();
    expect(editor.querySelector('img')).toBeNull();
    expect(editor.querySelector('a')).toBeNull();
    expect(editor.querySelector('b')?.textContent).toBe('gras');
    expect(editor.textContent).toContain('début');
    expect(editor.textContent).toContain('lien');
  });

  it('insère du texte brut quand il n\'y a pas de HTML', () => {
    const { ctx } = makeCtx({}, makeStorage({ draft: '' }));
    mount(host, ctx);
    const editor = editorOf();
    caretIn(editor);
    const ev = pasteEvent({ 'text/plain': '<img src=x onerror=alert(1)> texte' });
    editor.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(editor.querySelector('img')).toBeNull();
    expect(editor.textContent).toBe('<img src=x onerror=alert(1)> texte');
  });

  it('nettoie aussi un dépôt (drop)', () => {
    const { ctx } = makeCtx({}, makeStorage({ draft: '' }));
    mount(host, ctx);
    const editor = editorOf();
    caretIn(editor);
    const ev = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(ev, 'dataTransfer', {
      value: { getData: (t: string) => (t === 'text/html' ? '<i onclick="x">dépôt</i><iframe src="https://evil"></iframe>' : ''), files: [] },
    });
    editor.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(editor.querySelector('iframe')).toBeNull();
    expect(editor.innerHTML).toBe('<i>dépôt</i>');
  });
});
