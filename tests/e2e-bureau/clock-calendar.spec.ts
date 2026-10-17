import { test, expect, type Locator, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const isDesktop = (name: string): boolean => name === 'desktop';

// Samedi 17 octobre 2026 à Paris (heure d'été, UTC+2) : la page démarre à 14:30:00, puis le temps est figé à 14:32:10.
const START = new Date('2026-10-17T14:30:00+02:00');
const PAUSE = new Date('2026-10-17T14:32:10+02:00');

test.use({ timezoneId: 'Europe/Paris' });

const clockButton = (page: Page): Locator => page.locator('.taskbar button.taskbar-clock-button');
const dialog = (page: Page): Locator => page.getByRole('dialog', { name: /^Date (et heure|and time)$/ });

/** Fige l'heure (le temps ne s'écoule plus tant qu'on ne le fait pas avancer), puis ouvre l'accueil. */
async function gotoFrozen(page: Page): Promise<void> {
  await page.clock.install({ time: START });
  await page.goto('/');
  await page.clock.pauseAt(PAUSE);
  await expect(clockButton(page)).toBeVisible();
}

async function openCalendar(page: Page): Promise<Locator> {
  await clockButton(page).click();
  const pop = dialog(page);
  await expect(pop).toBeVisible();
  return pop;
}

const rotation = async (pop: Locator, hand: string): Promise<number> =>
  pop.locator(`[data-hand="${hand}"]`).evaluate((el) => {
    const match = /rotate\((-?[\d.]+)deg\)/.exec((el as SVGElement).style.transform);
    return match ? Number(match[1]) : NaN;
  });

test.describe('l’horloge de la barre des tâches', () => {
  test('est un vrai bouton nommé « Date et heure », qui affiche l’heure', async ({ page }) => {
    await gotoFrozen(page);
    const button = page.getByRole('button', { name: /Date et heure/ });
    await expect(button).toBeVisible();
    await expect(button).toHaveAttribute('aria-haspopup', 'dialog');
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(button.locator('time.taskbar-clock')).toHaveText('14:32');
  });

  test('reste une seule ligne dans la barre des tâches', async ({ page }, info) => {
    test.skip(!isDesktop(info.project.name));
    await gotoFrozen(page);
    const bar = (await page.locator('.taskbar').boundingBox())!;
    const clock = (await clockButton(page).boundingBox())!;
    expect(bar.height).toBeLessThan(70);
    expect(clock.y).toBeGreaterThanOrEqual(bar.y - 1);
    expect(clock.y + clock.height).toBeLessThanOrEqual(bar.y + bar.height + 1);
  });

  test('le calendrier est un module à part, chargé au premier clic seulement', async ({ page }) => {
    const chunks: string[] = [];
    page.on('request', (request) => {
      if (/\/assets\/dist\/chunks\/popup-/.test(request.url())) chunks.push(request.url());
    });
    await gotoFrozen(page);
    await page.waitForLoadState('networkidle');
    expect(chunks).toEqual([]);
    await openCalendar(page);
    expect(chunks).toHaveLength(1);
  });
});

test.describe('la fenêtre calendrier + horloge', () => {
  test('s’ouvre au-dessus de la barre des tâches, alignée à droite, et reste à l’écran', async ({ page }, info) => {
    await gotoFrozen(page);
    const pop = await openCalendar(page);
    await expect(clockButton(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(pop).not.toHaveAttribute('aria-modal', /.+/);
    const box = (await pop.boundingBox())!;
    const clock = (await clockButton(page).boundingBox())!;
    const viewport = page.viewportSize()!;
    expect(box.y + box.height).toBeLessThanOrEqual(clock.y + 1); // au-dessus de l'horloge
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    expect(box.y).toBeGreaterThanOrEqual(0);
    if (isDesktop(info.project.name)) {
      expect(Math.abs(box.x + box.width - (clock.x + clock.width))).toBeLessThanOrEqual(2); // alignée sur l'horloge
      const bar = (await page.locator('.taskbar').boundingBox())!;
      expect(box.y + box.height).toBeLessThanOrEqual(bar.y + 1);
    }
  });

  test('octobre 2026 : la semaine commence le lundi, le jour courant est en évidence', async ({ page }) => {
    await gotoFrozen(page);
    const pop = await openCalendar(page);
    const grid = pop.getByRole('grid', { name: 'octobre 2026' });
    await expect(grid).toBeVisible();
    const heads = grid.locator('thead th');
    await expect(heads).toHaveCount(7);
    await expect(heads.first()).toHaveText(/^lun/i);
    await expect(heads.last()).toHaveText(/^dim/i);
    const today = grid.getByRole('button', { name: 'samedi 17 octobre 2026' });
    await expect(today).toHaveAttribute('aria-current', 'date');
    await expect(today).toHaveText('17');
    // les jours du mois voisin sont là, grisés : le premier est le lundi 28 septembre
    const first = grid.locator('tbody button').first();
    await expect(first).toHaveText('28');
    await expect(first).toHaveAccessibleName('lundi 28 septembre 2026');
    expect(await first.evaluate((el) => getComputedStyle(el).color)).not.toBe(await today.evaluate((el) => getComputedStyle(el).color));
    // le mois est choisi par une liste, l'année par un champ
    await expect(pop.getByRole('combobox', { name: 'Mois' })).toHaveValue('9');
    await expect(pop.getByRole('spinbutton', { name: 'Année' })).toHaveValue('2026');
  });

  test('l’horloge analogique indique l’heure, et avance chaque seconde', async ({ page }) => {
    await gotoFrozen(page);
    const pop = await openCalendar(page);
    await expect(pop.locator('time.bclock-digital')).toHaveText('14:32:10');
    expect(await rotation(pop, 'second')).toBeCloseTo(60, 3); // 10 s × 6°
    expect(await rotation(pop, 'minute')).toBeCloseTo(32 * 6 + 10 * 0.1, 3);
    expect(await rotation(pop, 'hour')).toBeCloseTo(2 * 30 + 32 * 0.5, 3);
    await page.clock.runFor(3000);
    await expect(pop.locator('time.bclock-digital')).toHaveText('14:32:13');
    expect(await rotation(pop, 'second')).toBeCloseTo(78, 3);
    await expect(pop.locator('svg.bclock-face')).toHaveAttribute('aria-hidden', 'true');
  });

  test('l’aiguille des secondes ne revient pas en arrière en passant par zéro', async ({ page }) => {
    await gotoFrozen(page);
    const pop = await openCalendar(page);
    await page.clock.runFor(49_000); // 14:32:59
    const before = await rotation(pop, 'second');
    await page.clock.runFor(1000); // 14:33:00
    expect(await rotation(pop, 'second')).toBeGreaterThan(before);
    await expect(pop.locator('time.bclock-digital')).toHaveText('14:33:00');
  });

  test('affiche le fuseau horaire', async ({ page }) => {
    await gotoFrozen(page);
    const pop = await openCalendar(page);
    await expect(pop.locator('.bclock-tz')).toContainText('Europe/Paris');
    await expect(pop.locator('.bclock-tz')).toContainText(/Europe centrale/i);
  });

  test('« moins d’animations » : les secondes avancent par pas, sans transition', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoFrozen(page);
    const pop = await openCalendar(page);
    await expect(pop).toHaveClass(/bclock--still/);
    expect(await pop.locator('[data-hand="second"]').evaluate((el) => getComputedStyle(el).transitionDuration)).toBe('0s');
  });

  test('sinon l’aiguille des secondes a une petite transition', async ({ page }) => {
    await gotoFrozen(page);
    const pop = await openCalendar(page);
    await expect(pop).not.toHaveClass(/bclock--still/);
    expect(await pop.locator('[data-hand="second"]').evaluate((el) => getComputedStyle(el).transitionDuration)).not.toBe('0s');
  });

  test('mois précédent / suivant, de décembre à janvier, année et « Aujourd’hui »', async ({ page }) => {
    await gotoFrozen(page);
    const pop = await openCalendar(page);
    const next = pop.getByRole('button', { name: 'Mois suivant' });
    const prev = pop.getByRole('button', { name: 'Mois précédent' });
    await next.click();
    await expect(pop.getByRole('grid', { name: 'novembre 2026' })).toBeVisible();
    await next.click();
    await expect(pop.getByRole('grid', { name: 'décembre 2026' })).toBeVisible();
    await next.click();
    await expect(pop.getByRole('grid', { name: 'janvier 2027' })).toBeVisible();
    await expect(pop.getByRole('spinbutton', { name: 'Année' })).toHaveValue('2027');
    await prev.click();
    await expect(pop.getByRole('grid', { name: 'décembre 2026' })).toBeVisible();
    await pop.getByRole('spinbutton', { name: 'Année' }).fill('2024');
    await pop.getByRole('spinbutton', { name: 'Année' }).press('Enter');
    await pop.getByRole('combobox', { name: 'Mois' }).selectOption('1');
    const grid = pop.getByRole('grid', { name: 'février 2024' });
    await expect(grid).toBeVisible();
    await expect(grid.locator('tbody td:not(.bclock-out) button')).toHaveCount(29); // 2024 est bissextile
    await pop.getByRole('button', { name: 'Aujourd’hui' }).click();
    await expect(pop.getByRole('grid', { name: 'octobre 2026' })).toBeVisible();
  });

  test('un clic sur un jour le sélectionne', async ({ page }) => {
    await gotoFrozen(page);
    const pop = await openCalendar(page);
    await pop.getByRole('button', { name: 'mardi 20 octobre 2026' }).click();
    await expect(pop.locator('td[aria-selected="true"] button')).toHaveText('20');
    await expect(pop.locator('td[aria-selected="true"]')).toHaveCount(1);
  });
});

test.describe('fermeture et clavier', () => {
  test('Entrée sur l’horloge ouvre, le focus va au jour courant ; Échap ferme et rend le focus', async ({ page }) => {
    await gotoFrozen(page);
    await clockButton(page).focus();
    await page.keyboard.press('Enter');
    const pop = dialog(page);
    await expect(pop).toBeVisible();
    await expect(pop.getByRole('button', { name: 'samedi 17 octobre 2026' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(pop).toHaveCount(0);
    await expect(clockButton(page)).toBeFocused();
    await expect(clockButton(page)).toHaveAttribute('aria-expanded', 'false');
    // Espace ouvre aussi
    await page.keyboard.press('Space');
    await expect(dialog(page)).toBeVisible();
  });

  test('flèches, Début / Fin, PageHaut / PageBas dans les jours ; un seul jour tabulable', async ({ page }) => {
    await gotoFrozen(page);
    const pop = await openCalendar(page);
    const focusedName = (): Promise<string | null> => page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? null);
    await page.keyboard.press('ArrowRight');
    expect(await focusedName()).toBe('dimanche 18 octobre 2026');
    await page.keyboard.press('ArrowDown');
    expect(await focusedName()).toBe('dimanche 25 octobre 2026');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowUp');
    expect(await focusedName()).toBe('samedi 17 octobre 2026');
    await page.keyboard.press('Home');
    expect(await focusedName()).toBe('lundi 12 octobre 2026');
    await page.keyboard.press('End');
    expect(await focusedName()).toBe('dimanche 18 octobre 2026');
    await page.keyboard.press('PageDown');
    await expect(pop.getByRole('grid', { name: 'novembre 2026' })).toBeVisible();
    expect(await focusedName()).toBe('mercredi 18 novembre 2026');
    await page.keyboard.press('PageUp');
    await page.keyboard.press('PageUp');
    await expect(pop.getByRole('grid', { name: 'septembre 2026' })).toBeVisible();
    // traverser une fin de mois avec les flèches
    for (let i = 0; i < 14; i++) await page.keyboard.press('ArrowRight');
    await expect(pop.getByRole('grid', { name: 'octobre 2026' })).toBeVisible();
    await expect(pop.locator('tbody button[tabindex="0"]')).toHaveCount(1);
  });

  test('un clic ailleurs, ou un nouveau clic sur l’horloge, ferme la fenêtre', async ({ page }) => {
    await gotoFrozen(page);
    await openCalendar(page);
    await page.locator('main').click({ position: { x: 5, y: 5 } });
    await expect(dialog(page)).toHaveCount(0);
    await expect(clockButton(page)).toHaveAttribute('aria-expanded', 'false');
    await openCalendar(page);
    await clockButton(page).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(clockButton(page)).toBeFocused();
  });

  test('Tab hors de la fenêtre la ferme', async ({ page }) => {
    await gotoFrozen(page);
    await openCalendar(page);
    for (let i = 0; i < 12 && (await dialog(page).count()) > 0; i++) await page.keyboard.press('Tab');
    await expect(dialog(page)).toHaveCount(0);
  });

  test('Échap ferme le calendrier, pas la fenêtre d’appli qui est dessous', async ({ page }, info) => {
    test.skip(!isDesktop(info.project.name));
    await gotoFrozen(page);
    await page.locator('#bureau-desktop .bicon', { hasText: 'Corbeille' }).dblclick();
    const trash = page.locator('.bwin[data-app="trash"]');
    await expect(trash).toBeVisible();
    await openCalendar(page);
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toHaveCount(0);
    await expect(trash).toBeVisible();
    await trash.focus();
    await page.keyboard.press('Escape');
    await expect(trash).toHaveCount(0);
  });

  test('ouvrir le menu Démarrer ferme le calendrier', async ({ page }) => {
    await gotoFrozen(page);
    await openCalendar(page);
    await page.locator('.start-button').click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(page.locator('.bmenu')).toBeVisible();
  });

  test('plus aucune minuterie après la fermeture : le cadran n’est plus mis à jour', async ({ page }) => {
    await gotoFrozen(page);
    await openCalendar(page);
    await page.keyboard.press('Escape');
    await page.clock.runFor(10_000);
    await expect(page.locator('.bclock-pop, .bclock-digital')).toHaveCount(0);
    await openCalendar(page);
    await expect(page.locator('time.bclock-digital')).toHaveCount(1); // une seule fenêtre, rouverte proprement
  });
});

test.describe('calendrier : petit écran', () => {
  test.beforeEach(async ({}, info) => test.skip(isDesktop(info.project.name)));

  test('s’ouvre depuis l’horloge de la barre des tâches et tient dans l’écran', async ({ page }, info) => {
    await gotoFrozen(page);
    const button = clockButton(page);
    await button.scrollIntoViewIfNeeded();
    if (info.project.name === 'mobile') await button.tap();
    else await button.click();
    const pop = dialog(page);
    await expect(pop).toBeVisible();
    const box = (await pop.boundingBox())!;
    const viewport = page.viewportSize()!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    await expect(pop.getByRole('grid', { name: 'octobre 2026' })).toBeVisible();
    await expect(pop.locator('svg.bclock-face')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    // on peut naviguer au toucher
    const next = pop.getByRole('button', { name: 'Mois suivant' });
    if (info.project.name === 'mobile') await next.tap();
    else await next.click();
    await expect(pop.getByRole('grid', { name: 'novembre 2026' })).toBeVisible();
    // et la fermer
    await page.keyboard.press('Escape');
    await expect(pop).toHaveCount(0);
  });
});

test.describe('calendrier : anglais', () => {
  test.use({ locale: 'en-US' });

  test('semaine du dimanche, noms anglais, bouton nommé « Date and time »', async ({ page }) => {
    await gotoFrozen(page);
    await expect(page.getByRole('button', { name: /Date and time/ })).toBeVisible();
    const pop = await openCalendar(page);
    const grid = pop.getByRole('grid', { name: 'October 2026' });
    await expect(grid).toBeVisible();
    await expect(grid.locator('thead th').first()).toHaveText(/^Sun/);
    await expect(grid.locator('thead th').last()).toHaveText(/^Sat/);
    await expect(grid.locator('tbody button').first()).toHaveText('27'); // dimanche 27 septembre
    await expect(grid.getByRole('button', { name: /Saturday, October 17, 2026/ })).toHaveAttribute('aria-current', 'date');
    await expect(pop.getByRole('button', { name: 'Next month' })).toBeVisible();
    await expect(pop.getByRole('combobox', { name: 'Month' })).toBeVisible();
    await expect(pop.locator('.bclock-tz')).toContainText(/Central European/);
  });
});

test.describe('accessibilité du calendrier', () => {
  test('axe : aucune violation sérieuse ou critique dans la fenêtre ouverte', async ({ page }) => {
    await gotoFrozen(page);
    await openCalendar(page);
    await page.clock.resume(); // axe a besoin de minuteries
    const results = await new AxeBuilder({ page }).include('.bclock-pop').analyze();
    const blocking = results.violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => `${v.id} (${v.impact}) : ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
    expect(blocking).toEqual([]);
  });

  test('axe : la page entière, calendrier ouvert, et le bouton horloge fermé', async ({ page }) => {
    await gotoFrozen(page);
    await page.clock.resume(); // axe a besoin de minuteries
    const closed = await new AxeBuilder({ page }).analyze();
    await openCalendar(page);
    const open = await new AxeBuilder({ page }).analyze();
    for (const results of [closed, open]) {
      const blocking = results.violations
        .filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .map((v) => `${v.id} (${v.impact}) : ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
      expect(blocking).toEqual([]);
    }
  });
});
