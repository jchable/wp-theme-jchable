import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { missingKeys, setLang } from '../../core/i18n';
import type { AppContext } from '../../core/types';
import { messages } from './i18n';
import { mount, unmount } from './index';
import { linePoints } from './line';

const W = 640;
const H = 400;

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

/** Le canevas de jsdom n'existe pas : un faux contexte garde la dernière image envoyée. */
let shown: { data: Uint8ClampedArray; width: number; height: number } | null;
let putCount: number;
let blobCallback: ((blob: Blob | null) => void) | null;
let downloads: Array<{ name: string; href: string }>;

class FakeImageData {
  constructor(
    public data: Uint8ClampedArray,
    public width: number,
    public height: number,
  ) {}
}

let host: HTMLElement;
let win: HTMLElement;
let el: HTMLElement;

beforeEach(() => {
  shown = null;
  putCount = 0;
  blobCallback = null;
  downloads = [];
  vi.stubGlobal('ImageData', FakeImageData);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((kind: string) => {
    if (kind !== '2d') return null;
    return {
      putImageData: (image: FakeImageData) => {
        shown = image;
        putCount++;
      },
    };
  }) as never);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(((cb: (blob: Blob | null) => void) => {
    blobCallback = cb;
  }) as never);
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, right: W, bottom: H, width: W, height: H, x: 0, y: 0, toJSON: () => ({}) });
  URL.createObjectURL = vi.fn(() => 'blob:fake');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    downloads.push({ name: this.download, href: this.href });
  });

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
  vi.unstubAllGlobals();
});

type RGB = [number, number, number];
const pixel = (x: number, y: number): RGB => {
  const d = shown!.data;
  const i = (y * W + x) * 4;
  return [d[i]!, d[i + 1]!, d[i + 2]!];
};
const BLACK: RGB = [0, 0, 0];
const WHITE: RGB = [255, 255, 255];
const RED: RGB = [255, 0, 0];
const BLUE: RGB = [0, 0, 255];

const canvas = (): HTMLCanvasElement => el.querySelector('canvas')!;
const byLabel = (label: string, within: ParentNode = el): HTMLButtonElement => {
  const found = Array.from(within.querySelectorAll<HTMLButtonElement>('button')).find(
    (b) => (b.getAttribute('aria-label') ?? b.textContent) === label,
  );
  if (!found) throw new Error(`bouton introuvable : ${label}`);
  return found;
};
const tool = (id: string): HTMLButtonElement => el.querySelector<HTMLButtonElement>(`button[data-tool="${id}"]`)!;
const swatch = (hex: string): HTMLButtonElement => el.querySelector<HTMLButtonElement>(`button[data-color="${hex}"]`)!;
const status = (): string => el.querySelector('[role="status"]')!.textContent ?? '';

interface PointerInit {
  button?: number;
  shiftKey?: boolean;
  pointerId?: number;
}
const ptr = (type: string, x: number, y: number, init: PointerInit = {}): PointerEvent =>
  new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: init.button ?? 0, buttons: type === 'pointerup' ? 0 : 1, shiftKey: init.shiftKey ?? false, pointerId: init.pointerId ?? 1 });
function drag(points: Array<[number, number]>, init: PointerInit = {}): void {
  const [first, ...rest] = points;
  canvas().dispatchEvent(ptr('pointerdown', first![0], first![1], init));
  for (const [x, y] of rest) canvas().dispatchEvent(ptr('pointermove', x, y, init));
  const last = points[points.length - 1]!;
  canvas().dispatchEvent(ptr('pointerup', last[0], last[1], init));
}
const key = (k: string, init: KeyboardEventInit = {}, target: EventTarget = win): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
};

describe('messages de Paint', () => {
  it('les deux langues ont les mêmes clés, toutes renseignées', () => {
    expect(missingKeys(messages)).toEqual([]);
  });
});

describe('structure et accessibilité', () => {
  it('donne le titre à la fenêtre', () => {
    const ctx = makeCtx();
    mount(el, ctx);
    expect(ctx.setTitle).toHaveBeenCalledWith('Paint');
  });

  it('un canevas de 640×400, avec un rôle d’image et un nom, blanc au départ', () => {
    mount(el, makeCtx());
    expect(canvas().width).toBe(W);
    expect(canvas().height).toBe(H);
    expect(canvas().getAttribute('role')).toBe('img');
    expect(canvas().getAttribute('aria-label')).toBe('Zone de dessin');
    expect(pixel(0, 0)).toEqual(WHITE);
    expect(pixel(639, 399)).toEqual(WHITE);
  });

  it('huit outils, boutons nommés avec aria-pressed ; le crayon est actif', () => {
    mount(el, makeCtx());
    const group = el.querySelector('[role="group"][aria-label="Outils"]')!;
    const names = Array.from(group.querySelectorAll('button')).map((b) => b.getAttribute('aria-label'));
    expect(names).toEqual(['Crayon', 'Pinceau', 'Gomme', 'Ligne', 'Rectangle', 'Ellipse', 'Pot de peinture', 'Pipette']);
    for (const b of Array.from(group.querySelectorAll('button'))) expect(b.type).toBe('button');
    expect(tool('pencil').getAttribute('aria-pressed')).toBe('true');
    expect(tool('brush').getAttribute('aria-pressed')).toBe('false');
    tool('brush').click();
    expect(tool('pencil').getAttribute('aria-pressed')).toBe('false');
    expect(tool('brush').getAttribute('aria-pressed')).toBe('true');
  });

  it('quatre épaisseurs, l’une est active', () => {
    mount(el, makeCtx());
    const sizes = Array.from(el.querySelectorAll<HTMLButtonElement>('[aria-label="Épaisseur"] button'));
    expect(sizes.map((b) => b.getAttribute('aria-label'))).toEqual(['1 px', '2 px', '4 px', '8 px']);
    expect(sizes.filter((b) => b.getAttribute('aria-pressed') === 'true')).toHaveLength(1);
    sizes[2]!.click();
    expect(sizes[2]!.getAttribute('aria-pressed')).toBe('true');
    expect(sizes[0]!.getAttribute('aria-pressed')).toBe('false');
  });

  it('le style des formes n’apparaît qu’avec le rectangle et l’ellipse', () => {
    mount(el, makeCtx());
    const styles = el.querySelector<HTMLElement>('[aria-label="Style de forme"]')!;
    expect(styles.hidden).toBe(true);
    tool('rect').click();
    expect(styles.hidden).toBe(false);
    expect(Array.from(styles.querySelectorAll('button')).map((b) => b.getAttribute('aria-label'))).toEqual(['Contour', 'Contour et fond', 'Plein']);
    tool('line').click();
    expect(styles.hidden).toBe(true);
    tool('ellipse').click();
    expect(styles.hidden).toBe(false);
  });

  it('une palette de 28 boutons nommés', () => {
    mount(el, makeCtx());
    const group = el.querySelector('[role="group"][aria-label="Palette de couleurs"]')!;
    const buttons = Array.from(group.querySelectorAll<HTMLButtonElement>('button'));
    expect(buttons).toHaveLength(28);
    expect(buttons[0]!.getAttribute('aria-label')).toBe('Noir');
    expect(buttons[14]!.getAttribute('aria-label')).toBe('Blanc');
    expect(buttons[2]!.getAttribute('aria-label')).toBe('Bordeaux');
    for (const b of buttons) expect(b.type).toBe('button');
    expect(group.getAttribute('aria-describedby')).toBeTruthy();
    expect(el.querySelector(`#${group.getAttribute('aria-describedby')}`)!.textContent).toContain('Clic droit');
  });

  it('couleurs de premier plan et d’arrière-plan annoncées', () => {
    mount(el, makeCtx());
    const colors = el.querySelector('[role="img"][aria-label^="Premier plan"]')!;
    expect(colors.getAttribute('aria-label')).toBe('Premier plan : Noir. Arrière-plan : Blanc.');
  });

  it('une barre d’état avec les coordonnées (masquées aux lecteurs d’écran)', () => {
    mount(el, makeCtx());
    expect(status()).toBe('Prêt');
    canvas().dispatchEvent(ptr('pointermove', 12, 34));
    const coords = el.querySelector<HTMLElement>('.bapp-paint-coords')!;
    expect(coords.textContent).toBe('12, 34');
    expect(coords.getAttribute('aria-hidden')).toBe('true');
    canvas().dispatchEvent(new PointerEvent('pointerleave', { bubbles: false }));
    expect(coords.textContent).toBe('');
  });
});

describe('couleurs', () => {
  it('un clic choisit le premier plan, un clic droit ou Maj + clic l’arrière-plan', () => {
    mount(el, makeCtx());
    swatch('#ff0000').click();
    expect(el.querySelector('[role="img"][aria-label^="Premier plan"]')!.getAttribute('aria-label')).toBe('Premier plan : Rouge. Arrière-plan : Blanc.');
    swatch('#0000ff').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    expect(el.querySelector('[role="img"][aria-label^="Premier plan"]')!.getAttribute('aria-label')).toBe('Premier plan : Rouge. Arrière-plan : Bleu.');
    swatch('#00ff00').dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }));
    expect(el.querySelector('[role="img"][aria-label^="Premier plan"]')!.getAttribute('aria-label')).toBe('Premier plan : Rouge. Arrière-plan : Vert vif.');
  });

  it('le clic droit sur la palette n’ouvre pas le menu du navigateur', () => {
    mount(el, makeCtx());
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    swatch('#0000ff').dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('annonce le changement de couleur', () => {
    mount(el, makeCtx());
    swatch('#ff0000').click();
    expect(status()).toBe('Premier plan : Rouge');
  });
});

describe('dessin', () => {
  it('le crayon trace en continu : un seul mouvement relie les points sans trou', () => {
    mount(el, makeCtx());
    drag([[10, 10], [90, 50]]);
    for (const p of linePoints(10, 10, 90, 50)) expect(pixel(p.x, p.y)).toEqual(BLACK);
    expect(pixel(10, 11)).toEqual(WHITE); // 1 pixel d'épaisseur
  });

  it('un simple clic dessine un point', () => {
    mount(el, makeCtx());
    drag([[100, 100]]);
    expect(pixel(100, 100)).toEqual(BLACK);
  });

  it('dessine avec la couleur de premier plan, le clic droit avec l’arrière-plan', () => {
    mount(el, makeCtx());
    swatch('#ff0000').click();
    swatch('#0000ff').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    drag([[10, 10], [60, 10]]);
    drag([[10, 30], [60, 30]], { button: 2 });
    expect(pixel(30, 10)).toEqual(RED);
    expect(pixel(30, 30)).toEqual(BLUE);
  });

  it('le pinceau est épais, l’épaisseur compte', () => {
    mount(el, makeCtx());
    tool('brush').click();
    el.querySelector<HTMLButtonElement>('button[data-size="8"]')!.click();
    drag([[50, 50], [100, 50]]);
    expect(pixel(75, 47)).toEqual(BLACK);
    expect(pixel(75, 53)).toEqual(BLACK);
    expect(pixel(75, 60)).toEqual(WHITE);
  });

  it('la gomme peint avec la couleur d’arrière-plan', () => {
    mount(el, makeCtx());
    drag([[10, 10], [200, 10]]);
    tool('eraser').click();
    drag([[100, 10], [150, 10]]);
    expect(pixel(50, 10)).toEqual(BLACK);
    expect(pixel(120, 10)).toEqual(WHITE);
  });

  it('une forme s’aperçoit pendant le glisser et se fixe au relâchement', () => {
    mount(el, makeCtx());
    tool('rect').click();
    canvas().dispatchEvent(ptr('pointerdown', 20, 20));
    canvas().dispatchEvent(ptr('pointermove', 80, 60));
    expect(pixel(80, 60)).toEqual(BLACK); // aperçu
    canvas().dispatchEvent(ptr('pointermove', 50, 40));
    expect(pixel(80, 60)).toEqual(WHITE); // l'aperçu précédent est effacé
    expect(pixel(50, 40)).toEqual(BLACK);
    canvas().dispatchEvent(ptr('pointerup', 50, 40));
    expect(pixel(50, 40)).toEqual(BLACK);
    expect(pixel(35, 30)).toEqual(WHITE); // intérieur vide
  });

  it('Maj donne un carré', () => {
    mount(el, makeCtx());
    tool('rect').click();
    drag([[20, 20], [60, 30]], { shiftKey: true });
    expect(pixel(60, 60)).toEqual(BLACK);
  });

  it('la ligne, l’ellipse et le style plein', () => {
    mount(el, makeCtx());
    tool('line').click();
    drag([[10, 10], [110, 10]]);
    expect(pixel(60, 10)).toEqual(BLACK);
    tool('ellipse').click();
    swatch('#0000ff').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    el.querySelector<HTMLButtonElement>('button[data-style="filled"]')!.click();
    drag([[200, 100], [300, 180]]);
    expect(pixel(250, 140)).toEqual(BLUE);
    expect(pixel(200, 100)).toEqual(WHITE); // le coin de la boîte est hors de l'ellipse
  });

  it('Échap annule la forme en cours sans la dessiner', () => {
    mount(el, makeCtx());
    tool('rect').click();
    canvas().dispatchEvent(ptr('pointerdown', 20, 20));
    canvas().dispatchEvent(ptr('pointermove', 80, 60));
    const esc = key('Escape');
    expect(esc.defaultPrevented).toBe(true);
    expect(pixel(80, 60)).toEqual(WHITE);
    canvas().dispatchEvent(ptr('pointerup', 80, 60));
    expect(pixel(80, 60)).toEqual(WHITE);
    expect(byLabel('Annuler').disabled).toBe(true); // rien à annuler
  });

  it('le pot de peinture remplit une zone fermée', () => {
    mount(el, makeCtx());
    tool('rect').click();
    drag([[100, 100], [200, 160]]);
    tool('fill').click();
    swatch('#ff0000').click();
    drag([[150, 130]]);
    expect(pixel(150, 130)).toEqual(RED);
    expect(pixel(101, 101)).toEqual(RED);
    expect(pixel(100, 100)).toEqual(BLACK); // le trait reste
    expect(pixel(10, 10)).toEqual(WHITE); // le dehors aussi
  });

  it('remplir toute la page puis annuler', () => {
    mount(el, makeCtx());
    tool('fill').click();
    swatch('#0000ff').click();
    drag([[5, 5]]);
    expect(pixel(600, 380)).toEqual(BLUE);
    byLabel('Annuler').click();
    expect(pixel(600, 380)).toEqual(WHITE);
  });

  it('la pipette prend la couleur du pixel', () => {
    mount(el, makeCtx());
    swatch('#ff0000').click();
    drag([[10, 10], [60, 10]]);
    swatch('#000000').click();
    tool('picker').click();
    drag([[30, 10]]);
    expect(el.querySelector('[role="img"][aria-label^="Premier plan"]')!.getAttribute('aria-label')).toBe('Premier plan : Rouge. Arrière-plan : Blanc.');
    expect(status()).toBe('Couleur prélevée : #ff0000');
    drag([[500, 300]], { button: 2 }); // le blanc dans l’arrière-plan
    expect(el.querySelector('[role="img"][aria-label^="Premier plan"]')!.getAttribute('aria-label')).toBe('Premier plan : Rouge. Arrière-plan : Blanc.');
  });

  it('un second doigt pendant un tracé est ignoré', () => {
    mount(el, makeCtx());
    canvas().dispatchEvent(ptr('pointerdown', 10, 10, { pointerId: 1 }));
    canvas().dispatchEvent(ptr('pointerdown', 300, 300, { pointerId: 2 }));
    canvas().dispatchEvent(ptr('pointermove', 300, 300, { pointerId: 2 }));
    expect(pixel(300, 300)).toEqual(WHITE);
    canvas().dispatchEvent(ptr('pointerup', 10, 10, { pointerId: 1 }));
  });

  it('un bouton du milieu ne dessine pas', () => {
    mount(el, makeCtx());
    drag([[10, 10], [60, 10]], { button: 1 });
    expect(pixel(30, 10)).toEqual(WHITE);
  });

  it('le menu contextuel du navigateur est désactivé sur le canevas', () => {
    mount(el, makeCtx());
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    canvas().dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('dessiner hors du canevas (pointeur capturé) ne casse rien', () => {
    mount(el, makeCtx());
    expect(() => drag([[10, 10], [-200, 900], [5000, -40]])).not.toThrow();
  });
});

describe('annuler / rétablir', () => {
  it('boutons désactivés tant qu’il n’y a rien à faire', () => {
    mount(el, makeCtx());
    expect(byLabel('Annuler').disabled).toBe(true);
    expect(byLabel('Rétablir').disabled).toBe(true);
    drag([[10, 10], [60, 10]]);
    expect(byLabel('Annuler').disabled).toBe(false);
    expect(byLabel('Rétablir').disabled).toBe(true);
  });

  it('annule puis rétablit un trait, et l’annonce', () => {
    mount(el, makeCtx());
    drag([[10, 10], [60, 10]]);
    byLabel('Annuler').click();
    expect(pixel(30, 10)).toEqual(WHITE);
    expect(status()).toBe('Annulé');
    expect(byLabel('Rétablir').disabled).toBe(false);
    byLabel('Rétablir').click();
    expect(pixel(30, 10)).toEqual(BLACK);
    expect(status()).toBe('Rétabli');
  });

  it('Ctrl+Z annule, Ctrl+Y et Ctrl+Maj+Z rétablissent (focus dans la fenêtre)', () => {
    mount(el, makeCtx());
    drag([[10, 10], [60, 10]]);
    expect(key('z', { ctrlKey: true }).defaultPrevented).toBe(true);
    expect(pixel(30, 10)).toEqual(WHITE);
    key('y', { ctrlKey: true });
    expect(pixel(30, 10)).toEqual(BLACK);
    key('z', { ctrlKey: true });
    key('Z', { ctrlKey: true, shiftKey: true });
    expect(pixel(30, 10)).toEqual(BLACK);
    key('z', { metaKey: true });
    expect(pixel(30, 10)).toEqual(WHITE);
  });

  it('les raccourcis ne marchent pas quand le focus est hors de la fenêtre', () => {
    mount(el, makeCtx());
    drag([[10, 10], [60, 10]]);
    const outside = document.createElement('input');
    document.body.append(outside);
    const event = key('z', { ctrlKey: true }, outside);
    expect(event.defaultPrevented).toBe(false);
    expect(pixel(30, 10)).toEqual(BLACK);
    outside.remove();
  });

  it('la pile est bornée à 30 états', () => {
    mount(el, makeCtx());
    for (let i = 0; i < 35; i++) drag([[10 + i * 3, 10], [11 + i * 3, 10]]);
    let undone = 0;
    while (!byLabel('Annuler').disabled && undone < 100) {
      byLabel('Annuler').click();
      undone++;
    }
    expect(undone).toBe(30);
    expect(pixel(10, 10)).toEqual(BLACK); // les 5 premiers traits sont définitifs
    expect(pixel(10 + 34 * 3, 10)).toEqual(WHITE);
  });

  it('un nouveau trait après une annulation efface les états à rétablir', () => {
    mount(el, makeCtx());
    drag([[10, 10], [60, 10]]);
    byLabel('Annuler').click();
    drag([[10, 50], [60, 50]]);
    expect(byLabel('Rétablir').disabled).toBe(true);
  });
});

describe('Nouveau', () => {
  it('demande confirmation dans la fenêtre, sans boîte du navigateur', () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    mount(el, makeCtx());
    drag([[10, 10], [60, 10]]);
    byLabel('Nouveau').click();
    const box = el.querySelector<HTMLElement>('[role="group"][aria-label="Nouveau dessin"]')!;
    expect(box.hidden).toBe(false);
    expect(box.textContent).toContain('Effacer tout le dessin ?');
    expect(pixel(30, 10)).toEqual(BLACK); // pas encore effacé
    expect(confirmSpy).not.toHaveBeenCalled();
    byLabel('Garder', box).click();
    expect(box.hidden).toBe(true);
    expect(pixel(30, 10)).toEqual(BLACK);
  });

  it('confirmer efface, et Annuler le restitue', () => {
    mount(el, makeCtx());
    drag([[10, 10], [60, 10]]);
    byLabel('Nouveau').click();
    byLabel('Effacer', el.querySelector('[role="group"][aria-label="Nouveau dessin"]')!).click();
    expect(pixel(30, 10)).toEqual(WHITE);
    expect(status()).toBe('Nouveau dessin');
    byLabel('Annuler').click();
    expect(pixel(30, 10)).toEqual(BLACK);
  });

  it('Échap referme la confirmation ; ensuite Échap n’est plus pris', () => {
    mount(el, makeCtx());
    byLabel('Nouveau').click();
    const box = el.querySelector<HTMLElement>('[role="group"][aria-label="Nouveau dessin"]')!;
    expect(key('Escape').defaultPrevented).toBe(true);
    expect(box.hidden).toBe(true);
    expect(key('Escape').defaultPrevented).toBe(false); // propagé : la fenêtre peut se fermer
  });
});

describe('Enregistrer', () => {
  it('télécharge un PNG nommé dessin.png', () => {
    mount(el, makeCtx());
    byLabel('Enregistrer').click();
    expect(blobCallback).not.toBeNull();
    blobCallback!(new Blob(['png'], { type: 'image/png' }));
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(downloads).toEqual([{ name: 'dessin.png', href: 'blob:fake' }]);
    expect(status()).toBe('Dessin enregistré : dessin.png');
  });

  it('annonce l’échec quand le navigateur ne fournit rien', () => {
    mount(el, makeCtx());
    byLabel('Enregistrer').click();
    blobCallback!(null);
    expect(downloads).toEqual([]);
    expect(status()).toBe('Enregistrement impossible');
  });
});

describe('cycle de vie', () => {
  it('le démontage retire l’écouteur clavier et vide la fenêtre', () => {
    const remove = vi.spyOn(win, 'removeEventListener');
    mount(el, makeCtx());
    unmount();
    expect(remove).toHaveBeenCalledWith('keydown', expect.any(Function), true);
    expect(el.children).toHaveLength(0);
  });

  it('remonter donne un dessin vierge', () => {
    mount(el, makeCtx());
    drag([[10, 10], [60, 10]]);
    unmount();
    mount(el, makeCtx());
    expect(pixel(30, 10)).toEqual(WHITE);
    expect(byLabel('Annuler').disabled).toBe(true);
  });

  it('le canevas n’est rafraîchi que quand il le faut', () => {
    mount(el, makeCtx());
    const before = putCount;
    canvas().dispatchEvent(ptr('pointermove', 5, 5)); // survol : aucun dessin
    expect(putCount).toBe(before);
  });
});

describe('anglais', () => {
  it('outils, palette, messages et nom de fichier en anglais', () => {
    setLang('en');
    const ctx = makeCtx();
    mount(el, ctx);
    expect(ctx.setTitle).toHaveBeenCalledWith('Paint');
    expect(tool('pencil').getAttribute('aria-label')).toBe('Pencil');
    expect(tool('fill').getAttribute('aria-label')).toBe('Paint bucket');
    expect(swatch('#000000').getAttribute('aria-label')).toBe('Black');
    expect(canvas().getAttribute('aria-label')).toBe('Drawing area');
    expect(status()).toBe('Ready');
    byLabel('Save').click();
    blobCallback!(new Blob(['png']));
    expect(downloads[0]!.name).toBe('drawing.png');
    swatch('#ff0000').click();
    expect(status()).toBe('Foreground: Red');
  });
});
