import { SAVER_DELAYS } from '../../core/prefs';
import type { AppContext, DesktopSettings } from '../../core/types';
import { SCENE_IDS, sceneDescription, sceneLabel } from '../../ui/screensaver/scenes/catalog';
import { t } from './i18n';

let root: HTMLElement | null = null;
let uid = 0;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function section(title: string): { box: HTMLFieldSetElement } {
  const box = el('fieldset', 'bset-section');
  box.append(el('legend', undefined, title));
  return { box };
}

/** Une case à cocher ou un bouton radio avec son étiquette (le champ est dans le <label>). */
function choice(type: 'radio' | 'checkbox', label: string, options: { name?: string; value?: string; checked: boolean; className?: string; description?: string }): {
  row: HTMLLabelElement;
  input: HTMLInputElement;
} {
  const row = el('label', 'bset-choice');
  const input = el('input', options.className);
  input.type = type;
  if (options.name) input.name = options.name;
  if (options.value !== undefined) input.value = options.value;
  input.checked = options.checked;
  const text = el('span', 'bset-text');
  text.append(el('span', 'bset-label', label));
  if (options.description) text.append(el('span', 'bset-desc', options.description));
  row.append(input, text);
  return { row, input };
}

const delayLabel = (minutes: number): string => t(minutes === 1 ? 'minute' : 'minutes', { n: minutes });

/** « Préférences » : écran de veille, langue, son, rangement des icônes. Chaque changement s'applique tout de suite. */
export function mount(host: HTMLElement, ctx: AppContext): void {
  ctx.setTitle(t('title'));
  root = host;
  const read = (): Readonly<DesktopSettings> =>
    ctx.settings?.get() ?? { lang: 'auto', sound: false, screensaver: true, saverScene: 'tunnel', saverDelayMin: 3 };
  const change = (patch: Partial<DesktopSettings>): void => ctx.settings?.update(patch);
  const current = read();
  const id = ++uid;

  const wrap = el('div', 'bset');

  // --- Écran de veille ---
  const saver = section(t('saver'));
  const scenes = el('div', 'bset-scenes');
  scenes.setAttribute('role', 'radiogroup');
  scenes.setAttribute('aria-label', t('saver'));
  let selected = current.saverScene;
  for (const scene of SCENE_IDS) {
    const { row, input } = choice('radio', sceneLabel(scene), {
      name: 'bset-scene',
      value: scene,
      checked: scene === current.saverScene,
      description: sceneDescription(scene),
    });
    input.addEventListener('change', () => {
      selected = scene;
      change({ saverScene: scene });
    });
    scenes.append(row);
  }

  const preview = el('button', 'bset-btn bset-preview', t('preview'));
  preview.type = 'button';
  preview.title = t('previewHint');
  preview.addEventListener('click', () => ctx.previewScreensaver?.(selected));

  const auto = choice('checkbox', t('saverAuto'), { checked: current.screensaver, className: 'bset-auto' });
  const delayRow = el('div', 'bset-delay-row');
  const delayLabelEl = el('label', 'bset-inline', t('saverDelay'));
  const select = el('select', 'bset-delay');
  select.id = `bset-delay-${id}`;
  delayLabelEl.htmlFor = select.id;
  for (const minutes of SAVER_DELAYS) {
    const option = el('option', undefined, delayLabel(minutes));
    option.value = String(minutes);
    select.append(option);
  }
  select.value = String(current.saverDelayMin);
  select.disabled = !current.screensaver;
  select.addEventListener('change', () => change({ saverDelayMin: Number(select.value) }));
  auto.input.addEventListener('change', () => {
    select.disabled = !auto.input.checked;
    change({ screensaver: auto.input.checked });
  });
  delayRow.append(delayLabelEl, select);
  saver.box.append(scenes, preview, auto.row, delayRow);

  // --- Langue ---
  const language = section(t('language'));
  for (const lang of ['auto', 'fr', 'en'] as const) {
    const { row, input } = choice('radio', t(`lang.${lang}`), { name: 'bset-lang', value: lang, checked: current.lang === lang });
    input.addEventListener('change', () => change({ lang }));
    language.box.append(row);
  }

  // --- Son ---
  const sound = section(t('sound'));
  const soundChoice = choice('checkbox', t('soundOn'), { checked: current.sound, className: 'bset-sound' });
  soundChoice.input.addEventListener('change', () => change({ sound: soundChoice.input.checked }));
  sound.box.append(soundChoice.row);

  // --- Bureau ---
  const desktop = section(t('desktop'));
  const reset = el('button', 'bset-btn bset-reset', t('reset'));
  reset.type = 'button';
  reset.addEventListener('click', () => ctx.resetIcons?.());
  desktop.box.append(reset);

  const close = el('button', 'bset-btn bset-close', t('close'));
  close.type = 'button';
  close.addEventListener('click', () => ctx.close());

  wrap.append(saver.box, language.box, sound.box, desktop.box, close);
  host.replaceChildren(wrap);
  scenes.querySelector<HTMLInputElement>('input:checked')?.focus();
}

export function unmount(): void {
  root?.replaceChildren();
  root = null;
}
