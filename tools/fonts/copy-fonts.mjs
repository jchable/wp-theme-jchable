import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Copie les polices Chivo et Chivo Mono (SIL OFL 1.1) de @fontsource vers le thème Bureau.
const OUT = 'themes/jchable-bureau/assets/fonts';
const FAMILIES = [
  { pkg: 'chivo', weights: [400, 700, 900] },
  { pkg: 'chivo-mono', weights: [400, 700] },
];
const SUBSETS = ['latin', 'latin-ext'];

mkdirSync(OUT, { recursive: true });
const licences = [];
for (const { pkg, weights } of FAMILIES) {
  for (const subset of SUBSETS) {
    for (const weight of weights) {
      const name = `${pkg}-${subset}-${weight}-normal.woff2`;
      copyFileSync(join('node_modules', '@fontsource', pkg, 'files', name), join(OUT, name));
    }
  }
  licences.push(readFileSync(join('node_modules', '@fontsource', pkg, 'LICENSE'), 'utf8').trim());
}
writeFileSync(join(OUT, 'LICENSE-OFL.txt'), licences.join('\n\n----------------------------------------\n\n') + '\n');
console.log(`Polices copiées dans ${OUT}`);
