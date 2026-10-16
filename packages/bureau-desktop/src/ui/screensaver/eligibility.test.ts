import { describe, expect, it } from 'vitest';
import { isScreensaverEligiblePage } from './eligibility';

const body = (...classes: string[]) => ({ classList: { contains: (c: string) => classes.includes(c) } });

describe('isScreensaverEligiblePage', () => {
  it.each(['home', 'blog', 'archive', 'search', 'error404'])('autorise la classe %s', (c) => {
    expect(isScreensaverEligiblePage(body(c))).toBe(true);
  });

  it('refuse les articles et les pages', () => {
    expect(isScreensaverEligiblePage(body('single', 'single-post'))).toBe(false);
    expect(isScreensaverEligiblePage(body('page', 'page-template'))).toBe(false);
  });

  it('refuse un corps sans classe connue', () => {
    expect(isScreensaverEligiblePage(body())).toBe(false);
  });

  it('home ou blog l emporte sur page (page d accueil statique)', () => {
    expect(isScreensaverEligiblePage(body('page', 'home'))).toBe(true);
    expect(isScreensaverEligiblePage(body('page', 'blog'))).toBe(true);
  });

  it('single l emporte sur archive', () => {
    expect(isScreensaverEligiblePage(body('single', 'archive'))).toBe(false);
  });

  it('accepte un vrai DOMTokenList', () => {
    document.body.className = 'archive category';
    expect(isScreensaverEligiblePage(document.body)).toBe(true);
    document.body.className = '';
  });
});
