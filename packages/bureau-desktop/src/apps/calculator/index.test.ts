import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { missingKeys, setLang } from '../../core/i18n';
import type { AppContext } from '../../core/types';
import { messages } from './i18n';
import { mount, unmount } from './index';

function makeCtx() {
  return {
    config: {},
    args: {},
    storage: { get: () => null, set: vi.fn(), remove: vi.fn() },
    setTitle: vi.fn(),
    close: vi.fn(),
    openApp: vi.fn(),
    openBsod: vi.fn(),
    playSound: vi.fn(),
    fetchJson: vi.fn(),
  } as unknown as AppContext & { setTitle: ReturnType<typeof vi.fn> };
}

let host: HTMLElement;
let win: HTMLElement;
let el: HTMLElement;

beforeEach(() => {
  // La vraie fenêtre : le clavier est écouté sur la fenêtre (focus n'importe où dedans), pas sur la page.
  win = document.createElement('section');
  win.className = 'bwin';
  el = document.createElement('div');
  win.append(el);
  host = document.createElement('div');
  host.append(win);
  document.body.append(host);
});
afterEach(() => {
  unmount();
  host.remove();
});

const button = (name: string): HTMLButtonElement => {
  const found = Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((b) => (b.getAttribute('aria-label') ?? b.textContent) === name);
  if (!found) throw new Error(`bouton introuvable : ${name}`);
  return found;
};
const display = (): string => el.querySelector('[role="status"]')!.textContent ?? '';
const click = (...names: string[]): void => names.forEach((n) => button(n).click());
const key = (k: string, target: EventTarget = win, init: KeyboardEventInit = {}): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
};

describe('messages de la calculatrice', () => {
  it('les deux langues ont les mêmes clés, toutes renseignées', () => {
    expect(missingKeys(messages)).toEqual([]);
  });
});

describe('structure', () => {
  it('donne le titre à la fenêtre', () => {
    const ctx = makeCtx();
    mount(el, ctx);
    expect(ctx.setTitle).toHaveBeenCalledWith('Calculatrice');
  });

  it('a 27 vrais boutons nommés, dans la disposition de Windows 95', () => {
    mount(el, makeCtx());
    const buttons = Array.from(el.querySelectorAll('button'));
    expect(buttons).toHaveLength(4 + 3 + 20);
    for (const b of buttons) {
      expect(b.type).toBe('button');
      const name = b.getAttribute('aria-label') ?? b.textContent ?? '';
      expect(name).toBeTruthy();
      // Étiquette dans le nom (WCAG 2.5.3) : un texte visible fait partie du nom accessible (les symboles seuls ont un mot).
      const visible = b.textContent ?? '';
      if (/[0-9a-z]/i.test(visible)) expect(name.toLowerCase()).toContain(visible.toLowerCase());
    }
    expect(buttons.map((b) => b.textContent)).toEqual([
      '←', 'CE', 'C',
      'MC', '7', '8', '9', '÷', '√',
      'MR', '4', '5', '6', '×', '%',
      'MS', '1', '2', '3', '−', '1/x',
      'M+', '0', '±', ',', '+', '=',
    ]);
  });

  it("l'afficheur est une zone de statut annoncée poliment", () => {
    mount(el, makeCtx());
    const status = el.querySelector('[role="status"]')!;
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.textContent).toBe('0');
  });
});

describe('calculs à la souris', () => {
  it('additionne 7 et 8', () => {
    mount(el, makeCtx());
    click('7', 'Plus', '8', 'Égale');
    expect(display()).toBe('15');
  });

  it('affiche une virgule décimale en français', () => {
    mount(el, makeCtx());
    click('1', 'Virgule', '5');
    expect(display()).toBe('1,5');
  });

  it('0,1 + 0,2 donne 0,3', () => {
    mount(el, makeCtx());
    click('Virgule', '1', 'Plus', 'Virgule', '2', 'Égale');
    expect(display()).toBe('0,3');
  });

  it('division par zéro : message, puis C récupère', () => {
    mount(el, makeCtx());
    click('5', 'Divisé par', '0', 'Égale');
    expect(display()).toBe('Division par zéro impossible');
    click('7');
    expect(display()).toBe('Division par zéro impossible');
    click('C Tout effacer');
    expect(display()).toBe('0');
    click('7');
    expect(display()).toBe('7');
  });

  it("racine d'un négatif : entrée incorrecte", () => {
    mount(el, makeCtx());
    click('4', 'Changer le signe', 'Racine carrée');
    expect(display()).toBe('Entrée incorrecte');
  });

  it('la mémoire allume et éteint l’indicateur M', () => {
    mount(el, makeCtx());
    const indicator = el.querySelector<HTMLElement>('[role="img"]')!;
    expect(indicator.getAttribute('aria-label')).toBe('Mémoire utilisée');
    expect(indicator.hidden).toBe(true);
    click('9', 'MS Stocker en mémoire');
    expect(indicator.hidden).toBe(false);
    expect(indicator.textContent).toBe('M');
    click('C Tout effacer', 'MR Rappeler la mémoire');
    expect(display()).toBe('9');
    click('M+ Ajouter à la mémoire', 'MR Rappeler la mémoire');
    expect(display()).toBe('18');
    click('MC Effacer la mémoire');
    expect(indicator.hidden).toBe(true);
  });

  it('retour arrière et CE', () => {
    mount(el, makeCtx());
    click('1', '2', '3', 'Retour arrière');
    expect(display()).toBe('12');
    click('CE Effacer l’entrée');
    expect(display()).toBe('0');
  });
});

describe('clavier', () => {
  it('chiffres, opérations, Entrée', () => {
    mount(el, makeCtx());
    for (const k of ['1', '2', '+', '3', 'Enter']) key(k);
    expect(display()).toBe('15');
  });

  it('point et virgule, * et /, = et Retour arrière', () => {
    mount(el, makeCtx());
    for (const k of ['1', ',', '5', '*', '4', '=']) key(k);
    expect(display()).toBe('6');
    for (const k of ['/', '.', '5', '=']) key(k);
    expect(display()).toBe('12');
    for (const k of ['7', '8', 'Backspace']) key(k);
    expect(display()).toBe('7');
  });

  it('% et @ (racine)', () => {
    mount(el, makeCtx());
    for (const k of ['2', '0', '0', '+', '1', '0', '%']) key(k);
    expect(display()).toBe('20');
    key('Escape');
    for (const k of ['8', '1', '@']) key(k);
    expect(display()).toBe('9');
  });

  it('Échap efface tout et garde l’événement ; Suppr n’efface que la saisie', () => {
    mount(el, makeCtx());
    for (const k of ['5', '+', '3']) key(k);
    key('Delete');
    expect(display()).toBe('0');
    for (const k of ['4', 'Enter']) key(k);
    expect(display()).toBe('9');
    const esc = key('Escape');
    expect(display()).toBe('0');
    expect(esc.defaultPrevented).toBe(true);
  });

  it("quand tout est déjà effacé, Échap n'est pas pris : la fenêtre peut se fermer", () => {
    mount(el, makeCtx());
    const esc = key('Escape');
    expect(esc.defaultPrevented).toBe(false);
  });

  it('les touches avec Ctrl, Alt ou Méta ne sont pas volées', () => {
    mount(el, makeCtx());
    const event = key('1', win, { ctrlKey: true });
    expect(event.defaultPrevented).toBe(false);
    expect(display()).toBe('0');
  });

  it('les touches inconnues ne sont pas volées', () => {
    mount(el, makeCtx());
    expect(key('a').defaultPrevented).toBe(false);
    expect(key('Tab').defaultPrevented).toBe(false);
  });

  it('les touches prises ne remontent pas à la page', () => {
    mount(el, makeCtx());
    const onPage = vi.fn();
    document.addEventListener('keydown', onPage);
    key('5');
    key('a');
    document.removeEventListener('keydown', onPage);
    expect(onPage).toHaveBeenCalledTimes(1); // seulement la touche « a », pas le « 5 » consommé
  });

  it('ne prend rien quand le focus est hors de la fenêtre', () => {
    mount(el, makeCtx());
    const outside = document.createElement('input');
    document.body.append(outside);
    key('5', outside);
    key('5', document.body);
    expect(display()).toBe('0');
    outside.remove();
  });

  it("après le démontage, l'écouteur est retiré", () => {
    const remove = vi.spyOn(win, 'removeEventListener');
    mount(el, makeCtx());
    unmount();
    expect(remove).toHaveBeenCalledWith('keydown', expect.any(Function), true);
    key('5');
    expect(el.children).toHaveLength(0);
  });

  it('Entrée sur un bouton cliqué à la souris calcule, au lieu de répéter le bouton', () => {
    mount(el, makeCtx());
    click('2', 'Plus', '3');
    const event = key('Enter', button('3'));
    expect(event.defaultPrevented).toBe(true);
    expect(display()).toBe('5');
  });

  it('après Tab, Entrée active le bouton qui a le focus ; un clic ou une frappe de calcul lui redonne le sens de « = »', () => {
    mount(el, makeCtx());
    key('Tab');
    expect(key('Enter', button('3')).defaultPrevented).toBe(false); // le navigateur active le bouton
    win.dispatchEvent(new Event('pointerdown'));
    expect(key('Enter', button('3')).defaultPrevented).toBe(true);
    key('Tab');
    key('5'); // une frappe de calcul
    expect(key('Enter', button('3')).defaultPrevented).toBe(true);
  });
});

describe('anglais', () => {
  it('noms de boutons, séparateur décimal et messages en anglais', () => {
    setLang('en');
    const ctx = makeCtx();
    mount(el, ctx);
    expect(ctx.setTitle).toHaveBeenCalledWith('Calculator');
    expect(button('7').textContent).toBe('7');
    expect(button('Decimal point').textContent).toBe('.');
    click('1', 'Decimal point', '5');
    expect(display()).toBe('1.5');
    click('C Clear all', '5', 'Divided by', '0', 'Equals');
    expect(display()).toBe('Cannot divide by zero');
    click('C Clear all', '4', 'Change sign', 'Square root');
    expect(display()).toBe('Invalid input');
  });
});
