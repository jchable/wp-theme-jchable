import { afterEach, describe, expect, it, vi } from 'vitest';
import { missingKeys, setLang } from '../../core/i18n';
import { SAVER_DELAYS } from '../../core/prefs';
import type { AppContext, BureauConfig, DesktopSettings } from '../../core/types';
import { SCENE_IDS } from '../../ui/screensaver/scenes/catalog';
import { messages } from './i18n';
import { mount, unmount } from './index';

function makeCtx(initial: Partial<DesktopSettings> = {}, withCapabilities = true) {
  let state: DesktopSettings = { lang: 'auto', sound: false, screensaver: true, saverScene: 'tunnel', saverDelayMin: 3, ...initial };
  const update = vi.fn((patch: Partial<DesktopSettings>) => {
    state = { ...state, ...patch };
  });
  const previewScreensaver = vi.fn();
  const resetIcons = vi.fn();
  const setTitle = vi.fn();
  const close = vi.fn();
  const ctx: AppContext = {
    config: { siteName: 'Test' } as BureauConfig,
    args: {},
    storage: { get: () => null, set: () => undefined, remove: () => undefined },
    setTitle,
    close,
    openApp: vi.fn(),
    openBsod: vi.fn(),
    playSound: vi.fn(),
    fetchJson: vi.fn(),
    ...(withCapabilities ? { settings: { get: () => state, update }, previewScreensaver, resetIcons } : {}),
  };
  return { ctx, update, previewScreensaver, resetIcons, setTitle, close, state: () => state };
}

const host = () => {
  const el = document.createElement('div');
  document.body.append(el);
  return el;
};

afterEach(() => {
  unmount();
  document.body.innerHTML = '';
});

describe('Préférences', () => {
  it('a les mêmes clés en français et en anglais', () => {
    expect(missingKeys(messages)).toEqual([]);
  });

  it('propose les six écrans de veille, celui du visiteur est coché', () => {
    const el = host();
    const { ctx, setTitle } = makeCtx({ saverScene: 'planet' });
    mount(el, ctx);
    expect(setTitle).toHaveBeenCalledWith('Préférences');
    const radios = [...el.querySelectorAll<HTMLInputElement>('input[name="bset-scene"]')];
    expect(radios.map((r) => r.value)).toEqual([...SCENE_IDS]);
    expect(radios.filter((r) => r.checked).map((r) => r.value)).toEqual(['planet']);
    expect(el.textContent).toContain('Planète de code');
    expect(el.textContent).toContain('Tunnel néon');
  });

  it('choisir une scène l’enregistre', () => {
    const el = host();
    const { ctx, update } = makeCtx();
    mount(el, ctx);
    el.querySelector<HTMLInputElement>('input[value="voxel"]')!.click();
    expect(update).toHaveBeenCalledWith({ saverScene: 'voxel' });
  });

  it('« Aperçu » lance la scène cochée', () => {
    const el = host();
    const { ctx, previewScreensaver } = makeCtx({ saverScene: 'graph' });
    mount(el, ctx);
    el.querySelector<HTMLInputElement>('input[value="windows"]')!.click();
    el.querySelector<HTMLButtonElement>('.bset-preview')!.click();
    expect(previewScreensaver).toHaveBeenCalledWith('windows');
  });

  it('active ou coupe l’écran de veille automatique', () => {
    const el = host();
    const { ctx, update } = makeCtx({ screensaver: true });
    mount(el, ctx);
    const box = el.querySelector<HTMLInputElement>('.bset-auto')!;
    expect(box.checked).toBe(true);
    box.click();
    expect(update).toHaveBeenCalledWith({ screensaver: false });
  });

  it('le délai propose les durées permises et enregistre le choix', () => {
    const el = host();
    const { ctx, update } = makeCtx({ saverDelayMin: 5 });
    mount(el, ctx);
    const select = el.querySelector<HTMLSelectElement>('.bset-delay')!;
    expect([...select.options].map((o) => Number(o.value))).toEqual([...SAVER_DELAYS]);
    expect(select.value).toBe('5');
    expect(select.options[0]!.textContent).toBe('1 minute');
    expect(select.options[1]!.textContent).toBe('2 minutes');
    select.value = '15';
    select.dispatchEvent(new Event('change'));
    expect(update).toHaveBeenCalledWith({ saverDelayMin: 15 });
  });

  it('le délai et l’aperçu sont désactivés tant que l’écran de veille automatique est coupé… sauf l’aperçu', () => {
    const el = host();
    const { ctx } = makeCtx({ screensaver: false });
    mount(el, ctx);
    expect(el.querySelector<HTMLSelectElement>('.bset-delay')!.disabled).toBe(true);
    expect(el.querySelector<HTMLButtonElement>('.bset-preview')!.disabled).toBe(false);
    el.querySelector<HTMLInputElement>('.bset-auto')!.click();
    expect(el.querySelector<HTMLSelectElement>('.bset-delay')!.disabled).toBe(false);
  });

  it('choisit la langue', () => {
    const el = host();
    const { ctx, update } = makeCtx({ lang: 'auto' });
    mount(el, ctx);
    const langs = [...el.querySelectorAll<HTMLInputElement>('input[name="bset-lang"]')];
    expect(langs.map((r) => r.value)).toEqual(['auto', 'fr', 'en']);
    expect(langs.find((r) => r.checked)?.value).toBe('auto');
    langs.find((r) => r.value === 'en')!.click();
    expect(update).toHaveBeenCalledWith({ lang: 'en' });
  });

  it('active ou coupe le son', () => {
    const el = host();
    const { ctx, update } = makeCtx({ sound: false });
    mount(el, ctx);
    el.querySelector<HTMLInputElement>('.bset-sound')!.click();
    expect(update).toHaveBeenCalledWith({ sound: true });
  });

  it('« Réorganiser les icônes » et « Fermer »', () => {
    const el = host();
    const { ctx, resetIcons, close } = makeCtx();
    mount(el, ctx);
    el.querySelector<HTMLButtonElement>('.bset-reset')!.click();
    expect(resetIcons).toHaveBeenCalledTimes(1);
    el.querySelector<HTMLButtonElement>('.bset-close')!.click();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('chaque réglage a une étiquette accessible', () => {
    const el = host();
    mount(el, makeCtx().ctx);
    for (const control of el.querySelectorAll<HTMLElement>('input, select')) {
      const labelled = control.closest('label') ?? el.querySelector(`label[for="${control.id}"]`);
      expect(labelled, control.outerHTML).not.toBeNull();
    }
    expect(el.querySelectorAll('fieldset > legend').length).toBeGreaterThanOrEqual(3);
  });

  it('s’affiche en anglais', () => {
    setLang('en');
    const el = host();
    const { ctx, setTitle } = makeCtx();
    mount(el, ctx);
    expect(setTitle).toHaveBeenCalledWith('Settings');
    expect(el.textContent).toContain('Neon tunnel');
    expect(el.textContent).toContain('Preview');
    expect(el.querySelector<HTMLSelectElement>('.bset-delay')!.options[0]!.textContent).toBe('1 minute');
  });

  it('sans les capacités du bureau, s’affiche sans planter', () => {
    const el = host();
    const { ctx } = makeCtx({}, false);
    expect(() => mount(el, ctx)).not.toThrow();
    el.querySelector<HTMLButtonElement>('.bset-preview')!.click();
    el.querySelector<HTMLButtonElement>('.bset-reset')!.click();
  });
});
