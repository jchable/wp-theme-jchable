import { afterEach, describe, expect, it, vi } from 'vitest';
import { missingKeys, setLang } from '../../core/i18n';
import type { AppContext } from '../../core/types';
import { SOURCE_URL, buildAbout } from './about';
import { messages } from './i18n';
import { mount, unmount } from './index';
import { HttpError, buildDoomUrls, describeError, formatError } from './loader';

function fakeCtx(doomBaseUrl: string) {
  return {
    config: { restUrl: 'https://ex.com/wp-json/', locale: 'en_GB', doomBaseUrl },
    args: {},
    storage: { get: () => null, set: vi.fn(), remove: vi.fn() },
    setTitle: vi.fn(),
    close: vi.fn(),
    openApp: vi.fn(),
    openBsod: vi.fn(),
    playSound: vi.fn(),
    fetchJson: vi.fn(),
  } as unknown as AppContext;
}

afterEach(() => unmount());

describe('DOOM : traductions', () => {
  it('les deux langues ont les mêmes clés', () => {
    expect(missingKeys(messages)).toEqual([]);
  });

  it('le panneau « À propos » est en anglais', () => {
    setLang('en');
    const panel = buildAbout('https://x.test/doom/');
    expect(panel.getAttribute('aria-label')).toBe('About DOOM.EXE');
    expect(panel.querySelector('h2')?.textContent).toBe('About DOOM.EXE');
    expect(panel.textContent).toContain('free software under the GPL v2 or later');
    expect(panel.textContent).toContain('id Software');
    expect(panel.querySelector('button')?.textContent).toBe('Close this panel');
    const links = [...panel.querySelectorAll('a')].map((a) => a.textContent);
    expect(links).toContain('source code on GitHub (exact version)');
    expect(links).toContain('build README');
    expect(links).toContain('DOOM shareware license');
    expect(links).toContain('GPL v2');
    expect([...panel.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toContain(SOURCE_URL);
  });

  it('describeError et formatError en anglais', () => {
    setLang('en');
    expect(describeError(new HttpError('https://x/doom1.wad', 404))).toBe('A game file could not be found on the server.');
    expect(describeError(new HttpError('https://x/doom1.wad', 500))).toBe('The server refused to provide the game files.');
    expect(describeError(new TypeError('Failed to fetch'))).toBe('The game files were rejected (network, redirect or integrity check).');
    expect(describeError(new Error('boom'))).toBe('The game engine stopped unexpectedly.');
    expect(formatError(undefined)).toBe('Unknown error');
    expect(formatError(new Error(''))).toBe('(no message)');
    expect(formatError(new Error('fail', { cause: new TypeError('Failed to fetch') }))).toBe('fail\nCause: TypeError: Failed to fetch');
    expect(() => buildDoomUrls('   ')).toThrow(/missing/);
  });

  it('même erreur, deux langues', () => {
    expect(describeError(new HttpError('u', 404))).toBe('Un fichier du jeu est introuvable sur le serveur.');
    setLang('en');
    expect(describeError(new HttpError('u', 404))).not.toContain('fichier');
  });

  it('la fenêtre affiche commandes et panneau d’erreur en anglais', async () => {
    setLang('en');
    const host = document.createElement('div');
    document.body.append(host);
    const ctx = fakeCtx('');
    mount(host, ctx);
    const labels = [...host.querySelectorAll('.bapp-doom-strip button')].map((b) => b.textContent);
    expect(labels).toEqual(['Full screen', 'Sound: on', 'About', 'Close']);
    expect(host.querySelector('[role="toolbar"]')?.getAttribute('aria-label')).toBe('DOOM controls');
    await vi.waitFor(() => expect(host.querySelector('.bapp-doom-error')).not.toBeNull());
    expect(host.querySelector('.bapp-doom-error-title')?.textContent).toBe('DOOM.EXE has stopped working');
    expect(host.querySelector('.bapp-doom-error-text')?.textContent).toBe('The game engine stopped unexpectedly.');
    expect(host.querySelector('summary')?.textContent).toBe('Technical details');
    expect(host.querySelector('.bapp-doom-error-pre')?.textContent).toContain('DOOM folder address missing');
    expect(ctx.setTitle).toHaveBeenCalledWith('DOOM.EXE');
    host.remove();
  });
});
