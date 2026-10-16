import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { missingKeys, setLang } from '../../core/i18n';
import type { AppContext } from '../../core/types';
import { messages } from './i18n';
import { formatRelative, parseComments } from './logic';
import { createMessenger, type Messenger } from './view';

const NOW = new Date('2024-06-15T12:00:00Z');

function fakeCtx(fetchJson: AppContext['fetchJson'], seed: Record<string, string> = {}) {
  const store = new Map(Object.entries(seed));
  return {
    config: { restUrl: 'https://ex.com/wp-json/', locale: 'en_GB' },
    args: {},
    storage: {
      get: (k: string) => store.get(k) ?? null,
      set: (k: string, v: string) => void store.set(k, v),
      remove: (k: string) => void store.delete(k),
    },
    setTitle: vi.fn(),
    close: vi.fn(),
    openApp: vi.fn(),
    openBsod: vi.fn(),
    playSound: vi.fn(),
    fetchJson,
  } as unknown as AppContext;
}

const raw = (id: number) => ({
  id,
  author_name: `Author ${id}`,
  date_gmt: '2024-06-15T09:00:00',
  content: { rendered: `<p>Message ${id}</p>` },
  link: `https://ex.com/post-${id}/#comment-${id}`,
  post: id,
});

let el: HTMLElement;
let m: Messenger | undefined;

beforeEach(() => {
  el = document.createElement('div');
  document.body.append(el);
});
afterEach(() => {
  m?.destroy();
  m = undefined;
  el.remove();
});

const start = async (ctx: AppContext) => {
  m = createMessenger(el, ctx, { navigate: vi.fn(), now: () => NOW });
  await m.ready;
};

describe('Messenger : traductions', () => {
  it('les deux langues ont les mêmes clés', () => {
    expect(missingKeys(messages)).toEqual([]);
  });

  it('dates relatives en anglais', () => {
    setLang('en');
    const now = new Date(2024, 5, 15, 12, 0, 0);
    const ago = (ms: number) => new Date(now.getTime() - ms);
    const MIN = 60_000;
    const H = 60 * MIN;
    expect(formatRelative(ago(20_000), now)).toBe('just now');
    expect(formatRelative(ago(5 * MIN), now)).toBe('5 min ago');
    expect(formatRelative(ago(3 * H + MIN), now)).toBe('3 h ago');
    expect(formatRelative(ago(30 * H), now)).toBe('yesterday');
    expect(formatRelative(new Date(2024, 0, 5, 10, 0, 0), now)).toBe('05.01.2024');
  });

  it('auteur par défaut en anglais', () => {
    setLang('en');
    expect(parseComments([{ id: 3, content: { rendered: 'hello' } }])[0]!.author).toBe('Anonymous');
  });

  it('interface en anglais : badge, réponse, date, état de chargement', async () => {
    setLang('en');
    let resolve!: (v: unknown) => void;
    const ctx = fakeCtx(vi.fn().mockReturnValue(new Promise((r) => (resolve = r))), { seen: '1' });
    m = createMessenger(el, ctx, { navigate: vi.fn(), now: () => NOW });
    expect(el.textContent).toContain('Connecting…');
    expect(el.textContent).toContain('Online');
    resolve([raw(2), raw(1)]);
    await m.ready;
    expect(el.querySelector('.bapp-messenger-new')?.textContent).toBe('new');
    expect(el.querySelector('time')?.textContent).toBe('3 h ago');
    const btn = el.querySelector('button.bapp-messenger-reply') as HTMLButtonElement;
    expect(btn.textContent).toBe('Reply');
    expect(btn.getAttribute('aria-label')).toBe('Reply to Author 1');
    expect(el.querySelector('[role="log"]')?.getAttribute('aria-label')).toBe('Conversation');
    expect(ctx.setTitle).toHaveBeenCalledWith('Oh-Oh! Messenger (1)');
  });

  it('état vide et erreur en anglais', async () => {
    setLang('en');
    await start(fakeCtx(vi.fn().mockResolvedValue([])));
    expect(el.textContent).toContain('No messages yet. Be the first to comment!');
    m?.destroy();
    await start(fakeCtx(vi.fn().mockRejectedValue(new Error('x'))));
    expect(el.textContent).toContain('Could not reach the server.');
    expect(el.querySelector('button')?.textContent).toBe('Try again');
  });
});
