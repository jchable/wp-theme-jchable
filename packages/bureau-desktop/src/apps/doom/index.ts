/**
 * DOOM.EXE : Chocolate Doom (WebAssembly) dans une fenêtre du bureau.
 *
 * Le moteur Emscripten ne sait pas redémarrer : il tourne dans une <iframe> jetable (srcdoc, même origine).
 * Fermer la fenêtre = fermer l'audio puis retirer l'iframe, ce qui arrête sa boucle et libère sa mémoire.
 * Les fichiers (moteur .js, .wasm, doom1.wad) sont téléchargés ici, avec barre d'avancement,
 * puis donnés à l'iframe : aucune autre requête réseau.
 */
import type { AppContext } from '../../core/types';
import {
  DEFAULT_CFG,
  DOOM_FILES,
  buildDoomUrls,
  compileWasm,
  computeProgress,
  describeError,
  engineArgs,
  fetchBytes,
  formatError,
  isReleaseShortcut,
  shouldPreventDefault,
  type DoomFile,
  type PartProgress,
} from './loader';
import './style.css';

const MUTE_KEY = 'muted';
const LOG_LINES = 12;
let labelCounter = 0;

const FRAME_HTML = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>
html,body{margin:0;height:100%;overflow:hidden;background:#000}
canvas{display:block;width:100%!important;height:100%!important;object-fit:contain;image-rendering:pixelated;outline:none;background:#000}
</style></head><body><canvas id="canvas" tabindex="0" aria-label="Écran du jeu DOOM"></canvas></body></html>`;

/** Ce que le moteur Emscripten lit et écrit sur l'objet Module. */
interface EmscriptenModule {
  canvas: HTMLCanvasElement;
  noInitialRun: boolean;
  preRun: Array<() => void>;
  FS?: { writeFile(path: string, data: string | Uint8Array): void };
  callMain?: (args: string[]) => void;
  SDL2?: { audioContext?: AudioContext };
  instantiateWasm(
    imports: WebAssembly.Imports,
    receive: (instance: WebAssembly.Instance, module: WebAssembly.Module) => void,
  ): Record<string, never>;
  onRuntimeInitialized(): void;
  onExit(code: number): void;
  onAbort(what: unknown): void;
  print(text: string): void;
  printErr(text: string): void;
  setStatus(text: string): void;
}

type FrameWindow = Window & typeof globalThis & { Module?: EmscriptenModule };

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function isExitNoise(error: unknown): boolean {
  if (error === 'unwind') return true;
  return typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'ExitStatus';
}

class DoomSession {
  private readonly root = el('div', 'bapp-doom');
  private readonly stage = el('div', 'bapp-doom-stage');
  private readonly fullscreenBtn = el('button', 'bapp-doom-btn', 'Plein écran');
  private readonly soundBtn = el('button', 'bapp-doom-btn');
  private readonly closeBtn = el('button', 'bapp-doom-btn', 'Fermer');
  private readonly hint = el('button', 'bapp-doom-hint');
  /** Retire tous les écouteurs (page et iframe) d'un coup. */
  private readonly listeners = new AbortController();
  /** Annule les téléchargements en cours. */
  private readonly downloads = new AbortController();
  private readonly audioContexts = new Set<AudioContext>();
  private readonly log: string[] = [];
  private iframe: HTMLIFrameElement | null = null;
  private frameWin: FrameWindow | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private engine: EmscriptenModule | null = null;
  private muted: boolean;
  /** Le son ne démarre qu'après un geste dans le jeu (clic ou touche sur l'invite). */
  private armed = false;
  private failed = false;
  private disposed = false;

  constructor(
    private readonly host: HTMLElement,
    private readonly ctx: AppContext,
  ) {
    this.muted = ctx.storage.get(MUTE_KEY) === '1';
  }

  start(): void {
    this.ctx.setTitle('DOOM.EXE');
    const strip = el('div', 'bapp-doom-strip');
    strip.setAttribute('role', 'toolbar');
    strip.setAttribute('aria-label', 'Commandes de DOOM');
    for (const button of [this.fullscreenBtn, this.soundBtn, this.closeBtn]) button.type = 'button';
    this.fullscreenBtn.disabled = true;
    this.updateSoundButton();
    strip.append(this.fullscreenBtn, this.soundBtn, this.closeBtn);
    this.root.append(this.stage, strip);
    this.host.replaceChildren(this.root);

    const signal = this.listeners.signal;
    this.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen(), { signal });
    this.soundBtn.addEventListener('click', () => this.toggleSound(), { signal });
    this.closeBtn.addEventListener('click', () => this.ctx.close(), { signal });
    this.hint.type = 'button';
    this.hint.append(
      el('span', 'bapp-doom-hint-main', 'Cliquez pour jouer — Échap : menu du jeu'),
      el('span', 'bapp-doom-hint-sub', 'Flèches : se déplacer · Ctrl : tirer · Espace : ouvrir · Alt+Q : rendre le clavier'),
    );
    this.hint.addEventListener('click', () => this.focusGame(), { signal });

    void this.load().catch((error: unknown) => this.fail(error));
  }

  // ---------- Chargement ----------

  private async load(): Promise<void> {
    if (typeof WebAssembly === 'undefined') throw new Error('WebAssembly indisponible dans ce navigateur.');
    const urls = buildDoomUrls(this.ctx.config.doomBaseUrl, document.baseURI);
    const progress = this.showProgress();
    const parts: Partial<Record<DoomFile, PartProgress>> = {};
    const track = (key: DoomFile) => (p: PartProgress) => {
      parts[key] = p;
      progress(computeProgress(parts));
    };
    const fetchImpl = window.fetch.bind(window);
    const signal = this.downloads.signal;
    const [script, wasmModule, wad] = await Promise.all([
      fetchBytes(urls.engineJs, track('engineJs'), fetchImpl, signal).then((b) => new TextDecoder().decode(b)),
      compileWasm(urls.engineWasm, { fetch: fetchImpl, wasm: WebAssembly, onProgress: track('engineWasm'), signal }),
      fetchBytes(urls.wad, track('wad'), fetchImpl, signal),
    ]);
    if (this.disposed) return;
    progress(100);
    await this.boot(script, wasmModule, wad);
  }

  private showProgress(): (percent: number) => void {
    const box = el('div', 'bapp-doom-loading');
    const label = el('p', 'bapp-doom-loading-label', 'Chargement de DOOM…');
    label.id = `bapp-doom-label-${++labelCounter}`;
    const bar = el('progress', 'bapp-doom-progress');
    bar.max = 100;
    bar.value = 0;
    bar.setAttribute('aria-labelledby', label.id);
    const value = el('p', 'bapp-doom-loading-value', '0 %');
    box.append(label, bar, value);
    this.stage.replaceChildren(box);
    let last = -1;
    return (percent) => {
      if (percent === last || this.disposed) return;
      last = percent;
      bar.value = percent;
      value.textContent = `${percent} %`;
    };
  }

  // ---------- Démarrage du moteur dans l'iframe ----------

  private async boot(script: string, wasmModule: WebAssembly.Module, wad: Uint8Array): Promise<void> {
    const iframe = el('iframe', 'bapp-doom-frame');
    iframe.title = 'DOOM';
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
    iframe.setAttribute('allow', 'autoplay; fullscreen');
    iframe.srcdoc = FRAME_HTML;
    const loaded = new Promise<void>((resolve) => iframe.addEventListener('load', () => resolve(), { once: true }));
    this.stage.replaceChildren(iframe, this.hint);
    this.iframe = iframe;
    await loaded;
    if (this.disposed) return;

    const win = iframe.contentWindow as FrameWindow | null;
    const canvas = win?.document.getElementById('canvas');
    if (!win || !(canvas instanceof win.HTMLCanvasElement)) throw new Error('Iframe du jeu inaccessible.');
    this.frameWin = win;
    this.canvas = canvas;
    this.wireFrame(win, canvas);

    const engine: EmscriptenModule = {
      canvas,
      noInitialRun: true,
      preRun: [
        () => {
          const fs = engine.FS;
          if (!fs) throw new Error('Système de fichiers du moteur absent.');
          fs.writeFile(`/${DOOM_FILES.wad}`, wad);
          fs.writeFile('/default.cfg', DEFAULT_CFG);
        },
      ],
      instantiateWasm: (imports, receive) => {
        WebAssembly.instantiate(wasmModule, imports).then(
          (instance) => receive(instance, wasmModule),
          (error: unknown) => this.fail(error),
        );
        return {};
      },
      onRuntimeInitialized: () => {
        if (this.disposed) return;
        try {
          engine.callMain?.(engineArgs());
        } catch (error) {
          if (!isExitNoise(error)) this.fail(error);
        }
        this.fullscreenBtn.disabled = false;
      },
      onExit: (code) => {
        if (this.disposed) return;
        if (code === 0) this.ctx.close();
        else this.fail(new Error(`Le moteur s’est arrêté (code ${code}).`));
      },
      onAbort: (what) => this.fail(what instanceof Error ? what : new Error(`Arrêt du moteur : ${formatError(what)}`)),
      print: (text) => this.remember(text),
      printErr: (text) => this.remember(text),
      setStatus: () => {},
    };
    this.engine = engine;
    win.Module = engine;
    const tag = win.document.createElement('script');
    tag.textContent = script;
    win.document.body.append(tag);
  }

  private wireFrame(win: FrameWindow, canvas: HTMLCanvasElement): void {
    const signal = this.listeners.signal;
    // Le son ne part qu'après un geste : chaque AudioContext créé par le moteur est suivi (et mis en pause).
    const adopt = (audio: AudioContext): void => {
      this.audioContexts.add(audio);
      this.syncAudio();
    };
    const Native = win.AudioContext;
    if (typeof Native === 'function') {
      win.AudioContext = class extends Native {
        constructor(options?: AudioContextOptions) {
          super(options);
          adopt(this);
        }
      };
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.type === 'keydown' && isReleaseShortcut(event)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        this.releaseKeyboard();
        return;
      }
      if (shouldPreventDefault(event)) event.preventDefault();
      if (event.type === 'keydown') this.arm();
    };
    win.addEventListener('keydown', onKey, { capture: true, signal });
    win.addEventListener('keyup', onKey, { capture: true, signal });
    canvas.addEventListener(
      'pointerdown',
      () => {
        canvas.focus();
        this.arm();
      },
      { signal },
    );
    canvas.addEventListener('contextmenu', (event) => event.preventDefault(), { signal });
    win.addEventListener('focus', () => this.updateHint(), { signal });
    win.addEventListener('blur', () => this.updateHint(), { signal });
    win.addEventListener(
      'error',
      (event) => {
        const error: unknown = event.error ?? event.message;
        if (!isExitNoise(error)) this.fail(error);
      },
      { signal },
    );
    win.addEventListener(
      'unhandledrejection',
      (event) => {
        if (!isExitNoise(event.reason)) this.fail(event.reason);
      },
      { signal },
    );
    document.addEventListener('fullscreenchange', () => this.onFullscreenChange(), { signal });
  }

  // ---------- Clavier, focus, son ----------

  private focusGame(): void {
    if (!this.frameWin || !this.canvas || this.failed) return;
    this.frameWin.focus();
    this.canvas.focus({ preventScroll: true });
    this.arm();
    this.updateHint();
  }

  private releaseKeyboard(): void {
    this.canvas?.blur();
    this.fullscreenBtn.focus({ preventScroll: true });
    this.updateHint();
  }

  private gameHasFocus(): boolean {
    return !!this.frameWin && document.activeElement === this.iframe && this.frameWin.document.hasFocus();
  }

  private updateHint(): void {
    // L'état de focus se stabilise après l'événement : on relit au tour suivant.
    queueMicrotask(() => {
      if (this.disposed) return;
      this.hint.hidden = this.gameHasFocus() || this.failed;
    });
  }

  private arm(): void {
    if (this.armed) return;
    this.armed = true;
    this.syncAudio();
  }

  private syncAudio(): void {
    const contexts = new Set(this.audioContexts);
    const sdl = this.engine?.SDL2?.audioContext;
    if (sdl) contexts.add(sdl);
    const play = this.armed && !this.muted && !this.disposed;
    for (const audio of contexts) {
      if (audio.state === 'closed') continue;
      void (play ? audio.resume() : audio.suspend()).catch(() => {});
    }
  }

  private toggleSound(): void {
    this.muted = !this.muted;
    this.ctx.storage.set(MUTE_KEY, this.muted ? '1' : '0');
    this.updateSoundButton();
    this.syncAudio();
  }

  private updateSoundButton(): void {
    this.soundBtn.textContent = this.muted ? 'Son : non' : 'Son : oui';
    this.soundBtn.setAttribute('aria-label', this.muted ? 'Son coupé : activer le son' : 'Son actif : couper le son');
  }

  private toggleFullscreen(): void {
    const iframe = this.iframe;
    if (!iframe) return;
    if (document.fullscreenElement === iframe) {
      void document.exitFullscreen().catch(() => {});
      return;
    }
    if (typeof iframe.requestFullscreen !== 'function') return;
    iframe.requestFullscreen().then(
      () => this.focusGame(),
      () => this.remember('Plein écran refusé par le navigateur.'),
    );
  }

  private onFullscreenChange(): void {
    this.fullscreenBtn.textContent = document.fullscreenElement === this.iframe ? 'Quitter le plein écran' : 'Plein écran';
    this.updateHint();
  }

  private remember(text: string): void {
    this.log.push(text);
    if (this.log.length > LOG_LINES) this.log.shift();
  }

  // ---------- Erreurs ----------

  private fail(error: unknown): void {
    if (this.disposed || this.failed) return;
    if (error instanceof DOMException && error.name === 'AbortError') return;
    this.failed = true;
    const technical = [formatError(error), ...(this.log.length ? ['', 'Derniers messages du moteur :', ...this.log] : [])].join('\n');
    this.teardownEngine();
    this.fullscreenBtn.disabled = true;

    const panel = el('div', 'bapp-doom-error');
    panel.setAttribute('role', 'alert');
    const title = el('p', 'bapp-doom-error-title', 'DOOM.EXE a cessé de fonctionner');
    const reason = el('p', 'bapp-doom-error-text', describeError(error));
    const details = el('details', 'bapp-doom-error-details');
    details.append(el('summary', undefined, 'Détails techniques'), el('pre', 'bapp-doom-error-pre', technical));
    const close = el('button', 'bapp-doom-btn', 'Fermer');
    close.type = 'button';
    close.addEventListener('click', () => this.ctx.close(), { signal: this.listeners.signal });
    panel.append(title, reason, details, close);
    this.stage.replaceChildren(panel);
    try {
      this.ctx.playSound('error');
    } catch {
      /* le son est facultatif */
    }
    close.focus({ preventScroll: true });
  }

  // ---------- Fermeture ----------

  /** Coupe l'audio, retire l'iframe (arrête la boucle du moteur) et oublie toutes les références. */
  private teardownEngine(): void {
    this.downloads.abort();
    const sdl = this.engine?.SDL2?.audioContext;
    if (sdl) this.audioContexts.add(sdl);
    for (const audio of this.audioContexts) {
      if (audio.state !== 'closed') void audio.close().catch(() => {});
    }
    this.audioContexts.clear();
    if (this.iframe && document.fullscreenElement === this.iframe) void document.exitFullscreen().catch(() => {});
    if (this.frameWin) this.frameWin.Module = undefined;
    this.iframe?.remove();
    this.iframe = null;
    this.frameWin = null;
    this.canvas = null;
    this.engine = null;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.teardownEngine();
    this.listeners.abort();
    this.root.remove();
  }
}

let session: DoomSession | null = null;

export function mount(el: HTMLElement, ctx: AppContext): void {
  session?.dispose();
  session = new DoomSession(el, ctx);
  try {
    session.start();
  } catch (error) {
    // start() ne devrait pas lever ; par prudence, rien ne remonte au bureau.
    el.textContent = `DOOM.EXE a cessé de fonctionner : ${formatError(error)}`;
  }
}

export function unmount(): void {
  session?.dispose();
  session = null;
}
