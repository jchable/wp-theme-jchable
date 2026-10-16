/**
 * DOOM.EXE : Chocolate Doom (WebAssembly) dans une fenêtre du bureau.
 *
 * Le moteur Emscripten tourne dans une iframe jetable, sans accès à l'origine du blog.
 * Fermer la fenêtre = fermer l'audio puis retirer l'iframe, ce qui arrête sa boucle et libère sa mémoire.
 * Les fichiers (moteur .js, .wasm, doom1.wad) sont téléchargés ici, avec barre d'avancement,
 * puis donnés à l'iframe : aucune autre requête réseau.
 */
import type { AppContext } from '../../core/types';
import {
  DEFAULT_CFG,
  DOOM_FILES,
  buildDoomUrls,
  computeProgress,
  describeError,
  engineArgs,
  fetchBytes,
  formatError,
  type DoomFile,
  type PartProgress,
} from './loader';
import { buildAbout } from './about';
import { buildFrameHtml } from './frame';
import { t } from './i18n';
import { getLang } from '../../core/i18n';
import './style.css';

const MUTE_KEY = 'muted';
const LOG_LINES = 12;
let labelCounter = 0;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

class DoomSession {
  private readonly root = el('div', 'bapp-doom');
  private readonly stage = el('div', 'bapp-doom-stage');
  private readonly fullscreenBtn = el('button', 'bapp-doom-btn', t('fullscreen'));
  private readonly soundBtn = el('button', 'bapp-doom-btn');
  private readonly aboutBtn = el('button', 'bapp-doom-btn', t('about'));
  private readonly closeBtn = el('button', 'bapp-doom-btn', t('close'));
  private readonly hint = el('button', 'bapp-doom-hint');
  /** Retire tous les écouteurs (page et iframe) d'un coup. */
  private readonly listeners = new AbortController();
  /** Annule les téléchargements en cours. */
  private readonly downloads = new AbortController();
  private readonly log: string[] = [];
  private iframe: HTMLIFrameElement | null = null;
  private port: MessagePort | null = null;
  private loadTimer: ReturnType<typeof setTimeout> | null = null;
  private focused = false;
  private muted: boolean;
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
    strip.setAttribute('aria-label', t('controls'));
    for (const button of [this.fullscreenBtn, this.soundBtn, this.aboutBtn, this.closeBtn]) button.type = 'button';
    this.fullscreenBtn.disabled = true;
    this.updateSoundButton();
    strip.append(this.fullscreenBtn, this.soundBtn, this.aboutBtn, this.closeBtn);
    this.root.append(this.stage, strip);
    this.host.replaceChildren(this.root);

    const signal = this.listeners.signal;
    this.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen(), { signal });
    this.soundBtn.addEventListener('click', () => this.toggleSound(), { signal });
    this.closeBtn.addEventListener('click', () => this.ctx.close(), { signal });
    this.aboutBtn.addEventListener('click', () => this.toggleAbout(), { signal });
    this.hint.type = 'button';
    this.hint.append(
      el('span', 'bapp-doom-hint-main', t('hintMain')),
      el('span', 'bapp-doom-hint-sub', t('hintSub')),
    );
    this.hint.addEventListener('click', () => this.focusGame(), { signal });

    this.loadTimer = setTimeout(() => this.fail(new Error(t('loadTimeout'))), 90_000);
    void this.load().catch((error: unknown) => this.fail(error));
  }

  // ---------- À propos (licences, code source) ----------

  private about: HTMLElement | null = null;

  private toggleAbout(): void {
    if (this.about) {
      this.about.remove();
      this.about = null;
      this.aboutBtn.focus();
      return;
    }
    const panel = buildAbout(this.ctx.config.doomBaseUrl);
    panel.querySelector('.bapp-doom-about-close')?.addEventListener('click', () => this.toggleAbout(), { signal: this.listeners.signal });
    this.root.append(panel);
    this.about = panel;
    panel.querySelector<HTMLElement>('a')?.focus();
  }

  // ---------- Chargement ----------

  private async load(): Promise<void> {
    if (typeof WebAssembly === 'undefined') throw new Error(t('wasmUnavailable'));
    const urls = buildDoomUrls(this.ctx.config.doomBaseUrl, document.baseURI);
    const progress = this.showProgress();
    const parts: Partial<Record<DoomFile, PartProgress>> = {};
    const track = (key: DoomFile) => (p: PartProgress) => {
      parts[key] = p;
      progress(computeProgress(parts));
    };
    const fetchImpl = window.fetch.bind(window);
    const signal = this.downloads.signal;
    const [script, wasm, wad] = await Promise.all([
      fetchBytes(urls.engineJs, track('engineJs'), fetchImpl, signal, 'engineJs').then((b) => new TextDecoder().decode(b)),
      fetchBytes(urls.engineWasm, track('engineWasm'), fetchImpl, signal, 'engineWasm'),
      fetchBytes(urls.wad, track('wad'), fetchImpl, signal),
    ]);
    if (this.disposed || this.failed) return;
    progress(100);
    await this.boot(script, wasm, wad);
  }

  private showProgress(): (percent: number) => void {
    const box = el('div', 'bapp-doom-loading');
    const label = el('p', 'bapp-doom-loading-label', t('loading'));
    label.id = `bapp-doom-label-${++labelCounter}`;
    const bar = el('progress', 'bapp-doom-progress');
    bar.max = 100;
    bar.value = 0;
    bar.setAttribute('aria-labelledby', label.id);
    const value = el('p', 'bapp-doom-loading-value', t('percent', { n: 0 }));
    box.append(label, bar, value);
    this.stage.replaceChildren(box);
    let last = -1;
    return (percent) => {
      if (percent === last || this.disposed) return;
      last = percent;
      bar.value = percent;
      value.textContent = t('percent', { n: percent });
    };
  }

  // ---------- Démarrage du moteur dans l'iframe ----------

  private async boot(script: string, wasm: Uint8Array, wad: Uint8Array): Promise<void> {
    const iframe = el('iframe', 'bapp-doom-frame');
    iframe.title = 'DOOM';
    iframe.setAttribute('sandbox', 'allow-scripts');
    iframe.setAttribute('allow', 'autoplay; fullscreen');
    iframe.referrerPolicy = 'no-referrer';
    iframe.srcdoc = buildFrameHtml(getLang(), t('frameCanvasLabel'), {
      parentOrigin: location.origin,
      config: DEFAULT_CFG,
      args: engineArgs(),
      wadName: DOOM_FILES.wad,
      muted: this.muted,
    });
    const loaded = new Promise<void>((resolve) => iframe.addEventListener('load', () => resolve(), { once: true }));
    this.stage.replaceChildren(iframe, this.hint);
    this.iframe = iframe;
    await loaded;
    if (this.disposed || this.failed) return;
    if (!iframe.contentWindow) throw new Error(t('frameUnreachable'));
    const channel = new MessageChannel();
    this.port = channel.port1;
    this.port.onmessage = (event: MessageEvent<unknown>) => this.onFrameMessage(event.data);
    this.port.onmessageerror = () => this.fail(new Error(t('frameUnreachable')));
    iframe.contentWindow.postMessage({ type: 'doom:init', script, wasm, wad }, '*', [channel.port2]);
    document.addEventListener('fullscreenchange', () => this.onFullscreenChange(), { signal: this.listeners.signal });
  }

  private onFrameMessage(data: unknown): void {
    if (this.disposed || this.failed || !data || typeof data !== 'object' || !('type' in data)) return;
    const value = 'value' in data ? data.value : undefined;
    switch (data.type) {
      case 'ready':
        if (this.loadTimer !== null) clearTimeout(this.loadTimer);
        this.loadTimer = null;
        this.fullscreenBtn.disabled = false;
        break;
      case 'log':
        if (typeof value === 'string') this.remember(value.slice(0, 2000));
        break;
      case 'error':
        if (typeof value === 'string') this.fail(new Error(value.slice(0, 2000)));
        break;
      case 'exit':
        if (value === 0) this.ctx.close();
        else if (typeof value === 'number') this.fail(new Error(t('engineStopped', { code: value })));
        break;
      case 'focus':
        if (typeof value === 'boolean') this.focused = value;
        this.updateHint();
        break;
      case 'release':
        this.focused = false;
        this.fullscreenBtn.focus({ preventScroll: true });
        this.updateHint();
        break;
    }
  }

  // ---------- Clavier, focus, son ----------

  private focusGame(): void {
    if (!this.iframe || this.failed) return;
    this.iframe.focus();
    this.port?.postMessage({ type: 'focus' });
  }

  private updateHint(): void {
    // L'état de focus se stabilise après l'événement : on relit au tour suivant.
    queueMicrotask(() => {
      if (this.disposed) return;
      this.hint.hidden = (this.focused && document.activeElement === this.iframe) || this.failed;
    });
  }

  private toggleSound(): void {
    this.muted = !this.muted;
    this.ctx.storage.set(MUTE_KEY, this.muted ? '1' : '0');
    this.updateSoundButton();
    this.port?.postMessage({ type: 'mute', value: this.muted });
  }

  private updateSoundButton(): void {
    this.soundBtn.textContent = this.muted ? t('soundOff') : t('soundOn');
    this.soundBtn.setAttribute('aria-label', this.muted ? t('soundOffLabel') : t('soundOnLabel'));
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
      () => this.remember(t('fullscreenDenied')),
    );
  }

  private onFullscreenChange(): void {
    this.fullscreenBtn.textContent = document.fullscreenElement === this.iframe ? t('exitFullscreen') : t('fullscreen');
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
    const technical = [formatError(error), ...(this.log.length ? ['', t('engineLog'), ...this.log] : [])].join('\n');
    this.teardownEngine();
    this.fullscreenBtn.disabled = true;

    const panel = el('div', 'bapp-doom-error');
    panel.setAttribute('role', 'alert');
    const title = el('p', 'bapp-doom-error-title', t('crashTitle'));
    const reason = el('p', 'bapp-doom-error-text', describeError(error));
    const details = el('details', 'bapp-doom-error-details');
    details.append(el('summary', undefined, t('technicalDetails')), el('pre', 'bapp-doom-error-pre', technical));
    const close = el('button', 'bapp-doom-btn', t('close'));
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
    if (this.loadTimer !== null) clearTimeout(this.loadTimer);
    this.loadTimer = null;
    if (this.iframe && document.fullscreenElement === this.iframe) void document.exitFullscreen().catch(() => {});
    this.port?.postMessage({ type: 'dispose' });
    this.port?.close();
    this.port = null;
    this.iframe?.remove();
    this.iframe = null;
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
    el.textContent = t('crashInline', { detail: formatError(error) });
  }
}

export function unmount(): void {
  session?.dispose();
  session = null;
}
