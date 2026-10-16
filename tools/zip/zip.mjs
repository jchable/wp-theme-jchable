import archiver from 'archiver';
import { createWriteStream, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { listThemeFiles } from './files.mjs';

const THEMES_DIR = 'themes';
const OUT_DIR = 'dist';

const requested = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
// --no-doom : zip léger sans le moteur ni les données de DOOM (6 Mo), à copier ensuite par SFTP.
const noDoom = process.argv.includes('--no-doom');
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
  const lightweight = noDoom && existsSync(join(themeDir, 'assets', 'doom'));
  const target = join(OUT_DIR, lightweight ? `${theme}-sans-doom.zip` : `${theme}.zip`);
  const archive = archiver('zip', { zlib: { level: 9 } });
  const done = new Promise((resolve, reject) => {
    const output = createWriteStream(target);
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
  });
  for (const file of listThemeFiles(themeDir, { exclude: lightweight ? ['assets/doom/'] : [] })) {
    archive.file(join(themeDir, file), { name: `${theme}/${file}` });
  }
  await archive.finalize();
  await done;
  console.log(`${target} : ${archive.pointer()} octets`);
}
