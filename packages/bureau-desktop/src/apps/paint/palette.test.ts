import { describe, expect, it } from 'vitest';
import { missingKeys } from '../../core/i18n';
import { messages } from './i18n';
import { PALETTE } from './palette';

describe('palette de 28 couleurs', () => {
  it('28 couleurs hexadécimales distinctes, en deux rangées de 14', () => {
    expect(PALETTE).toHaveLength(28);
    expect(new Set(PALETTE.map((c) => c.hex)).size).toBe(28);
    for (const c of PALETTE) expect(c.hex).toMatch(/^#[0-9a-f]{6}$/);
  });
  it('noir et blanc aux deux coins gauches comme dans Windows 95', () => {
    expect(PALETTE[0]!.hex).toBe('#000000');
    expect(PALETTE[14]!.hex).toBe('#ffffff');
  });
  it('chaque couleur a un nom dans les deux langues', () => {
    expect(missingKeys(messages)).toEqual([]);
    for (const c of PALETTE) {
      expect(messages.fr).toHaveProperty(c.nameKey);
      expect(messages.en).toHaveProperty(c.nameKey);
    }
  });
});
