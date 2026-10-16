import { describe, it, expect } from 'vitest';
import { parseCommand, History, formatDate, formatDateTime, decodeEntities } from './logic';

describe('parseCommand', () => {
  it('retourne null pour une ligne vide', () => {
    expect(parseCommand('')).toBeNull();
    expect(parseCommand('   ')).toBeNull();
  });
  it('met le nom en minuscules et découpe les arguments', () => {
    expect(parseCommand('  CAT  Mon-Slug  autre ')).toEqual({ name: 'cat', args: ['Mon-Slug', 'autre'] });
  });
  it('gère une commande sans argument', () => {
    expect(parseCommand('help')).toEqual({ name: 'help', args: [] });
  });
});

describe('History', () => {
  it('ignore les lignes vides et les doublons consécutifs', () => {
    const h = new History();
    h.push('a');
    h.push('a');
    h.push('  ');
    expect(h.prev('')).toBe('a');
    expect(h.prev('')).toBe('a');
  });
  it('remonte puis redescend, en restituant la saisie en cours', () => {
    const h = new History();
    h.push('un');
    h.push('deux');
    expect(h.prev('en cours')).toBe('deux');
    expect(h.prev('en cours')).toBe('un');
    expect(h.prev('en cours')).toBe('un');
    expect(h.next()).toBe('deux');
    expect(h.next()).toBe('en cours');
    expect(h.next()).toBe('en cours');
  });
  it('renvoie la saisie quand l\'historique est vide', () => {
    const h = new History();
    expect(h.prev('x')).toBe('x');
    expect(h.next()).toBe('x');
  });
  it('repart de la fin après un push', () => {
    const h = new History();
    h.push('un');
    h.prev('');
    h.push('deux');
    expect(h.prev('')).toBe('deux');
  });
  it('limite la taille', () => {
    const h = new History(2);
    h.push('1');
    h.push('2');
    h.push('3');
    expect(h.prev('')).toBe('3');
    expect(h.prev('')).toBe('2');
    expect(h.prev('')).toBe('2');
  });
});

describe('formatDate', () => {
  it('formate une date ISO en jj.mm.aaaa', () => {
    expect(formatDate('2024-03-05T10:20:30')).toBe('05.03.2024');
    expect(formatDate('2023-12-31')).toBe('31.12.2023');
  });
  it('accepte un objet Date', () => {
    expect(formatDate(new Date(2020, 0, 9))).toBe('09.01.2020');
  });
  it('renvoie des points d\'interrogation si illisible', () => {
    expect(formatDate('nimporte quoi')).toBe('??.??.????');
  });
});

describe('formatDateTime', () => {
  it('retourne une chaîne non vide, même avec une locale invalide', () => {
    expect(formatDateTime(new Date(2020, 0, 9, 8, 5), 'fr-FR').length).toBeGreaterThan(5);
    expect(formatDateTime(new Date(2020, 0, 9, 8, 5), '!!').length).toBeGreaterThan(5);
  });
});

describe('decodeEntities', () => {
  it('décode les entités', () => {
    expect(decodeEntities('L&#8217;&eacute;t&eacute; &amp; l&#039;automne')).toBe('L’été & l\'automne');
  });
  it('n\'exécute ni ne conserve de balises', () => {
    const out = decodeEntities('<img src=x onerror="window.__pwned=1">Salut &lt;b&gt;');
    expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined();
    expect(out).toBe('Salut <b>');
  });
});
