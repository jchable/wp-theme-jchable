import { beforeEach, describe, expect, it } from 'vitest';
import { MAX_ACTIVE_SECONDS, createMatomoTrack, createUsageTracker, diffSettings } from './analytics';
import type { Track } from './analytics';
import type { DesktopSettings } from './types';

type PaqWindow = Window & { _paq?: unknown[] };

describe('createMatomoTrack', () => {
  beforeEach(() => {
    delete (window as PaqWindow)._paq;
  });

  it('pousse un événement dans la file de Matomo, catégorie « Bureau »', () => {
    const paq: unknown[] = [];
    (window as PaqWindow)._paq = paq;
    createMatomoTrack()('Ouverture', 'calculator');
    expect(paq).toEqual([['trackEvent', 'Bureau', 'Ouverture', 'calculator']]);
  });

  it('transmet la valeur (la durée en secondes)', () => {
    const paq: unknown[] = [];
    (window as PaqWindow)._paq = paq;
    createMatomoTrack()('Durée active', 'paint', 42);
    expect(paq).toEqual([['trackEvent', 'Bureau', 'Durée active', 'paint', 42]]);
  });

  it('ne fait rien, sans erreur, quand Matomo n’est pas installé', () => {
    expect(() => createMatomoTrack()('Ouverture', 'calculator')).not.toThrow();
    expect((window as PaqWindow)._paq).toBeUndefined();
  });

  it('retrouve la file de Matomo même si elle apparaît après la création', () => {
    const track = createMatomoTrack();
    const paq: unknown[] = [];
    (window as PaqWindow)._paq = paq;
    track('Ouverture', 'terminal');
    expect(paq).toHaveLength(1);
  });

  it('ne laisse jamais passer une erreur de Matomo', () => {
    (window as PaqWindow)._paq = {
      push: () => {
        throw new Error('boom');
      },
    } as unknown as unknown[];
    expect(() => createMatomoTrack()('Ouverture', 'calculator')).not.toThrow();
  });
});

interface Sent {
  action: string;
  name: string | undefined;
  value: number | undefined;
}

function harness() {
  const sent: Sent[] = [];
  const track: Track = (action, name, value) => sent.push({ action, name, value });
  let clock = 0;
  const tracker = createUsageTracker({ track, now: () => clock });
  const wait = (seconds: number): void => {
    clock += seconds * 1000;
  };
  const win = (id: string, active = false, minimized = false) => ({ id, minimized, active });
  return { sent, tracker, wait, win };
}

describe('createUsageTracker', () => {
  it('compte une ouverture quand une fenêtre apparaît, pas quand elle revient au premier plan', () => {
    const { sent, tracker, win } = harness();
    tracker.sync([win('calculator', true)]);
    tracker.sync([win('calculator', true), win('paint', true)]);
    tracker.sync([win('paint'), win('calculator', true)]);
    expect(sent.filter((e) => e.action === 'Ouverture').map((e) => e.name)).toEqual(['calculator', 'paint']);
  });

  it('envoie la durée active à la fermeture, en secondes', () => {
    const { sent, tracker, wait, win } = harness();
    tracker.sync([win('paint', true)]);
    wait(90);
    tracker.sync([]);
    expect(sent).toContainEqual({ action: 'Durée active', name: 'paint', value: 90 });
  });

  it('ne compte que le temps où la fenêtre est au premier plan', () => {
    const { sent, tracker, wait, win } = harness();
    tracker.sync([win('paint', true)]);
    wait(10);
    tracker.sync([win('paint'), win('terminal', true)]); // le terminal passe devant
    wait(100);
    tracker.sync([win('paint', true), win('terminal')]);
    wait(5);
    tracker.sync([win('terminal')]);
    wait(1);
    tracker.sync([]);
    const duration = (name: string) => sent.find((e) => e.action === 'Durée active' && e.name === name)?.value;
    expect(duration('paint')).toBe(15);
    expect(duration('terminal')).toBe(100);
  });

  it('ne compte pas le temps d’une fenêtre réduite', () => {
    const { sent, tracker, wait, win } = harness();
    tracker.sync([win('paint', true)]);
    wait(10);
    tracker.sync([win('paint', false, true)]);
    wait(300);
    tracker.sync([win('paint', true)]);
    wait(5);
    tracker.sync([]);
    expect(sent).toContainEqual({ action: 'Durée active', name: 'paint', value: 15 });
  });

  it('ne compte pas le temps où l’onglet est caché ou l’écran de veille tourne', () => {
    const { sent, tracker, wait, win } = harness();
    tracker.sync([win('paint', true)]);
    wait(10);
    tracker.setVisible(false);
    wait(600);
    tracker.setVisible(true);
    wait(5);
    tracker.setPaused(true);
    wait(600);
    tracker.setPaused(false);
    wait(5);
    tracker.sync([]);
    expect(sent).toContainEqual({ action: 'Durée active', name: 'paint', value: 20 });
  });

  it('n’envoie pas de durée pour une ouverture de moins d’une seconde', () => {
    const { sent, tracker, wait, win } = harness();
    tracker.sync([win('paint', true)]);
    wait(0.4);
    tracker.sync([]);
    expect(sent.map((e) => e.action)).toEqual(['Ouverture']);
  });

  it('plafonne la durée d’un envoi (fenêtre oubliée au premier plan)', () => {
    const { sent, tracker, wait, win } = harness();
    tracker.sync([win('doom', true)]);
    wait(MAX_ACTIVE_SECONDS * 10);
    tracker.sync([]);
    expect(sent).toContainEqual({ action: 'Durée active', name: 'doom', value: MAX_ACTIVE_SECONDS });
  });

  it('flush envoie le temps cumulé des fenêtres encore ouvertes, puis repart de zéro', () => {
    const { sent, tracker, wait, win } = harness();
    tracker.sync([win('paint', true)]);
    wait(30);
    tracker.flush();
    expect(sent).toContainEqual({ action: 'Durée active', name: 'paint', value: 30 });
    wait(10);
    tracker.sync([]);
    const durations = sent.filter((e) => e.action === 'Durée active').map((e) => e.value);
    expect(durations).toEqual([30, 10]); // pas de double comptage
  });

  it('flush n’envoie rien quand rien n’a été utilisé', () => {
    const { sent, tracker, win } = harness();
    tracker.sync([win('paint', true)]);
    tracker.flush();
    expect(sent.filter((e) => e.action === 'Durée active')).toEqual([]);
  });
});

describe('diffSettings', () => {
  const base: DesktopSettings = { lang: 'auto', sound: false, screensaver: true, saverScene: 'voxel', saverDelayMin: 5 };

  it('ne retient que ce qui a changé', () => {
    expect(diffSettings(base, { ...base, saverScene: 'tunnel', sound: true })).toEqual(['sound=on', 'saverScene=tunnel']);
  });

  it('exprime les réglages oui/non et le délai en clair', () => {
    expect(diffSettings(base, { ...base, screensaver: false, saverDelayMin: 15, lang: 'en' })).toEqual([
      'lang=en',
      'screensaver=off',
      'saverDelayMin=15',
    ]);
  });

  it('ne retient rien quand tout est identique', () => {
    expect(diffSettings(base, { ...base })).toEqual([]);
  });
});
