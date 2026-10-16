import { describe, it, expect, vi, afterEach } from 'vitest';
import { mount, unmount } from './index';
import type { AppContext } from '../../core/types';

function fakeCtx(): AppContext {
  return {
    config: {
      homeUrl: 'https://blog.example.org/',
      restUrl: 'https://blog.example.org/wp-json/',
      locale: 'fr_FR',
      assetsUrl: '',
      siteName: 'Mon Blog',
      sitemapUrl: 'https://blog.example.org/archives/',
      feedUrl: '',
      doomBaseUrl: '',
    },
    args: {},
    storage: { get: () => null, set: () => undefined, remove: () => undefined },
    setTitle: vi.fn(),
    close: vi.fn(),
    openApp: vi.fn(),
    openBsod: vi.fn(),
    playSound: vi.fn(),
    fetchJson: vi.fn(async () => []),
  } as unknown as AppContext;
}

const key = (input: HTMLInputElement, k: string): void => {
  input.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
};

describe('terminal mount', () => {
  afterEach(() => unmount());

  it('construit un journal accessible et un champ étiqueté', () => {
    const el = document.createElement('div');
    document.body.append(el);
    mount(el, fakeCtx());
    const log = el.querySelector('[role="log"]');
    expect(log?.getAttribute('aria-live')).toBe('polite');
    expect(el.querySelector('input')?.getAttribute('aria-label')).toBeTruthy();
    expect(log?.textContent).toContain('Tapez help pour la liste des commandes.');
    el.remove();
  });

  it("exécute une commande, affiche l'écho et rappelle l'historique", async () => {
    const el = document.createElement('div');
    document.body.append(el);
    const ctx = fakeCtx();
    mount(el, ctx);
    const input = el.querySelector('input') as HTMLInputElement;
    input.value = 'doom';
    el.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(el.querySelector('[role="log"]')?.textContent).toContain('C:\\Blog>doom');
    expect(ctx.openApp).toHaveBeenCalledWith('doom');
    expect(input.value).toBe('');
    key(input, 'ArrowUp');
    expect(input.value).toBe('doom');
    key(input, 'ArrowDown');
    expect(input.value).toBe('');
    el.remove();
  });

  it("n'interprète jamais le texte comme du HTML", async () => {
    const el = document.createElement('div');
    document.body.append(el);
    mount(el, fakeCtx());
    const input = el.querySelector('input') as HTMLInputElement;
    input.value = '<img src=x>';
    el.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(el.querySelector('img')).toBeNull();
    el.remove();
  });
});
