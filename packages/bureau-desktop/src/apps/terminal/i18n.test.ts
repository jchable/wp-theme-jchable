import { describe, it, expect, vi } from 'vitest';
import { missingKeys, setLang } from '../../core/i18n';
import { messages } from './i18n';
import { mount, unmount } from './index';
import { createRunner } from './run';
import type { AppContext, BureauConfig } from '../../core/types';

const config: BureauConfig = {
  homeUrl: 'https://blog.example.org/',
  restUrl: 'https://blog.example.org/wp-json/',
  locale: 'fr_FR',
  assetsUrl: '',
  siteName: 'My Blog',
  sitemapUrl: 'https://blog.example.org/archives/',
  feedUrl: '',
  doomBaseUrl: '',
};

function fakeCtx(fetchJson: (url: string) => Promise<unknown> = async () => []) {
  return {
    config,
    args: {},
    storage: { get: () => null, set: () => undefined, remove: () => undefined },
    setTitle: vi.fn(),
    close: vi.fn(),
    openApp: vi.fn(),
    openBsod: vi.fn(),
    playSound: vi.fn(),
    fetchJson: vi.fn(fetchJson),
  } as unknown as AppContext;
}

function setup(ctx = fakeCtx()) {
  const lines: string[] = [];
  const navigate = vi.fn();
  const runner = createRunner(ctx, {
    print: (l) => lines.push(l),
    clear: vi.fn(),
    navigate,
    now: () => new Date(2024, 5, 1, 12, 0, 0),
  });
  return { ctx, lines, navigate, runner };
}

describe('terminal i18n', () => {
  it('a les mêmes clés en français et en anglais', () => {
    expect(missingKeys(messages)).toEqual([]);
  });

  it('affiche le titre, les libellés et la bannière en anglais', () => {
    setLang('en');
    const el = document.createElement('div');
    document.body.append(el);
    const ctx = fakeCtx();
    mount(el, ctx);
    expect(ctx.setTitle).toHaveBeenCalledWith('Command Prompt');
    expect(el.querySelector('[role="log"]')?.getAttribute('aria-label')).toBe('Terminal output');
    expect(el.querySelector('input')?.getAttribute('aria-label')).toBe('Command');
    const text = el.querySelector('[role="log"]')?.textContent ?? '';
    expect(text).toContain('My Blog [Version 1.0]');
    expect(text).toContain('Type help for the list of commands.');
    unmount();
    el.remove();
  });

  it("répond en anglais : aide, commande inconnue, chemin, whoami, date", async () => {
    setLang('en');
    const { runner, lines } = setup();
    await runner.run('help');
    expect(lines[0]).toBe('Available commands:');
    expect(lines).toContain('  clear         clear the screen');
    lines.length = 0;
    await runner.run('foo');
    expect(lines).toEqual(["'foo' is not recognized as an internal or external command, operable program or batch file. Type help."]);
    lines.length = 0;
    await runner.run('cd nowhere');
    await runner.run('whoami');
    await runner.run('date');
    expect(lines[0]).toBe('The system cannot find the path specified.');
    expect(lines[1]).toBe('visitor@blog.example.org');
    expect(lines[2]).toContain('Saturday');
    expect(lines[2]).toContain('June');
  });

  it('garde la date en français quand la langue est le français', async () => {
    const { runner, lines } = setup();
    await runner.run('date');
    expect(lines[0]).toContain('samedi');
    expect(lines[0]).toContain('juin');
  });

  it('traduit ls, cat et les erreurs réseau', async () => {
    setLang('en');
    const empty = setup();
    await empty.runner.run('ls');
    expect(empty.lines).toEqual(['The directory is empty.']);
    empty.lines.length = 0;
    await empty.runner.run('cat');
    await empty.runner.run('cat missing');
    expect(empty.lines).toEqual(['Usage: cat <post>', 'File not found: missing']);
    const broken = setup(fakeCtx(async () => Promise.reject(new Error('offline'))));
    await broken.runner.run('ls');
    expect(broken.lines).toEqual(['Unable to reach the server.']);
  });

  it("traduit les gags et leur écran bleu", async () => {
    setLang('en');
    const { runner, lines, ctx } = setup();
    await runner.run('format c:');
    expect(lines[0]).toBe('WARNING: all data on drive C: will be lost. Formatting...');
    expect(ctx.openBsod).toHaveBeenCalledWith(
      'Drive C: has been formatted. The blog is doing just fine, thanks. Press any key to pretend to continue.',
    );
  });
});
