import type { AppContext } from '../../core/types';
import { t } from './i18n';

let root: HTMLElement | null = null;

const ROWS: ReadonlyArray<readonly [() => string, () => string]> = [
  [() => t('system'), () => t('systemValue')],
  [() => t('user'), () => t('userValue')],
  [() => t('processor'), () => t('processorValue')],
  [() => t('memory'), () => t('memoryValue')],
  [() => t('screen'), () => t('screenValue', { width: window.innerWidth, height: window.innerHeight })],
  [() => t('status'), () => t('statusValue')],
];

/** « Propriétés » : une boîte de dialogue pour rire, ouverte par le menu contextuel du bureau. */
export function mount(el: HTMLElement, ctx: AppContext): void {
  ctx.setTitle(t('title'));
  root = el;
  const wrap = document.createElement('div');
  wrap.className = 'bprops';
  const list = document.createElement('dl');
  for (const [label, value] of ROWS) {
    const term = document.createElement('dt');
    term.textContent = label();
    const desc = document.createElement('dd');
    desc.textContent = value();
    list.append(term, desc);
  }
  const ok = document.createElement('button');
  ok.type = 'button';
  ok.className = 'bprops-ok';
  ok.textContent = t('ok');
  ok.addEventListener('click', () => ctx.close());
  wrap.append(list, ok);
  el.replaceChildren(wrap);
  ok.focus();
}

export function unmount(): void {
  root?.replaceChildren();
  root = null;
}
