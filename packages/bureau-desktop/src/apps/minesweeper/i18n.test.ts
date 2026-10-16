import { afterEach, describe, expect, it, vi } from 'vitest';
import { missingKeys, setLang } from '../../core/i18n';
import type { AppContext } from '../../core/types';
import { messages } from './i18n';
import { mount, unmount } from './index';

function makeCtx(): { ctx: AppContext; store: Map<string, string>; setTitle: ReturnType<typeof vi.fn> } {
  const store = new Map<string, string>();
  const setTitle = vi.fn();
  const ctx = {
    setTitle,
    storage: {
      get: (k: string) => store.get(k) ?? null,
      set: (k: string, v: string) => void store.set(k, v),
      remove: (k: string) => void store.delete(k),
    },
  } as unknown as AppContext;
  return { ctx, store, setTitle };
}

afterEach(() => {
  unmount();
  vi.useRealTimers();
});

describe('messages du Démineur', () => {
  it('les deux langues ont les mêmes clés, toutes renseignées', () => {
    expect(missingKeys(messages)).toEqual([]);
  });
});

describe('Démineur en anglais', () => {
  it("affiche l'interface en anglais", () => {
    setLang('en');
    const host = document.createElement('div');
    const { ctx, setTitle } = makeCtx();
    mount(host, ctx);
    expect(setTitle).toHaveBeenCalledWith('Minesweeper.exe');
    expect(host.querySelector('label')!.textContent).toBe('Level');
    expect(host.querySelector('[role="grid"]')!.getAttribute('aria-label')).toBe('Minefield');
    expect(host.querySelector('option')!.textContent).toBe('Beginner (9×9, 10 mines)');
    expect(host.querySelector('.bapp-minesweeper-best')!.textContent).toBe('Best time: —');
    expect(host.querySelector('.bapp-minesweeper-face')!.getAttribute('aria-label')).toBe('New game');
    expect(host.querySelector('.bapp-minesweeper-help')!.textContent).toContain('Enter or click: reveal.');
    const lcds = host.querySelectorAll('.bapp-minesweeper-lcd');
    expect(lcds[0]!.getAttribute('aria-label')).toBe('Mines left: 10');
    expect(lcds[1]!.getAttribute('aria-label')).toBe('Time: 0 s');
  });

  it('décrit les cases en anglais (fermée, drapeau, voisines)', () => {
    setLang('en');
    const host = document.createElement('div');
    document.body.appendChild(host);
    mount(host, makeCtx().ctx);
    const cells = host.querySelectorAll<HTMLButtonElement>('[role="gridcell"]');
    expect(cells[0]!.getAttribute('aria-label')).toBe('row 1, column 1, closed');
    cells[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', bubbles: true }));
    expect(cells[0]!.getAttribute('aria-label')).toBe('row 1, column 1, flag');
    cells[40]!.click();
    const labels = Array.from(cells).map((c) => c.getAttribute('aria-label')!);
    expect(labels.some((l) => /, (no|\d+) neighbouring mines?$/.test(l))).toBe(true);
    host.remove();
  });

  it('annonce la défaite en anglais', () => {
    setLang('en');
    let n = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => (n++ * 0.37) % 1);
    const host = document.createElement('div');
    mount(host, makeCtx().ctx);
    const cells = host.querySelectorAll<HTMLButtonElement>('[role="gridcell"]');
    // Mines dispersées (tirage déterministe) ; le premier clic est sûr, puis on clique chaque case : on finit sur une mine.
    cells[40]!.click();
    cells.forEach((c) => c.click());
    vi.restoreAllMocks();
    expect(host.querySelector('.bapp-minesweeper-status')!.textContent).toBe('Game over');
    expect(host.querySelector('.bapp-minesweeper-face')!.getAttribute('aria-label')).toBe('New game (game lost)');
  });
});
