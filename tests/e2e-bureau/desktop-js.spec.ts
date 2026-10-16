import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { POSTS } from '../e2e/fixtures';

const isDesktop = (name: string): boolean => name === 'desktop';

async function openApp(page: Page, title: string): Promise<void> {
  await page.locator('#bureau-desktop .bicon', { hasText: title }).dblclick();
}

async function openFromStartMenu(page: Page, title: string): Promise<void> {
  await page.locator('.start-button').click();
  await page.locator('.bmenu').getByRole('menuitem', { name: title }).click();
}

test.describe('bureau : grand écran', () => {
  test.beforeEach(async ({}, info) => test.skip(!isDesktop(info.project.name)));

  test('11 icônes : 5 du menu du site et 6 applis ; le menu d’origine est masqué', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#bureau-desktop .bicon')).toHaveCount(11);
    await expect(page.locator('.desktop-icons')).toBeHidden();
    for (const label of ['Accueil', 'Terminal', 'Démineur.exe', 'WORDPAD.EXE', 'Oh-Oh! Messenger', 'Corbeille', 'DOOM.EXE']) {
      await expect(page.locator('#bureau-desktop .bicon', { hasText: label })).toBeVisible();
    }
  });

  test('un simple clic sélectionne, un double-clic ouvre', async ({ page }) => {
    await page.goto('/a-propos/');
    await page.locator('#bureau-desktop .bicon', { hasText: 'Accueil' }).click();
    await expect(page).toHaveURL(/\/a-propos\/$/);
    await expect(page.locator('#bureau-desktop .bicon--selected')).toHaveCount(1);
    await page.locator('#bureau-desktop .bicon', { hasText: 'Accueil' }).dblclick();
    await expect(page).toHaveURL(/localhost:8888\/$/);
  });

  test('une bulle explique le double-clic au premier simple clic, une seule fois', async ({ page }) => {
    await page.goto('/');
    await page.locator('#bureau-desktop .bicon', { hasText: 'Corbeille' }).click();
    await expect(page.locator('.bicon-hint')).toHaveText('Double-cliquez pour ouvrir');
    await page.reload();
    await page.locator('#bureau-desktop .bicon', { hasText: 'Corbeille' }).click();
    await expect(page.locator('.bicon-hint')).toHaveCount(0);
  });

  test('ouvrir, déplacer, réduire, restaurer et fermer une fenêtre', async ({ page }) => {
    await page.goto('/');
    await openApp(page, 'Corbeille');
    const win = page.locator('.bwin[data-app="trash"]');
    await expect(win).toBeVisible();
    await expect(page.locator('.bwin-tab')).toHaveText('Corbeille');

    const before = await win.boundingBox();
    const bar = win.locator('.bwin-titlebar');
    const barBox = await bar.boundingBox();
    await page.mouse.move(barBox!.x + 60, barBox!.y + 10);
    await page.mouse.down();
    await page.mouse.move(barBox!.x + 160, barBox!.y + 70, { steps: 5 });
    await page.mouse.up();
    const after = await win.boundingBox();
    expect(Math.round(after!.x - before!.x)).toBe(100);
    expect(Math.round(after!.y - before!.y)).toBe(60);

    await win.getByRole('button', { name: 'Réduire' }).click();
    await expect(win).toBeHidden();
    await page.locator('.bwin-tab').click();
    await expect(win).toBeVisible();

    await win.getByRole('button', { name: 'Fermer' }).click();
    await expect(win).toHaveCount(0);
    await expect(page.locator('.bwin-tab')).toHaveCount(0);
  });

  test('Échap ferme la fenêtre active', async ({ page }) => {
    await page.goto('/');
    await openApp(page, 'Terminal');
    const win = page.locator('.bwin[data-app="terminal"]');
    await expect(win).toBeVisible();
    await win.locator('input').focus();
    await page.keyboard.press('Escape');
    await expect(win).toHaveCount(0);
  });

  test('la position d’une fenêtre est mémorisée', async ({ page }) => {
    await page.goto('/');
    await openApp(page, 'Corbeille');
    const win = page.locator('.bwin[data-app="trash"]');
    const bar = await win.locator('.bwin-titlebar').boundingBox();
    await page.mouse.move(bar!.x + 60, bar!.y + 10);
    await page.mouse.down();
    await page.mouse.move(bar!.x + 260, bar!.y + 110, { steps: 5 });
    await page.mouse.up();
    const moved = await win.boundingBox();
    await win.getByRole('button', { name: 'Fermer' }).click();
    await page.reload();
    await openApp(page, 'Corbeille');
    const again = await page.locator('.bwin[data-app="trash"]').boundingBox();
    expect(Math.abs(again!.x - moved!.x)).toBeLessThan(2);
    expect(Math.abs(again!.y - moved!.y)).toBeLessThan(2);
  });

  test('on déplace une icône dans la bande ; sa place est mémorisée et « Réorganiser » la remet', async ({ page }) => {
    await page.goto('/');
    const icon = page.locator('#bureau-desktop .bicon', { hasText: 'Démineur.exe' });
    const start = await icon.boundingBox();
    await page.mouse.move(start!.x + 40, start!.y + 30);
    await page.mouse.down();
    await page.mouse.move(start!.x + 40, start!.y + 30 + 480, { steps: 8 });
    await page.mouse.up();
    const moved = await icon.boundingBox();
    expect(Math.round(moved!.y - start!.y)).toBe(480);
    await page.reload();
    const reloaded = await page.locator('#bureau-desktop .bicon', { hasText: 'Démineur.exe' }).boundingBox();
    expect(Math.abs(reloaded!.x - moved!.x)).toBeLessThan(2);
    expect(Math.abs(reloaded!.y - moved!.y)).toBeLessThan(2);

    await page.mouse.click(30, 820, { button: 'right' });
    await page.getByRole('menuitem', { name: 'Réorganiser les icônes' }).click();
    const reset = await page.locator('#bureau-desktop .bicon', { hasText: 'Démineur.exe' }).boundingBox();
    expect(Math.abs(reset!.x - start!.x)).toBeLessThan(2);
    expect(Math.abs(reset!.y - start!.y)).toBeLessThan(2);
  });

  test('Maj + flèche déplace une icône au clavier', async ({ page }) => {
    await page.goto('/');
    const icon = page.locator('#bureau-desktop .bicon', { hasText: 'Terminal' });
    const start = await icon.boundingBox();
    await icon.focus();
    await page.keyboard.press('Shift+ArrowRight');
    const moved = await icon.boundingBox();
    expect(Math.round(moved!.x - start!.x)).toBe(96);
  });

  test('la fenêtre de la barre latérale se déplace et reste mémorisée', async ({ page }) => {
    await page.goto('/');
    const win = page.locator('.sidebar-windows > .window').nth(1);
    const before = await win.boundingBox();
    const bar = await win.locator('.window-titlebar').boundingBox();
    await page.mouse.move(bar!.x + 40, bar!.y + 10);
    await page.mouse.down();
    await page.mouse.move(bar!.x - 160, bar!.y + 90, { steps: 6 });
    await page.mouse.up();
    const moved = await win.boundingBox();
    expect(Math.round(before!.x - moved!.x)).toBe(200);
    await page.reload();
    const again = await page.locator('.sidebar-windows > .window').nth(1).boundingBox();
    expect(Math.abs(again!.x - moved!.x)).toBeLessThan(2);
  });

  test('les fenêtres des articles ne se déplacent pas', async ({ page }) => {
    await page.goto(POSTS.latest.path);
    const win = page.locator('article.window');
    const before = await win.boundingBox();
    const bar = await win.locator('.window-titlebar').boundingBox();
    await page.mouse.move(bar!.x + 60, bar!.y + 10);
    await page.mouse.down();
    await page.mouse.move(bar!.x + 200, bar!.y + 100, { steps: 5 });
    await page.mouse.up();
    const after = await win.boundingBox();
    expect(after!.x).toBe(before!.x);
    expect(after!.y).toBe(before!.y);
  });

  test('menu Démarrer : programmes, documents, réglages, Échap rend le focus', async ({ page }) => {
    await page.goto('/');
    const start = page.locator('.start-button');
    await start.click();
    const menu = page.locator('.bmenu');
    await expect(menu).toBeVisible();
    await expect(start).toHaveAttribute('aria-expanded', 'true');
    await expect(menu.getByRole('menuitem', { name: 'Démineur.exe' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: /A folder of markdown/ })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Plan du site' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect(start).toBeFocused();
  });

  test('réglage du son mémorisé dans le navigateur', async ({ page }) => {
    await page.goto('/');
    await page.locator('.start-button').click();
    await page.locator('.bmenu').getByRole('menuitemcheckbox', { name: 'Son' }).click();
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('jchable-bureau:v1') ?? '{}'));
    expect(stored.sound).toBe(false);
  });

  test('Arrêter… affiche l’écran d’arrêt puis redémarre la page', async ({ page }) => {
    await page.goto('/');
    await page.locator('.start-button').click();
    await page.locator('.bmenu').getByRole('menuitem', { name: 'Arrêter…' }).click();
    const screen = page.locator('.bshutdown');
    await expect(screen).toContainText('Vous pouvez maintenant éteindre votre ordinateur');
    await Promise.all([page.waitForNavigation(), screen.click()]);
    await expect(page.locator('.bshutdown')).toHaveCount(0);
  });

  test('l’horloge affiche l’heure', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('time.taskbar-clock')).toHaveText(/^\d{2}:\d{2}$/);
  });

  test('un échec de chargement d’appli affiche une boîte d’erreur, le blog continue', async ({ page }) => {
    await page.route('**/chunks/index-*.js', (route) => route.abort());
    await page.route('**/chunks/trash*.js', (route) => route.abort());
    await page.goto('/');
    await openApp(page, 'Corbeille');
    await expect(page.locator('.bwin[data-app="trash"]')).toContainText('a cessé de fonctionner');
    await page.locator('.bwin[data-app="trash"]').getByRole('button', { name: 'Fermer', exact: true }).last().click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Julien Chable');
  });

  test('aucune appli n’est téléchargée avant son lancement', async ({ page }) => {
    const chunks: string[] = [];
    page.on('request', (request) => {
      // Le code partagé (traductions) se charge avec la page ; les applis, jamais avant leur lancement.
      if (/\/assets\/dist\/chunks\/(?!boot-|i18n-)/.test(request.url())) chunks.push(request.url());
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(chunks).toEqual([]);
    await openApp(page, 'Démineur.exe');
    await expect(page.locator('.bwin[data-app="minesweeper"] [role="grid"]')).toBeVisible();
    expect(chunks.length).toBeGreaterThan(0);
  });
});

test.describe('applis', () => {
  test.beforeEach(async ({}, info) => test.skip(!isDesktop(info.project.name)));

  test('Terminal : help, ls, gag qui déclenche l’écran bleu', async ({ page }) => {
    await page.goto('/');
    await openApp(page, 'Terminal');
    const input = page.locator('.bwin[data-app="terminal"] input');
    await input.fill('help');
    await input.press('Enter');
    await expect(page.locator('.bwin[data-app="terminal"]')).toContainText('doom');
    await input.fill('ls');
    await input.press('Enter');
    await expect(page.locator('.bwin[data-app="terminal"]')).toContainText('okf4net-0-6-0');
    await input.fill('sudo rm -rf /');
    await input.press('Enter');
    await expect(page.locator('.bbsod')).toBeVisible();
    await page.keyboard.press('Space');
    await expect(page.locator('.bbsod')).toHaveCount(0);
  });

  test('Démineur : grille accessible, un clic dévoile', async ({ page }) => {
    await page.goto('/');
    await openApp(page, 'Démineur.exe');
    const grid = page.locator('.bwin[data-app="minesweeper"] [role="grid"]');
    await expect(grid).toBeVisible();
    await expect(grid.locator('[role="gridcell"]')).toHaveCount(81);
    await grid.locator('[role="gridcell"]').nth(40).click();
    await expect(page.locator('.bwin[data-app="minesweeper"]')).not.toContainText('Perdu');
  });

  test('WordPad : écrire et enregistrer sous télécharge un fichier', async ({ page }) => {
    await page.goto('/');
    await openApp(page, 'WORDPAD.EXE');
    const win = page.locator('.bwin[data-app="wordpad"]');
    const editor = win.getByRole('textbox', { name: 'Document' });
    await expect(editor).toBeVisible();
    await editor.click();
    await page.keyboard.type('Bonjour le bureau');
    await win.getByRole('button', { name: /Enregistrer sous/ }).click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      win.getByRole('button', { name: 'Enregistrer', exact: true }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.(html|txt)$/);
  });

  test('Messenger : les commentaires du blog arrivent comme des messages', async ({ page }) => {
    await page.goto('/');
    await openApp(page, 'Oh-Oh! Messenger');
    const win = page.locator('.bwin[data-app="messenger"]');
    await expect(win).toContainText('Alice');
    await expect(win).toContainText('Super article, merci !');
    await expect(win).toContainText('Chloé');
  });

  test('Corbeille : 8 brouillons, on vide la corbeille', async ({ page }) => {
    await page.goto('/');
    await openApp(page, 'Corbeille');
    const win = page.locator('.bwin[data-app="trash"]');
    await expect(win.getByRole('option')).toHaveCount(8);
    await win.getByRole('button', { name: /Vider la corbeille/ }).click();
    await expect(win).toContainText('Rien à voir ici');
  });

  test('DOOM : rien n’est téléchargé avant le clic, puis une fenêtre s’ouvre', async ({ page }) => {
    const doomRequests: string[] = [];
    page.on('request', (request) => {
      if (/\/assets\/doom\//.test(request.url())) doomRequests.push(request.url());
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(doomRequests).toEqual([]);
    await openApp(page, 'DOOM.EXE');
    await expect(page.locator('.bwin[data-app="doom"]')).toBeVisible();
  });
});

test.describe('DOOM', () => {
  test.beforeEach(async ({}, info) => test.skip(!isDesktop(info.project.name)));

  test('le moteur se charge, affiche un écran, ne fait pas défiler la page et se ferme', async ({ page }) => {
    test.setTimeout(120_000);
    const files: string[] = [];
    page.on('request', (request) => {
      if (/\/assets\/doom\//.test(request.url())) files.push(request.url().split('/').pop()!.split('?')[0]!);
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(files).toEqual([]);
    await openApp(page, 'DOOM.EXE');
    const win = page.locator('.bwin[data-app="doom"]');
    const frame = win.locator('iframe');
    await expect(frame).toBeVisible();
    // Un écran noir donne un PNG minuscule ; l'écran titre du jeu est bien plus lourd.
    await expect.poll(async () => (await frame.screenshot()).length, { timeout: 90_000 }).toBeGreaterThan(8000);
    expect(files).toEqual(expect.arrayContaining(['websockets-doom.wasm', 'doom1.wad']));
    await win.locator('.bapp-doom-hint').click();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Space');
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await win.locator('.bwin-controls').getByRole('button', { name: 'Fermer' }).click();
    await expect(win).toHaveCount(0);
  });
});

test.describe('écran de veille', () => {
  test.beforeEach(async ({}, info) => test.skip(!isDesktop(info.project.name)));

  test('apparaît après 3 minutes sur l’accueil et disparaît au moindre geste', async ({ page }) => {
    await page.clock.install();
    await page.goto('/');
    await page.clock.fastForward(3 * 60 * 1000 + 1000);
    await expect(page.locator('.bscr-overlay')).toBeVisible();
    await page.clock.fastForward(500);
    await page.mouse.move(300, 300);
    await page.mouse.move(340, 320);
    await expect(page.locator('.bscr-overlay')).toHaveCount(0);
  });

  test('ne se déclenche jamais sur un article', async ({ page }) => {
    await page.clock.install();
    await page.goto(POSTS.latest.path);
    await page.clock.fastForward(10 * 60 * 1000);
    await expect(page.locator('.bscr-overlay')).toHaveCount(0);
  });
});

test.describe('bureau : petit écran', () => {
  test.beforeEach(async ({}, info) => test.skip(info.project.name !== 'mobile'));

  test('pas de bureau d’icônes : le menu d’origine reste visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#bureau-desktop')).toBeHidden();
    await expect(page.locator('.desktop-icons')).toBeVisible();
  });

  test('une appli s’ouvre en plein écran depuis le menu Démarrer et se ferme', async ({ page }) => {
    await page.goto('/');
    await openFromStartMenu(page, 'Démineur.exe');
    const win = page.locator('.bwin[data-app="minesweeper"]');
    await expect(win).toBeVisible();
    const box = await win.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(388);
    expect(box!.height).toBeGreaterThanOrEqual(840);
    await win.getByRole('button', { name: 'Fermer' }).click();
    await expect(win).toHaveCount(0);
  });

  test('DOOM n’est pas disponible sur mobile, avec un message clair', async ({ page }) => {
    await page.goto('/');
    await openFromStartMenu(page, 'DOOM.EXE');
    await expect(page.locator('.bwin[data-app="doom"]')).toContainText('clavier');
  });
});

test.describe('accessibilité du bureau interactif', () => {
  test('axe : menu Démarrer ouvert', async ({ page }) => {
    await page.goto('/');
    await page.locator('.start-button').click();
    await expect(page.locator('.bmenu')).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => `${v.id} : ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
    expect(blocking).toEqual([]);
  });

  test('axe : fenêtre d’appli ouverte', async ({ page }, info) => {
    test.skip(info.project.name === 'tablet');
    await page.goto('/');
    if (isDesktop(info.project.name)) await openApp(page, 'Corbeille');
    else await openFromStartMenu(page, 'Corbeille');
    await expect(page.locator('.bwin[data-app="trash"]')).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => `${v.id} : ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
    expect(blocking).toEqual([]);
  });

  test('axe : bureau avec ses icônes (grand écran)', async ({ page }, info) => {
    test.skip(!isDesktop(info.project.name));
    await page.goto('/');
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => `${v.id} : ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
    expect(blocking).toEqual([]);
  });
});

test.describe('correctifs issus de la relecture indépendante', () => {
  test.beforeEach(async ({}, info) => test.skip(!isDesktop(info.project.name)));

  test('une fenêtre réduite se rouvre normalement après un rechargement', async ({ page }) => {
    await page.goto('/');
    await openApp(page, 'Corbeille');
    const win = page.locator('.bwin[data-app="trash"]');
    await win.getByRole('button', { name: 'Réduire' }).click();
    await page.reload();
    await openApp(page, 'Corbeille');
    await expect(win).toBeVisible();
    const box = await win.boundingBox();
    expect(box!.x).toBeGreaterThan(20);
    expect(box!.y).toBeGreaterThan(20);
  });

  test('une fenêtre reste atteignable quand le navigateur rétrécit', async ({ page }) => {
    await page.goto('/');
    await openApp(page, 'Corbeille');
    const win = page.locator('.bwin[data-app="trash"]');
    const bar = await win.locator('.bwin-titlebar').boundingBox();
    await page.mouse.move(bar!.x + 60, bar!.y + 10);
    await page.mouse.down();
    await page.mouse.move(1300, 300, { steps: 6 });
    await page.mouse.up();
    await page.setViewportSize({ width: 1000, height: 700 });
    await expect.poll(async () => (await win.boundingBox())!.x, { timeout: 3000 }).toBeLessThanOrEqual(1000 - 56);
  });

  test('Échap qui réveille l’écran de veille ne ferme pas la fenêtre dessous', async ({ page }) => {
    await page.clock.install();
    await page.goto('/');
    await openApp(page, 'Terminal');
    const win = page.locator('.bwin[data-app="terminal"]');
    await win.locator('input').focus();
    await page.clock.fastForward(3 * 60 * 1000 + 1000);
    await expect(page.locator('.bscr-overlay')).toBeVisible();
    await page.clock.fastForward(500);
    await page.keyboard.press('Escape');
    await expect(page.locator('.bscr-overlay')).toHaveCount(0);
    await expect(win).toBeVisible();
  });

  test('avec « moins d’animations », l’écran de veille ne se déclenche pas tout seul', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.clock.install();
    await page.goto('/');
    await page.clock.fastForward(10 * 60 * 1000);
    await expect(page.locator('.bscr-overlay')).toHaveCount(0);
  });

  test('la première tabulation tombe sur le lien d’évitement, pas sur les icônes', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toHaveClass(/skip-link/);
  });

  test('basculer entre grand et petit écran ne multiplie pas les écouteurs', async ({ page }) => {
    await page.goto('/');
    for (const width of [800, 1440, 800, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.locator('html')).toHaveClass(width >= 900 ? /bureau-desktop-on/ : /^((?!bureau-desktop-on).)*$/);
    }
    await expect(page.locator('#bureau-desktop .bicon')).toHaveCount(11);
    await page.mouse.click(30, 820, { button: 'right' });
    await expect(page.locator('.bctx')).toHaveCount(1);
  });

  test('rouvrir vite le menu Démarrer n’ajoute pas de documents en double', async ({ page }) => {
    await page.route('**/wp-json/wp/v2/posts*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 600));
      await route.continue();
    });
    await page.goto('/');
    const start = page.locator('.start-button');
    await start.click();
    await page.keyboard.press('Escape');
    await start.click();
    const docs = page.locator('.bmenu [role="group"][aria-label="Documents"] [role="menuitem"]');
    await expect(docs).toHaveCount(5);
    await page.waitForTimeout(900);
    await expect(docs).toHaveCount(5);
  });

  test('Échap ferme la fenêtre du dessus même quand le focus est sur la page', async ({ page }) => {
    await page.goto('/');
    await openApp(page, 'Corbeille');
    const win = page.locator('.bwin[data-app="trash"]');
    await expect(win).toBeVisible();
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('Escape');
    await expect(win).toHaveCount(0);
  });

  test('le menu Démarrer propose les pages du menu du site, dont À propos', async ({ page }) => {
    await page.goto('/');
    await page.locator('.start-button').click();
    const menu = page.locator('.bmenu');
    await expect(menu.getByRole('menuitem', { name: 'À propos' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Flux RSS' })).toBeVisible();
  });

  test('WordPad ouvert sur un article parle de cet article', async ({ page }) => {
    await page.goto(POSTS.release.path);
    await openApp(page, 'WORDPAD.EXE');
    await expect(page.locator('.bwin[data-app="wordpad"]').getByRole('textbox', { name: 'Document' })).toContainText(
      'OKF4net 0.6.0',
    );
  });

  test('une icône dont le lien est « # » ne plante pas', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      const link = document.querySelector<HTMLAnchorElement>('.desktop-icons a[href="#recherche"]');
      link?.setAttribute('href', '#');
    });
    await page.reload();
    await expect(page.locator('#bureau-desktop .bicon')).toHaveCount(11);
  });
});

test.describe('correctifs de la revue finale', () => {
  test.beforeEach(async ({}, info) => test.skip(!isDesktop(info.project.name)));

  test('la barre des tâches reste visible en bas de l’écran, même en haut d’une longue page', async ({ page }) => {
    await page.goto('/');
    const bar = await page.locator('.taskbar').boundingBox();
    expect(bar!.y + bar!.height).toBeLessThanOrEqual(900 + 1);
    expect(bar!.y).toBeGreaterThan(700);
    await expect(page.locator('.start-button')).toBeInViewport();
  });

  test('une fenêtre réduite se retrouve dans la barre des tâches visible, et le focus ne se perd pas', async ({ page }) => {
    await page.goto('/');
    await openApp(page, 'Corbeille');
    await page.locator('.bwin[data-app="trash"]').getByRole('button', { name: 'Réduire' }).click();
    await expect(page.locator('.bwin-tab')).toBeInViewport();
    expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('BODY');
    await page.locator('.bwin-tab').click();
    await expect(page.locator('.bwin[data-app="trash"]')).toBeVisible();
  });

  test('avec cinq fenêtres ouvertes, la barre des tâches reste sur une seule ligne', async ({ page }) => {
    await page.goto('/');
    for (const title of ['Terminal', 'Démineur.exe', 'WORDPAD.EXE', 'Oh-Oh! Messenger', 'Corbeille']) {
      await openApp(page, title);
    }
    const bar = await page.locator('.taskbar').boundingBox();
    expect(bar!.height).toBeLessThan(70);
    await expect(page.locator('time.taskbar-clock')).toBeInViewport();
  });

  test('le menu Démarrer ne propose le flux RSS qu’une fois', async ({ page }) => {
    await page.goto('/');
    await page.locator('.start-button').click();
    await expect(page.locator('.bmenu').getByRole('menuitem', { name: /RSS/ })).toHaveCount(1);
  });

  test('un geste rapide déplace quand même l’icône', async ({ page }) => {
    await page.goto('/');
    const icon = page.locator('#bureau-desktop .bicon', { hasText: 'Démineur.exe' });
    const start = await icon.boundingBox();
    await page.mouse.move(start!.x + 40, start!.y + 30);
    await page.mouse.down();
    await page.mouse.move(start!.x + 40, start!.y + 30 + 480, { steps: 2 });
    await page.mouse.up();
    const moved = await icon.boundingBox();
    expect(Math.round(moved!.y - start!.y)).toBe(480);
  });

  test('DOOM : un panneau « À propos » donne les licences et le lien vers le code source', async ({ page }) => {
    await page.goto('/');
    await openApp(page, 'DOOM.EXE');
    const win = page.locator('.bwin[data-app="doom"]');
    await win.getByRole('button', { name: 'À propos' }).click();
    const panel = win.locator('.bapp-doom-about');
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('link', { name: /code source/i })).toHaveAttribute('href', /github\.com\/cloudflare\/doom-wasm/);
    await expect(panel.getByRole('link', { name: /GPL/ })).toBeVisible();
    const readme = panel.getByRole('link', { name: /construction/i });
    const href = await readme.getAttribute('href');
    const response = await page.request.get(href!);
    expect(response.status()).toBe(200);
  });
});

test.describe('« À propos » s’ouvre dans une fenêtre', () => {
  test('grand écran : le double-clic ouvre une fenêtre avec la page, sans quitter l’accueil', async ({ page }, info) => {
    test.skip(!isDesktop(info.project.name));
    await page.goto('/');
    await openApp(page, 'À propos');
    const win = page.locator('.bwin[data-app="page-a-propos"]');
    await expect(win).toBeVisible();
    await expect(win.locator('.bwin-title')).toHaveText('a-propos.md');
    await expect(win.getByRole('heading', { level: 1 })).toHaveText('À propos');
    await expect(win).toContainText('Open Knowledge Format');
    await expect(win.getByRole('link', { name: /Ouvrir la page/ })).toHaveAttribute('href', /\/a-propos\/$/);
    await expect(page).toHaveURL(/localhost:8888\/$/);
    await win.getByRole('button', { name: 'Fermer' }).click();
    await expect(win).toHaveCount(0);
  });

  test('une page sans contenu (Plan du site) s’ouvre normalement, pas dans une fenêtre', async ({ page }, info) => {
    test.skip(!isDesktop(info.project.name));
    await page.goto('/');
    await openApp(page, 'Plan du site');
    await expect(page).toHaveURL(/\/plan-du-site\/$/);
  });

  test('l’accueil reste une vraie navigation', async ({ page }, info) => {
    test.skip(!isDesktop(info.project.name));
    await page.goto('/a-propos/');
    await openApp(page, 'Accueil');
    await expect(page).toHaveURL(/localhost:8888\/$/);
  });

  test('le menu Démarrer ouvre aussi « À propos » dans une fenêtre', async ({ page }, info) => {
    test.skip(info.project.name === 'tablet');
    await page.goto('/');
    await openFromStartMenu(page, 'À propos');
    await expect(page.locator('.bwin[data-app="page-a-propos"]')).toBeVisible();
    await expect(page).toHaveURL(/localhost:8888\/$/);
  });

  test('si l’API échoue, la page s’ouvre normalement', async ({ page }, info) => {
    test.skip(!isDesktop(info.project.name));
    await page.route('**/wp-json/wp/v2/pages*', (route) => route.abort());
    await page.goto('/');
    await openApp(page, 'À propos');
    await expect(page).toHaveURL(/\/a-propos\/$/);
  });

  test('du contenu piégé venant de l’API reste inerte', async ({ page }, info) => {
    test.skip(!isDesktop(info.project.name));
    await page.route('**/wp-json/wp/v2/pages*', (route) =>
      route.fulfill({
        json: [
          {
            title: { rendered: 'Piège <img src=x onerror="window.__pwn=1">' },
            link: 'https://localhost:8888/a-propos/',
            content: { rendered: '<p>texte</p><img src="x" onerror="window.__pwn=1"><script>window.__pwn=1</script><a href="javascript:window.__pwn=1">clic</a>' },
          },
        ],
      }),
    );
    await page.goto('/');
    await openApp(page, 'À propos');
    const win = page.locator('.bwin[data-app="page-a-propos"]');
    await expect(win).toContainText('texte');
    await win.getByText('clic').click();
    expect(await page.evaluate(() => (window as unknown as { __pwn?: number }).__pwn)).toBeUndefined();
    await expect(win.locator('script, [onerror]')).toHaveCount(0);
  });
});

test.describe('bande d’icônes : jamais cachée, adaptée à la largeur', () => {
  test.beforeEach(async ({}, info) => test.skip(!isDesktop(info.project.name)));

  const columns = async (page: Page): Promise<number[]> => {
    const lefts = await page.locator('#bureau-desktop .bicon').evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().left)));
    const distinct = [...new Set(lefts)].sort((x, y) => x - y);
    return distinct.map((left) => lefts.filter((l) => l === left).length);
  };

  test('deux colonnes avec le même nombre d’icônes (6 et 5), jamais 8 et 3', async ({ page }) => {
    await page.goto('/');
    expect(await columns(page)).toEqual([6, 5]);
  });

  test('une seule colonne sur un écran très haut ou étroit', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1300 });
    await page.goto('/');
    expect(await columns(page)).toEqual([11]);
    await page.setViewportSize({ width: 1000, height: 900 });
    await expect.poll(async () => (await columns(page)).length).toBe(1);
  });

  test('le contenu est plus large qu’avant et occupe tout l’espace restant', async ({ page }) => {
    await page.goto('/');
    expect((await page.locator('main').boundingBox())!.width).toBeGreaterThanOrEqual(800);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect.poll(async () => (await page.locator('main').boundingBox())!.width).toBeGreaterThanOrEqual(1200);
  });

  test('le contenu ne passe jamais sous les icônes', async ({ page }) => {
    await page.goto('/');
    const band = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bureau-band')));
    expect(band).toBeGreaterThan(100);
    const main = await page.locator('main').boundingBox();
    expect(main!.x).toBeGreaterThanOrEqual(band);
  });

  test('aucune fenêtre ne recouvre une icône, même tirée tout à gauche', async ({ page }) => {
    await page.goto('/');
    for (const title of ['Terminal', 'Démineur.exe', 'WORDPAD.EXE']) await openApp(page, title);
    const win = page.locator('.bwin[data-app="terminal"]');
    const bar = await win.locator('.bwin-titlebar').boundingBox();
    await page.mouse.move(bar!.x + 80, bar!.y + 10);
    await page.mouse.down();
    await page.mouse.move(2, bar!.y + 200, { steps: 8 });
    await page.mouse.up();
    const covered = await page.locator('#bureau-desktop .bicon').evaluateAll((icons) =>
      icons.filter((icon) => {
        const r = icon.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return hit?.closest('.bicon') !== icon;
      }).map((icon) => (icon as HTMLElement).dataset['id']),
    );
    expect(covered).toEqual([]);
  });

  test('une icône lâchée sur le contenu revient dans la bande', async ({ page }) => {
    await page.goto('/');
    const icon = page.locator('#bureau-desktop .bicon', { hasText: 'Terminal' });
    const start = await icon.boundingBox();
    await page.mouse.move(start!.x + 40, start!.y + 30);
    await page.mouse.down();
    await page.mouse.move(900, 400, { steps: 8 });
    await page.mouse.up();
    const band = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bureau-band')));
    const moved = await icon.boundingBox();
    expect(moved!.x + moved!.width).toBeLessThanOrEqual(band);
  });
});

test.describe('un seul bureau, même après le chargement d’une appli', () => {
  test.beforeEach(async ({}, info) => test.skip(!isDesktop(info.project.name)));

  const APPS: Array<[string, string]> = [
    ['Terminal', 'terminal'],
    ['Démineur.exe', 'minesweeper'],
    ['WORDPAD.EXE', 'wordpad'],
    ['Oh-Oh! Messenger', 'messenger'],
    ['Corbeille', 'trash'],
    ['DOOM.EXE', 'doom'],
  ];

  for (const [label, id] of APPS) {
    test(`ouvrir « ${label} » ne duplique ni les icônes, ni les couches, ni le bureau`, async ({ page }) => {
      await page.goto('/');
      await openApp(page, label);
      await expect(page.locator(`.bwin[data-app="${id}"]`)).toBeVisible();
      await page.waitForTimeout(400);
      const counts = await page.evaluate(() => ({
        icons: document.querySelectorAll('#bureau-desktop .bicon').length,
        desktops: document.querySelectorAll('#bureau-desktop').length,
        layers: document.querySelectorAll('#bureau-windows').length,
        taskbarTabs: document.querySelectorAll('.bwin-tabs').length,
      }));
      expect(counts).toEqual({ icons: 11, desktops: 1, layers: 1, taskbarTabs: 1 });
    });
  }

  test('le fichier du bureau n’est téléchargé qu’une fois (pas de second chargement sous une autre adresse)', async ({ page }) => {
    const entries: string[] = [];
    page.on('request', (request) => {
      if (/\/assets\/dist\/bureau\.js/.test(request.url())) entries.push(request.url());
    });
    await page.goto('/');
    await openApp(page, 'Terminal');
    await expect(page.locator('.bwin[data-app="terminal"]')).toBeVisible();
    expect(entries).toHaveLength(1);
  });
});

test.describe('agrandir et restaurer une fenêtre', () => {
  test.beforeEach(async ({}, info) => test.skip(!isDesktop(info.project.name)));

  test('le bouton d’agrandissement devient « Restaurer » (double carré), puis redevient « Agrandir »', async ({ page }) => {
    await page.goto('/');
    await openApp(page, 'Terminal');
    const win = page.locator('.bwin[data-app="terminal"]');
    const before = await win.boundingBox();
    const button = win.locator('.bwin-controls [data-action="maximize"]');
    await expect(button).toHaveAttribute('aria-label', 'Agrandir');
    await expect(button.locator('svg rect')).toHaveCount(1); // un seul carré

    await button.click();
    await expect(win).toHaveClass(/bwin--maximized/);
    await expect(button).toHaveAttribute('aria-label', 'Restaurer');
    await expect(button.locator('svg rect')).toHaveCount(2); // double carré : on peut rétrécir
    expect((await win.boundingBox())!.width).toBeGreaterThan(before!.width);

    await button.click();
    await expect(win).not.toHaveClass(/bwin--maximized/);
    await expect(button).toHaveAttribute('aria-label', 'Agrandir');
    await expect(button.locator('svg rect')).toHaveCount(1);
    const after = await win.boundingBox();
    expect(Math.round(after!.width)).toBe(Math.round(before!.width));
    // Ce n'est pas une réduction : la fenêtre reste ouverte et visible.
    await expect(win).toBeVisible();
  });

  test('le bouton Restaurer est traduit en anglais', async ({ browser }) => {
    const context = await browser.newContext({ locale: 'en-US', viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto('/');
    await page.locator('#bureau-desktop .bicon', { hasText: 'Terminal' }).dblclick();
    const button = page.locator('.bwin[data-app="terminal"] [data-action="maximize"]');
    await expect(button).toHaveAttribute('aria-label', 'Maximize');
    await button.click();
    await expect(button).toHaveAttribute('aria-label', 'Restore');
    await context.close();
  });
});
