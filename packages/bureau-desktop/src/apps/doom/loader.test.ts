import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_CFG,
  EXPECTED_SIZES,
  HttpError,
  buildDoomUrls,
  compileWasm,
  computeProgress,
  contentLength,
  describeError,
  engineArgs,
  fetchBytes,
  formatError,
  isReleaseShortcut,
  pickWasmStrategy,
  shouldPreventDefault,
  shouldRetryWithArrayBuffer,
  type FetchLike,
  type PartProgress,
  type WasmApi,
} from './loader';

const FAKE_MODULE = {} as WebAssembly.Module;

function response(body: Uint8Array<ArrayBuffer> | null, headers: Record<string, string> = {}, status = 200): Response {
  return new Response(body, { status, headers });
}

function fakeWasm(overrides: Partial<WasmApi> = {}): WasmApi & { compile: ReturnType<typeof vi.fn> } {
  const compile = vi.fn(async () => FAKE_MODULE);
  return { compile, ...overrides } as WasmApi & { compile: ReturnType<typeof vi.fn> };
}

describe('buildDoomUrls', () => {
  it('ajoute le / final manquant', () => {
    expect(buildDoomUrls('https://exemple.fr/wp-content/themes/jchable-bureau/assets/doom')).toEqual({
      engineJs: 'https://exemple.fr/wp-content/themes/jchable-bureau/assets/doom/websockets-doom.js',
      engineWasm: 'https://exemple.fr/wp-content/themes/jchable-bureau/assets/doom/websockets-doom.wasm',
      wad: 'https://exemple.fr/wp-content/themes/jchable-bureau/assets/doom/doom1.wad',
    });
  });

  it('garde un / final existant et ignore la requête et l’ancre', () => {
    const urls = buildDoomUrls('http://localhost:8888/doom/?ver=1#x');
    expect(urls.wad).toBe('http://localhost:8888/doom/doom1.wad');
  });

  it('résout une adresse relative par rapport au document', () => {
    expect(buildDoomUrls('/assets/doom', 'https://exemple.fr/blog/').engineJs).toBe(
      'https://exemple.fr/assets/doom/websockets-doom.js',
    );
  });

  it.each(['javascript:alert(1)', 'data:text/plain,x', 'file:///C:/doom/', 'ftp://exemple.fr/doom/'])(
    'refuse le protocole de %s',
    (url) => {
      expect(() => buildDoomUrls(url)).toThrow(/Protocole refusé/);
    },
  );

  it('refuse une adresse vide ou invalide', () => {
    expect(() => buildDoomUrls('   ')).toThrow(/absente/);
    expect(() => buildDoomUrls('pas une url')).toThrow(/invalide/);
  });
});

describe('computeProgress', () => {
  const expected = { engineJs: 100, engineWasm: 300, wad: 600 };

  it('vaut 0 au départ et 100 à la fin', () => {
    expect(computeProgress({}, expected)).toBe(0);
    expect(
      computeProgress(
        { engineJs: { loaded: 100, total: 100 }, engineWasm: { loaded: 300, total: 300 }, wad: { loaded: 600, total: 600 } },
        expected,
      ),
    ).toBe(100);
  });

  it('pondère par la taille et utilise la taille attendue si le total est inconnu', () => {
    expect(computeProgress({ wad: { loaded: 300, total: null } }, expected)).toBe(30);
    expect(computeProgress({ engineJs: { loaded: 50, total: 100 } }, expected)).toBe(5);
  });

  it('préfère le Content-Length annoncé à la taille attendue', () => {
    expect(computeProgress({ wad: { loaded: 600, total: 1200 } }, expected)).toBe(37); // 600 / (100+300+1200)
  });

  it('ne dépasse jamais 100 même si le fichier est plus gros que prévu', () => {
    const p = computeProgress(
      { engineJs: { loaded: 500, total: null }, engineWasm: { loaded: 300, total: 300 }, wad: { loaded: 600, total: 600 } },
      expected,
    );
    expect(p).toBe(100);
  });

  it('utilise par défaut les tailles réelles des fichiers livrés', () => {
    expect(EXPECTED_SIZES.wad).toBe(4_196_020);
    expect(computeProgress({ wad: { loaded: EXPECTED_SIZES.wad, total: null } })).toBeGreaterThan(60);
  });
});

describe('contentLength', () => {
  it('lit une taille valide', () => {
    expect(contentLength(new Headers({ 'content-length': '42' }))).toBe(42);
  });

  it('ignore une taille absente, invalide, nulle ou d’une réponse compressée', () => {
    expect(contentLength(new Headers())).toBeNull();
    expect(contentLength(new Headers({ 'content-length': 'abc' }))).toBeNull();
    expect(contentLength(new Headers({ 'content-length': '0' }))).toBeNull();
    expect(contentLength(new Headers({ 'content-length': '42', 'content-encoding': 'br' }))).toBeNull();
  });
});

describe('fetchBytes', () => {
  it('assemble les morceaux et signale l’avancement', async () => {
    const chunks = [new Uint8Array([1, 2]), new Uint8Array([3])];
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const c of chunks) controller.enqueue(c);
        controller.close();
      },
    });
    const fetchImpl: FetchLike = async () => new Response(stream, { headers: { 'content-length': '3' } });
    const seen: PartProgress[] = [];
    const bytes = await fetchBytes('https://x/doom1.wad', (p) => seen.push({ ...p }), fetchImpl);
    expect([...bytes]).toEqual([1, 2, 3]);
    expect(seen[0]).toEqual({ loaded: 0, total: 3 });
    expect(seen.at(-1)).toEqual({ loaded: 3, total: 3 });
  });

  it('rejette une réponse HTTP en erreur', async () => {
    const fetchImpl: FetchLike = async () => response(null, {}, 404);
    await expect(fetchBytes('https://x/doom1.wad', () => {}, fetchImpl)).rejects.toBeInstanceOf(HttpError);
  });
});

describe('pickWasmStrategy', () => {
  it('compile en flux seulement avec le bon type MIME', () => {
    expect(pickWasmStrategy(true, 'application/wasm')).toBe('streaming');
    expect(pickWasmStrategy(true, 'Application/WASM; charset=binary')).toBe('streaming');
  });

  it('se replie sur les octets si le MIME est faux ou si le flux n’existe pas', () => {
    expect(pickWasmStrategy(true, 'application/octet-stream')).toBe('arrayBuffer');
    expect(pickWasmStrategy(true, null)).toBe('arrayBuffer');
    expect(pickWasmStrategy(false, 'application/wasm')).toBe('arrayBuffer');
  });
});

describe('shouldRetryWithArrayBuffer', () => {
  it('retente après une erreur de type (MIME refusé)', () => {
    expect(shouldRetryWithArrayBuffer(new TypeError("WebAssembly: Incorrect response MIME type. Expected 'application/wasm'."))).toBe(true);
  });

  it('ne retente pas une annulation ni un binaire invalide', () => {
    expect(shouldRetryWithArrayBuffer(new DOMException('stop', 'AbortError'))).toBe(false);
    expect(shouldRetryWithArrayBuffer(new WebAssembly.CompileError('bad magic'))).toBe(false);
    expect(shouldRetryWithArrayBuffer(new Error('autre'))).toBe(false);
  });
});

describe('compileWasm', () => {
  const url = 'https://x/websockets-doom.wasm';
  const bytes = new Uint8Array([0, 97, 115, 109]);

  it('utilise compileStreaming quand le serveur annonce application/wasm', async () => {
    const compileStreaming = vi.fn(async (source: Response | PromiseLike<Response>) => {
      await (await source).arrayBuffer(); // consomme le flux compté
      return FAKE_MODULE;
    });
    const wasm = fakeWasm({ compileStreaming });
    const fetchImpl = vi.fn<FetchLike>(async () => response(bytes, { 'content-type': 'application/wasm' }));
    const seen: PartProgress[] = [];
    await expect(compileWasm(url, { fetch: fetchImpl, wasm, onProgress: (p) => seen.push(p) })).resolves.toBe(FAKE_MODULE);
    expect(compileStreaming).toHaveBeenCalledOnce();
    expect(wasm.compile).not.toHaveBeenCalled();
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(seen.at(-1)).toEqual({ loaded: 4, total: 4 });
  });

  it('compile les octets directement si le type MIME est faux', async () => {
    const compileStreaming = vi.fn(async () => FAKE_MODULE);
    const wasm = fakeWasm({ compileStreaming });
    const fetchImpl = vi.fn<FetchLike>(async () => response(bytes, { 'content-type': 'application/octet-stream' }));
    await compileWasm(url, { fetch: fetchImpl, wasm, onProgress: () => {} });
    expect(compileStreaming).not.toHaveBeenCalled();
    expect(wasm.compile).toHaveBeenCalledOnce();
    expect(new Uint8Array(wasm.compile.mock.calls[0]?.[0] as ArrayBuffer)).toEqual(bytes);
  });

  it('retélécharge et compile les octets si compileStreaming échoue sur une TypeError', async () => {
    const compileStreaming = vi.fn(async () => {
      throw new TypeError('Incorrect response MIME type');
    });
    const wasm = fakeWasm({ compileStreaming });
    const fetchImpl = vi.fn<FetchLike>(async () => response(bytes, { 'content-type': 'application/wasm' }));
    await expect(compileWasm(url, { fetch: fetchImpl, wasm, onProgress: () => {} })).resolves.toBe(FAKE_MODULE);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(wasm.compile).toHaveBeenCalledOnce();
  });

  it('propage une CompileError sans réessayer', async () => {
    const compileStreaming = vi.fn(async () => {
      throw new WebAssembly.CompileError('bad magic');
    });
    const wasm = fakeWasm({ compileStreaming });
    const fetchImpl = vi.fn<FetchLike>(async () => response(bytes, { 'content-type': 'application/wasm' }));
    await expect(compileWasm(url, { fetch: fetchImpl, wasm, onProgress: () => {} })).rejects.toBeInstanceOf(
      WebAssembly.CompileError,
    );
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(wasm.compile).not.toHaveBeenCalled();
  });

  it('se passe de compileStreaming quand le navigateur ne l’a pas', async () => {
    const wasm = fakeWasm();
    const fetchImpl = vi.fn<FetchLike>(async () => response(bytes, { 'content-type': 'application/wasm' }));
    await compileWasm(url, { fetch: fetchImpl, wasm, onProgress: () => {} });
    expect(wasm.compile).toHaveBeenCalledOnce();
  });
});

describe('formatError / describeError', () => {
  it('donne le nom, le message et la cause', () => {
    const error = new Error('échec', { cause: new TypeError('Failed to fetch') });
    expect(formatError(error)).toBe('échec\nCause : TypeError : Failed to fetch');
  });

  it('accepte les chaînes, objets et valeurs vides', () => {
    expect(formatError('abort')).toBe('abort');
    expect(formatError({ code: 7 })).toBe('{"code":7}');
    expect(formatError(undefined)).toBe('Erreur inconnue');
    expect(formatError(new Error(''))).toBe('(sans message)');
  });

  it('explique simplement les cas courants', () => {
    expect(describeError(new HttpError('https://x/doom1.wad', 404))).toMatch(/introuvable/);
    expect(describeError(new HttpError('https://x/doom1.wad', 500))).toMatch(/refusé/);
    expect(describeError(new TypeError('Failed to fetch'))).toMatch(/réseau/);
    expect(describeError(new Error('abort(42)'))).toMatch(/moteur/);
  });
});

describe('clavier', () => {
  const key = (k: string, mods: Partial<Pick<KeyboardEvent, 'ctrlKey' | 'altKey' | 'metaKey'>> = {}) => ({
    key: k,
    ctrlKey: false,
    altKey: false,
    metaKey: false,
    ...mods,
  });

  it('bloque l’action par défaut des touches de jeu et de navigation', () => {
    for (const k of ['ArrowUp', 'ArrowDown', ' ', 'Escape', 'Tab', 'F1', 'F3', 'Control', 'PageDown', 'Enter']) {
      expect(shouldPreventDefault(key(k))).toBe(true);
    }
    expect(shouldPreventDefault(key('f', { ctrlKey: true }))).toBe(true);
  });

  it('laisse passer les caractères imprimables (saisie du nom de sauvegarde)', () => {
    expect(shouldPreventDefault(key('a'))).toBe(false);
    expect(shouldPreventDefault(key('é'))).toBe(false);
  });

  it('reconnaît Alt+Q pour rendre le clavier', () => {
    const ev = (code: string, mods: Partial<Pick<KeyboardEvent, 'ctrlKey' | 'altKey' | 'metaKey'>>) => ({
      code,
      ctrlKey: false,
      altKey: false,
      metaKey: false,
      ...mods,
    });
    expect(isReleaseShortcut(ev('KeyQ', { altKey: true }))).toBe(true);
    expect(isReleaseShortcut(ev('KeyQ', {}))).toBe(false);
    expect(isReleaseShortcut(ev('KeyQ', { altKey: true, ctrlKey: true }))).toBe(false);
  });
});

describe('configuration du moteur', () => {
  it('lance le WAD shareware sans souris ni musique', () => {
    const args = engineArgs();
    expect(args.slice(0, 2)).toEqual(['-iwad', 'doom1.wad']);
    expect(args).toContain('-nomouse');
    expect(args).toContain('-nomusic');
  });

  it('écrit une configuration sans souris, touches classiques', () => {
    expect(DEFAULT_CFG).toMatch(/^use_mouse\s+0$/m);
    expect(DEFAULT_CFG).toMatch(/^key_fire\s+29$/m);
    expect(DEFAULT_CFG.endsWith('\n')).toBe(true);
  });
});
