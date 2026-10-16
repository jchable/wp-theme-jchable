import { describe, expect, it } from 'vitest';
import { sanitizePageHtml } from './sanitize';

const BASE = 'https://x.test/';

function render(html: string): HTMLElement {
  const box = document.createElement('div');
  box.append(sanitizePageHtml(html, BASE));
  return box;
}

describe('sanitizePageHtml', () => {
  it('garde la structure de lecture courante', () => {
    const box = render('<h2>Titre</h2><p>Un <strong>texte</strong> et <em>un autre</em>.</p><ul><li>a</li></ul><blockquote>cit</blockquote><pre><code>x</code></pre>');
    expect(box.querySelector('h2')?.textContent).toBe('Titre');
    expect(box.querySelector('strong')).not.toBeNull();
    expect(box.querySelector('li')).not.toBeNull();
    expect(box.querySelector('blockquote')).not.toBeNull();
    expect(box.querySelector('pre code')).not.toBeNull();
  });

  it('supprime les éléments actifs avec leur contenu', () => {
    const box = render('<p>ok</p><script>window.__pwn=1</script><style>p{color:red}</style><iframe src="https://evil.test"></iframe><object data="x"></object><embed src="x"><form action="/x"><input name="a"></form><svg onload="window.__pwn=1"><script>1</script></svg><math><mi>x</mi></math>');
    expect(box.textContent).toBe('ok');
    expect(box.querySelector('script, style, iframe, object, embed, form, input, svg, math')).toBeNull();
  });

  it('retire les gestionnaires d’évènements et les styles', () => {
    const box = render('<p onclick="x()" style="position:fixed" class="evil" id="y" data-x="1">t</p><img src="/a.png" onerror="window.__pwn=1" alt="a">');
    const p = box.querySelector('p');
    expect(p?.attributes.length).toBe(0);
    expect(box.querySelector('img')?.hasAttribute('onerror')).toBe(false);
  });

  it('refuse les adresses dangereuses', () => {
    const box = render(
      '<a href="javascript:alert(1)">a</a><a href="  JaVaScRiPt:alert(1)">b</a><a href="jav&#x09;ascript:alert(1)">c</a><a href="data:text/html,<script>1</script>">d</a><a href="vbscript:x">e</a>' +
        '<img src="javascript:alert(1)" alt=""><img src="data:image/svg+xml,<svg onload=alert(1)>" alt="">',
    );
    for (const a of box.querySelectorAll('a')) expect(a.hasAttribute('href')).toBe(false);
    expect(box.querySelectorAll('img').length).toBe(0);
    expect(box.textContent).toContain('a');
  });

  it('résout les adresses relatives et sécurise les liens externes', () => {
    const box = render('<a href="/autre/">interne</a><a href="https://ailleurs.test/p">externe</a><a href="mailto:a@x.test">mail</a>');
    const [interne, externe, mail] = box.querySelectorAll('a');
    expect(interne?.getAttribute('href')).toBe('https://x.test/autre/');
    expect(interne?.hasAttribute('target')).toBe(false);
    expect(externe?.getAttribute('target')).toBe('_blank');
    expect(externe?.getAttribute('rel')).toContain('noopener');
    expect(mail?.getAttribute('href')).toBe('mailto:a@x.test');
  });

  it('garde les images https et relatives, en chargement différé', () => {
    const box = render('<figure><img src="/wp-content/a.png" alt="Une image" width="800" height="600"><figcaption>Légende</figcaption></figure>');
    const img = box.querySelector('img');
    expect(img?.getAttribute('src')).toBe('https://x.test/wp-content/a.png');
    expect(img?.getAttribute('alt')).toBe('Une image');
    expect(img?.getAttribute('loading')).toBe('lazy');
    expect(box.querySelector('figcaption')?.textContent).toBe('Légende');
  });

  it('déballe les éléments inconnus en gardant leur texte et retire les commentaires', () => {
    const box = render('<custom-tag><p>dedans</p></custom-tag><!-- caché --><p>fin</p>');
    expect(box.textContent).toBe('dedansfin');
    expect(box.innerHTML).not.toContain('caché');
  });

  it('ne change plus rien quand on le repasse sur son propre résultat', () => {
    const once = render('<p onclick="x" style="a:b">a <a href="javascript:x">b</a> <img src="/a.png" onerror="x" alt=""></p><script>1</script>');
    const twice = render(once.innerHTML);
    expect(twice.innerHTML).toBe(once.innerHTML);
  });
});
