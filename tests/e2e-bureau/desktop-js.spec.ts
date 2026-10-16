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
    await expect(page.locator('.desktop-icons')).toHaveCSS('visibility', 'hidden');
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

  test('on déplace une icône ; sa place est mémorisée et « Réorganiser » la remet', async ({ page }) => {
    await page.goto('/');
    const icon = page.locator('#bureau-desktop .bicon', { hasText: 'Terminal' });
    const start = await icon.boundingBox();
    await page.mouse.move(start!.x + 40, start!.y + 30);
    await page.mouse.down();
    await page.mouse.move(start!.x + 40 + 300, start!.y + 30 + 100, { steps: 8 });
    await page.mouse.up();
    const moved = await icon.boundingBox();
    expect(moved!.x - start!.x).toBeGreaterThan(250);
    await page.reload();
    const reloaded = await page.locator('#bureau-desktop .bicon', { hasText: 'Terminal' }).boundingBox();
    expect(Math.abs(reloaded!.x - moved!.x)).toBeLessThan(2);
    expect(Math.abs(reloaded!.y - moved!.y)).toBeLessThan(2);

    await page.mouse.click(30, 820, { button: 'right' });
    await page.getByRole('menuitem', { name: 'Réorganiser les icônes' }).click();
    const reset = await page.locator('#bureau-desktop .bicon', { hasText: 'Terminal' }).boundingBox();
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
      if (/\/assets\/dist\/chunks\//.test(request.url())) chunks.push(request.url());
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
    const icon = page.locator('#bureau-desktop .bicon', { hasText: 'Terminal' });
    const start = await icon.boundingBox();
    await page.mouse.move(start!.x + 40, start!.y + 30);
    await page.mouse.down();
    await page.mouse.move(start!.x + 40 + 400, start!.y + 30 + 40, { steps: 2 });
    await page.mouse.up();
    const moved = await icon.boundingBox();
    expect(moved!.x - start!.x).toBeGreaterThan(300);
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
