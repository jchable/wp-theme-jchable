import { readFileSync } from 'node:fs';
import { test, expect, type Locator, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const isDesktop = (name: string): boolean => name === 'desktop';

type RGB = [number, number, number];
const BLACK: RGB = [0, 0, 0];
const WHITE: RGB = [255, 255, 255];
const RED: RGB = [255, 0, 0];
const BLUE: RGB = [0, 0, 255];

/** Ouvre Paint : double-clic sur l'icône (grand écran) ou menu Démarrer (petit écran). */
async function openPaint(page: Page, projectName: string): Promise<Locator> {
  await page.goto('/');
  if (isDesktop(projectName)) {
    await page.locator('#bureau-desktop .bicon', { hasText: 'Paint' }).dblclick();
  } else {
    await page.locator('.start-button').click();
    await page.locator('.bmenu').getByRole('menuitem', { name: 'Paint' }).click();
  }
  const win = page.locator('.bwin[data-app="paint"]');
  await expect(win).toBeVisible();
  await expect(win.locator('canvas')).toBeVisible();
  return win;
}

/** Les vrais pixels du canevas, lus avec getImageData. */
const pixel = (win: Locator, x: number, y: number): Promise<RGB> =>
  win.locator('canvas').evaluate(
    (canvas, [px, py]) => {
      const data = (canvas as HTMLCanvasElement).getContext('2d')!.getImageData(px!, py!, 1, 1).data;
      return [data[0]!, data[1]!, data[2]!] as RGB;
    },
    [x, y] as const,
  );

const countColor = (win: Locator, color: RGB): Promise<number> =>
  win.locator('canvas').evaluate((canvas, [r, g, b]) => {
    const c = canvas as HTMLCanvasElement;
    const data = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i] === r && data[i + 1] === g && data[i + 2] === b) n++;
    return n;
  }, color);

async function screenPoint(win: Locator, x: number, y: number): Promise<{ x: number; y: number }> {
  const box = (await win.locator('canvas').boundingBox())!;
  return { x: box.x + x, y: box.y + y };
}

async function drag(page: Page, win: Locator, from: [number, number], to: [number, number], options: { button?: 'left' | 'right'; steps?: number } = {}): Promise<void> {
  const a = await screenPoint(win, from[0], from[1]);
  const b = await screenPoint(win, to[0], to[1]);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down({ button: options.button ?? 'left' });
  await page.mouse.move(b.x, b.y, { steps: options.steps ?? 1 });
  await page.mouse.up({ button: options.button ?? 'left' });
}

const tool = (win: Locator, name: string): Locator => win.getByRole('button', { name, exact: true });

test.describe('Paint : fenêtre et icône', () => {
  test('est une icône du bureau et s’ouvre avec un canevas de 640×400 blanc', async ({ page }, info) => {
    test.skip(!isDesktop(info.project.name));
    const win = await openPaint(page, info.project.name);
    await expect(win.locator('.bwin-title')).toHaveText('Paint');
    const canvas = win.locator('canvas');
    expect(await canvas.evaluate((c) => [(c as HTMLCanvasElement).width, (c as HTMLCanvasElement).height])).toEqual([640, 400]);
    await expect(canvas).toHaveAttribute('role', 'img');
    await expect(canvas).toHaveAttribute('aria-label', 'Zone de dessin');
    expect(await pixel(win, 0, 0)).toEqual(WHITE);
    expect(await pixel(win, 639, 399)).toEqual(WHITE);
    const box = (await win.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(720);
    expect(box.width).toBeLessThanOrEqual(780);
    // tout le canevas est visible sans défilement dans la fenêtre par défaut
    const fits = await win.locator('.bapp-paint-scroll').evaluate((el) => el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight);
    expect(fits).toBe(true);
  });

  test('huit outils, quatre épaisseurs, 28 couleurs, des boutons nommés', async ({ page }, info) => {
    const win = await openPaint(page, info.project.name);
    const names = ['Crayon', 'Pinceau', 'Gomme', 'Ligne', 'Rectangle', 'Ellipse', 'Pot de peinture', 'Pipette'];
    for (const name of names) await expect(tool(win, name)).toBeVisible();
    await expect(tool(win, 'Crayon')).toHaveAttribute('aria-pressed', 'true');
    await tool(win, 'Gomme').click();
    await expect(tool(win, 'Gomme')).toHaveAttribute('aria-pressed', 'true');
    await expect(tool(win, 'Crayon')).toHaveAttribute('aria-pressed', 'false');
    await expect(win.getByRole('group', { name: 'Épaisseur' }).getByRole('button')).toHaveCount(4);
    await expect(win.getByRole('group', { name: 'Palette de couleurs' }).getByRole('button')).toHaveCount(28);
    await expect(win.getByRole('button', { name: 'Noir', exact: true })).toBeVisible();
    await expect(win.getByRole('button', { name: 'Orange', exact: true })).toBeVisible();
  });
});

test.describe('Paint : dessiner', () => {
  test.beforeEach(async ({}, info) => test.skip(!isDesktop(info.project.name)));

  test('le crayon trace en continu, même quand la souris saute d’un coup', async ({ page }, info) => {
    const win = await openPaint(page, info.project.name);
    await drag(page, win, [50, 50], [300, 200], { steps: 1 }); // un seul mouvement, 250 px d'un coup
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const x = Math.round(50 + 250 * t);
      const y = Math.round(50 + 150 * t);
      // le pixel exact peut être décalé de 1 selon l'arrondi : on regarde les voisins verticaux
      const column = await Promise.all([y - 1, y, y + 1].map((yy) => pixel(win, x, yy)));
      expect(column.some((p) => p.join() === BLACK.join()), `point ${x},${y}`).toBe(true);
    }
    expect(await pixel(win, 50, 200)).toEqual(WHITE);
  });

  test('l’épaisseur choisie s’applique aussi au crayon (trace libre) : de 1 à 8 pixels de haut', async ({ page }, info) => {
    const win = await openPaint(page, info.project.name);
    const heights: number[] = [];
    let y = 40;
    for (const size of ['1 px', '2 px', '4 px', '8 px']) {
      await win.getByRole('button', { name: size, exact: true }).click();
      await drag(page, win, [100, y], [300, y], { steps: 10 });
      let rows = 0;
      for (let yy = y - 12; yy <= y + 12; yy++) if ((await pixel(win, 200, yy)).join() === BLACK.join()) rows++;
      heights.push(rows);
      y += 60;
    }
    expect(heights).toEqual([1, 2, 4, 8]);
  });

  test('un clic dessine un point, le clic droit dessine avec la couleur d’arrière-plan', async ({ page }, info) => {
    const win = await openPaint(page, info.project.name);
    await win.getByRole('button', { name: 'Rouge', exact: true }).click();
    await win.getByRole('button', { name: 'Bleu', exact: true }).click({ button: 'right' });
    const a = await screenPoint(win, 100, 100);
    await page.mouse.click(a.x, a.y);
    expect(await pixel(win, 100, 100)).toEqual(RED);
    await drag(page, win, [100, 150], [200, 150], { button: 'right', steps: 5 });
    expect(await pixel(win, 150, 150)).toEqual(BLUE);
    await expect(win.getByRole('img', { name: /^Premier plan/ })).toHaveAttribute('aria-label', 'Premier plan : Rouge. Arrière-plan : Bleu.');
  });

  test('Maj + clic sur une couleur choisit l’arrière-plan ; Maj + Entrée au clavier aussi', async ({ page }, info) => {
    const win = await openPaint(page, info.project.name);
    await win.getByRole('button', { name: 'Jaune', exact: true }).click({ modifiers: ['Shift'] });
    await expect(win.getByRole('img', { name: /^Premier plan/ })).toHaveAttribute('aria-label', 'Premier plan : Noir. Arrière-plan : Jaune.');
    await win.getByRole('button', { name: 'Vert vif', exact: true }).focus();
    await page.keyboard.press('Shift+Enter');
    await expect(win.getByRole('img', { name: /^Premier plan/ })).toHaveAttribute('aria-label', 'Premier plan : Noir. Arrière-plan : Vert vif.');
    await page.keyboard.press('Enter');
    await expect(win.getByRole('img', { name: /^Premier plan/ })).toHaveAttribute('aria-label', 'Premier plan : Vert vif. Arrière-plan : Vert vif.');
  });

  test('le pinceau est plus épais selon l’épaisseur choisie', async ({ page }, info) => {
    const win = await openPaint(page, info.project.name);
    await tool(win, 'Pinceau').click();
    await tool(win, '8 px').click();
    await drag(page, win, [100, 100], [300, 100], { steps: 10 });
    expect(await pixel(win, 200, 96)).toEqual(BLACK);
    expect(await pixel(win, 200, 103)).toEqual(BLACK);
    expect(await pixel(win, 200, 110)).toEqual(WHITE);
    await expect(tool(win, '8 px')).toHaveAttribute('aria-pressed', 'true');
  });

  test('la gomme efface avec l’arrière-plan', async ({ page }, info) => {
    const win = await openPaint(page, info.project.name);
    await drag(page, win, [50, 100], [400, 100], { steps: 10 });
    expect(await pixel(win, 200, 100)).toEqual(BLACK);
    await tool(win, 'Gomme').click();
    await drag(page, win, [150, 100], [250, 100], { steps: 10 });
    expect(await pixel(win, 200, 100)).toEqual(WHITE);
    expect(await pixel(win, 100, 100)).toEqual(BLACK);
  });

  test('ligne, rectangle et ellipse avec un aperçu pendant le glisser', async ({ page }, info) => {
    const win = await openPaint(page, info.project.name);
    await tool(win, 'Rectangle').click();
    const a = await screenPoint(win, 100, 100);
    const b = await screenPoint(win, 220, 180);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 4 });
    expect(await pixel(win, 220, 180)).toEqual(BLACK); // aperçu, bouton encore enfoncé
    const c = await screenPoint(win, 160, 140);
    await page.mouse.move(c.x, c.y, { steps: 4 });
    expect(await pixel(win, 220, 180)).toEqual(WHITE); // l'aperçu suit la souris
    expect(await pixel(win, 160, 140)).toEqual(BLACK);
    await page.mouse.up();
    expect(await pixel(win, 130, 120)).toEqual(WHITE); // contour seulement
    await tool(win, 'Ligne').click();
    await drag(page, win, [300, 50], [500, 50], { steps: 4 });
    expect(await pixel(win, 400, 50)).toEqual(BLACK);
    await tool(win, 'Ellipse').click();
    await drag(page, win, [300, 150], [500, 300], { steps: 6 });
    expect(await pixel(win, 300, 225)).toEqual(BLACK); // le bord gauche de l'ellipse
    expect(await pixel(win, 400, 225)).toEqual(WHITE); // le centre est vide
  });

  test('Maj donne un carré, un cercle ou une ligne à 45°', async ({ page }, info) => {
    const win = await openPaint(page, info.project.name);
    await tool(win, 'Rectangle').click();
    await page.keyboard.down('Shift');
    await drag(page, win, [100, 100], [200, 130], { steps: 4 });
    await page.keyboard.up('Shift');
    expect(await pixel(win, 200, 200)).toEqual(BLACK); // carré de 101 px
    expect(await pixel(win, 100, 200)).toEqual(BLACK);
    await tool(win, 'Ligne').click();
    await page.keyboard.down('Shift');
    await drag(page, win, [300, 50], [400, 60], { steps: 4 });
    await page.keyboard.up('Shift');
    expect(await pixel(win, 350, 50)).toEqual(BLACK); // horizontale
    expect(await pixel(win, 400, 60)).toEqual(WHITE);
  });

  test('le style « contour et fond » remplit la forme avec la couleur d’arrière-plan', async ({ page }, info) => {
    const win = await openPaint(page, info.project.name);
    await tool(win, 'Rectangle').click();
    await win.getByRole('button', { name: 'Bleu', exact: true }).click({ button: 'right' });
    await win.getByRole('button', { name: 'Contour et fond', exact: true }).click();
    await drag(page, win, [100, 100], [200, 180], { steps: 4 });
    expect(await pixel(win, 150, 140)).toEqual(BLUE);
    expect(await pixel(win, 100, 100)).toEqual(BLACK);
  });

  test('le pot de peinture remplit une zone fermée et seulement elle', async ({ page }, info) => {
    const win = await openPaint(page, info.project.name);
    await tool(win, 'Rectangle').click();
    await drag(page, win, [100, 100], [200, 180], { steps: 4 });
    await tool(win, 'Pot de peinture').click();
    await win.getByRole('button', { name: 'Rouge', exact: true }).click();
    const inside = await screenPoint(win, 150, 140);
    await page.mouse.click(inside.x, inside.y);
    expect(await pixel(win, 150, 140)).toEqual(RED);
    expect(await pixel(win, 101, 101)).toEqual(RED);
    expect(await pixel(win, 100, 100)).toEqual(BLACK);
    expect(await pixel(win, 50, 50)).toEqual(WHITE);
    expect(await countColor(win, RED)).toBe(99 * 79); // l'intérieur du rectangle, rien d'autre
    // remplir le dehors
    const outside = await screenPoint(win, 20, 20);
    await win.getByRole('button', { name: 'Bleu', exact: true }).click();
    await page.mouse.click(outside.x, outside.y);
    expect(await pixel(win, 600, 380)).toEqual(BLUE);
    expect(await pixel(win, 150, 140)).toEqual(RED);
  });

  test('la pipette prend la couleur du pixel', async ({ page }, info) => {
    const win = await openPaint(page, info.project.name);
    await win.getByRole('button', { name: 'Orange', exact: true }).click();
    await drag(page, win, [100, 100], [200, 100], { steps: 5 });
    await win.getByRole('button', { name: 'Noir', exact: true }).click();
    await tool(win, 'Pipette').click();
    const p = await screenPoint(win, 150, 100);
    await page.mouse.click(p.x, p.y);
    await expect(win.getByRole('img', { name: /^Premier plan/ })).toHaveAttribute('aria-label', 'Premier plan : Orange. Arrière-plan : Blanc.');
    await expect(win.getByRole('status')).toHaveText('Couleur prélevée : #ff8040');
  });

  test('les coordonnées du pointeur s’affichent dans la barre d’état', async ({ page }, info) => {
    const win = await openPaint(page, info.project.name);
    const p = await screenPoint(win, 123, 45);
    await page.mouse.move(p.x, p.y);
    await expect(win.locator('.bapp-paint-coords')).toHaveText('123, 45');
  });
});

test.describe('Paint : annuler, rétablir, nouveau, enregistrer', () => {
  test.beforeEach(async ({}, info) => test.skip(!isDesktop(info.project.name)));

  test('annuler et rétablir par les boutons, un remplissage aussi', async ({ page }, info) => {
    const win = await openPaint(page, info.project.name);
    const undo = win.getByRole('button', { name: 'Annuler', exact: true });
    const redo = win.getByRole('button', { name: 'Rétablir', exact: true });
    await expect(undo).toBeDisabled();
    await expect(redo).toBeDisabled();
    await drag(page, win, [100, 100], [300, 100], { steps: 5 });
    await expect(undo).toBeEnabled();
    await tool(win, 'Pot de peinture').click();
    await win.getByRole('button', { name: 'Rouge', exact: true }).click();
    const p = await screenPoint(win, 20, 20);
    await page.mouse.click(p.x, p.y);
    expect(await pixel(win, 400, 300)).toEqual(RED);
    await undo.click(); // annule le remplissage
    expect(await pixel(win, 400, 300)).toEqual(WHITE);
    expect(await pixel(win, 200, 100)).toEqual(BLACK);
    await undo.click(); // annule le trait
    expect(await pixel(win, 200, 100)).toEqual(WHITE);
    await expect(undo).toBeDisabled();
    await redo.click();
    expect(await pixel(win, 200, 100)).toEqual(BLACK);
    await redo.click();
    expect(await pixel(win, 400, 300)).toEqual(RED);
    await expect(redo).toBeDisabled();
  });

  test('Ctrl+Z annule et Ctrl+Y rétablit quand le focus est dans la fenêtre', async ({ page }, info) => {
    const win = await openPaint(page, info.project.name);
    await drag(page, win, [100, 100], [300, 100], { steps: 5 });
    await page.keyboard.press('Control+z');
    expect(await pixel(win, 200, 100)).toEqual(WHITE);
    await page.keyboard.press('Control+y');
    expect(await pixel(win, 200, 100)).toEqual(BLACK);
    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+Shift+z');
    expect(await pixel(win, 200, 100)).toEqual(BLACK);
    // hors de la fenêtre, les raccourcis ne servent pas
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('Control+z');
    expect(await pixel(win, 200, 100)).toEqual(BLACK);
  });

  test('la pile d’annulation est bornée à 30 états', async ({ page }, info) => {
    const win = await openPaint(page, info.project.name);
    for (let i = 0; i < 33; i++) {
      const p = await screenPoint(win, 20 + i * 15, 50);
      await page.mouse.click(p.x, p.y);
    }
    for (let i = 0; i < 40; i++) await page.keyboard.press('Control+z');
    expect(await pixel(win, 20, 50)).toEqual(BLACK); // les 3 premiers points sont restés
    expect(await pixel(win, 20 + 2 * 15, 50)).toEqual(BLACK);
    expect(await pixel(win, 20 + 3 * 15, 50)).toEqual(WHITE);
    expect(await pixel(win, 20 + 32 * 15, 50)).toEqual(WHITE);
  });

  test('Nouveau : confirmation dans la fenêtre (pas de boîte du navigateur), annulable', async ({ page }, info) => {
    const dialogs: string[] = [];
    page.on('dialog', (d) => {
      dialogs.push(d.message());
      void d.dismiss();
    });
    const win = await openPaint(page, info.project.name);
    await drag(page, win, [100, 100], [300, 100], { steps: 5 });
    await win.getByRole('button', { name: 'Nouveau', exact: true }).click();
    const confirm = win.getByRole('group', { name: 'Nouveau dessin' });
    await expect(confirm).toBeVisible();
    await expect(confirm).toContainText('Effacer tout le dessin ?');
    expect(await pixel(win, 200, 100)).toEqual(BLACK);
    await confirm.getByRole('button', { name: 'Garder' }).click();
    await expect(confirm).toBeHidden();
    expect(await pixel(win, 200, 100)).toEqual(BLACK);
    await win.getByRole('button', { name: 'Nouveau', exact: true }).click();
    await confirm.getByRole('button', { name: 'Effacer' }).click();
    await expect(confirm).toBeHidden();
    expect(await pixel(win, 200, 100)).toEqual(WHITE);
    await win.getByRole('button', { name: 'Annuler', exact: true }).click(); // on peut revenir en arrière
    expect(await pixel(win, 200, 100)).toEqual(BLACK);
    expect(dialogs).toEqual([]);
  });

  test('Échap ferme la confirmation, puis la fenêtre', async ({ page }, info) => {
    const win = await openPaint(page, info.project.name);
    await win.getByRole('button', { name: 'Nouveau', exact: true }).click();
    const confirm = win.getByRole('group', { name: 'Nouveau dessin' });
    await expect(confirm).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(confirm).toBeHidden();
    await expect(win).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(win).toHaveCount(0);
  });

  test('Enregistrer télécharge un vrai PNG nommé dessin.png', async ({ page }, info) => {
    const win = await openPaint(page, info.project.name);
    await drag(page, win, [100, 100], [300, 100], { steps: 5 });
    const [download] = await Promise.all([page.waitForEvent('download'), win.getByRole('button', { name: 'Enregistrer', exact: true }).click()]);
    expect(download.suggestedFilename()).toBe('dessin.png');
    const bytes = readFileSync((await download.path())!);
    expect([...bytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(bytes.readUInt32BE(16)).toBe(640); // largeur et hauteur dans l'en-tête IHDR
    expect(bytes.readUInt32BE(20)).toBe(400);
    await expect(win.getByRole('status')).toHaveText('Dessin enregistré : dessin.png');
  });
});

test.describe('Paint : fenêtre redimensionnée', () => {
  test.beforeEach(async ({}, info) => test.skip(!isDesktop(info.project.name)));

  test('plus petite que le canevas, la zone de dessin défile et on peut dessiner partout', async ({ page }, info) => {
    const win = await openPaint(page, info.project.name);
    await win.evaluate((el) => {
      el.style.width = '420px';
      el.style.height = '360px';
    });
    const scroller = win.locator('.bapp-paint-scroll');
    const scrolls = await scroller.evaluate((el) => el.scrollWidth > el.clientWidth && el.scrollHeight > el.clientHeight);
    expect(scrolls).toBe(true);
    await expect(win.locator('canvas')).toHaveCSS('width', '640px'); // le canevas ne se déforme pas
    await scroller.evaluate((el) => el.scrollTo(el.scrollWidth, el.scrollHeight));
    // le coin bas droit du canevas est maintenant à l'écran : on y dessine
    await tool(win, 'Pinceau').click();
    await tool(win, '4 px').click();
    await drag(page, win, [560, 360], [620, 380], { steps: 6 });
    expect(await pixel(win, 590, 370)).toEqual(BLACK);
    expect(await pixel(win, 10, 10)).toEqual(WHITE);
    await scroller.evaluate((el) => el.scrollTo(0, 0));
    await drag(page, win, [20, 20], [80, 40], { steps: 6 });
    expect(await pixel(win, 50, 30)).toEqual(BLACK);
  });

  test('les coordonnées restent justes quand la zone est défilée', async ({ page }, info) => {
    const win = await openPaint(page, info.project.name);
    await win.evaluate((el) => {
      el.style.width = '420px';
      el.style.height = '360px';
    });
    await win.locator('.bapp-paint-scroll').evaluate((el) => el.scrollTo(200, 100));
    const p = await screenPoint(win, 300, 200);
    await page.mouse.move(p.x, p.y);
    await expect(win.locator('.bapp-paint-coords')).toHaveText('300, 200');
  });

  test('une fenêtre plus grande ne change pas le dessin', async ({ page }, info) => {
    const win = await openPaint(page, info.project.name);
    await drag(page, win, [100, 100], [300, 100], { steps: 5 });
    await win.evaluate((el) => {
      el.style.width = '1000px';
      el.style.height = '700px';
    });
    expect(await pixel(win, 200, 100)).toEqual(BLACK);
    await drag(page, win, [100, 150], [300, 150], { steps: 5 });
    expect(await pixel(win, 200, 150)).toEqual(BLACK);
  });
});

test.describe('Paint : clavier', () => {
  test.beforeEach(async ({}, info) => test.skip(!isDesktop(info.project.name)));

  test('les outils sont atteignables à la tabulation et s’activent au clavier', async ({ page }, info) => {
    const win = await openPaint(page, info.project.name);
    await tool(win, 'Crayon').focus();
    await page.keyboard.press('Tab');
    await expect(tool(win, 'Pinceau')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(tool(win, 'Pinceau')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Space');
    await expect(tool(win, 'Gomme')).toHaveAttribute('aria-pressed', 'true');
  });

  test('Échap annule la forme en cours de tracé', async ({ page }, info) => {
    const win = await openPaint(page, info.project.name);
    await tool(win, 'Rectangle').click();
    const a = await screenPoint(win, 100, 100);
    const b = await screenPoint(win, 200, 160);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 4 });
    expect(await pixel(win, 200, 160)).toEqual(BLACK);
    await page.keyboard.press('Escape');
    expect(await pixel(win, 200, 160)).toEqual(WHITE);
    await page.mouse.up();
    expect(await pixel(win, 200, 160)).toEqual(WHITE);
    await expect(win).toBeVisible();
  });
});

test.describe('Paint : petit écran', () => {
  test.beforeEach(async ({}, info) => test.skip(isDesktop(info.project.name)));

  test('plein écran, la boîte à outils et la palette tiennent dans l’écran, on dessine au toucher', async ({ page }, info) => {
    const win = await openPaint(page, info.project.name);
    const viewport = page.viewportSize()!;
    const box = (await win.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(viewport.width - 2);
    expect(box.height).toBeGreaterThanOrEqual(viewport.height - 4);
    for (const group of ['Outils', 'Palette de couleurs']) {
      const g = (await win.getByRole('group', { name: group }).boundingBox())!;
      expect(g.x).toBeGreaterThanOrEqual(0);
      expect(g.x + g.width).toBeLessThanOrEqual(viewport.width + 1);
    }
    // le canevas s'adapte à la largeur de l'écran (il ne déborde pas), le dessin reste de 640×400 pixels
    const canvasBox = (await win.locator('canvas').boundingBox())!;
    expect(canvasBox.x).toBeGreaterThanOrEqual(0);
    expect(canvasBox.x + canvasBox.width).toBeLessThanOrEqual(viewport.width);
    expect(Math.abs(canvasBox.width / canvasBox.height - 1.6)).toBeLessThan(0.02);
    expect(await win.locator('canvas').evaluate((c) => [(c as HTMLCanvasElement).width, (c as HTMLCanvasElement).height])).toEqual([640, 400]);
    // un tapotement au milieu dessine un point au milieu du dessin
    const x = canvasBox.x + canvasBox.width / 2;
    const y = canvasBox.y + canvasBox.height / 2;
    if (info.project.name === 'mobile') await page.touchscreen.tap(x, y);
    else await page.mouse.click(x, y);
    const around = await Promise.all([319, 320, 321].map((px) => pixel(win, px, 200)));
    expect(around.some((p) => p.join() === BLACK.join())).toBe(true);
    await win.getByRole('button', { name: 'Fermer' }).click();
    await expect(win).toHaveCount(0);
  });
});

test.describe('Paint : anglais', () => {
  test.use({ locale: 'en-US' });

  test('outils, palette, messages et nom de fichier en anglais', async ({ page }, info) => {
    await page.goto('/');
    if (isDesktop(info.project.name)) {
      await page.locator('#bureau-desktop .bicon', { hasText: 'Paint' }).dblclick();
    } else {
      await page.locator('.start-button').click();
      await page.locator('.bmenu').getByRole('menuitem', { name: 'Paint' }).click();
    }
    const win = page.locator('.bwin[data-app="paint"]');
    await expect(win).toBeVisible();
    await expect(win.getByRole('button', { name: 'Pencil', exact: true })).toBeVisible();
    await expect(win.getByRole('button', { name: 'Paint bucket', exact: true })).toBeVisible();
    await expect(win.getByRole('group', { name: 'Color palette' }).getByRole('button', { name: 'Black', exact: true })).toBeVisible();
    await expect(win.locator('canvas')).toHaveAttribute('aria-label', 'Drawing area');
    await expect(win.getByRole('status')).toHaveText('Ready');
    if (isDesktop(info.project.name)) {
      const [download] = await Promise.all([page.waitForEvent('download'), win.getByRole('button', { name: 'Save', exact: true }).click()]);
      expect(download.suggestedFilename()).toBe('drawing.png');
    }
  });
});

test.describe('accessibilité de Paint', () => {
  test('axe : aucune violation sérieuse ou critique dans la fenêtre', async ({ page }, info) => {
    const win = await openPaint(page, info.project.name);
    await win.getByRole('button', { name: 'Rectangle', exact: true }).click(); // montre aussi le style des formes
    await win.getByRole('button', { name: 'Nouveau', exact: true }).click(); // et la confirmation
    const results = await new AxeBuilder({ page }).include('.bwin[data-app="paint"]').analyze();
    const blocking = results.violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => `${v.id} (${v.impact}) : ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
    expect(blocking).toEqual([]);
  });

  test('axe : page entière avec Paint ouvert', async ({ page }, info) => {
    test.skip(!isDesktop(info.project.name));
    await openPaint(page, info.project.name);
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => `${v.id} (${v.impact}) : ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
    expect(blocking).toEqual([]);
  });
});
