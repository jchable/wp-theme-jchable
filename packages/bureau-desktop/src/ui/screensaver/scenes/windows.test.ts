import { describe, expect, it, vi } from 'vitest';
import { mulberry32 } from './math3d';
import { expectSceneConforms, recordingContext, testContext } from './testing';
import { create, fitTitle } from './windows';

/** Fait tourner la scène et renvoie tous les textes passés à fillText (dessin toutes les 5 images). */
function drawnTexts(overrides: Parameters<typeof testContext>[0], frames = 300): string[] {
  const scene = create(testContext(overrides));
  const { ctx, calls } = recordingContext();
  for (let i = 0; i < frames; i++) {
    scene.step(50);
    if (i % 5 === 0) scene.draw(ctx);
  }
  return calls.filter((c) => c.name === 'fillText').map((c) => String(c.args[0]));
}

describe('scène « Fenêtres flottantes »', () => {
  it('respecte le contrat commun des scènes', () => expectSceneConforms(create));

  it('affiche un titre de context.titles (éventuellement tronqué)', () => {
    const texts = drawnTexts({ titles: ['Zebra'] });
    expect(texts.length).toBeGreaterThan(0);
    for (const t of texts) expect('Zebra'.startsWith(t.replace('…', ''))).toBe(true);
    expect(texts).toContain('Zebra');
  });

  it('sans titres, utilise les titres de repli en français', () => {
    const texts = drawnTexts({ titles: [], lang: 'fr' });
    expect(texts.some((t) => t === 'Bienvenue' || t === 'Notes.txt')).toBe(true);
    expect(texts.some((t) => t.startsWith('Welcome'))).toBe(false);
  });

  it('sans titres, utilise les titres de repli en anglais', () => {
    const texts = drawnTexts({ titles: [], lang: 'en' });
    expect(texts.some((t) => t === 'Welcome' || t === 'Notes.txt')).toBe(true);
    expect(texts.some((t) => t.startsWith('Bienvenue'))).toBe(false);
  });

  it('tronque un titre interminable avec « … »', () => {
    const long = 'x'.repeat(200);
    const texts = drawnTexts({ titles: [long] });
    expect(texts.length).toBeGreaterThan(0);
    expect(texts.some((t) => t.endsWith('…') && t.length < long.length)).toBe(true);
    expect(texts.every((t) => t.length < long.length)).toBe(true);
  });

  it('le titre suit l’orientation de la fenêtre : il est dessiné dans le repère incliné de la carte', () => {
    const scene = create(testContext({ titles: ['Zebra'] }));
    const { ctx, calls } = recordingContext();
    for (let i = 0; i < 300; i++) {
      scene.step(50);
      if (i % 5 === 0) scene.draw(ctx);
    }
    const matrices: number[][] = [];
    calls.forEach((call, index) => {
      if (call.name !== 'fillText') return;
      expect(call.args.slice(1)).toEqual([0, 0]); // dessiné à l'origine du repère de la carte
      const before = calls.slice(0, index).reverse().find((c) => c.name === 'transform');
      expect(before, 'fillText sans repère propre à la carte').toBeDefined();
      matrices.push(before!.args as number[]);
    });
    expect(matrices.length).toBeGreaterThan(0);
    // La carte bascule (lacet, tangage, roulis) : le repère du texte est cisaillé ou tourné, jamais un simple zoom.
    expect(matrices.some(([a, b, c, d]) => Math.abs(b!) > 1e-3 || Math.abs(c!) > 1e-3 || Math.abs(a! - d!) > 1e-3)).toBe(true);
    // Le repère est rendu au dessin suivant : chaque transformation du texte (qui s'ajoute à l'échelle de l'écran) est encadré par save/restore.
    const names = calls.map((c) => c.name);
    expect(names.filter((n) => n === 'save').length).toBe(names.filter((n) => n === 'restore').length);
  });

  it('n’écrit aucun texte quand tout est trop petit (1×1)', () => {
    expect(drawnTexts({ width: 1, height: 1 })).toEqual([]);
  });

  it('ne dépasse pas ~1500 appels de tracé par image', () => {
    const scene = create(testContext({ width: 1920, height: 1080 }));
    for (let i = 0; i < 200; i++) scene.step(50);
    const { ctx, calls } = recordingContext();
    scene.draw(ctx);
    expect(calls.length).toBeLessThanOrEqual(1500);
  });

  it('redessine le fond complet à chaque image', () => {
    const scene = create(testContext());
    const { ctx, calls } = recordingContext();
    scene.draw(ctx);
    const first = calls.find((c) => c.name === 'fillRect');
    expect(first?.args).toEqual([0, 0, 800, 600]);
  });

  it('resize met à jour les dimensions du fond', () => {
    const scene = create(testContext());
    scene.resize(500, 300);
    const { ctx, calls } = recordingContext();
    scene.draw(ctx);
    expect(calls.find((c) => c.name === 'fillRect')?.args).toEqual([0, 0, 500, 300]);
  });

  it('tout l’aléatoire passe par context.rng', () => {
    const random = vi.spyOn(Math, 'random');
    const rng = vi.fn(mulberry32(3));
    const scene = create(testContext({ rng }));
    const created = rng.mock.calls.length;
    expect(created).toBeGreaterThan(0);
    const { ctx } = recordingContext();
    for (let i = 0; i < 400; i++) {
      scene.step(100);
      scene.draw(ctx);
    }
    expect(rng.mock.calls.length).toBeGreaterThan(created); // les fenêtres recyclées retirent au sort
    expect(random).not.toHaveBeenCalled();
    random.mockRestore();
  });
});

describe('fitTitle', () => {
  it('garde un titre qui tient', () => {
    expect(fitTitle('Notes.txt', 20)).toBe('Notes.txt');
  });

  it('tronque avec « … » sans dépasser le nombre de caractères', () => {
    const out = fitTitle('Un titre vraiment long', 10);
    expect(out.endsWith('…')).toBe(true);
    expect(out.length).toBeLessThanOrEqual(10);
  });

  it('renvoie une chaîne vide quand il n’y a pas de place', () => {
    expect(fitTitle('Notes.txt', 1)).toBe('');
    expect(fitTitle('Notes.txt', 0)).toBe('');
    expect(fitTitle('Notes.txt', Number.NaN)).toBe('');
  });
});
