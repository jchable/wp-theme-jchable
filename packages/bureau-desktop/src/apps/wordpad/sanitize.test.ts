import { describe, expect, it } from 'vitest';
import { sanitizeHtml } from './sanitize';

/** Aucun résidu dangereux ne doit survivre, quelle que soit la charge. */
function expectInert(out: string): void {
  const doc = new DOMParser().parseFromString(`<body>${out}</body>`, 'text/html');
  expect(doc.querySelectorAll('script,style,iframe,img,object,embed,svg,math,link,meta,form,input').length).toBe(0);
  for (const el of Array.from(doc.body.querySelectorAll('*'))) {
    for (const attr of Array.from(el.attributes)) {
      expect(attr.name.startsWith('on')).toBe(false);
      expect(['style', 'href', 'rel', 'color', 'face', 'size']).toContain(attr.name);
      expect(attr.value.toLowerCase()).not.toContain('javascript:');
    }
  }
  expect(out.toLowerCase()).not.toContain('<script');
}

describe('sanitizeHtml : contenu légitime', () => {
  it('conserve le texte et les balises autorisées', () => {
    const html = '<p>Bonjour <b>le</b> <i>monde</i> <u>!</u></p><ul><li>un</li></ul>';
    expect(sanitizeHtml(html)).toBe(html);
  });

  it('conserve titres, listes ordonnées, br, s, strong, em', () => {
    const html = '<h1>A</h1><h2>B</h2><h3>C</h3><ol><li><strong>x</strong><br><em>y</em><s>z</s></li></ol>';
    expect(sanitizeHtml(html)).toBe(html);
  });

  it('échappe le texte et décode les entités en toute sécurité', () => {
    const out = sanitizeHtml('<p>&lt;script&gt;alert(1)&lt;/script&gt; &amp; &eacute;</p>');
    expect(out).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt; &amp; é</p>');
    expectInert(out);
  });

  it('renvoie une chaîne vide pour une entrée vide', () => {
    expect(sanitizeHtml('')).toBe('');
  });
});

describe('sanitizeHtml : éléments dangereux', () => {
  it('supprime script avec son contenu', () => {
    expect(sanitizeHtml('<p>a</p><script>alert(1)</script><p>b</p>')).toBe('<p>a</p><p>b</p>');
  });

  it('supprime script à casse mixte', () => {
    const out = sanitizeHtml('<ScRiPt>alert(1)</sCrIpT>texte');
    expect(out).toBe('texte');
  });

  it('supprime style avec son contenu', () => {
    expect(sanitizeHtml('<style>body{display:none}</style><p>x</p>')).toBe('<p>x</p>');
  });

  it('supprime style imbriqué dans un élément autorisé', () => {
    expect(sanitizeHtml('<div>a<style>*{x:y}</style>b</div>')).toBe('<div>ab</div>');
  });

  it('supprime iframe, object, embed, img, video', () => {
    const out = sanitizeHtml(
      '<iframe src="https://evil"></iframe><object data="x">obj</object><embed src="x"><img src=x onerror=alert(1)><video src=x>v</video>ok',
    );
    expect(out).toBe('ok');
    expectInert(out);
  });

  it('supprime noscript, template, textarea, select avec contenu', () => {
    const out = sanitizeHtml('<noscript><img src=x onerror=alert(1)></noscript><template><b>t</b></template><textarea>tt</textarea>ok');
    expect(out).toBe('ok');
  });

  it('supprime SVG et MathML en entier', () => {
    const out = sanitizeHtml(
      '<svg onload="alert(1)"><script>alert(2)</script><text>svgtext</text></svg><math><mi xlink:href="javascript:alert(3)">m</mi></math><p>ok</p>',
    );
    expect(out).toBe('<p>ok</p>');
    expectInert(out);
  });

  it('supprime les commentaires et conditionnels', () => {
    const out = sanitizeHtml('<p>a<!-- <script>alert(1)</script> -->b<!--[if IE]><img src=x><![endif]--></p>');
    expect(out).toBe('<p>ab</p>');
  });

  it('retire formulaires et boutons mais garde le texte', () => {
    const out = sanitizeHtml('<form action="https://evil"><input name="a" value="v">texte<button>clic</button></form>');
    expect(out).toBe('texteclic');
  });

  it('retire les éléments inconnus en gardant leur texte et leurs enfants autorisés', () => {
    expect(sanitizeHtml('<foo>a<b>b</b></foo><blink>c</blink><custom-el>d</custom-el>')).toBe('a<b>b</b>cd');
  });

  it('supprime meta, link, base, title', () => {
    const out = sanitizeHtml('<meta http-equiv="refresh" content="0;url=https://evil"><link rel="stylesheet" href="x"><base href="https://evil"><title>T</title>texte');
    expect(out).toBe('texte');
  });

  it('gère du HTML cassé ou mal imbriqué', () => {
    const out = sanitizeHtml('<b><i>x</b></i><p><div>y</p><script');
    expectInert(out);
    expect(out).toContain('x');
    expect(out).toContain('y');
  });

  it('résiste aux tentatives de mXSS classiques', () => {
    const payloads = [
      '<noscript><p title="</noscript><img src=x onerror=alert(1)>">',
      '<math><mtext><table><mglyph><style><!--</style><img title="--&gt;&lt;img src=1 onerror=alert(1)&gt;">',
      '<svg></p><style><a id="</style><img src=1 onerror=alert(1)>">',
      '<form><math><mtext></form><form><mglyph><style></math><img src onerror=alert(1)>',
      '<xmp><img src=x onerror=alert(1)></xmp>',
      '<plaintext><img src=x onerror=alert(1)>',
      '<listing><img src=x onerror=alert(1)></listing>',
    ];
    for (const p of payloads) {
      const out = sanitizeHtml(p);
      expectInert(out);
      // Re-sanitiser le résultat ne doit rien changer (idempotence).
      expect(sanitizeHtml(out)).toBe(out);
    }
  });
});

describe('sanitizeHtml : attributs', () => {
  it('supprime les gestionnaires d\'événements', () => {
    const out = sanitizeHtml('<p onclick="alert(1)" onmouseover=alert(2) ONLOAD="x" id="a" class="b" data-x="1">t</p>');
    expect(out).toBe('<p>t</p>');
  });

  it('supprime onerror sur des éléments autorisés', () => {
    const out = sanitizeHtml('<b onerror="alert(1)">x</b><span onfocus="alert(1)" autofocus tabindex=0>y</span>');
    expect(out).toBe('<b>x</b><span>y</span>');
  });
});

describe('sanitizeHtml : liens', () => {
  it('garde http, https et mailto avec rel', () => {
    expect(sanitizeHtml('<a href="https://exemple.fr/a?b=1&amp;c=2">x</a>')).toBe(
      '<a href="https://exemple.fr/a?b=1&amp;c=2" rel="noopener noreferrer">x</a>',
    );
    expect(sanitizeHtml('<a href="http://exemple.fr">x</a>')).toContain('href="http://exemple.fr"');
    expect(sanitizeHtml('<a href="mailto:a@b.fr">x</a>')).toContain('href="mailto:a@b.fr"');
  });

  it('remplace le rel fourni et ignore target', () => {
    const out = sanitizeHtml('<a href="https://e.fr" target="_blank" rel="opener">x</a>');
    expect(out).toBe('<a href="https://e.fr" rel="noopener noreferrer">x</a>');
  });

  it('retire javascript: (casse mixte, espaces, tabulations, entités)', () => {
    const payloads = [
      '<a href="javascript:alert(1)">x</a>',
      '<a href="  javascript:alert(1)">x</a>',
      '<a href="JaVaScRiPt:alert(1)">x</a>',
      '<a href="java\tscript:alert(1)">x</a>',
      '<a href="java&#10;script:alert(1)">x</a>',
      '<a href="&#106;avascript:alert(1)">x</a>',
      '<a href="&#x6A;avascript&colon;alert(1)">x</a>',
      '<a href="\u0001javascript:alert(1)">x</a>',
      '<a href=" javascript:alert(1)">x</a>',
    ];
    for (const p of payloads) {
      const out = sanitizeHtml(p);
      expect(out).toBe('x');
    }
  });

  it('retire data:, vbscript:, file:, ftp: et les liens relatifs', () => {
    for (const href of [
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
      'file:///etc/passwd',
      'ftp://exemple.fr',
      '/relatif',
      '//exemple.fr',
      '#ancre',
      '',
    ]) {
      expect(sanitizeHtml(`<a href="${href.replace(/"/g, '&quot;')}">x</a>`)).toBe('x');
    }
  });

  it('retire un lien sans href', () => {
    expect(sanitizeHtml('<a name="x">t</a>')).toBe('t');
  });
});

describe('sanitizeHtml : styles', () => {
  it('conserve les propriétés autorisées avec valeurs sûres', () => {
    const out = sanitizeHtml(
      '<span style="font-weight: bold; font-style: italic; text-decoration: underline; color: #ff0000; text-align: center; font-size: 20px">t</span>',
    );
    expect(out).toContain('font-weight: bold');
    expect(out).toContain('font-style: italic');
    expect(out).toContain('text-decoration: underline');
    expect(out).toContain('color: #ff0000');
    expect(out).toContain('text-align: center');
    expect(out).toContain('font-size: 20px');
    expectInert(out);
  });

  it('accepte rgb() et rgba()', () => {
    expect(sanitizeHtml('<span style="color: rgb(10, 20, 30)">t</span>')).toContain('color: rgb(10, 20, 30)');
    expect(sanitizeHtml('<span style="color:rgba(10,20,30,0.5)">t</span>')).toContain('color: rgba(10,20,30,0.5)');
  });

  it('accepte les polices autorisées et refuse les autres', () => {
    expect(sanitizeHtml('<span style="font-family: Chivo, sans-serif">t</span>')).toContain('font-family:');
    expect(sanitizeHtml('<span style="font-family: &quot;Chivo Mono&quot;, monospace">t</span>')).toContain('Chivo Mono');
    expect(sanitizeHtml('<span style="font-family: serif">t</span>')).toContain('font-family: serif');
    expect(sanitizeHtml('<span style="font-family: evil, url(http://x)">t</span>')).toBe('<span>t</span>');
    expect(sanitizeHtml('<span style="font-family: Comic Sans MS">t</span>')).toBe('<span>t</span>');
  });

  it('borne la taille de police', () => {
    expect(sanitizeHtml('<span style="font-size: 5px">t</span>')).toBe('<span>t</span>');
    expect(sanitizeHtml('<span style="font-size: 500px">t</span>')).toBe('<span>t</span>');
    expect(sanitizeHtml('<span style="font-size: 9999em">t</span>')).toBe('<span>t</span>');
    expect(sanitizeHtml('<span style="font-size: 1.5em">t</span>')).toContain('font-size: 1.5em');
    expect(sanitizeHtml('<span style="font-size: 96px">t</span>')).toContain('font-size: 96px');
  });

  it('refuse les propriétés non autorisées', () => {
    const out = sanitizeHtml(
      '<div style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: url(https://evil/x); z-index: 9999; display:none">t</div>',
    );
    expect(out).toBe('<div>t</div>');
  });

  it('refuse les valeurs piégées (url, expression, javascript, import, @, \\)', () => {
    const payloads = [
      'color: url(javascript:alert(1))',
      'color: expression(alert(1))',
      'color: red; background-image: url(x)',
      'color: \\72 ed',
      'color: red !important',
      'color: var(--x)',
      'color: javascript:alert(1)',
      'font-weight: bold; } body { display:none',
      'text-align: center; behavior: url(x.htc)',
      '-moz-binding: url(x)',
      'color: #ff0000/*x*/',
      'co/**/lor: red',
      'color: #xyz',
      'color: rgb(0,0,0',
      'text-align: justify',
      'text-decoration: underline; text-decoration: expression(1)',
    ];
    for (const style of payloads) {
      const out = sanitizeHtml(`<span style="${style.replace(/"/g, '&quot;')}">t</span>`);
      const lower = out.toLowerCase();
      expect(lower).not.toContain('url(');
      expect(lower).not.toContain('expression');
      expect(lower).not.toContain('javascript');
      expect(lower).not.toContain('binding');
      expect(lower).not.toContain('behavior');
      expect(lower).not.toContain('!important');
      expect(lower).not.toContain('var(');
      expect(lower).not.toContain('\\');
      expect(lower).not.toContain('background');
      expect(lower).not.toContain('display');
    }
  });

  it('filtre déclaration par déclaration', () => {
    const out = sanitizeHtml('<span style="color: red; font-weight: bold; position: absolute">t</span>');
    expect(out).toContain('font-weight: bold');
    expect(out).not.toContain('position');
    expect(out).not.toContain('color: red');
  });

  it('supprime l\'attribut style si rien ne reste', () => {
    expect(sanitizeHtml('<p style="position:absolute">t</p>')).toBe('<p>t</p>');
  });

  it('ne laisse pas l\'attribut style sur les éléments sans style autorisé n\'importe quoi', () => {
    const out = sanitizeHtml('<STYLE>x</STYLE><P STYLE="TEXT-ALIGN: RIGHT">t</P>');
    expect(out).toBe('<p style="text-align: right">t</p>');
  });
});

describe('sanitizeHtml : font', () => {
  it('conserve color, face et size valides', () => {
    const out = sanitizeHtml('<font color="#ff0000" face="serif" size="5">t</font>');
    expect(out).toBe('<font color="#ff0000" face="serif" size="5">t</font>');
  });

  it('rejette valeurs piégées', () => {
    const out = sanitizeHtml('<font color="red;background:url(x)" face="evil" size="99" onclick="x">t</font>');
    expect(out).toBe('<font>t</font>');
  });
});

describe('sanitizeHtml : divers', () => {
  it('ne rend jamais d\'élément à événements après passage dans innerHTML', () => {
    const out = sanitizeHtml('<p>x</p><img src=x onerror="document.title=1">');
    const host = document.createElement('div');
    host.innerHTML = out;
    expect(host.querySelector('img')).toBeNull();
  });

  it('traite les très gros contenus sans erreur', () => {
    const big = '<p>a</p>'.repeat(5000);
    expect(sanitizeHtml(big)).toBe(big);
  });

  it('gère les imbrications profondes', () => {
    const deep = '<div>'.repeat(300) + 'x' + '</div>'.repeat(300);
    expect(sanitizeHtml(deep)).toContain('x');
  });
});
