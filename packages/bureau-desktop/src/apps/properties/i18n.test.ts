import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { missingKeys, setLang } from '../../core/i18n';
import type { AppContext, BureauConfig } from '../../core/types';
import { messages } from './i18n';
import { mount, unmount } from './index';

function makeCtx() {
  const setTitle = vi.fn();
  const ctx: AppContext = {
    config: { siteName: 'Test Blog', homeUrl: 'https://example.com/' } as BureauConfig,
    args: {},
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

describe('Propriétés système : version affichée', () => {
  it('suit la version du thème (style.css)', () => {
    // les tests se lancent depuis la racine du dépôt (npm run test:unit)
    const css = readFileSync(join(process.cwd(), 'themes', 'jchable-bureau', 'style.css'), 'utf8');
    const [major, minor] = (css.match(/^Version:\s*(\d+)\.(\d+)/m) ?? []).slice(1);
    expect(major, 'version introuvable dans style.css').toBeDefined();
    for (const lang of ['fr', 'en'] as const) expect(messages[lang].systemValue).toContain(`Bureau ${major}.${minor} `);
  });
});

describe('Propriétés système : traductions', () => {
  it('a les mêmes clés en français et en anglais', () => {
    expect(missingKeys(messages)).toEqual([]);
  });

  it('affiche les propriétés en français', () => {
    const host = document.createElement('div');
    const { ctx, setTitle } = makeCtx();
    mount(host, ctx);
    expect(setTitle).toHaveBeenCalledWith('Propriétés système');
    const terms = Array.from(host.querySelectorAll('dt')).map((d) => d.textContent);
    expect(terms).toEqual(['Système', 'Utilisateur', 'Processeur', 'Mémoire', 'Écran', 'Statut']);
    expect(host.querySelector('button')?.textContent).toBe('OK');
  });

  it('affiche les propriétés en anglais', () => {
    setLang('en');
    const host = document.createElement('div');
    const { ctx, setTitle } = makeCtx();
    mount(host, ctx);
    expect(setTitle).toHaveBeenCalledWith('System Properties');
    const terms = Array.from(host.querySelectorAll('dt')).map((d) => d.textContent);
    expect(terms).toEqual(['System', 'User', 'Processor', 'Memory', 'Display', 'Status']);
    const values = Array.from(host.querySelectorAll('dd')).map((d) => d.textContent);
    expect(values[3]).toBe('640 KB (should be enough for anybody)');
    expect(values[4]).toBe(`${window.innerWidth} × ${window.innerHeight} pixels`);
    expect(values[5]).toBe('All good. Probably.');
  });
});
