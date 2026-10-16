import type { SoundName } from './types';

export interface Tone {
  /** Fréquence de départ en Hz. */
  from: number;
  /** Fréquence d'arrivée en Hz (glissando). */
  to: number;
  /** Durée en secondes. */
  duration: number;
  /** Retard avant le début, en secondes. */
  delay: number;
  type: OscillatorType;
}

/** Partition de chaque son : de petits bips synthétisés, aucun fichier audio. */
export function soundScript(name: SoundName): Tone[] {
  switch (name) {
    case 'ohoh':
      return [
        { from: 880, to: 880, duration: 0.14, delay: 0, type: 'triangle' },
        { from: 660, to: 587, duration: 0.24, delay: 0.17, type: 'triangle' },
      ];
    case 'recycle':
      return [{ from: 520, to: 70, duration: 0.45, delay: 0, type: 'sawtooth' }];
    case 'ding':
      return [{ from: 1318, to: 1318, duration: 0.3, delay: 0, type: 'sine' }];
    case 'error':
      return [
        { from: 220, to: 220, duration: 0.18, delay: 0, type: 'square' },
        { from: 196, to: 196, duration: 0.26, delay: 0.22, type: 'square' },
      ];
  }
}

export interface SoundPlayer {
  play(name: SoundName): void;
}

/**
 * Les sons ne partent qu'après un premier geste du visiteur (règle des navigateurs)
 * et seulement si le son est activé dans ses préférences.
 */
export function createSound(isEnabled: () => boolean, doc: Document = document): SoundPlayer {
  let context: AudioContext | null = null;
  let unlocked = false;

  const unlock = (): void => {
    if (unlocked) return;
    unlocked = true;
    for (const type of ['pointerdown', 'keydown'] as const) doc.removeEventListener(type, unlock, true);
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctor) context = new Ctor();
    } catch {
      context = null;
    }
  };
  for (const type of ['pointerdown', 'keydown'] as const) doc.addEventListener(type, unlock, true);

  return {
    play(name) {
      if (!isEnabled() || !context) return;
      const audio = context;
      if (audio.state === 'suspended') void audio.resume().catch(() => undefined);
      const now = audio.currentTime;
      for (const tone of soundScript(name)) {
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        oscillator.type = tone.type;
        const start = now + tone.delay;
        oscillator.frequency.setValueAtTime(tone.from, start);
        oscillator.frequency.exponentialRampToValueAtTime(Math.max(tone.to, 1), start + tone.duration);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.15, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.duration);
        oscillator.connect(gain).connect(audio.destination);
        oscillator.start(start);
        oscillator.stop(start + tone.duration + 0.02);
      }
    },
  };
}
