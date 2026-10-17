// Exécute une commande en tenant un verrou sur le WordPress local : deux suites Playwright (qui activent chacune
// leur thème) ne doivent jamais tourner en même temps. Usage : node tools/env/locked.mjs <commande> [arguments…]
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const LOCK = join(tmpdir(), 'jchable-wpenv.lock');
const STALE_MS = 20 * 60 * 1000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function acquire() {
  for (;;) {
    try {
      mkdirSync(LOCK);
      return;
    } catch {
      try {
        if (Date.now() - statSync(LOCK).mtimeMs > STALE_MS) rmSync(LOCK, { recursive: true, force: true });
      } catch {
        /* le verrou vient d'être libéré */
      }
      await sleep(3000);
    }
  }
}

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error('Usage : node tools/env/locked.mjs <commande> [arguments…]');
  process.exit(2);
}
await acquire();
const release = () => rmSync(LOCK, { recursive: true, force: true });
process.on('SIGINT', () => {
  release();
  process.exit(130);
});
const child = spawn(command, args, { stdio: 'inherit', shell: true });
child.on('exit', (code) => {
  release();
  process.exit(code ?? 1);
});
