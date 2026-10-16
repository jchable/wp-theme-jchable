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

describe('préférences de l’écran de veille', () => {
  it('par défaut : le tunnel néon, après 3 minutes', () => {
    const prefs = createPrefs(null).get();
    expect(prefs.saver).toBe('tunnel');
    expect(prefs.saverDelay).toBe(3);
  });

  it('mémorise la scène et le délai choisis', () => {
    const storage = new MemoryStorage();
    createPrefs(storage).update((p) => {
      p.saver = 'voxel';
      p.saverDelay = 10;
    });
    const got = createPrefs(storage).get();
    expect(got.saver).toBe('voxel');
    expect(got.saverDelay).toBe(10);
  });

  it('écarte une scène inconnue et un délai absurde venus du stockage', () => {
    const storage = new MemoryStorage();
    storage.setItem(PREFS_KEY, JSON.stringify({ v: 1, saver: 'hologramme', saverDelay: -5 }));
    const got = createPrefs(storage).get();
    expect(got.saver).toBe('tunnel');
    expect(got.saverDelay).toBe(3);
  });

  it('un écran de veille retiré (planète, badge JC) retombe sur le tunnel', () => {
    const storage = new MemoryStorage();
    for (const gone of ['planet', 'classic']) {
      storage.setItem(PREFS_KEY, JSON.stringify({ v: 1, saver: gone }));
      expect(createPrefs(storage).get().saver).toBe('tunnel');
    }
  });

  it('un délai valide est conservé, un délai non listé retombe sur 3', () => {
    const storage = new MemoryStorage();
    storage.setItem(PREFS_KEY, JSON.stringify({ v: 1, saverDelay: 5 }));
    expect(createPrefs(storage).get().saverDelay).toBe(5);
    storage.setItem(PREFS_KEY, JSON.stringify({ v: 1, saverDelay: 7 }));
    expect(createPrefs(storage).get().saverDelay).toBe(3);
  });
});
