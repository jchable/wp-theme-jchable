/**
 * Enregistre une démo du thème Bureau (vidéo MP4 1080p pour LinkedIn) avec Playwright et ffmpeg.
 *
 * Prérequis : WordPress local démarré (`npm run env:start`, `npm run env:seed`), thème jchable-bureau actif, ffmpeg dans le PATH.
 * Usage : `npm run demo:video` ; sortie dans dist/demo/bureau-demo.mp4 (WP_BASE_URL change l'adresse du site).
 * Le curseur et les légendes sont injectés dans la page : Playwright ne filme pas le pointeur.
 */
const { chromium } = require('playwright-core');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const BASE = (process.env.WP_BASE_URL ?? 'http://localhost:8888').replace(/\/$/, '');
const DIST = path.join(__dirname, '..', '..', 'dist', 'demo');
const OUT = path.join(DIST, 'raw');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.rmSync(path.join(DIST, 'bureau-demo.mp4'), { force: true });

const W = 1440, H = 810;

// Curseur visible + légendes, réinjectés à chaque page.
const INIT = () => {
  const mk = () => {
    if (document.getElementById('fx-cursor')) return;
    const st = document.createElement('style');
    st.textContent = `
      #fx-cursor{position:fixed;left:0;top:0;width:26px;height:26px;z-index:2147483647;pointer-events:none;transform:translate(-100px,-100px);filter:drop-shadow(2px 2px 0 rgba(0,0,0,.35))}
      .fx-ring{position:fixed;z-index:2147483646;pointer-events:none;width:14px;height:14px;margin:-7px 0 0 -7px;border:3px solid #ffe14d;border-radius:50%;animation:fxring .5s ease-out forwards}
      @keyframes fxring{to{transform:scale(3.2);opacity:0}}
      #fx-cap{position:fixed;left:50%;top:22px;transform:translate(-50%,-14px);z-index:2147483645;pointer-events:none;opacity:0;transition:opacity .25s,transform .25s;
        background:#ffe14d;color:#111;border:3px solid #111;box-shadow:6px 6px 0 #111;padding:12px 22px;font:700 26px/1.2 'Chivo Mono','Courier New',monospace;white-space:nowrap}
      #fx-cap.on{opacity:1;transform:translate(-50%,0)}
      #fx-cap.big{font-size:34px;padding:16px 30px;background:#fff}`;
    document.head.appendChild(st);
    const c = document.createElement('div');
    c.id = 'fx-cursor';
    c.innerHTML = '<svg width="26" height="26" viewBox="0 0 26 26"><path d="M3 2 L3 21 L8 16.5 L11.5 24 L15 22.4 L11.6 15 L18.5 15 Z" fill="#fff" stroke="#111" stroke-width="2" stroke-linejoin="round"/></svg>';
    document.body.appendChild(c);
    const cap = document.createElement('div');
    cap.id = 'fx-cap';
    document.body.appendChild(cap);
    const move = (e) => { c.style.transform = `translate(${e.clientX}px,${e.clientY}px)`; };
    document.addEventListener('mousemove', move, true);
    document.addEventListener('pointermove', move, true);
    document.addEventListener('mousedown', (e) => {
      const r = document.createElement('div');
      r.className = 'fx-ring'; r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px';
      document.body.appendChild(r); setTimeout(() => r.remove(), 600);
    }, true);
    window.__cap = (text, big) => {
      const el = document.getElementById('fx-cap');
      if (!text) { el.classList.remove('on'); return; }
      el.textContent = text; el.classList.toggle('big', !!big); el.classList.add('on');
    };
  };
  if (document.body) mk(); else document.addEventListener('DOMContentLoaded', mk);
};

(async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const tCtx = Date.now();
  const ctx = await browser.newContext({
    viewport: { width: W, height: H }, locale: 'fr-FR',
    recordVideo: { dir: OUT, size: { width: W, height: H } },
  });
  await ctx.addInitScript(INIT);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('PAGEERR', e.message));
  const wait = (ms) => p.waitForTimeout(ms);
  const cap = (t, big) => p.evaluate(([t, big]) => window.__cap && window.__cap(t, big), [t, big]);

  let cx = 720, cy = 420;
  const glide = async (x, y, dur = 650) => {
    const steps = Math.max(10, Math.round(dur / 16));
    const x0 = cx, y0 = cy;
    for (let i = 1; i <= steps; i++) {
      const k = i / steps, e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      await p.mouse.move(x0 + (x - x0) * e, y0 + (y - y0) * e);
      await wait(dur / steps);
    }
    cx = x; cy = y;
  };
  const center = async (loc) => { const b = await loc.boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
  const clickAt = async (x, y, opts = {}) => { await glide(x, y, opts.dur ?? 650); await wait(120); await p.mouse.click(x, y, opts.button ? { button: opts.button } : {}); };
  const click = async (loc, opts) => { const [x, y] = await center(loc); await clickAt(x, y, opts); };
  const dbl = async (loc) => { const [x, y] = await center(loc); await glide(x, y); await wait(150); await p.mouse.dblclick(x, y); };
  const icon = (t) => p.locator('#bureau-desktop .bicon', { hasText: t });

  // ---- 1. Le bureau ----
  await p.goto(BASE + '/');
  await p.waitForSelector('#bureau-desktop .bicon');
  await wait(900);
  const tStart = (Date.now() - tCtx) / 1000;
  await p.mouse.move(cx, cy);
  await cap('Mon blog est un bureau d’ordinateur.');
  await wait(2200);

  // ---- 2. Terminal ----
  await cap('Un vrai Terminal…');
  await dbl(icon('Terminal'));
  const term = p.locator('.bwin[data-app="terminal"]');
  await term.waitFor();
  // on déplace la fenêtre pour montrer qu’elle est libre
  const bar = await term.locator('.bwin-titlebar').boundingBox();
  await glide(bar.x + 120, bar.y + 12, 500);
  await p.mouse.down();
  await glide(bar.x + 330, bar.y + 70, 600);
  await p.mouse.up();
  await wait(250);
  const inp = term.locator('input');
  await inp.focus();
  await inp.pressSequentially('ls', { delay: 110 }); await p.keyboard.press('Enter');
  await wait(1700);
  await cap('… qui lance DOOM.');
  await inp.pressSequentially('doom', { delay: 110 }); await p.keyboard.press('Enter');

  // ---- 3. DOOM ----
  const hint = p.locator('.bapp-doom-hint');
  await hint.waitFor({ timeout: 60000 });
  await cap('Le vrai DOOM, en WebAssembly. Dans une page WordPress.', false);
  await wait(2500);
  await cap('');
  await clickAt(...(await center(hint)), { dur: 700 });
  await wait(300);
  for (let i = 0; i < 4; i++) { await p.keyboard.press('Enter'); await wait(i === 0 ? 1300 : 800); }
  await cap('Et oui, on peut jouer.');
  await wait(1500);
  await p.keyboard.down('ArrowUp');
  await wait(900);
  await p.keyboard.down('Control'); await wait(350); await p.keyboard.up('Control'); await wait(250);
  await p.keyboard.down('Control'); await wait(350); await p.keyboard.up('Control');
  await wait(250);
  await p.keyboard.up('ArrowUp');
  await p.keyboard.down('Control'); await wait(350); await p.keyboard.up('Control');
  await wait(250);
  await p.keyboard.down('Control'); await wait(350); await p.keyboard.up('Control');
  await wait(600);
  await cap('');

  // fermer DOOM
  await click(p.locator('.bwin[data-app="doom"] .bapp-doom-btn', { hasText: 'Fermer' }), { dur: 700 });
  await wait(500);
  // fermer le terminal
  await click(term.getByRole('button', { name: 'Fermer' }), { dur: 500 });
  await wait(300);

  // ---- 4. Démineur ----
  await cap('Un Démineur (avec drapeaux).');
  await dbl(icon('Démineur'));
  const cells = p.locator('.bwin[data-app="minesweeper"] .bapp-minesweeper-cell');
  await cells.first().waitFor();
  await wait(400);
  await click(cells.nth(40), { dur: 700 });
  await wait(900);
  await click(cells.nth(13), { dur: 500, button: 'right' });
  await wait(700);
  await cap('');
  await click(p.locator('.bwin[data-app="minesweeper"]').getByRole('button', { name: 'Fermer' }), { dur: 600 });
  await wait(300);

  // ---- 5. Écrans de veille ----
  await cap('Des écrans de veille 3D, codés à la main.');
  await click(p.locator('.start-button'), { dur: 700 });
  await wait(1000);
  await click(p.locator('.bmenu').getByRole('menuitem', { name: 'Préférences…' }), { dur: 500 });
  const win = p.locator('.bwin[data-app="settings"]');
  await win.locator('.bset-preview').waitFor({timeout:8000});
  await wait(500);
  await click(win.locator('.bset-preview'), { dur: 700 });
  await p.locator('.bscr-overlay').waitFor();
  await wait(2700);
  await p.mouse.move(cx + 40, cy + 30); await p.mouse.move(cx + 90, cy + 60); cx += 90; cy += 60;
  await wait(500);
  // 2e scène : bureau en voxels
  await click(win.locator('input[value="voxel"]'), { dur: 600 });
  await click(win.locator('.bset-preview'), { dur: 500 });
  await p.locator('.bscr-overlay').waitFor();
  await wait(2700);
  await p.mouse.move(cx + 40, cy + 30); await p.mouse.move(cx + 90, cy + 60); cx += 90; cy += 60;
  await wait(600);
  await cap('');

  // ---- 6. La 404 ----
  await p.goto(BASE + '/cette-page-nexiste-pas/');
  await wait(500);
  await cap('Et la 404 ? Un écran bleu. Évidemment.');
  await wait(2400);
  await cap('Nouveau thème WordPress « Bureau » · julien.chable.net', true);
  await wait(3200);
  await cap('');
  await wait(400);

  const tEnd = (Date.now() - tCtx) / 1000;
  await p.close();
  await ctx.close();
  await browser.close();
  const files = fs.readdirSync(OUT).filter((f) => f.endsWith('.webm'));
  // On retire le chargement initial, puis on encode en H.264 1080p pour LinkedIn.
  const out = path.join(DIST, 'bureau-demo.mp4');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', (tStart - 0.1).toFixed(2), '-i', path.join(OUT, files[0]),
    '-vf', 'scale=1920:1080:flags=lanczos,fps=30,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '17',
    '-movflags', '+faststart', '-an', out], { stdio: 'inherit' });
  fs.rmSync(OUT, { recursive: true, force: true });
  console.log('OK', out, { duree: (tEnd - tStart).toFixed(1) + ' s' });
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
