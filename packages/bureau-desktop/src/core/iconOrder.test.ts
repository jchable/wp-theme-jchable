import { describe, expect, it } from 'vitest';
import type { IconItem } from '../ui/desktopIcons';
import { arrangeDesktopIcons } from './iconOrder';

const link = (id: string, label: string, href: string): IconItem => ({ id, label, iconUrl: `${id}.svg`, kind: 'link', href });
const app = (id: string): IconItem => ({ id: `app:${id}`, label: id, iconUrl: `${id}.svg`, kind: 'app', appId: id });

const where = { homeUrl: 'https://ex.org/', sitemapUrl: 'https://ex.org/plan-du-site/', feedUrl: 'https://ex.org/feed/' };
const menu = [
  link('nav:/', 'Accueil', 'https://ex.org/'),
  link('nav:/a-propos/', 'À propos', 'https://ex.org/a-propos/'),
  link('nav:/plan-du-site/', 'Plan du site', 'https://ex.org/plan-du-site/'),
  { id: 'nav:#recherche', label: 'Recherche', iconUrl: 's.svg', kind: 'anchor', href: '#recherche' } as IconItem,
  { id: 'nav:rss', label: 'RSS', iconUrl: 'rss.svg', kind: 'link', href: 'https://ex.org/feed/' } as IconItem,
];
const apps = [app('terminal'), app('minesweeper'), app('trash'), app('doom')];
const ids = (items: IconItem[]) => items.map((item) => item.id);

describe('rangement des icônes du bureau', () => {
  it('le plan du site et le flux RSS quittent le bureau (ils sont dans la barre des tâches)', () => {
    const { desktop } = arrangeDesktopIcons(menu, apps, where);
    expect(ids(desktop)).not.toContain('nav:/plan-du-site/');
    expect(ids(desktop)).not.toContain('nav:rss');
    expect(ids(desktop)).toContain('nav:#recherche');
  });

  it('la corbeille se place juste sous l’icône Accueil', () => {
    const { desktop } = arrangeDesktopIcons(menu, apps, where);
    expect(ids(desktop)).toEqual(['nav:/', 'app:trash', 'nav:/a-propos/', 'nav:#recherche', 'app:terminal', 'app:minesweeper', 'app:doom']);
  });

  it('les liens du menu Démarrer gardent le plan du site (mais pas le flux, ajouté à part)', () => {
    const { menuLinks } = arrangeDesktopIcons(menu, apps, where);
    expect(menuLinks.map((item) => item.label)).toEqual(['Accueil', 'À propos', 'Plan du site']);
  });

  it('reconnaît le plan du site malgré une barre oblique finale ou une adresse relative', () => {
    const odd = [link('nav:/', 'Accueil', 'https://ex.org/'), link('nav:/plan-du-site', 'Plan', 'https://ex.org/plan-du-site')];
    expect(ids(arrangeDesktopIcons(odd, apps, where).desktop)).toEqual(['nav:/', 'app:trash', 'app:terminal', 'app:minesweeper', 'app:doom']);
  });

  it('sans page « Plan du site » (l’adresse renvoyée est l’accueil), l’icône Accueil reste', () => {
    const none = { ...where, sitemapUrl: 'https://ex.org/' };
    expect(ids(arrangeDesktopIcons(menu, apps, none).desktop)).toContain('nav:/');
  });

  it('sans icône Accueil, la corbeille passe en deuxième position', () => {
    const noHome = menu.filter((item) => item.id !== 'nav:/');
    expect(ids(arrangeDesktopIcons(noHome, apps, where).desktop).slice(0, 2)).toEqual(['nav:/a-propos/', 'app:trash']);
  });

  it('sans corbeille dans les applis, rien de cassé', () => {
    const { desktop } = arrangeDesktopIcons(menu, [app('terminal')], where);
    expect(ids(desktop)).toEqual(['nav:/', 'nav:/a-propos/', 'nav:#recherche', 'app:terminal']);
  });
});
