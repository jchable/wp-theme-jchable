import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { missingKeys, setLang } from '../../core/i18n';
import type { AppContext } from '../../core/types';
import { formatCount, formatDate, formatSize } from './helpers';
import { messages } from './i18n';
import { mountTrash, resetTrashSession, unmount } from './index';
import { TRASH_ITEMS } from './items';

function makeCtx() {
  return {
    config: {},
    args: {},
    storage: { get: () => null, set: vi.fn(), remove: vi.fn() },
    setTitle: vi.fn(),
    close: vi.fn(),
    openApp: vi.fn(),
    openBsod: vi.fn(),
    playSound: vi.fn(),
    fetchJson: vi.fn(),
  } as unknown as AppContext & { setTitle: ReturnType<typeof vi.fn> };
}

const reduced = { wait: async () => undefined, reducedMotion: () => true };
const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

let el: HTMLElement;

beforeEach(() => {
  resetTrashSession();
  el = document.createElement('div');
  document.body.appendChild(el);
});
afterEach(() => {
  unmount();
  el.remove();
});

describe('messages de la Corbeille', () => {
  it('les deux langues ont les mêmes clés, toutes renseignées', () => {
    expect(missingKeys(messages)).toEqual([]);
  });
});

describe('formats en anglais', () => {
  it('tailles en KB / MB, milliers à la virgule, décimale au point', () => {
    setLang('en');
    expect(formatSize(14)).toBe('14 KB');
    expect(formatSize(1234)).toBe('1,234 KB');
    expect(formatSize(20480)).toBe('20.0 MB');
  });
  it('accorde « item(s) » et garde jj/mm/aaaa', () => {
    setLang('en');
    expect(formatCount(0)).toBe('0 items');
    expect(formatCount(1)).toBe('1 item');
    expect(formatCount(8)).toBe('8 items');
    expect(formatDate('2025-03-14')).toBe('14/03/2025');
  });
  it('reste en français par défaut', () => {
    expect(formatSize(1234)).toBe('1 234 Ko');
    expect(formatSize(20480)).toBe('20,0 Mo');
  });
});

describe('Recycle Bin en anglais', () => {
  it("affiche l'interface, les brouillons et l'aperçu en anglais", () => {
    setLang('en');
    const ctx = makeCtx();
    mountTrash(el, ctx, reduced);
    expect(ctx.setTitle).toHaveBeenCalledWith('Recycle Bin');
    expect(el.querySelector('[role="toolbar"]')!.getAttribute('aria-label')).toBe('Recycle Bin actions');
    expect(el.querySelector('[role="listbox"]')!.getAttribute('aria-label')).toBe('Deleted drafts');
    expect(Array.from(el.querySelectorAll('button')).map((b) => b.textContent)).toEqual(['Restore', 'Empty Recycle Bin']);
    expect(el.querySelector('.bapp-trash-head')!.textContent).toBe('NameSizeDeleted on');
    expect(el.querySelector('.bapp-trash-count')!.textContent).toBe('8 items');
    expect(el.querySelector('.bapp-trash-total')!.textContent).toMatch(/KB$/);
    expect(el.querySelector('.bapp-trash-preview')!.textContent).toBe('Select a file to see a preview.');
    const rows = Array.from(el.querySelectorAll<HTMLElement>('[role="option"]'));
    expect(rows[0]!.textContent).toContain('sharepoint-is-dead-long-live-sharepoint.md');
    rows[3]!.click();
    expect(el.querySelector('.bapp-trash-preview')!.textContent).toBe(TRASH_ITEMS[3]!.preview);
    expect(TRASH_ITEMS[3]!.preview).toBe(
      'Everything works perfectly. On my machine. Today. With the right SDK version.',
    );
  });

  it('les gags et l’état vide sont en anglais', async () => {
    setLang('en');
    mountTrash(el, makeCtx(), reduced);
    const status = el.querySelector('.bapp-trash-status')!;
    const [restore, empty] = Array.from(el.querySelectorAll('button'));
    restore!.click();
    expect(status.textContent).toBe('Select a draft first.');
    el.querySelector<HTMLElement>('[role="option"]')!.click();
    restore!.click();
    expect(status.textContent).toBe('Cannot restore: the draft was deleted for very good reasons.');
    empty!.click();
    await flush();
    expect(el.textContent).toContain('Recycle Bin is empty');
    expect(el.textContent).toContain('Nothing to see here. Move along.');
    expect(el.querySelector('.bapp-trash-count')!.textContent).toBe('0 items');
  });

  it('les noms de fichiers suivent la langue (résolus à la lecture)', () => {
    expect(TRASH_ITEMS[0]!.name).toBe('sharepoint-est-mort-vive-sharepoint.md');
    setLang('en');
    expect(TRASH_ITEMS[0]!.name).toBe('sharepoint-is-dead-long-live-sharepoint.md');
  });
});
