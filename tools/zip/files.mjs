import { readdirSync, lstatSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const EXCLUDED_DIRS = new Set(['node_modules', 'src']);
const EXCLUDED_FILES = [/\.map$/, /^Thumbs\.db$/];
const PRIVATE_FILES = /(?:^\.env(?:\.|$)|\.(?:pem|key|p12|pfx|sql|bak|old|orig|swp)$|~$|^wp-config\.php$)/i;

/**
 * Fichiers à mettre dans le zip d'un thème.
 * @param {string} themeDir
 * @param {{ exclude?: string[] }} [options] préfixes de chemins relatifs à exclure (ex. « assets/doom/ »)
 * @returns {string[]} chemins relatifs, séparés par « / », triés
 */
export function listThemeFiles(themeDir, { exclude = [] } = {}) {
  if (lstatSync(themeDir).isSymbolicLink()) throw new Error(`Lien symbolique interdit : ${themeDir}`);
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const rel = relative(themeDir, full).split(sep).join('/');
      const stat = lstatSync(full);
      if (stat.isSymbolicLink()) throw new Error(`Lien symbolique interdit : ${full}`);
      if (PRIVATE_FILES.test(name)) throw new Error(`Fichier privé interdit dans le thème : ${full}`);
      if (name.startsWith('.')) continue;
      if (exclude.some((prefix) => rel.startsWith(prefix))) continue;
      if (stat.isDirectory()) {
        if (!EXCLUDED_DIRS.has(name)) walk(full);
        continue;
      }
      if (!stat.isFile()) throw new Error(`Fichier non régulier interdit : ${full}`);
      if (EXCLUDED_FILES.some((re) => re.test(name))) continue;
      files.push(rel);
    }
  };
  walk(themeDir);
  return files.sort();
}
