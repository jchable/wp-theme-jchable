import { afterEach, describe, expect, it } from 'vitest';
import { readMenuIcons } from './menuIcons';

const html = (items: string): string => `<div class="desktop-icons"><nav><ul>${items}</ul></nav></div>`;
const li = (cls: string, label: string, href: string): string =>
  `<li class="wp-block-navigation-item ${cls}"><a class="wp-block-navigation-item__content" href="${href}"><span>${label}</span></a></li>`;

afterEach(() => {
  document.body.innerHTML = '';
});

describe('readMenuIcons', () => {
  it('lit le libellé, le lien et le pictogramme de chaque entrée du menu', () => {
    document.body.innerHTML = html(li('icon-text', 'À propos', '/a-propos/') + li('', 'Accueil', '/'));
    const items = readMenuIcons(document, 'https://x.test/assets/', 'https://x.test/feed/');
    expect(items.map((i) => i.label)).toEqual(['À propos', 'Accueil']);
    expect(items[0]?.iconUrl).toBe('https://x.test/assets/icons/document.svg');
    expect(items[1]?.iconUrl).toBe('https://x.test/assets/icons/folder.svg');
    expect(items.every((i) => i.kind === 'link')).toBe(true);
  });

  it('l’icône RSS suit l’adresse du flux transmise par WordPress, pas un chemin codé en dur', () => {
    document.body.innerHTML = html(li('icon-rss', 'RSS', '/feed/'));
    const [rss] = readMenuIcons(document, 'https://x.test/assets/', 'https://x.test/?feed=rss2');
    expect(rss?.href).toBe('https://x.test/?feed=rss2');
  });

  it('une ancre de la page devient une icône « anchor »', () => {
    document.body.innerHTML = html(li('icon-search', 'Recherche', '#recherche'));
    const [search] = readMenuIcons(document, 'https://x.test/assets/', 'https://x.test/feed/');
    expect(search?.kind).toBe('anchor');
    expect(search?.href).toBe('#recherche');
  });

  it('deux entrées de même libellé gardent des identifiants différents', () => {
    document.body.innerHTML = html(li('', 'Lien', '/a/') + li('', 'Lien', '/b/'));
    const items = readMenuIcons(document, 'https://x.test/assets/', 'https://x.test/feed/');
    expect(new Set(items.map((i) => i.id)).size).toBe(2);
  });

  it('l’identifiant ne dépend pas du nom de domaine', () => {
    document.body.innerHTML = html(li('', 'Accueil', 'http://a.test/x/'));
    const a = readMenuIcons(document, '/', '/f')[0]?.id;
    document.body.innerHTML = html(li('', 'Accueil', 'http://b.test/x/'));
    const b = readMenuIcons(document, '/', '/f')[0]?.id;
    expect(a).toBe(b);
  });
});
