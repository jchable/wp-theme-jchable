import type { LangPref } from './i18n';
import { DEFAULT_SCENE, isSceneId } from '../ui/screensaver/scenes/catalog';
import type { SceneId } from '../ui/screensaver/scenes/types';
import type { AppStorage } from './types';

/** Clé du localStorage. Une nouvelle version du format repart des valeurs par défaut. */
export const PREFS_KEY = 'jchable-bureau:v1';

export interface IconPos {
  col: number;
  row: number;
}

export interface WinPos {
  x: number;
  y: number;
  minimized: boolean;
}

export interface Prefs {
  v: 1;
  icons: Record<string, IconPos>;
  windows: Record<string, WinPos>;
  sound: boolean;
  screensaver: boolean;
  /** Langue de l'interface : « auto » suit le navigateur. */
  lang: LangPref;
  /** Écran de veille choisi et délai d'inactivité (en minutes). */
  saver: SceneId;
  saverDelay: number;
  seen: Record<string, string | boolean>;
}

/** Délais d'inactivité proposés (minutes). */
export const SAVER_DELAYS: readonly number[] = [1, 2, 3, 5, 10, 15, 30];

export const DEFAULT_PREFS: Prefs = {
  v: 1,
  icons: {},
  windows: {},
  sound: true,
  screensaver: true,
  lang: 'auto',
  saver: DEFAULT_SCENE,
  saverDelay: 3,
  seen: {},
};

export interface PrefsApi {
  get(): Readonly<Prefs>;
  update(change: (prefs: Prefs) => void): void;
  resetIcons(): void;
  subscribe(listener: () => void): () => void;
}

const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < 10_000;

const isCoordinate = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && Math.abs(value) < 100_000;

function cleanIcons(raw: unknown): Record<string, IconPos> {
  const out: Record<string, IconPos> = {};
  if (!isRecord(raw)) return out;
  for (const [id, value] of Object.entries(raw)) {
    if (UNSAFE_KEYS.has(id) || !isRecord(value)) continue;
    if (isCount(value['col']) && isCount(value['row'])) out[id] = { col: value['col'], row: value['row'] };
  }
  return out;
}

function cleanWindows(raw: unknown): Record<string, WinPos> {
  const out: Record<string, WinPos> = {};
  if (!isRecord(raw)) return out;
  for (const [id, value] of Object.entries(raw)) {
    if (UNSAFE_KEYS.has(id) || !isRecord(value)) continue;
    if (isCoordinate(value['x']) && isCoordinate(value['y']) && typeof value['minimized'] === 'boolean') {
      out[id] = { x: value['x'], y: value['y'], minimized: value['minimized'] };
    }
  }
  return out;
}

function cleanSeen(raw: unknown): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  if (!isRecord(raw)) return out;
  for (const [key, value] of Object.entries(raw)) {
    if (UNSAFE_KEYS.has(key)) continue;
    if (typeof value === 'boolean' || (typeof value === 'string' && value.length < 200)) out[key] = value;
  }
  return out;
}

/** Remet en forme ce qui vient du stockage : tout ce qui n'est pas valide est écarté. */
export function sanitizePrefs(raw: unknown): Prefs {
  if (!isRecord(raw) || raw['v'] !== 1) return structuredClone(DEFAULT_PREFS);
  return {
    v: 1,
    icons: cleanIcons(raw['icons']),
    windows: cleanWindows(raw['windows']),
    sound: typeof raw['sound'] === 'boolean' ? raw['sound'] : DEFAULT_PREFS.sound,
    screensaver: typeof raw['screensaver'] === 'boolean' ? raw['screensaver'] : DEFAULT_PREFS.screensaver,
    lang: raw['lang'] === 'fr' || raw['lang'] === 'en' ? raw['lang'] : 'auto',
    saver: isSceneId(raw['saver']) ? raw['saver'] : DEFAULT_SCENE,
    saverDelay: SAVER_DELAYS.includes(raw['saverDelay'] as number) ? (raw['saverDelay'] as number) : DEFAULT_PREFS.saverDelay,
    seen: cleanSeen(raw['seen']),
  };
}

function readPrefs(storage: Storage | null): Prefs {
  if (!storage) return structuredClone(DEFAULT_PREFS);
  try {
    const text = storage.getItem(PREFS_KEY);
    return text ? sanitizePrefs(JSON.parse(text)) : structuredClone(DEFAULT_PREFS);
  } catch {
    return structuredClone(DEFAULT_PREFS);
  }
}

/**
 * Préférences du visiteur, gardées dans le navigateur (localStorage) et jamais envoyées au serveur.
 * Si le stockage est bloqué (navigation privée…), tout continue en mémoire.
 */
export function createPrefs(storage: Storage | null): PrefsApi {
  let current = readPrefs(storage);
  const listeners = new Set<() => void>();

  const save = (): void => {
    if (storage) {
      try {
        storage.setItem(PREFS_KEY, JSON.stringify(current));
      } catch {
        /* stockage plein ou bloqué : on garde la valeur en mémoire */
      }
    }
    listeners.forEach((listener) => listener());
  };

  return {
    get: () => current,
    update(change) {
      change(current);
      save();
    },
    resetIcons() {
      current.icons = {};
      save();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** Stockage propre à une appli : clés préfixées, jamais d'exception. */
export function createAppStorage(appId: string, storage: Storage | null): AppStorage {
  const memory = new Map<string, string>();
  const full = (key: string): string => `${PREFS_KEY}:app:${appId}:${key}`;
  return {
    get(key) {
      try {
        const value = storage?.getItem(full(key));
        if (typeof value === 'string') return value;
      } catch {
        /* repli sur la mémoire */
      }
      return memory.get(key) ?? null;
    },
    set(key, value) {
      memory.set(key, value);
      try {
        storage?.setItem(full(key), value);
      } catch {
        /* repli sur la mémoire */
      }
    },
    remove(key) {
      memory.delete(key);
      try {
        storage?.removeItem(full(key));
      } catch {
        /* rien à faire */
      }
    },
  };
}
