import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppContext } from '../../core/types';
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

describe('interface du Démineur', () => {
  it('monte une grille accessible avec un seul arrêt de tabulation', () => {
    const host = document.createElement('div');
    const { ctx, setTitle } = makeCtx();
    mount(host, ctx);
    expect(setTitle).toHaveBeenCalledWith('Démineur.exe');
    expect(host.querySelector('[role="grid"]')).not.toBeNull();
    expect(host.querySelectorAll('[role="row"]')).toHaveLength(9);
    const cells = host.querySelectorAll<HTMLButtonElement>('[role="gridcell"]');
    expect(cells).toHaveLength(81);
    expect(Array.from(cells).filter((c) => c.tabIndex === 0)).toHaveLength(1);
    expect(cells[0]!.getAttribute('aria-label')).toBe('ligne 1, colonne 1, fermée');
    expect(host.querySelector('label')!.textContent).toBe('Niveau');
  });

  it('F pose un drapeau, les flèches déplacent le focus', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    mount(host, makeCtx().ctx);
    const cells = host.querySelectorAll<HTMLButtonElement>('[role="gridcell"]');
    cells[0]!.focus();
    cells[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', bubbles: true }));
    expect(cells[0]!.getAttribute('aria-label')).toBe('ligne 1, colonne 1, drapeau');
    cells[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(document.activeElement).toBe(cells[1]);
    expect(cells[1]!.tabIndex).toBe(0);
    expect(cells[0]!.tabIndex).toBe(-1);
    host.remove();
  });

  it('le chronomètre démarre au premier dévoilement et est arrêté au démontage', () => {
    vi.useFakeTimers();
    const host = document.createElement('div');
    mount(host, makeCtx().ctx);
    const cells = host.querySelectorAll<HTMLButtonElement>('[role="gridcell"]');
    cells[40]!.click();
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('change de niveau et mémorise le choix', () => {
    const host = document.createElement('div');
    const { ctx, store } = makeCtx();
    mount(host, ctx);
    const select = host.querySelector('select')!;
    select.value = 'expert';
    select.dispatchEvent(new Event('change'));
    expect(host.querySelectorAll('[role="gridcell"]')).toHaveLength(480);
    expect(store.get('level')).toBe('expert');
  });
});
