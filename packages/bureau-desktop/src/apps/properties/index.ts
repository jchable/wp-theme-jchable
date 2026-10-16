import type { AppContext } from '../../core/types';

let root: HTMLElement | null = null;

const ROWS: ReadonlyArray<readonly [string, () => string]> = [
  ['Système', () => 'jchable Bureau 0.1 (édition « presque stable »)'],
  ['Utilisateur', () => 'visiteur, aimablement enregistré nulle part'],
  ['Processeur', () => 'un cerveau, avec un peu de café'],
  ['Mémoire', () => '640 Ko (ça devrait suffire à tout le monde)'],
  ['Écran', () => `${window.innerWidth} × ${window.innerHeight} pixels`],
  ['Statut', () => 'Tout va bien. Probablement.'],
];

/** « Propriétés » : une boîte de dialogue pour rire, ouverte par le menu contextuel du bureau. */
export function mount(el: HTMLElement, ctx: AppContext): void {
  ctx.setTitle('Propriétés système');
  root = el;
  const wrap = document.createElement('div');
  wrap.className = 'bprops';
  const list = document.createElement('dl');
  for (const [label, value] of ROWS) {
    const term = document.createElement('dt');
    term.textContent = label;
    const desc = document.createElement('dd');
    desc.textContent = value();
    list.append(term, desc);
  }
  const ok = document.createElement('button');
  ok.type = 'button';
  ok.className = 'bprops-ok';
  ok.textContent = 'OK';
  ok.addEventListener('click', () => ctx.close());
  wrap.append(list, ok);
  el.replaceChildren(wrap);
  ok.focus();
}

export function unmount(): void {
  root?.replaceChildren();
  root = null;
}
