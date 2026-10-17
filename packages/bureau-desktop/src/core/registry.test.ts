import { describe, expect, it } from 'vitest';
import type { IconItem } from '../ui/desktopIcons';
import { setLang } from './i18n';
import { arrangeDesktopIcons } from './iconOrder';
import { APPS, LISTED_APPS, findApp } from './registry';

describe('registre des applis', () => {
  it('Calculatrice et Paint sont déclarées, listées, plein écran sur mobile', () => {
    for (const id of ['calculator', 'paint']) {
      const app = findApp(id);
      expect(app, id).toBeDefined();
      expect(app?.mobile).toBe('fullscreen');
      expect(app?.icon).toBe(id);
      expect(LISTED_APPS.map((a) => a.id)).toContain(id);
      expect(typeof app?.load).toBe('function');
    }
  });

  it('tailles de fenêtre voulues', () => {
    expect(findApp('calculator')?.defaultSize).toEqual({ w: 280, h: 360 });
    expect(findApp('paint')?.defaultSize).toEqual({ w: 740, h: 590 });
  });

  it('titres dans les deux langues', () => {
    expect(findApp('calculator')?.title).toBe('Calculatrice');
    expect(findApp('paint')?.title).toBe('Paint');
    setLang('en');
    expect(findApp('calculator')?.title).toBe('Calculator');
    expect(findApp('paint')?.title).toBe('Paint');
  });

  it('huit applis listées (icônes du bureau et menu Démarrer), « Propriétés » et « Préférences » à part', () => {
    expect(LISTED_APPS).toHaveLength(8);
    expect(APPS).toHaveLength(10);
    expect(LISTED_APPS.map((a) => a.id)).not.toContain('properties');
    expect(LISTED_APPS.map((a) => a.id)).not.toContain('settings');
  });

  it('les ids sont uniques', () => {
    expect(new Set(APPS.map((a) => a.id)).size).toBe(APPS.length);
  });
});

describe('icônes du bureau avec les vraies applis', () => {
  const link = (id: string, label: string, href: string): IconItem => ({ id, label, iconUrl: `${id}.svg`, kind: 'link', href });
  const apps = LISTED_APPS.map((a): IconItem => ({ id: `app:${a.id}`, label: a.title, iconUrl: `${a.icon}.svg`, kind: 'app', appId: a.id }));
  const menu = [
    link('nav:/', 'Accueil', 'https://ex.org/'),
    link('nav:/a-propos/', 'À propos', 'https://ex.org/a-propos/'),
    { id: 'nav:#recherche', label: 'Recherche', iconUrl: 's.svg', kind: 'anchor', href: '#recherche' } as IconItem,
  ];

  it('11 icônes en tout (3 du menu + 8 applis) et la corbeille reste juste sous Accueil', () => {
    const { desktop } = arrangeDesktopIcons(menu, apps, { homeUrl: 'https://ex.org/', sitemapUrl: 'https://ex.org/plan/', feedUrl: 'https://ex.org/feed/' });
    expect(desktop).toHaveLength(11);
    expect(desktop[0]?.id).toBe('nav:/');
    expect(desktop[1]?.id).toBe('app:trash');
    expect(desktop.map((i) => i.id)).toEqual(expect.arrayContaining(['app:calculator', 'app:paint']));
  });
});
