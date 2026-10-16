import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppContext } from '../../core/types';
import { createMessenger, type Messenger } from './view';

const NOW = new Date('2024-06-15T12:00:00Z');

function raw(id: number, extra: Record<string, unknown> = {}) {
  return {
    id,
    author_name: `Auteur ${id}`,
    date_gmt: '2024-06-15T09:00:00',
    content: { rendered: `<p>Message ${id}</p>` },
    link: `https://ex.com/billet-${id}/#comment-${id}`,
    post: id,
    ...extra,
  };
}

function fakeCtx(fetchJson: AppContext['fetchJson'], seed: Record<string, string> = {}) {
  const store = new Map(Object.entries(seed));
  const ctx = {
    config: { restUrl: 'https://ex.com/wp-json/', locale: 'fr_FR' },
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
  return { ctx, store };
}

let el: HTMLElement;
let m: Messenger | undefined;
const navigate = vi.fn();

beforeEach(() => {
  el = document.createElement('div');
  document.body.append(el);
  navigate.mockReset();
});
afterEach(() => {
  m?.destroy();
  m = undefined;
  el.remove();
});

const start = async (ctx: AppContext) => {
  m = createMessenger(el, ctx, { navigate, now: () => NOW });
  await m.ready;
};

describe('Oh-Oh! Messenger', () => {
  it('demande les bons commentaires', async () => {
    const f = vi.fn().mockResolvedValue([]);
    await start(fakeCtx(f).ctx);
    expect(f).toHaveBeenCalledWith(
      'https://ex.com/wp-json/wp/v2/comments?per_page=10&status=approve&_fields=id,author_name,date_gmt,content,link,post&order=desc',
    );
  });

  it('affiche l’état de chargement puis la conversation, ancien en haut', async () => {
    let resolve!: (v: unknown) => void;
    const f = vi.fn().mockReturnValue(new Promise((r) => (resolve = r)));
    const { ctx } = fakeCtx(f);
    m = createMessenger(el, ctx, { navigate, now: () => NOW });
    expect(el.textContent).toContain('Connexion…');
    expect(el.textContent).toContain('Oh-Oh! Messenger');
    resolve([raw(3), raw(2), raw(1)]);
    await m.ready;
    const bubbles = el.querySelectorAll('.bapp-messenger-bubble');
    expect(bubbles).toHaveLength(3);
    expect(bubbles[0]!.textContent).toContain('Auteur 1');
    expect(bubbles[2]!.textContent).toContain('Auteur 3');
    expect(bubbles[2]!.textContent).toContain('Message 3');
    expect(bubbles[2]!.textContent).toContain('il y a 3 h');
    expect(el.textContent).not.toContain('Connexion…');
    expect(el.textContent).toContain('En ligne');
  });

  it('expose un journal accessible et des boutons nommés', async () => {
    await start(fakeCtx(vi.fn().mockResolvedValue([raw(1)])).ctx);
    const log = el.querySelector('[role="log"]');
    expect(log?.getAttribute('aria-live')).toBe('polite');
    const btn = el.querySelector('button.bapp-messenger-reply') as HTMLButtonElement;
    expect(btn.textContent).toBe('Répondre');
    expect(btn.getAttribute('aria-label')).toBe('Répondre à Auteur 1');
  });

  it('marque les nouveaux, joue le son une fois, change le titre, met à jour seen', async () => {
    const f = vi.fn().mockResolvedValue([raw(5), raw(4), raw(3)]);
    const { ctx, store } = fakeCtx(f, { seen: '3' });
    await start(ctx);
    expect(el.querySelectorAll('.bapp-messenger-new')).toHaveLength(2);
    const bubbles = el.querySelectorAll('.bapp-messenger-bubble');
    expect(bubbles[0]!.querySelector('.bapp-messenger-new')).toBeNull();
    expect(bubbles[1]!.querySelector('.bapp-messenger-new')?.textContent).toBe('nouveau');
    expect(ctx.playSound).toHaveBeenCalledTimes(1);
    expect(ctx.playSound).toHaveBeenCalledWith('ohoh');
    expect(ctx.setTitle).toHaveBeenCalledWith('Oh-Oh! Messenger (2)');
    expect(store.get('seen')).toBe('5');
  });

  it('rien de nouveau : pas de son, titre simple', async () => {
    const { ctx, store } = fakeCtx(vi.fn().mockResolvedValue([raw(2), raw(1)]), { seen: '2' });
    await start(ctx);
    expect(ctx.playSound).not.toHaveBeenCalled();
    expect(el.querySelector('.bapp-messenger-new')).toBeNull();
    expect(ctx.setTitle).not.toHaveBeenCalledWith(expect.stringContaining('('));
    expect(store.get('seen')).toBe('2');
  });

  it('défile jusqu’en bas', async () => {
    const { ctx } = fakeCtx(vi.fn().mockResolvedValue([raw(2), raw(1)]));
    const spy = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(999);
    await start(ctx);
    expect((el.querySelector('[role="log"]') as HTMLElement).scrollTop).toBe(999);
    spy.mockRestore();
  });

  it('Répondre ouvre le formulaire de commentaire du billet', async () => {
    await start(fakeCtx(vi.fn().mockResolvedValue([raw(7)])).ctx);
    (el.querySelector('button.bapp-messenger-reply') as HTMLButtonElement).click();
    expect(navigate).toHaveBeenCalledWith('https://ex.com/billet-7/#respond');
  });

  it('état vide', async () => {
    const { ctx, store } = fakeCtx(vi.fn().mockResolvedValue([]));
    await start(ctx);
    expect(el.textContent).toContain('Aucun message pour le moment. Soyez le premier à commenter !');
    expect(el.querySelector('button')).toBeNull();
    expect(ctx.playSound).not.toHaveBeenCalled();
    expect(store.has('seen')).toBe(false);
  });

  it('erreur puis Réessayer, sans reprise automatique', async () => {
    const f = vi.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce([raw(1)]);
    await start(fakeCtx(f).ctx);
    expect(el.textContent).toContain('Impossible de joindre le serveur.');
    expect(f).toHaveBeenCalledTimes(1);
    const retry = el.querySelector('button') as HTMLButtonElement;
    expect(retry.textContent).toBe('Réessayer');
    retry.click();
    expect(el.textContent).toContain('Connexion…');
    await vi.waitFor(() => expect(el.querySelectorAll('.bapp-messenger-bubble')).toHaveLength(1));
    expect(f).toHaveBeenCalledTimes(2);
    expect(el.textContent).not.toContain('Impossible');
  });

  it('une réponse JSON absurde donne l’état vide', async () => {
    await start(fakeCtx(vi.fn().mockResolvedValue({ code: 'rest_forbidden' })).ctx);
    expect(el.textContent).toContain('Aucun message pour le moment.');
  });

  it('contenu hostile : texte inerte', async () => {
    const hostile = raw(1, {
      author_name: '<img src=x onerror=alert(1)>',
      content: { rendered: '<img src=x onerror=alert(1)><script>alert(2)</script><b>gras</b> &lt;i&gt;' },
    });
    await start(fakeCtx(vi.fn().mockResolvedValue([hostile])).ctx);
    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('script')).toBeNull();
    expect(el.querySelector('b')).toBeNull();
    const body = el.querySelector('.bapp-messenger-text') as HTMLElement;
    expect(body.textContent).toBe('gras <i>');
  });

  it('destroy : une réponse tardive ne touche plus rien', async () => {
    let resolve!: (v: unknown) => void;
    const f = vi.fn().mockReturnValue(new Promise((r) => (resolve = r)));
    const { ctx, store } = fakeCtx(f);
    m = createMessenger(el, ctx, { navigate, now: () => NOW });
    m.destroy();
    resolve([raw(1)]);
    await m.ready;
    expect(el.children).toHaveLength(0);
    expect(ctx.playSound).not.toHaveBeenCalled();
    expect(store.has('seen')).toBe(false);
  });
});
