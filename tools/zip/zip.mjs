import archiver from 'archiver';
import { createWriteStream, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { listThemeFiles } from './files.mjs';

const THEMES_DIR = 'themes';
const OUT_DIR = 'dist';

const requested = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const available = readdirSync(THEMES_DIR).filter((name) => existsSync(join(THEMES_DIR, name, 'style.css')));
const themes = requested.length > 0 ? requested : available;

for (const theme of themes) {
  if (!available.includes(theme)) {
    console.error(`Thème introuvable : ${theme} (disponibles : ${available.join(', ')})`);
    process.exit(1);
  }
}

mkdirSync(OUT_DIR, { recursive: true });

for (const theme of themes) {
  const themeDir = join(THEMES_DIR, theme);
  const target = join(OUT_DIR, `${theme}.zip`);
  const archive = archiver('zip', { zlib: { level: 9 } });
  const done = new Promise((resolve, reject) => {
    const output = createWriteStream(target);
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
  });
  for (const file of listThemeFiles(themeDir)) {
    archive.file(join(themeDir, file), { name: `${theme}/${file}` });
  }
  await archive.finalize();
  await done;
  console.log(`${target} : ${archive.pointer()} octets`);
}
