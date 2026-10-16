export interface FrameSettings {
  parentOrigin: string;
  config: string;
  args: string[];
  wadName: string;
  muted: boolean;
}

interface FrameModule {
  canvas: HTMLCanvasElement;
  noInitialRun: boolean;
  preRun: Array<() => void>;
  FS?: { writeFile(path: string, data: string | Uint8Array): void };
  callMain?: (args: string[]) => void;
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

// Serialized into srcdoc: keep every runtime dependency inside this function.
export function bootDoomFrame(
  settings: FrameSettings,
  releaseShortcut: typeof isReleaseShortcut,
  preventDefault: typeof shouldPreventDefault,
): void {
  let port: MessagePort | null = null;
  let armed = false;
  let muted = settings.muted;
  let stopped = false;
  const contexts = new Set<AudioContext>();
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  const send = (type: string, value?: string | boolean | number): void => port?.postMessage({ type, value });
  const noise = (error: unknown): boolean =>
    error === 'unwind' || (typeof error === 'object' && error !== null && 'name' in error && error.name === 'ExitStatus');
  const fail = (error: unknown): void => {
    if (!stopped && !noise(error)) send('error', String(error).slice(0, 2000));
  };
  const Native = window.AudioContext;
  const syncAudio = (): void => {
    for (const audio of contexts) {
      if (audio.state !== 'closed') {
        void (armed && !muted && !stopped ? Native.prototype.resume.call(audio) : audio.suspend()).catch(fail);
      }
    }
  };
  const arm = (): void => {
    armed = true;
    syncAudio();
  };
  if (typeof Native === 'function') {
    window.AudioContext = class extends Native {
      constructor(options?: AudioContextOptions) {
        super(options);
        contexts.add(this);
        syncAudio();
      }
      override resume(): Promise<void> {
        return armed && !muted && !stopped ? super.resume() : Promise.resolve();
      }
    };
  }
  const dispose = async (): Promise<void> => {
    stopped = true;
    await Promise.all([...contexts].map((audio) => audio.state === 'closed' ? Promise.resolve() : audio.close()));
    send('disposed');
    port?.close();
  };
  window.addEventListener('pagehide', () => { void dispose().catch(fail); });
  window.addEventListener('error', (event) => fail(event.error ?? event.message));
  window.addEventListener('unhandledrejection', (event) => fail(event.reason));
  const onKey = (event: KeyboardEvent): void => {
    if (event.type === 'keydown' && releaseShortcut(event)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      canvas.blur();
      send('release');
      return;
    }
    if (preventDefault(event)) {
      event.preventDefault();
    }
    if (event.type === 'keydown') arm();
  };
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('keyup', onKey, true);
  canvas.addEventListener('pointerdown', () => { canvas.focus(); arm(); });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  window.addEventListener('focus', () => send('focus', true));
  window.addEventListener('blur', () => send('focus', false));
  window.addEventListener('message', (event: MessageEvent<unknown>) => {
    if (port || event.source !== parent || event.origin !== settings.parentOrigin) return;
    const data = event.data;
    if (!data || typeof data !== 'object' || !('type' in data) || data.type !== 'doom:init' ||
        !('script' in data) || typeof data.script !== 'string' ||
        !('wasm' in data) || !(data.wasm instanceof Uint8Array) ||
        !('wad' in data) || !(data.wad instanceof Uint8Array) || !event.ports[0]) return;
    port = event.ports[0];
    port.onmessage = (message: MessageEvent<unknown>) => {
      const command = message.data;
      if (!command || typeof command !== 'object' || !('type' in command)) return;
      if (command.type === 'focus') {
        canvas.focus();
        arm();
        send('focus', true);
      } else if (command.type === 'mute' && 'value' in command && typeof command.value === 'boolean') {
        muted = command.value;
        syncAudio();
      } else if (command.type === 'dispose') {
        void dispose().catch(fail);
      }
    };
    const wasm = data.wasm;
    const wad = data.wad;
    const engine: FrameModule = {
      canvas,
      noInitialRun: true,
      preRun: [() => {
        if (!engine.FS) throw new Error('DOOM filesystem unavailable');
        engine.FS.writeFile(`/${settings.wadName}`, wad);
        engine.FS.writeFile('/default.cfg', settings.config);
      }],
      instantiateWasm: (imports, receive) => {
        void WebAssembly.instantiate(wasm.slice().buffer, imports).then(({ instance, module }) => receive(instance, module), fail);
        return {};
      },
      onRuntimeInitialized: () => {
        try {
          if (!engine.callMain) throw new Error('DOOM entry point unavailable');
          engine.callMain(settings.args);
        } catch (error) {
          if (!noise(error)) { fail(error); return; }
        }
        send('ready');
      },
      onExit: (code) => send('exit', code),
      onAbort: fail,
      print: (text) => send('log', String(text).slice(0, 2000)),
      printErr: (text) => send('log', String(text).slice(0, 2000)),
      setStatus: () => {},
    };
    (window as Window & { Module?: FrameModule }).Module = engine;
    const script = document.createElement('script');
    script.textContent = data.script;
    document.body.append(script);
  });
}

export function buildFrameHtml(lang: string, label: string, settings: FrameSettings): string {
  const escape = (value: string): string => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const json = JSON.stringify(settings).replace(/</g, '\\u003c');
  return `<!doctype html><html lang="${escape(lang)}"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'unsafe-inline'; connect-src 'none'; base-uri 'none'; form-action 'none'">
<style>html,body{margin:0;height:100%;overflow:hidden;background:#000}canvas{display:block;width:100%!important;height:100%!important;object-fit:contain;image-rendering:pixelated;outline:none;background:#000}</style>
</head><body><canvas id="canvas" tabindex="0" aria-label="${escape(label)}"></canvas>
<script>(${bootDoomFrame.toString()})(${json},${isReleaseShortcut.toString()},${shouldPreventDefault.toString()})</script></body></html>`;
}
import { isReleaseShortcut, shouldPreventDefault } from './loader';
