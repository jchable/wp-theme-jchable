import { describe, it, expect, vi } from 'vitest';
import { createRunner, PROMPT } from './run';
import type { AppContext, BureauConfig } from '../../core/types';

const config: BureauConfig = {
  homeUrl: 'https://blog.example.org/',
  restUrl: 'https://blog.example.org/wp-json/',
  locale: 'fr_FR',
  assetsUrl: '',
  siteName: 'Mon Blog',
  sitemapUrl: 'https://blog.example.org/archives/',
  feedUrl: '',
  doomBaseUrl: '',
};

const POSTS = [
  { slug: 'premier', title: { rendered: 'L&#8217;&eacute;t&eacute;' }, date: '2024-03-05T10:00:00', link: 'https://blog.example.org/premier/' },
  { slug: 'second', title: { rendered: 'Deux' }, date: '2023-12-31T08:00:00', link: 'https://blog.example.org/second/' },
];

function setup(fetchImpl?: (url: string) => Promise<unknown>) {
  const fetchJson = vi.fn(fetchImpl ?? (async () => POSTS));
  const ctx = {
    config,
    args: {},
    storage: { get: () => null, set: () => undefined, remove: () => undefined },
    setTitle: vi.fn(),
    close: vi.fn(),
    openApp: vi.fn(),
    openBsod: vi.fn(),
    playSound: vi.fn(),
    fetchJson,
  } as unknown as AppContext;
  const lines: string[] = [];
  const clear = vi.fn();
  const navigate = vi.fn();
  const runner = createRunner(ctx, {
    print: (l) => lines.push(l),
    clear,
    navigate,
    now: () => new Date(2024, 5, 1, 12, 0, 0),
  });
  return { ctx, lines, clear, navigate, runner, fetchJson };
}

describe('PROMPT', () => {
  it('vaut C:\\Blog>', () => expect(PROMPT).toBe('C:\\Blog>'));
});

describe('welcome', () => {
  it("affiche le nom du site et l'aide", () => {
    const { runner, lines } = setup();
    runner.welcome();
    expect(lines.join('\n')).toContain('Mon Blog');
    expect(lines.join('\n')).toContain('Tapez help pour la liste des commandes.');
  });
});

describe('run', () => {
  it('ignore une ligne vide', async () => {
    const { runner, lines } = setup();
    await runner.run('   ');
    expect(lines).toEqual([]);
  });

  it('help liste les commandes', async () => {
    const { runner, lines } = setup();
    await runner.run('HELP');
    const text = lines.join('\n');
    for (const c of ['ls', 'cat', 'cd', 'whoami', 'date', 'clear', 'doom', 'wordpad', 'exit']) {
      expect(text).toContain(c);
    }
  });

  it('commande inconnue', async () => {
    const { runner, lines } = setup();
    await runner.run('Xxx foo');
    expect(lines).toEqual(["'xxx' n'est pas reconnu en tant que commande interne ou externe. Tapez help."]);
  });

  it("ls appelle l'API et liste les articles", async () => {
    const { runner, lines, fetchJson } = setup();
    await runner.run('ls');
    expect(fetchJson).toHaveBeenCalledWith('https://blog.example.org/wp-json/wp/v2/posts?per_page=10&_fields=slug,title,date,link');
    expect(lines).toEqual(['05.03.2024  premier.md', '31.12.2023  second.md']);
  });

  it('ls : échec réseau', async () => {
    const { runner, lines } = setup(async () => {
      throw new Error('boom');
    });
    await runner.run('ls');
    expect(lines).toEqual(['Impossible de joindre le serveur.']);
  });

  it('ls : réponse inattendue', async () => {
    const { runner, lines } = setup(async () => ({ oops: true }));
    await runner.run('ls');
    expect(lines).toEqual(['Impossible de joindre le serveur.']);
  });

  it('cat utilise la liste déjà chargée', async () => {
    const { runner, navigate, fetchJson } = setup();
    await runner.run('ls');
    fetchJson.mockClear();
    await runner.run('cat premier');
    expect(fetchJson).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('https://blog.example.org/premier/');
  });

  it('cat accepte le suffixe .md', async () => {
    const { runner, navigate } = setup();
    await runner.run('ls');
    await runner.run('cat second.md');
    expect(navigate).toHaveBeenCalledWith('https://blog.example.org/second/');
  });

  it("cat interroge l'API par slug sinon", async () => {
    const { runner, navigate, fetchJson } = setup(async () => [{ link: 'https://blog.example.org/a-b/' }]);
    await runner.run('cat a b');
    expect(fetchJson).toHaveBeenCalledWith('https://blog.example.org/wp-json/wp/v2/posts?slug=a%20b&_fields=link');
    expect(navigate).toHaveBeenCalledWith('https://blog.example.org/a-b/');
  });

  it('cat : introuvable', async () => {
    const { runner, navigate, lines } = setup(async () => []);
    await runner.run('cat nope');
    expect(navigate).not.toHaveBeenCalled();
    expect(lines).toEqual(['Fichier introuvable : nope']);
  });

  it('cat : erreur réseau', async () => {
    const { runner, lines } = setup(async () => {
      throw new Error('x');
    });
    await runner.run('cat nope');
    expect(lines).toEqual(['Impossible de joindre le serveur.']);
  });

  it('cat sans argument', async () => {
    const { runner, lines } = setup();
    await runner.run('cat');
    expect(lines).toEqual(['Syntaxe : cat <article>']);
  });

  it('cat refuse une adresse non http(s)', async () => {
    const { runner, navigate, lines } = setup(async () => [{ link: 'javascript:alert(1)' }]);
    await runner.run('cat x');
    expect(navigate).not.toHaveBeenCalled();
    expect(lines).toEqual(['Fichier introuvable : x']);
  });

  it('cd archives navigue vers le plan du site', async () => {
    const { runner, navigate } = setup();
    await runner.run('cd ARCHIVES');
    expect(navigate).toHaveBeenCalledWith('https://blog.example.org/archives/');
  });

  it('cd ailleurs', async () => {
    const { runner, navigate, lines } = setup();
    await runner.run('cd windows');
    expect(navigate).not.toHaveBeenCalled();
    expect(lines).toEqual(["Le chemin d'accès spécifié est introuvable."]);
  });

  it('whoami', async () => {
    const { runner, lines } = setup();
    await runner.run('whoami');
    expect(lines).toEqual(['visiteur@blog.example.org']);
  });

  it('date', async () => {
    const { runner, lines } = setup();
    await runner.run('date');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/2024/);
  });

  it('clear', async () => {
    const { runner, clear } = setup();
    await runner.run('clear');
    expect(clear).toHaveBeenCalled();
  });

  it('doom, wordpad, exit', async () => {
    const { runner, ctx } = setup();
    await runner.run('doom');
    await runner.run('wordpad');
    await runner.run('exit');
    expect(ctx.openApp).toHaveBeenCalledWith('doom');
    expect(ctx.openApp).toHaveBeenCalledWith('wordpad');
    expect(ctx.close).toHaveBeenCalled();
  });

  it.each(['sudo rm -rf /', 'rm -rf /', 'RM -RF /', 'format c:', 'format C:'])('gag « %s » : écran bleu', async (cmd) => {
    const { runner, ctx, lines } = setup();
    await runner.run(cmd);
    expect(lines.length).toBeGreaterThan(0);
    expect(ctx.openBsod).toHaveBeenCalledTimes(1);
    expect(vi.mocked(ctx.openBsod).mock.calls[0]?.[0]).toBeTruthy();
  });

  it("rm sans -rf / n'est pas un gag", async () => {
    const { runner, ctx } = setup();
    await runner.run('rm fichier');
    expect(ctx.openBsod).not.toHaveBeenCalled();
  });
});
