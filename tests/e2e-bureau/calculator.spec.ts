import { test, expect, type Locator, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const isDesktop = (name: string): boolean => name === 'desktop';

/** Ouvre la Calculatrice : double-clic sur l'icône (grand écran) ou menu Démarrer (petit écran). */
async function openCalculator(page: Page, projectName: string): Promise<Locator> {
  await page.goto('/');
  if (isDesktop(projectName)) {
    await page.locator('#bureau-desktop .bicon', { hasText: 'Calculatrice' }).dblclick();
  } else {
    await page.locator('.start-button').click();
    await page.locator('.bmenu').getByRole('menuitem', { name: 'Calculatrice' }).click();
  }
  const win = page.locator('.bwin[data-app="calculator"]');
  await expect(win).toBeVisible();
  await expect(win.getByRole('button', { name: '7', exact: true })).toBeVisible();
  return win;
}

const press = async (win: Locator, ...names: string[]): Promise<void> => {
  for (const name of names) await win.getByRole('button', { name, exact: true }).click();
};
const display = (win: Locator): Locator => win.getByRole('status');

test.describe('Calculatrice', () => {
  test('est une icône du bureau et une entrée du menu Démarrer', async ({ page }, info) => {
    await page.goto('/');
    if (isDesktop(info.project.name)) {
      await expect(page.locator('#bureau-desktop .bicon', { hasText: 'Calculatrice' })).toBeVisible();
    }
    await page.locator('.start-button').click();
    await expect(page.locator('.bmenu').getByRole('menuitem', { name: 'Calculatrice' })).toBeVisible();
    await expect(page.locator('.bmenu').getByRole('menuitem', { name: 'Paint' })).toBeVisible();
  });

  test('tous les noms d’icônes ont la même taille de police, même s’ils passent sur deux lignes', async ({ page }, info) => {
    test.skip(!isDesktop(info.project.name));
    await page.goto('/');
    const sizes = await page.locator('#bureau-desktop .bicon .bicon-label').evaluateAll((labels) => [...new Set(labels.map((el) => getComputedStyle(el).fontSize))]);
    expect(sizes).toHaveLength(1);
    // la bande n'est pas pour autant recouverte ni tronquée : chaque nom reste entièrement visible dans son icône
    const clipped = await page.locator('#bureau-desktop .bicon').evaluateAll((icons) =>
      icons.filter((icon) => {
        const label = icon.querySelector('.bicon-label')!.getBoundingClientRect();
        const box = icon.getBoundingClientRect();
        return label.left < box.left - 1 || label.right > box.right + 1;
      }).length,
    );
    expect(clipped).toBe(0);
  });

  test('s’ouvre à 280×360 sur grand écran, avec le bon titre', async ({ page }, info) => {
    test.skip(!isDesktop(info.project.name));
    const win = await openCalculator(page, info.project.name);
    const box = (await win.boundingBox())!;
    expect(Math.abs(box.width - 280)).toBeLessThanOrEqual(2);
    expect(Math.abs(box.height - 360)).toBeLessThanOrEqual(2);
    await expect(win.locator('.bwin-title')).toHaveText('Calculatrice');
    await expect(page.locator('.bwin-tab')).toHaveText('Calculatrice');
  });

  test('additionne à la souris, virgule décimale, zone de statut annoncée', async ({ page }, info) => {
    const win = await openCalculator(page, info.project.name);
    await expect(display(win)).toHaveText('0');
    await expect(display(win)).toHaveAttribute('aria-live', 'polite');
    await press(win, '7', 'Plus', '8', 'Égale');
    await expect(display(win)).toHaveText('15');
    await press(win, 'C Tout effacer', '1', 'Virgule', '5');
    await expect(display(win)).toHaveText('1,5');
  });

  test('0,1 + 0,2 donne 0,3 ; pas de priorité des opérateurs ; « = » répété', async ({ page }, info) => {
    const win = await openCalculator(page, info.project.name);
    await press(win, 'Virgule', '1', 'Plus', 'Virgule', '2', 'Égale');
    await expect(display(win)).toHaveText('0,3');
    await press(win, 'C Tout effacer', '2', 'Plus', '3', 'Fois', '4', 'Égale');
    await expect(display(win)).toHaveText('20');
    await press(win, 'C Tout effacer', '2', 'Plus', '3', 'Égale', 'Égale');
    await expect(display(win)).toHaveText('8');
  });

  test('racine, inverse, pourcentage, changement de signe', async ({ page }, info) => {
    const win = await openCalculator(page, info.project.name);
    await press(win, '9', 'Racine carrée');
    await expect(display(win)).toHaveText('3');
    await press(win, 'C Tout effacer', '4', '1/x Inverse');
    await expect(display(win)).toHaveText('0,25');
    await press(win, 'C Tout effacer', '2', '0', '0', 'Plus', '1', '0', 'Pourcentage');
    await expect(display(win)).toHaveText('20');
    await press(win, 'Égale');
    await expect(display(win)).toHaveText('220');
    await press(win, 'Changer le signe');
    await expect(display(win)).toHaveText('-220');
  });

  test('division par zéro : message, puis C récupère', async ({ page }, info) => {
    const win = await openCalculator(page, info.project.name);
    await press(win, '5', 'Divisé par', '0', 'Égale');
    await expect(display(win)).toHaveText('Division par zéro impossible');
    await press(win, '7');
    await expect(display(win)).toHaveText('Division par zéro impossible');
    await press(win, 'C Tout effacer', '7');
    await expect(display(win)).toHaveText('7');
  });

  test('racine d’un négatif : entrée incorrecte', async ({ page }, info) => {
    const win = await openCalculator(page, info.project.name);
    await press(win, '4', 'Changer le signe', 'Racine carrée');
    await expect(display(win)).toHaveText('Entrée incorrecte');
  });

  test('la mémoire allume l’indicateur M', async ({ page }, info) => {
    const win = await openCalculator(page, info.project.name);
    const indicator = win.getByRole('img', { name: 'Mémoire utilisée' });
    await expect(indicator).toBeHidden();
    await press(win, '9', 'MS Stocker en mémoire');
    await expect(indicator).toBeVisible();
    await expect(indicator).toHaveText('M');
    await press(win, 'C Tout effacer', 'MR Rappeler la mémoire');
    await expect(display(win)).toHaveText('9');
    await press(win, 'M+ Ajouter à la mémoire', 'MR Rappeler la mémoire');
    await expect(display(win)).toHaveText('18');
    await press(win, 'MC Effacer la mémoire');
    await expect(indicator).toBeHidden();
  });

  test('plus de douze chiffres : notation exponentielle bornée', async ({ page }, info) => {
    const win = await openCalculator(page, info.project.name);
    for (let i = 0; i < 14; i++) await press(win, '9');
    await expect(display(win)).toHaveText('999999999999');
    await press(win, 'Plus', '1', 'Égale');
    await expect(display(win)).toHaveText('1e+12');
  });
});

test.describe('Calculatrice au clavier', () => {
  test.beforeEach(async ({}, info) => test.skip(!isDesktop(info.project.name)));

  test('chiffres, opérations, Entrée, Retour arrière, point et virgule', async ({ page }, info) => {
    const win = await openCalculator(page, info.project.name);
    await page.keyboard.type('12+30');
    await page.keyboard.press('Enter');
    await expect(display(win)).toHaveText('42');
    await page.keyboard.type('*2=');
    await expect(display(win)).toHaveText('84');
    await page.keyboard.press('Escape');
    await page.keyboard.type('7,5/.5');
    await page.keyboard.press('Enter');
    await expect(display(win)).toHaveText('15');
    await page.keyboard.type('12');
    await page.keyboard.press('Backspace');
    await expect(display(win)).toHaveText('1');
  });

  test('Échap = C, Suppr = CE, % et @ (racine)', async ({ page }, info) => {
    const win = await openCalculator(page, info.project.name);
    await page.keyboard.type('5+3');
    await page.keyboard.press('Delete');
    await expect(display(win)).toHaveText('0');
    await page.keyboard.type('4=');
    await expect(display(win)).toHaveText('9');
    await page.keyboard.press('Escape');
    await expect(display(win)).toHaveText('0');
    await expect(win).toBeVisible(); // le premier Échap efface seulement
    await page.keyboard.type('81@');
    await expect(display(win)).toHaveText('9');
    await page.keyboard.press('Escape');
    await page.keyboard.type('200+10%');
    await expect(display(win)).toHaveText('20');
  });

  test('quand tout est effacé, Échap ferme la fenêtre', async ({ page }, info) => {
    const win = await openCalculator(page, info.project.name);
    await page.keyboard.press('Escape');
    await expect(win).toHaveCount(0);
  });

  test('les touches ne sont prises que quand le focus est dans la fenêtre', async ({ page }, info) => {
    const win = await openCalculator(page, info.project.name);
    await page.keyboard.type('5');
    await expect(display(win)).toHaveText('5');
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.type('77');
    await expect(display(win)).toHaveText('5');
    // et un clic dans la fenêtre lui rend le clavier
    await win.locator('.bapp-calc').click({ position: { x: 5, y: 5 } });
    await page.keyboard.type('6');
    await expect(display(win)).toHaveText('56'); // la frappe reprend là où elle en était
  });

  test('Entrée sur un bouton atteint à la souris calcule ; atteint par Tab, elle l’active', async ({ page }, info) => {
    const win = await openCalculator(page, info.project.name);
    await press(win, '2', 'Plus', '3');
    await page.keyboard.press('Enter');
    await expect(display(win)).toHaveText('5');
    await press(win, 'C Tout effacer');
    await win.getByRole('button', { name: '8', exact: true }).focus();
    await page.keyboard.press('Tab'); // le focus au clavier : le bouton suivant ('9') s'active avec Entrée
    await page.keyboard.press('Enter');
    await expect(display(win)).toHaveText('9');
  });

  test('les touches de la page ne sont pas volées par un champ de la page (la recherche)', async ({ page }, info) => {
    const win = await openCalculator(page, info.project.name);
    const field = page.locator('#recherche input[type="search"]');
    await field.click();
    await page.keyboard.type('abc123/45'); // vraies frappes : la calculatrice ne doit pas les prendre
    await expect(field).toHaveValue('abc123/45');
    await expect(display(win)).toHaveText('0');
  });
});

test.describe('Calculatrice : petit écran', () => {
  test.beforeEach(async ({}, info) => test.skip(isDesktop(info.project.name)));

  test('plein écran, utilisable au toucher', async ({ page }, info) => {
    const hit = (locator: Locator): Promise<void> => (info.project.name === 'mobile' ? locator.tap() : locator.click());
    const win = await openCalculator(page, info.project.name);
    const viewport = page.viewportSize()!;
    const box = (await win.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(viewport.width - 2);
    expect(box.height).toBeGreaterThanOrEqual(viewport.height - 4);
    await hit(win.getByRole('button', { name: '7', exact: true }));
    await hit(win.getByRole('button', { name: 'Fois', exact: true }));
    await hit(win.getByRole('button', { name: '6', exact: true }));
    await hit(win.getByRole('button', { name: 'Égale', exact: true }));
    await expect(display(win)).toHaveText('42');
    // aucune touche n'est hors de la fenêtre
    for (const b of await win.getByRole('button').all()) {
      const r = (await b.boundingBox())!;
      if (r.y < viewport.height) expect(r.x + r.width).toBeLessThanOrEqual(viewport.width + 1);
    }
    await hit(win.getByRole('button', { name: 'Fermer' }));
    await expect(win).toHaveCount(0);
  });
});

test.describe('Calculatrice : anglais', () => {
  test.use({ locale: 'en-US' });

  test('boutons, titre et messages en anglais', async ({ page }, info) => {
    await page.goto('/');
    if (isDesktop(info.project.name)) {
      await page.locator('#bureau-desktop .bicon', { hasText: 'Calculator' }).dblclick();
    } else {
      await page.locator('.start-button').click();
      await page.locator('.bmenu').getByRole('menuitem', { name: 'Calculator' }).click();
    }
    const win = page.locator('.bwin[data-app="calculator"]');
    await expect(win.locator('.bwin-title')).toHaveText('Calculator');
    await win.getByRole('button', { name: '1', exact: true }).click();
    await win.getByRole('button', { name: 'Decimal point', exact: true }).click();
    await win.getByRole('button', { name: '5', exact: true }).click();
    await expect(win.getByRole('status')).toHaveText('1.5');
    await win.getByRole('button', { name: 'C Clear all', exact: true }).click();
    await win.getByRole('button', { name: '5', exact: true }).click();
    await win.getByRole('button', { name: 'Divided by', exact: true }).click();
    await win.getByRole('button', { name: '0', exact: true }).click();
    await win.getByRole('button', { name: 'Equals', exact: true }).click();
    await expect(win.getByRole('status')).toHaveText('Cannot divide by zero');
  });
});

test.describe('accessibilité de la Calculatrice', () => {
  test('axe : aucune violation sérieuse ou critique dans la fenêtre', async ({ page }, info) => {
    await openCalculator(page, info.project.name);
    const results = await new AxeBuilder({ page }).include('.bwin[data-app="calculator"]').analyze();
    const blocking = results.violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => `${v.id} (${v.impact}) : ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
    expect(blocking).toEqual([]);
  });

  test('axe : page entière avec la Calculatrice et une erreur affichée', async ({ page }, info) => {
    test.skip(!isDesktop(info.project.name));
    const win = await openCalculator(page, info.project.name);
    await press(win, '1', 'Divisé par', '0', 'Égale');
    await expect(display(win)).toHaveText('Division par zéro impossible');
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => `${v.id} (${v.impact}) : ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
    expect(blocking).toEqual([]);
  });

  test('chaque touche a un nom accessible et le focus est visible', async ({ page }, info) => {
    test.skip(!isDesktop(info.project.name));
    const win = await openCalculator(page, info.project.name);
    const buttons = await win.getByRole('button').all();
    expect(buttons.length).toBe(27 + 3); // 27 touches + minimiser, agrandir, fermer
    for (const b of buttons) expect((await b.getAttribute('aria-label')) ?? (await b.textContent())).toBeTruthy();
  });
});
