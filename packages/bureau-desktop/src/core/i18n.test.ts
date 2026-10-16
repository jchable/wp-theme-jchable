import { afterEach, describe, expect, it } from 'vitest';
import { detectLang, getLang, makeT, missingKeys, resolveLang, setLang } from './i18n';

afterEach(() => setLang('fr'));

describe('detectLang', () => {
  it('français si la première langue du navigateur est le français', () => {
    expect(detectLang(['fr-FR', 'en-US'])).toBe('fr');
    expect(detectLang(['fr'])).toBe('fr');
    expect(detectLang(['FR-ca'])).toBe('fr');
  });

  it('anglais pour toutes les autres langues', () => {
    expect(detectLang(['en-GB'])).toBe('en');
    expect(detectLang(['de-DE', 'fr-FR'])).toBe('en');
    expect(detectLang(['ja'])).toBe('en');
  });

  it('français par défaut quand le navigateur ne dit rien', () => {
    expect(detectLang([])).toBe('fr');
  });
});

describe('resolveLang', () => {
  it('le choix explicite du visiteur l’emporte', () => {
    expect(resolveLang('en', ['fr-FR'])).toBe('en');
    expect(resolveLang('fr', ['en-US'])).toBe('fr');
  });

  it('« auto » suit le navigateur', () => {
    expect(resolveLang('auto', ['en-US'])).toBe('en');
    expect(resolveLang('auto', ['fr-FR'])).toBe('fr');
  });

  it('une valeur inconnue retombe sur « auto »', () => {
    expect(resolveLang('klingon', ['en-US'])).toBe('en');
  });
});

describe('makeT', () => {
  const t = makeT({
    fr: { hello: 'Bonjour {name}', only: 'Seulement en français', two: '{a} et {a}' },
    en: { hello: 'Hello {name}', only: '', two: '{a} and {a}' },
  });

  it('traduit selon la langue courante', () => {
    setLang('fr');
    expect(t('hello', { name: 'Ana' })).toBe('Bonjour Ana');
    setLang('en');
    expect(t('hello', { name: 'Ana' })).toBe('Hello Ana');
  });

  it('remplace toutes les occurrences d’un paramètre', () => {
    setLang('en');
    expect(t('two', { a: 'x' })).toBe('x and x');
  });

  it('retombe sur le français quand la traduction est vide', () => {
    setLang('en');
    expect(t('only')).toBe('Seulement en français');
  });

  it('un paramètre absent reste visible plutôt que de planter', () => {
    setLang('fr');
    expect(t('hello')).toBe('Bonjour {name}');
  });

  it('getLang suit setLang', () => {
    setLang('en');
    expect(getLang()).toBe('en');
  });
});

describe('missingKeys', () => {
  it('signale les clés absentes ou vides d’une langue', () => {
    expect(missingKeys({ fr: { a: '1', b: '2' }, en: { a: '1', b: '' } })).toEqual(['en.b']);
    expect(missingKeys({ fr: { a: '1' }, en: { a: '1', c: '3' } })).toEqual(['fr.c']);
    expect(missingKeys({ fr: { a: '1' }, en: { a: '1' } })).toEqual([]);
  });
});
