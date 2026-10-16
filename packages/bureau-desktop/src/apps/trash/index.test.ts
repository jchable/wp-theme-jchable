import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppContext } from '../../core/types';
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
  } as unknown as AppContext & {
    playSound: ReturnType<typeof vi.fn>;
    setTitle: ReturnType<typeof vi.fn>;
    storage: { set: ReturnType<typeof vi.fn> };
  };
}

const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

let el: HTMLElement;

function rows(root: HTMLElement = el): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>('[role="option"]'));
}
function button(label: string): HTMLButtonElement {
  const b = Array.from(el.querySelectorAll('button')).find((x) => x.textContent === label);
  if (!b) throw new Error(`bouton introuvable : ${label}`);
  return b;
}
const status = () => el.querySelector('.bapp-trash-status')!;
const normal = { wait: async () => undefined, reducedMotion: () => false };
const reduced = { wait: async () => undefined, reducedMotion: () => true };

beforeEach(() => {
  resetTrashSession();
  el = document.createElement('div');
  document.body.appendChild(el);
});
afterEach(() => {
  unmount();
  el.remove();
});

describe('Corbeille', () => {
  it('rend 8 lignes dans une listbox, un seul arrêt de tabulation, et fixe le titre', () => {
    const ctx = makeCtx();
    mountTrash(el, ctx, normal);
    expect(ctx.setTitle).toHaveBeenCalledWith('Corbeille');
    expect(el.querySelector('[role="listbox"]')).not.toBeNull();
    expect(rows()).toHaveLength(8);
    expect(rows().filter((r) => r.tabIndex === 0)).toHaveLength(1);
    expect(el.querySelector('.bapp-trash-count')!.textContent).toBe('8 objets');
    expect(el.querySelector('.bapp-trash-total')!.textContent).toContain('Ko');
  });

  it("met à jour l'aperçu à la sélection (clic, clavier)", () => {
    mountTrash(el, makeCtx(), normal);
    const preview = el.querySelector('.bapp-trash-preview')!;
    rows()[2]!.click();
    expect(rows()[2]!.getAttribute('aria-selected')).toBe('true');
    expect(preview.textContent).toBe(TRASH_ITEMS[2]!.preview);
    rows()[2]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(rows()[3]!.getAttribute('aria-selected')).toBe('true');
    expect(rows()[2]!.getAttribute('aria-selected')).toBe('false');
    expect(rows()[3]!.tabIndex).toBe(0);
    expect(rows()[2]!.tabIndex).toBe(-1);
    expect(preview.textContent).toBe(TRASH_ITEMS[3]!.preview);
    rows()[3]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(preview.textContent).toBe(TRASH_ITEMS[7]!.preview);
  });

  it('Entrée et Espace sélectionnent la ligne', () => {
    mountTrash(el, makeCtx(), normal);
    rows()[4]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(rows()[4]!.getAttribute('aria-selected')).toBe('true');
    rows()[5]!.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(rows()[5]!.getAttribute('aria-selected')).toBe('true');
  });

  it('Restaurer affiche la blague sans rien retirer', () => {
    mountTrash(el, makeCtx(), normal);
    rows()[0]!.click();
    button('Restaurer').click();
    expect(status().textContent).toBe(
      'Impossible de restaurer : le brouillon a été supprimé pour de bonnes raisons.',
    );
    expect(rows()).toHaveLength(8);
  });

  it("Vider joue le son une fois, anime, puis affiche l'état vide", async () => {
    const ctx = makeCtx();
    const wait = vi.fn(async () => undefined);
    mountTrash(el, ctx, { wait, reducedMotion: () => false });
    button('Vider la corbeille').click();
    expect(ctx.playSound).toHaveBeenCalledTimes(1);
    expect(ctx.playSound).toHaveBeenCalledWith('recycle');
    expect(el.querySelector('.bapp-trash-shred')).not.toBeNull();
    await flush();
    expect(wait).toHaveBeenCalledWith(600);
    expect(rows()).toHaveLength(0);
    expect(el.textContent).toContain('Corbeille vide');
    expect(el.textContent).toContain('Rien à voir ici. Circulez.');
    expect(el.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(el.querySelector('.bapp-trash-count')!.textContent).toBe('0 objet');
    expect(ctx.playSound).toHaveBeenCalledTimes(1);
  });

  it("mouvement réduit : ni attente ni animation", async () => {
    const wait = vi.fn(async () => undefined);
    mountTrash(el, makeCtx(), { wait, reducedMotion: () => true });
    button('Vider la corbeille').click();
    expect(el.querySelector('.bapp-trash-shred')).toBeNull();
    await flush();
    expect(wait).not.toHaveBeenCalled();
    expect(rows()).toHaveLength(0);
  });

  it("l'état vidé survit au remontage (session), puis se remplit après reset", async () => {
    mountTrash(el, makeCtx(), reduced);
    button('Vider la corbeille').click();
    await flush();
    unmount();
    const el2 = document.createElement('div');
    mountTrash(el2, makeCtx(), reduced);
    expect(rows(el2)).toHaveLength(0);
    expect(el2.textContent).toContain('Rien à voir ici. Circulez.');
    unmount();
    resetTrashSession();
    mountTrash(el2, makeCtx(), reduced);
    expect(rows(el2)).toHaveLength(8);
  });

  it("n'écrit rien dans le stockage", async () => {
    const ctx = makeCtx();
    mountTrash(el, ctx, reduced);
    button('Vider la corbeille').click();
    await flush();
    expect(ctx.storage.set).not.toHaveBeenCalled();
  });
});
