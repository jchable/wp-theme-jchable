import { describe, expect, it } from 'vitest';
import { buildHtmlDocument, escapeHtml, htmlToText, makeFileName } from './text';

describe('escapeHtml', () => {
  it('échappe & < > " \'', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  });
});

describe('htmlToText', () => {
  it('transforme les blocs en lignes', () => {
    expect(htmlToText('<h1>Titre</h1><p>Un</p><p>Deux</p>')).toBe('Titre\nUn\nDeux');
  });

  it('transforme br en saut de ligne', () => {
    expect(htmlToText('a<br>b<br/>c')).toBe('a\nb\nc');
  });

  it('gère div et listes', () => {
    expect(htmlToText('<div>a</div><div>b</div><ul><li>x</li><li>y</li></ul>')).toBe('a\nb\n- x\n- y');
  });

  it('décode les entités', () => {
    expect(htmlToText('<p>&lt;b&gt; &amp; &eacute; &quot;ok&quot; &nbsp;fin</p>')).toBe('<b> & é "ok"  fin');
  });

  it('ignore script et style avec leur contenu', () => {
    expect(htmlToText('<p>a</p><script>alert(1)</script><style>p{}</style><p>b</p>')).toBe('a\nb');
  });

  it('garde le texte des éléments inline sans coupure', () => {
    expect(htmlToText('<p>Bon<b>jour</b> <i>tout</i> le monde</p>')).toBe('Bonjour tout le monde');
  });

  it('ne produit jamais de balise', () => {
    const out = htmlToText('<p onclick="x">a<img src=x onerror=alert(1)><a href="javascript:alert(1)">lien</a></p>');
    expect(out).toBe('alien');
    expect(out).not.toContain('<');
  });

  it('réduit les sauts de ligne répétés et rogne', () => {
    expect(htmlToText('<p></p><p>a</p><br><br><br><br><p>b</p><p></p>')).toBe('a\n\nb');
  });

  it('renvoie une chaîne vide pour une entrée vide', () => {
    expect(htmlToText('')).toBe('');
  });
});

describe('buildHtmlDocument', () => {
  it('produit un document autonome avec meta charset', () => {
    const doc = buildHtmlDocument('Mon titre', '<p>x</p>');
    expect(doc.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(doc).toContain('<meta charset="utf-8">');
    expect(doc).toContain('<title>Mon titre</title>');
    expect(doc).toContain('<p>x</p>');
    expect(doc).toContain('<html lang="fr">');
  });

  it('échappe le titre', () => {
    const doc = buildHtmlDocument('</title><script>alert(1)</script>', '');
    expect(doc).toContain('<title>&lt;/title&gt;&lt;script&gt;alert(1)&lt;/script&gt;</title>');
    expect(doc).not.toContain('<script>');
  });

  it('est analysable comme un vrai document', () => {
    const doc = new DOMParser().parseFromString(buildHtmlDocument('T & Cie', '<h1>a</h1>'), 'text/html');
    expect(doc.title).toBe('T & Cie');
    expect(doc.querySelector('h1')?.textContent).toBe('a');
  });
});

describe('makeFileName', () => {
  it('ajoute l\'extension', () => {
    expect(makeFileName('lettre', 'html')).toBe('lettre.html');
  });
  it('ne double pas l\'extension', () => {
    expect(makeFileName('lettre.TXT', 'txt')).toBe('lettre.TXT');
  });
  it('retire les caractères interdits', () => {
    expect(makeFileName('a/b\\c:d*e?f"g<h>i|j', 'txt')).toBe('abcdefghij.txt');
  });
  it('retombe sur « document » si vide', () => {
    expect(makeFileName('   ', 'html')).toBe('document.html');
    expect(makeFileName('///', 'txt')).toBe('document.txt');
  });
  it('limite la longueur', () => {
    expect(makeFileName('a'.repeat(500), 'txt').length).toBeLessThanOrEqual(104);
  });
});
