import { describe, expect, it } from 'vitest';
import { countNew, excerptText, formatRelative, maxId, parseComments, replyUrl, type Message } from './logic';

const msg = (id: number): Message => ({ id, author: 'A', date: null, text: 't', link: '' });

describe('excerptText', () => {
  it('retire les balises, décode les entités et compacte les espaces', () => {
    expect(excerptText('<p>Salut&nbsp;<strong>toi</strong> &amp; moi</p>\n\n<p>  ok  </p>', 280)).toBe('Salut toi & moi ok');
  });
  it('décode les entités numériques', () => {
    expect(excerptText('<p>l&#8217;ami &#x41;</p>', 280)).toBe('l’ami A');
  });
  it('ne garde ni script ni style', () => {
    expect(excerptText('a<script>alert(1)</script><style>p{}</style>b', 280)).toBe('ab');
  });
  it('tronque sur une limite de mot avec une ellipse', () => {
    const out = excerptText('un deux trois quatre cinq six', 15);
    expect(out).toBe('un deux trois…');
    expect(out.length).toBeLessThanOrEqual(16);
  });
  it('coupe net un mot unique trop long', () => {
    expect(excerptText('x'.repeat(50), 10)).toBe('x'.repeat(10) + '…');
  });
  it('laisse intact un texte court et tolère les valeurs non texte', () => {
    expect(excerptText('court', 280)).toBe('court');
    expect(excerptText(null as unknown as string, 10)).toBe('');
  });
});

describe('formatRelative', () => {
  const now = new Date(2024, 5, 15, 12, 0, 0);
  const ago = (ms: number) => new Date(now.getTime() - ms);
  const MIN = 60_000;
  const H = 60 * MIN;
  it('à l’instant', () => expect(formatRelative(ago(20_000), now, 'fr')).toBe('à l’instant'));
  it('minutes', () => expect(formatRelative(ago(5 * MIN), now, 'fr')).toBe('il y a 5 min'));
  it('heures', () => expect(formatRelative(ago(3 * H + 10 * MIN), now, 'fr')).toBe('il y a 3 h'));
  it('hier', () => expect(formatRelative(ago(30 * H), now, 'fr')).toBe('hier'));
  it('au-delà, dd.mm.yyyy', () => {
    expect(formatRelative(new Date(2024, 0, 5, 10, 0, 0), now, 'fr')).toBe('05.01.2024');
  });
  it('une date future ou invalide ne plante pas', () => {
    expect(formatRelative(new Date(now.getTime() + H), now, 'fr')).toBe('à l’instant');
    expect(formatRelative(new Date('nope'), now, 'fr')).toBe('');
  });
});

describe('parseComments', () => {
  it('convertit un commentaire valide', () => {
    const [m] = parseComments([
      {
        id: 12,
        author_name: 'Ada',
        date_gmt: '2024-06-15T10:00:00',
        content: { rendered: '<p>Bravo &amp; merci</p>' },
        link: 'https://ex.com/post/#comment-12',
        post: 3,
      },
    ]);
    expect(m!).toMatchObject({ id: 12, author: 'Ada', text: 'Bravo & merci', link: 'https://ex.com/post/#comment-12' });
    expect(m!.date?.toISOString()).toBe('2024-06-15T10:00:00.000Z');
  });
  it('coerce les ids en nombre', () => {
    expect(parseComments([{ id: '7', content: { rendered: 'x' } }])[0]?.id).toBe(7);
  });
  it('ignore le malformé sans jamais lever', () => {
    const junk: unknown[] = [null, undefined, 'str', 42, [], {}, { id: 'abc' }, { id: -1 }, { id: 0 }, { id: 5, content: 12 }];
    expect(() => parseComments(junk)).not.toThrow();
    expect(parseComments(junk)).toEqual([]);
    expect(parseComments(null)).toEqual([]);
    expect(parseComments('x')).toEqual([]);
    expect(parseComments({ a: 1 })).toEqual([]);
  });
  it('met des valeurs par défaut pour les champs manquants', () => {
    const [m] = parseComments([{ id: 3, content: { rendered: 'hello' } }]);
    expect(m!.author).toBe('Anonyme');
    expect(m!.date).toBeNull();
    expect(m!.link).toBe('');
  });
  it('ignore un commentaire sans texte', () => {
    expect(parseComments([{ id: 3, content: { rendered: '<p> </p>' } }])).toEqual([]);
  });
  it('trie du plus ancien au plus récent', () => {
    const out = parseComments([
      { id: 3, content: { rendered: 'c' } },
      { id: 1, content: { rendered: 'a' } },
      { id: 2, content: { rendered: 'b' } },
    ]);
    expect(out.map((m) => m.id)).toEqual([1, 2, 3]);
  });
  it('réduit le contenu hostile à du texte et nettoie l’auteur', () => {
    const [m] = parseComments([
      { id: 1, author_name: '<b>Eve</b>', content: { rendered: '<img src=x onerror=alert(1)><script>alert(2)</script>ok' } },
    ]);
    expect(m!.text).toBe('ok');
    expect(m!.author).toBe('Eve');
  });
  it('rejette un lien non http(s) dans le message', () => {
    const [m] = parseComments([{ id: 1, link: 'javascript:alert(1)', content: { rendered: 'x' } }]);
    expect(m!.link).toBe('');
  });
});

describe('maxId / countNew', () => {
  it('maxId', () => {
    expect(maxId([])).toBe(0);
    expect(maxId([msg(2), msg(9), msg(4)])).toBe(9);
  });
  it('countNew compare à l’id déjà vu', () => {
    const list = [msg(1), msg(2), msg(3)];
    expect(countNew(list, '1')).toBe(2);
    expect(countNew(list, '3')).toBe(0);
    expect(countNew(list, '99')).toBe(0);
  });
  it('sans valeur exploitable tout est nouveau', () => {
    const list = [msg(1), msg(2)];
    expect(countNew(list, null)).toBe(2);
    expect(countNew(list, 'zzz')).toBe(2);
  });
});

describe('replyUrl', () => {
  it('remplace le fragment par #respond', () => {
    expect(replyUrl('https://ex.com/p/#comment-4')).toBe('https://ex.com/p/#respond');
    expect(replyUrl('https://ex.com/p/')).toBe('https://ex.com/p/#respond');
  });
  it('null si vide', () => expect(replyUrl('')).toBeNull());
});
