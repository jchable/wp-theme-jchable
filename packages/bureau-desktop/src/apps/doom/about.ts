/** Panneau « À propos de DOOM.EXE » : licences et lien vers le code source (obligations de la GPL). */

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
  panel.setAttribute('aria-label', 'À propos de DOOM.EXE');

  const title = document.createElement('h2');
  title.textContent = 'À propos de DOOM.EXE';
  const intro = document.createElement('p');
  intro.textContent =
    'Le moteur est Chocolate Doom (portage WebAssembly de Cloudflare), un logiciel libre sous licence GPL v2 ou ultérieure. ' +
    'Les données du jeu sont celles de DOOM shareware (épisode 1), © id Software, que l’éditeur autorise à redistribuer gratuitement et sans modification.';

  const list = document.createElement('ul');
  list.append(
    item('Code source du moteur : ', link('code source sur GitHub (version exacte)', SOURCE_URL)),
    item('Notre construction et les deux corrections : ', link('README de la construction', `${base}README.md`)),
    item('Licence du moteur : ', link('GPL v2', `${base}LICENSE-GPL-2.0.txt`)),
    item('Données du jeu : ', link('licence shareware de DOOM', `${base}LICENSE-DOOM1-SHAREWARE.txt`)),
    item('Bibliothèques : ', link('SDL2 (zlib)', `${base}LICENSE-zlib-SDL2.txt`), ' · ', link('Emscripten (MIT/NCSA)', `${base}LICENSE-Emscripten-MIT-NCSA.txt`)),
  );

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'bapp-doom-btn bapp-doom-about-close';
  close.textContent = 'Fermer ce panneau';
  panel.append(title, intro, list, close);
  return panel;
}
