import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listThemeFiles } from './files.mjs';

function makeTheme(files) {
  const dir = mkdtempSync(join(tmpdir(), 'jchable-zip-'));
  for (const file of files) {
    const full = join(dir, ...file.split('/'));
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, 'x');
  }
  return dir;
}

test('liste les fichiers du thème, triés, avec des séparateurs /', () => {
  const dir = makeTheme(['style.css', 'templates/home.html', 'blocks/post-filename/block.json']);
  try {
    assert.deepEqual(listThemeFiles(dir), [
      'blocks/post-filename/block.json',
      'style.css',
      'templates/home.html',
    ]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('exclut les sources, les dépendances et les fichiers parasites', () => {
  const dir = makeTheme([
    'style.css',
    'node_modules/pkg/index.js',
    'src/main.ts',
    '.git/HEAD',
    'assets/dist/app.js',
    'assets/dist/app.js.map',
    '.DS_Store',
    'assets/Thumbs.db',
  ]);
  try {
    assert.deepEqual(listThemeFiles(dir), ['assets/dist/app.js', 'style.css']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('exclut les dossiers demandés (option sans DOOM)', () => {
  const dir = makeTheme(['style.css', 'assets/doom/doom1.wad', 'assets/doom/README.md', 'assets/css/a.css']);
  try {
    assert.deepEqual(listThemeFiles(dir, { exclude: ['assets/doom/'] }), ['assets/css/a.css', 'style.css']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('sans option, tout est inclus', () => {
  const dir = makeTheme(['assets/doom/doom1.wad', 'style.css']);
  try {
    assert.deepEqual(listThemeFiles(dir), ['assets/doom/doom1.wad', 'style.css']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('refuse les secrets et les sauvegardes au lieu de les publier', () => {
  for (const name of ['.env', '.env.production', 'private.key', 'backup.sql', 'functions.php.bak', 'wp-config.php']) {
    const dir = makeTheme(['style.css', name]);
    try {
      assert.throws(() => listThemeFiles(dir), /Fichier privé interdit/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

test('ne suit pas les liens de dossier extérieurs au thème', () => {
  const outside = makeTheme(['private.txt']);
  const dir = makeTheme(['style.css']);
  try {
    symlinkSync(outside, join(dir, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
    assert.throws(() => listThemeFiles(dir), /Lien symbolique interdit/);
  } finally {
    rmSync(join(dir, 'linked'), { recursive: true, force: true });
    rmSync(dir, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});
