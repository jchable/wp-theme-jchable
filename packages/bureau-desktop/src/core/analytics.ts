import type { DesktopSettings } from './types';

/**
 * Mesure d'audience : quelles applis du bureau sont ouvertes, combien de temps, quels réglages sont choisis.
 *
 * Les événements passent par la file `window._paq` du tracker Matomo déjà installé sur le site : sans lui,
 * rien n'est envoyé. Aucun identifiant n'est créé, rien n'est lu dans le contenu des applis, et l'opt-out
 * et le Do Not Track du tracker s'appliquent tels quels.
 */

/** Catégorie des événements Matomo (Comportement → Événements). */
const CATEGORY = 'Bureau';

/** Plafond d'une durée envoyée : une fenêtre oubliée au premier plan ne doit pas fausser les moyennes. */
export const MAX_ACTIVE_SECONDS = 30 * 60;

/** Envoie un événement : l'action, le nom (l'appli, la scène…) et une valeur numérique (secondes). */
export type Track = (action: string, name?: string, value?: number) => void;

/** Une fenêtre telle que la décrit `WindowManager.list()`. */
export interface TrackedWindow {
  id: string;
  minimized: boolean;
  active: boolean;
}

export interface UsageTracker {
  /** À appeler à chaque changement de fenêtres : ouvertures, fermetures, fenêtre au premier plan. */
  sync(windows: readonly TrackedWindow[]): void;
  /** Onglet visible ou caché : le temps d'un onglet caché ne compte pas. */
  setVisible(visible: boolean): void;
  /** Écran de veille en marche : le temps ne compte pas. */
  setPaused(paused: boolean): void;
  /** Envoie le temps cumulé des fenêtres encore ouvertes (le visiteur quitte la page). */
  flush(): void;
}

interface Pusher {
  push(...args: unknown[]): unknown;
}

/** Pousse dans la file de Matomo, retrouvée à chaque appel (le tracker peut arriver après le bureau). */
export function createMatomoTrack(): Track {
  return (action, name, value) => {
    try {
      const paq = (window as Window & { _paq?: Pusher })._paq;
      if (!paq || typeof paq.push !== 'function') return;
      const event: unknown[] = ['trackEvent', CATEGORY, action];
      if (name !== undefined || value !== undefined) event.push(name ?? '');
      if (value !== undefined) event.push(value);
      paq.push(event);
    } catch {
      /* la mesure ne doit jamais gêner le visiteur */
    }
  };
}

export interface UsageTrackerOptions {
  track: Track;
  now?: () => number;
}

/** Temps actif = fenêtre au premier plan, non réduite, onglet visible, écran de veille éteint. */
export function createUsageTracker({ track, now = () => Date.now() }: UsageTrackerOptions): UsageTracker {
  /** Fenêtres ouvertes → millisecondes actives non encore envoyées. */
  const open = new Map<string, number>();
  let activeId: string | null = null;
  let visible = true;
  let paused = false;
  let since = now();

  const focused = (): string | null => (visible && !paused ? activeId : null);

  /** Crédite le temps écoulé à la fenêtre qui avait le focus jusqu'ici. */
  const commit = (): void => {
    const at = now();
    const id = focused();
    if (id !== null && open.has(id)) open.set(id, (open.get(id) ?? 0) + (at - since));
    since = at;
  };

  const send = (id: string): void => {
    const seconds = Math.min(MAX_ACTIVE_SECONDS, Math.round((open.get(id) ?? 0) / 1000));
    if (seconds >= 1) track('Durée active', id, seconds);
    open.set(id, 0);
  };

  return {
    sync(windows) {
      commit();
      const ids = new Set(windows.map((w) => w.id));
      for (const id of open.keys()) {
        if (ids.has(id)) continue;
        send(id);
        open.delete(id);
      }
      for (const id of ids) {
        if (open.has(id)) continue;
        open.set(id, 0);
        track('Ouverture', id);
      }
      activeId = windows.find((w) => w.active && !w.minimized)?.id ?? null;
    },
    setVisible(value) {
      commit();
      visible = value;
    },
    setPaused(value) {
      commit();
      paused = value;
    },
    flush() {
      commit();
      for (const id of open.keys()) send(id);
    },
  };
}

const SETTING_KEYS = ['lang', 'sound', 'screensaver', 'saverScene', 'saverDelayMin'] as const;

function readable(value: DesktopSettings[(typeof SETTING_KEYS)[number]]): string {
  if (typeof value !== 'boolean') return String(value);
  return value ? 'on' : 'off';
}

/** Les réglages modifiés, sous la forme `réglage=valeur` (valeurs d'un jeu fermé : langue, scène, délai, oui/non). */
export function diffSettings(before: Readonly<DesktopSettings>, after: Readonly<DesktopSettings>): string[] {
  return SETTING_KEYS.filter((key) => before[key] !== after[key]).map((key) => `${key}=${readable(after[key])}`);
}
