import { describe, expect, it } from 'vitest';
import { SOURCE_URL, buildAbout } from './about';

describe('À propos de DOOM.EXE (obligations GPL)', () => {
  const panel = buildAbout('https://x.test/wp-content/themes/jchable-bureau/assets/doom/');
  const hrefs = [...panel.querySelectorAll('a')].map((a) => a.getAttribute('href'));

  it('donne le lien vers le code source du moteur, au commit exact', () => {
    expect(SOURCE_URL).toMatch(/github\.com\/cloudflare\/doom-wasm\/tree\/65e0d3ae2ffa604155eebd96ed40da6567bd08f4$/);
    expect(hrefs).toContain(SOURCE_URL);
  });

  it('renvoie vers les licences et le README servis avec le jeu', () => {
    const base = 'https://x.test/wp-content/themes/jchable-bureau/assets/doom/';
    for (const file of ['README.md', 'LICENSE-GPL-2.0.txt', 'LICENSE-DOOM1-SHAREWARE.txt', 'LICENSE-zlib-SDL2.txt', 'LICENSE-Emscripten-MIT-NCSA.txt']) {
      expect(hrefs).toContain(base + file);
    }
  });

  it('les liens s’ouvrent sans donner accès à la page', () => {
    for (const a of panel.querySelectorAll('a')) {
      expect(a.getAttribute('target')).toBe('_blank');
      expect(a.getAttribute('rel')).toContain('noopener');
    }
  });

  it('cite la licence du moteur et le droit de redistribuer le WAD', () => {
    expect(panel.textContent).toContain('GPL');
    expect(panel.textContent).toContain('id Software');
  });
});
