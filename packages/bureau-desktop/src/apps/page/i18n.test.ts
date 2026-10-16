import { afterEach, describe, expect, it, vi } from 'vitest';
import { missingKeys, setLang } from '../../core/i18n';
import type { AppContext, BureauConfig } from '../../core/types';
import { messages } from './i18n';
import { mount, unmount } from './index';

function makeCtx() {
  const setTitle = vi.fn();
  const ctx: AppContext = {
    config: { siteName: 'Test Blog', homeUrl: 'https://example.com/' } as BureauConfig,
    args: { slug: 'about', page: { title: { rendered: 'About' }, content: { rendered: '<p>Hi</p>' } } },
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

describe('Lecteur de page : traductions', () => {
  it('a les mêmes clés en français et en anglais', () => {
    expect(missingKeys(messages)).toEqual([]);
  });

  it('affiche le lien de pied de page en français puis en anglais', () => {
    const host = document.createElement('div');
    mount(host, makeCtx().ctx);
    expect(host.querySelector('.bapp-page-footer a')?.textContent).toBe('Ouvrir la page ↗');
    unmount();
    setLang('en');
    const { ctx, setTitle } = makeCtx();
    mount(host, ctx);
    expect(host.querySelector('.bapp-page-footer a')?.textContent).toBe('Open the page ↗');
    expect(setTitle).toHaveBeenCalledWith('about.md');
  });
});
