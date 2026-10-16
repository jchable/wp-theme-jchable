import { describe, expect, it } from 'vitest';
import { initialDocumentHtml } from './document';
import { sanitizeHtml } from './sanitize';

describe('initialDocumentHtml', () => {
  it('construit la présentation du blog avec le nom du site', () => {
    const html = initialDocumentHtml('Mon Blog', {});
    expect(html).toContain('<h1>');
    expect(html).toContain('Mon Blog');
    expect(html).toContain('lisez-moi.rtf');
    expect(html).toContain('Enregistrer sous');
  });

  it('échappe le nom du site', () => {
    const html = initialDocumentHtml('<img src=x onerror=alert(1)>', {});
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });

  it('construit une note sur l\'article quand titre et url sont fournis', () => {
    const html = initialDocumentHtml('Blog', { title: 'Mon article', url: 'https://exemple.fr/mon-article/' });
    expect(html).toContain('lisez-moi.rtf');
    expect(html).toContain('Mon article');
    expect(html).toContain('https://exemple.fr/mon-article/');
    expect(html).toContain('Tapez ici');
    // Lien en texte brut, pas de balise <a>.
    expect(html).not.toContain('<a ');
  });

  it('échappe titre et url de l\'article', () => {
    const html = initialDocumentHtml('Blog', { title: '<script>alert(1)</script>', url: '"><b>x</b>' });
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<b>x</b>');
  });

  it('retombe sur la présentation si titre ou url manquent ou ne sont pas des chaînes', () => {
    expect(initialDocumentHtml('Blog', { title: 'T' })).toContain('Enregistrer sous');
    expect(initialDocumentHtml('Blog', { title: 'T', url: 42 })).toContain('Enregistrer sous');
    expect(initialDocumentHtml('Blog', { url: 'https://x.fr' })).toContain('Enregistrer sous');
  });

  it('passe le nettoyeur sans perte', () => {
    const html = initialDocumentHtml('Blog', { title: 'T', url: 'https://x.fr' });
    expect(sanitizeHtml(html)).toBe(html);
    const html2 = initialDocumentHtml('Blog', {});
    expect(sanitizeHtml(html2)).toBe(html2);
  });
});
