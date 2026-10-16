import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
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
