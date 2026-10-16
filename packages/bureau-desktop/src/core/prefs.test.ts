import { describe, expect, it } from 'vitest';
import { createPrefs, createAppStorage, DEFAULT_PREFS, PREFS_KEY } from './prefs';

class FakeStorage implements Storage {
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

const throwingStorage = (): Storage =>
  new Proxy(new FakeStorage(), {
    get() {
      return () => {
        throw new Error('stockage bloqué');
      };
    },
  });

describe('createPrefs', () => {
  it('renvoie les valeurs par défaut sans stockage', () => {
    const prefs = createPrefs(null);
    expect(prefs.get()).toEqual(DEFAULT_PREFS);
  });

  it('enregistre et relit les positions des icônes', () => {
    const storage = new FakeStorage();
    createPrefs(storage).update((p) => {
      p.icons['terminal'] = { col: 2, row: 3 };
    });
    expect(createPrefs(storage).get().icons['terminal']).toEqual({ col: 2, row: 3 });
  });

  it('ignore un JSON corrompu', () => {
    const storage = new FakeStorage();
    storage.setItem(PREFS_KEY, '{pas du json');
    expect(createPrefs(storage).get()).toEqual(DEFAULT_PREFS);
  });

  it('ignore une autre version du format', () => {
    const storage = new FakeStorage();
    storage.setItem(PREFS_KEY, JSON.stringify({ v: 99, sound: false }));
    expect(createPrefs(storage).get().sound).toBe(true);
  });

  it('ne lève jamais quand le stockage est bloqué et garde les valeurs en mémoire', () => {
    const prefs = createPrefs(throwingStorage());
    prefs.update((p) => {
      p.sound = false;
    });
    expect(prefs.get().sound).toBe(false);
  });

  it('nettoie les valeurs invalides venues du stockage', () => {
    const storage = new FakeStorage();
    storage.setItem(
      PREFS_KEY,
      JSON.stringify({
        v: 1,
        icons: { ok: { col: 1, row: 2 }, mauvais: { col: 'x', row: -4 }, __proto__: { col: 1, row: 1 } },
        windows: { w: { x: 'a', y: 10, minimized: 'oui' } },
        sound: 'peut-être',
        screensaver: false,
      }),
    );
    const got = createPrefs(storage).get();
    expect(got.icons).toEqual({ ok: { col: 1, row: 2 } });
    expect(got.windows).toEqual({});
    expect(got.sound).toBe(true);
    expect(got.screensaver).toBe(false);
  });

  it('reset remet les positions des icônes à zéro mais garde les réglages', () => {
    const prefs = createPrefs(new FakeStorage());
    prefs.update((p) => {
      p.icons['a'] = { col: 1, row: 1 };
      p.sound = false;
    });
    prefs.resetIcons();
    expect(prefs.get().icons).toEqual({});
    expect(prefs.get().sound).toBe(false);
  });

  it('notifie les abonnés à chaque mise à jour', () => {
    const prefs = createPrefs(null);
    let calls = 0;
    prefs.subscribe(() => calls++);
    prefs.update((p) => {
      p.sound = false;
    });
    expect(calls).toBe(1);
  });
});

describe('createAppStorage', () => {
  it('préfixe les clés par appli et se comporte comme un stockage', () => {
    const storage = new FakeStorage();
    const a = createAppStorage('wordpad', storage);
    const b = createAppStorage('terminal', storage);
    a.set('draft', 'x');
    expect(a.get('draft')).toBe('x');
    expect(b.get('draft')).toBeNull();
    a.remove('draft');
    expect(a.get('draft')).toBeNull();
  });

  it('garde en mémoire quand le stockage est bloqué', () => {
    const a = createAppStorage('wordpad', throwingStorage());
    a.set('draft', 'x');
    expect(a.get('draft')).toBe('x');
  });
});
