/** Panneau « À propos de DOOM.EXE » : licences et lien vers le code source (obligations de la GPL). */

import { t } from './i18n';

export const SOURCE_URL =
  'https://github.com/cloudflare/doom-wasm/tree/65e0d3ae2ffa604155eebd96ed40da6567bd08f4';

function link(text: string, href: string): HTMLAnchorElement {
  const a = document.createElement('a');
  a.textContent = text;
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  return a;
}

function item(...nodes: Array<string | Node>): HTMLLIElement {
  const li = document.createElement('li');
  li.append(...nodes);
  return li;
}

export function buildAbout(baseUrl: string): HTMLElement {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const panel = document.createElement('div');
  panel.className = 'bapp-doom-about';
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-label', t('aboutTitle'));

  const title = document.createElement('h2');
  title.textContent = t('aboutTitle');
  const intro = document.createElement('p');
  intro.textContent = t('aboutIntro');

  const list = document.createElement('ul');
  list.append(
    item(t('aboutSourceLabel'), link(t('aboutSourceLink'), SOURCE_URL)),
    item(t('aboutBuildLabel'), link(t('aboutBuildLink'), `${base}README.md`)),
    item(t('aboutEngineLicenseLabel'), link('GPL v2', `${base}LICENSE-GPL-2.0.txt`)),
    item(t('aboutDataLabel'), link(t('aboutDataLink'), `${base}LICENSE-DOOM1-SHAREWARE.txt`)),
    item(t('aboutLibsLabel'), link('SDL2 (zlib)', `${base}LICENSE-zlib-SDL2.txt`), ' · ', link('Emscripten (MIT/NCSA)', `${base}LICENSE-Emscripten-MIT-NCSA.txt`)),
  );

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'bapp-doom-btn bapp-doom-about-close';
  close.textContent = t('aboutClose');
  panel.append(title, intro, list, close);
  return panel;
}
