/**
 * Chargement de DOOM : fonctions pures ou à dépendances injectées, testables sans WebAssembly réel.
 * Le moteur (Chocolate Doom compilé par Emscripten) et le WAD vivent dans assets/doom/ du thème.
 */

/** Fichiers servis par `doomBaseUrl` (voir themes/jchable-bureau/assets/doom/README.md). */
export const DOOM_FILES = {
  engineJs: 'websockets-doom.js',
  engineWasm: 'websockets-doom.wasm',
  wad: 'doom1.wad',
} as const;

export type DoomFile = keyof typeof DOOM_FILES;

/**
 * Tailles connues (octets, non compressées) : servent de total quand le serveur n'envoie pas
 * de Content-Length (réponse compressée par Cloudflare, par exemple).
 */
export const EXPECTED_SIZES: Readonly<Record<DoomFile, number>> = {
  engineJs: 196_367,
  engineWasm: 2_250_555,
  wad: 4_196_020,
};

export type DoomUrls = Readonly<Record<DoomFile, string>>;

/**
 * Construit les adresses des fichiers à partir du dossier `doomBaseUrl`.
 * Tolère l'absence de « / » final ; refuse tout ce qui n'est pas http(s).
 */
export function buildDoomUrls(baseUrl: string, documentBase?: string): DoomUrls {
  const raw = baseUrl.trim();
  if (raw === '') throw new Error('Adresse du dossier DOOM absente (doomBaseUrl).');
  let base: URL;
  try {
    base = documentBase === undefined ? new URL(raw) : new URL(raw, documentBase);
  } catch {
    throw new Error(`Adresse du dossier DOOM invalide : ${raw}`);
  }
  if (base.protocol !== 'http:' && base.protocol !== 'https:') {
    throw new Error(`Protocole refusé pour le dossier DOOM : ${base.protocol}`);
  }
  base.search = '';
  base.hash = '';
  if (!base.pathname.endsWith('/')) base.pathname += '/';
  const at = (name: string): string => new URL(name, base).href;
  return {
    engineJs: at(DOOM_FILES.engineJs),
    engineWasm: at(DOOM_FILES.engineWasm),
    wad: at(DOOM_FILES.wad),
  };
}

/** Avancement d'un téléchargement. `total` vaut null quand il est inconnu. */
export interface PartProgress {
  loaded: number;
  total: number | null;
}

/**
 * Pourcentage global (0–100, entier) pondéré par la taille de chaque fichier.
 * Total inconnu : on prend la taille attendue, sans jamais descendre sous ce qui est déjà reçu.
 */
export function computeProgress(
  parts: Readonly<Partial<Record<DoomFile, PartProgress>>>,
  expected: Readonly<Record<DoomFile, number>> = EXPECTED_SIZES,
): number {
  let loaded = 0;
  let total = 0;
  for (const key of Object.keys(expected) as DoomFile[]) {
    const part = parts[key];
    const partLoaded = Math.max(0, part?.loaded ?? 0);
    const declared = part?.total != null && part.total > 0 ? part.total : expected[key];
    const partTotal = Math.max(declared, partLoaded);
    loaded += Math.min(partLoaded, partTotal);
    total += partTotal;
  }
  if (total <= 0) return 0;
  return Math.min(100, Math.floor((loaded / total) * 100));
}

/** Lit l'en-tête Content-Length ; null s'il est absent, invalide, ou si la réponse est compressée. */
export function contentLength(headers: Headers): number | null {
  if (headers.get('content-encoding')) return null; // la taille annoncée ne correspond pas aux octets décodés
  const value = headers.get('content-length');
  if (value === null || !/^\d+$/.test(value.trim())) return null;
  const n = Number(value);
  return n > 0 ? n : null;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class HttpError extends Error {
  constructor(
    readonly url: string,
    readonly status: number,
  ) {
    super(`HTTP ${status} pour ${url}`);
    this.name = 'HttpError';
  }
}

async function checkedFetch(fetchImpl: FetchLike, url: string, signal?: AbortSignal): Promise<Response> {
  const response = await fetchImpl(url, { signal, credentials: 'same-origin' });
  if (!response.ok) throw new HttpError(url, response.status);
  return response;
}

/** Lit tout le corps en signalant l'avancement ; repli sur arrayBuffer() si le flux n'est pas lisible. */
export async function readBody(
  response: Response,
  onProgress: (p: PartProgress) => void,
): Promise<Uint8Array> {
  const total = contentLength(response.headers);
  const reader = response.body?.getReader();
  if (!reader) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    onProgress({ loaded: bytes.byteLength, total: bytes.byteLength });
    return bytes;
  }
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  onProgress({ loaded, total });
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    onProgress({ loaded, total });
  }
  const out = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  onProgress({ loaded, total: loaded });
  return out;
}

/** Télécharge un fichier entier avec suivi d'avancement. */
export async function fetchBytes(
  url: string,
  onProgress: (p: PartProgress) => void,
  fetchImpl: FetchLike,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  return readBody(await checkedFetch(fetchImpl, url, signal), onProgress);
}

/** Sous-ensemble de l'objet global WebAssembly utilisé ici (injectable dans les tests). */
export interface WasmApi {
  compile(bytes: BufferSource): Promise<WebAssembly.Module>;
  compileStreaming?: (source: Response | PromiseLike<Response>) => Promise<WebAssembly.Module>;
}

export type WasmStrategy = 'streaming' | 'arrayBuffer';

/**
 * Compilation en flux seulement si le navigateur la propose ET si le serveur annonce le bon type MIME
 * (sinon le navigateur la refuse : TypeError « Incorrect response MIME type »).
 */
export function pickWasmStrategy(hasStreaming: boolean, contentType: string | null): WasmStrategy {
  if (!hasStreaming) return 'arrayBuffer';
  const mime = (contentType ?? '').split(';')[0]?.trim().toLowerCase();
  return mime === 'application/wasm' ? 'streaming' : 'arrayBuffer';
}

/**
 * Faut-il retenter en téléchargeant les octets après un échec de la compilation en flux ?
 * Oui pour une erreur de type (MIME, réponse non « basic »…), non pour une annulation
 * ou un binaire réellement invalide (CompileError : réessayer donnerait la même erreur).
 */
export function shouldRetryWithArrayBuffer(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') return false;
  if (typeof WebAssembly !== 'undefined' && error instanceof WebAssembly.CompileError) return false;
  if (error instanceof Error && (error.name === 'CompileError' || error.name === 'AbortError')) return false;
  return error instanceof TypeError || (error instanceof Error && /mime|content-type/i.test(error.message));
}

/**
 * Télécharge et compile le module WebAssembly (sans l'instancier : les imports viennent du moteur).
 * Essaie compileStreaming ; repli sur compile(octets) si le type MIME est faux ou si le flux échoue.
 * Dans tous les cas l'avancement est signalé (le flux est compté au passage).
 */
export async function compileWasm(
  url: string,
  deps: { fetch: FetchLike; wasm: WasmApi; onProgress: (p: PartProgress) => void; signal?: AbortSignal },
): Promise<WebAssembly.Module> {
  const { fetch: fetchImpl, wasm, onProgress, signal } = deps;
  const response = await checkedFetch(fetchImpl, url, signal);
  const streaming = typeof wasm.compileStreaming === 'function' ? wasm.compileStreaming.bind(wasm) : null;
  if (streaming && pickWasmStrategy(true, response.headers.get('content-type')) === 'streaming' && response.body) {
    try {
      return await streaming(countingResponse(response, onProgress));
    } catch (error) {
      if (!shouldRetryWithArrayBuffer(error)) throw error;
      // Le corps est consommé : on retélécharge (le cache HTTP sert normalement la seconde requête).
      return wasm.compile(toBufferSource(await fetchBytes(url, onProgress, fetchImpl, signal)));
    }
  }
  return wasm.compile(toBufferSource(await readBody(response, onProgress)));
}

/** Recopie une réponse en comptant les octets qui passent (le type MIME d'origine est conservé). */
function countingResponse(response: Response, onProgress: (p: PartProgress) => void): Response {
  const total = contentLength(response.headers);
  let loaded = 0;
  onProgress({ loaded, total });
  const counter = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      loaded += chunk.byteLength;
      onProgress({ loaded, total });
      controller.enqueue(chunk);
    },
    flush() {
      onProgress({ loaded, total: loaded });
    },
  });
  const body = (response.body as ReadableStream<Uint8Array>).pipeThrough(counter);
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

function toBufferSource(bytes: Uint8Array): ArrayBuffer {
  return bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength && bytes.buffer instanceof ArrayBuffer
    ? bytes.buffer
    : bytes.slice().buffer;
}

/** Texte de l'erreur montré dans « Détails techniques » : nom, message, et cause éventuelle. */
export function formatError(error: unknown): string {
  const lines: string[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current !== undefined && current !== null; depth++) {
    if (current instanceof Error) {
      const name = current.name && current.name !== 'Error' ? `${current.name} : ` : '';
      lines.push(`${name}${current.message || '(sans message)'}`);
      current = (current as Error & { cause?: unknown }).cause;
    } else if (typeof current === 'string') {
      lines.push(current || '(sans message)');
      current = undefined;
    } else {
      let text: string;
      try {
        text = JSON.stringify(current) ?? String(current);
      } catch {
        text = String(current);
      }
      lines.push(text);
      current = undefined;
    }
  }
  if (lines.length === 0) lines.push('Erreur inconnue');
  return lines.map((line, i) => (i === 0 ? line : `Cause : ${line}`)).join('\n');
}

/** Message court et compréhensible, selon le type d'erreur. */
export function describeError(error: unknown): string {
  if (error instanceof HttpError) {
    return error.status === 404
      ? 'Un fichier du jeu est introuvable sur le serveur.'
      : 'Le serveur a refusé de fournir les fichiers du jeu.';
  }
  if (error instanceof TypeError && /fetch|network|réseau/i.test(error.message)) {
    return 'Les fichiers du jeu n’ont pas pu être téléchargés (réseau).';
  }
  if (typeof WebAssembly === 'undefined') return 'Ce navigateur ne sait pas exécuter WebAssembly.';
  return 'Le moteur du jeu s’est arrêté de façon inattendue.';
}

/**
 * Touches dont le navigateur ne doit pas faire son action par défaut (défilement, aide F1, recherche F3…).
 * Les caractères imprimables simples restent libres : le moteur en a besoin (texte des sauvegardes)
 * et ils ne déclenchent aucune action de page.
 */
export function shouldPreventDefault(event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'altKey' | 'metaKey'>): boolean {
  if (event.ctrlKey || event.altKey || event.metaKey) return true;
  if (event.key === ' ' || event.key === 'Spacebar') return true;
  return [...event.key].length !== 1;
}

/** Raccourci qui rend le clavier à la page (pas de piège clavier) : Alt+Q. */
export function isReleaseShortcut(event: Pick<KeyboardEvent, 'code' | 'altKey' | 'ctrlKey' | 'metaKey'>): boolean {
  return event.altKey && !event.ctrlKey && !event.metaKey && event.code === 'KeyQ';
}

/** Arguments de la ligne de commande de Chocolate Doom. */
export function engineArgs(): string[] {
  // -nomusic : l'émulation OPL de la musique bloque le fil principal dans cette version (bruitages conservés).
  return ['-iwad', DOOM_FILES.wad, '-window', '-nogui', '-nomouse', '-nomusic', '-config', 'default.cfg'];
}

/** Configuration écrite dans le système de fichiers du moteur avant le démarrage (sans souris). */
export const DEFAULT_CFG = [
  ['use_mouse', '0'],
  ['grabmouse', '0'],
  ['fullscreen', '0'],
  ['startup_delay', '0'],
  ['show_diskicon', '1'],
  ['sfx_volume', '8'],
  ['music_volume', '8'],
  ['show_messages', '1'],
  ['key_right', '77'],
  ['key_left', '75'],
  ['key_up', '72'],
  ['key_down', '80'],
  ['key_strafeleft', '51'],
  ['key_straferight', '52'],
  ['key_fire', '29'],
  ['key_use', '57'],
  ['key_strafe', '56'],
  ['key_speed', '54'],
  ['use_joystick', '0'],
  ['screenblocks', '10'],
  ['detaillevel', '0'],
  ['snd_channels', '8'],
  ['snd_musicdevice', '3'],
  ['snd_sfxdevice', '3'],
  ['usegamma', '0'],
]
  .map(([k, v]) => `${(k ?? '').padEnd(30)}${v ?? ''}`)
  .join('\n')
  .concat('\n');
