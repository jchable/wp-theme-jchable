import { describe, expect, it } from 'vitest';
import { soundScript } from './sound';

describe('soundScript', () => {
  it('chaque son a au moins une note valide', () => {
    for (const name of ['ohoh', 'recycle', 'ding', 'error'] as const) {
      const tones = soundScript(name);
      expect(tones.length).toBeGreaterThan(0);
      for (const tone of tones) {
        expect(tone.from).toBeGreaterThan(0);
        expect(tone.to).toBeGreaterThan(0);
        expect(tone.duration).toBeGreaterThan(0);
        expect(tone.delay).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('« oh-oh » est une descente en deux temps', () => {
    const [first, second] = soundScript('ohoh');
    expect(second!.from).toBeLessThan(first!.from);
    expect(second!.delay).toBeGreaterThan(first!.duration);
  });
});
