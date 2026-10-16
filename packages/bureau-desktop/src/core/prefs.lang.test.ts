import { describe, expect, it } from 'vitest';
import { PREFS_KEY, createPrefs } from './prefs';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length(): number {
    return this.data.size;
  }
  clear(): void {
    this.data.clear();
  }
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

describe('préférence de langue', () => {
  it('« auto » par défaut', () => {
    expect(createPrefs(null).get().lang).toBe('auto');
  });

  it('mémorise le choix du visiteur', () => {
    const storage = new MemoryStorage();
    createPrefs(storage).update((p) => {
      p.lang = 'en';
    });
    expect(createPrefs(storage).get().lang).toBe('en');
  });

  it('écarte une valeur inconnue venue du stockage', () => {
    const storage = new MemoryStorage();
    storage.setItem(PREFS_KEY, JSON.stringify({ v: 1, lang: 'klingon' }));
    expect(createPrefs(storage).get().lang).toBe('auto');
  });
});
