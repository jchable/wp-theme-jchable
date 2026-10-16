import { afterEach, describe, expect, it, vi } from 'vitest';
import { missingKeys, setLang } from '../../core/i18n';
import type { AppContext, BureauConfig } from '../../core/types';
import { initialDocumentHtml } from './document';
import { messages, t } from './i18n';
import { mount, unmount } from './index';
import { buildHtmlDocument } from './text';

function makeCtx(args: Record<string, unknown> = {}) {
  const setTitle = vi.fn();
  const ctx: AppContext = {
    config: { siteName: 'Test Blog', homeUrl: 'https://example.com/' } as BureauConfig,
    args,
    storage: { get: () => null, set: () => undefined, remove: () => undefined },
    setTitle,
    close: vi.fn(),
    openApp: vi.fn(),
    openBsod: vi.fn(),
    playSound: vi.fn(),
    fetchJson: vi.fn(),
  };
  return { ctx, setTitle };
}

afterEach(() => unmount());

describe('WordPad : traductions', () => {
  it('a les mêmes clés en français et en anglais', () => {
    expect(missingKeys(messages)).toEqual([]);
  });

  it('résout les textes dans la langue courante', () => {
    expect(t('untitled')).toBe('Sans titre');
    setLang('en');
    expect(t('untitled')).toBe('Untitled');
  });

  it('construit les documents de départ en anglais', () => {
    setLang('en');
    const welcome = initialDocumentHtml('Test Blog', {});
    expect(welcome).toContain('<h1>Welcome to Test Blog</h1>');
    expect(welcome).toContain('readme.rtf');
    expect(welcome).not.toContain('lisez-moi');
    const note = initialDocumentHtml('Test Blog', { title: '<i>A & B</i>', url: 'https://example.com/a/' });
    expect(note).toContain('<h1>readme.rtf</h1>');
    expect(note).toContain('Note about the article: <b>&lt;i&gt;A &amp; B&lt;/i&gt;</b>');
    expect(note).toContain('Address: https://example.com/a/');
    expect(note).toContain('Type here…');
  });

  it("exporte le document avec la langue courante", () => {
    expect(buildHtmlDocument('t', '')).toContain('<html lang="fr">');
    setLang('en');
    expect(buildHtmlDocument('t', '')).toContain('<html lang="en">');
  });

  it("affiche la barre d'outils, le titre et le formulaire en anglais", () => {
    setLang('en');
    const host = document.createElement('div');
    document.body.appendChild(host);
    const { ctx, setTitle } = makeCtx();
    mount(host, ctx);
    expect(setTitle).toHaveBeenCalledWith('Untitled - WordPad');
    const labels = Array.from(host.querySelectorAll('button')).map((b) => b.getAttribute('aria-label'));
    expect(labels).toEqual(expect.arrayContaining(['New', 'Save as…', 'Bold', 'Italic', 'Underline', 'Align left', 'Align right']));
    expect(host.querySelector('[role="toolbar"]')?.getAttribute('aria-label')).toBe('Formatting');
    expect(host.querySelector('select[aria-label="Font"]')).not.toBeNull();
    const sizes = Array.from(host.querySelectorAll<HTMLOptionElement>('select[aria-label="Size"] option')).map((o) => o.text);
    expect(sizes).toEqual(['Small', 'Normal', 'Large', 'Extra large']);
    const editor = host.querySelector<HTMLElement>('[role="textbox"]')!;
    expect(editor.getAttribute('lang')).toBe('en');
    expect(editor.getAttribute('aria-label')).toBe('Document');
    expect(editor.textContent).toContain('Welcome to Test Blog');
    expect(host.textContent).toContain('Plain text (.txt)');
    host.remove();
  });
});
