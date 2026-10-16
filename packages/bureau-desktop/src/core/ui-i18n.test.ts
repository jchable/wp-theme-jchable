import { describe, expect, it } from 'vitest';
import { missingKeys, setLang } from './i18n';
import { APPS } from './registry';
import { messages, t } from './ui-i18n';

describe('textes du cœur du bureau', () => {
  it('les deux langues ont exactement les mêmes clés, sans valeur vide', () => {
    expect(missingKeys(messages)).toEqual([]);
  });

  it('les titres des applis suivent la langue courante', () => {
    const minesweeper = APPS.find((app) => app.id === 'minesweeper');
    const trash = APPS.find((app) => app.id === 'trash');
    expect(minesweeper?.title).toBe('Démineur.exe');
    expect(trash?.title).toBe('Corbeille');
    setLang('en');
    expect(minesweeper?.title).toBe('Minesweeper.exe');
    expect(trash?.title).toBe('Recycle Bin');
    expect(APPS.find((app) => app.id === 'doom')?.unsupportedMessage).toContain('needs a keyboard');
  });

  it('paramètres : le titre de l’appli est inséré dans le message d’erreur', () => {
    expect(t('win.crashed', { title: 'DOOM.EXE' })).toBe('DOOM.EXE a cessé de fonctionner.');
    setLang('en');
    expect(t('win.crashed', { title: 'DOOM.EXE' })).toBe('DOOM.EXE has stopped working.');
  });
});
