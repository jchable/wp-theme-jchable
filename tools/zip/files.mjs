import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const EXCLUDED_DIRS = new Set(['node_modules', 'src', '.git']);
const EXCLUDED_FILES = [/\.map$/, /^\.DS_Store$/, /^Thumbs\.db$/];

/**
 * Fichiers à mettre dans le zip d'un thème.
 * @param {string} themeDir
 * @returns {string[]} chemins relatifs, séparés par « / », triés
 */
export function listThemeFiles(themeDir) {
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        if (!EXCLUDED_DIRS.has(name)) walk(full);
        continue;
      }
      if (EXCLUDED_FILES.some((re) => re.test(name))) continue;
      files.push(relative(themeDir, full).split(sep).join('/'));
    }
  };
  walk(themeDir);
  return files.sort();
}
