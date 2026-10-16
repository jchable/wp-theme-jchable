import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const patch = fileURLToPath(new URL('../../patches/@wordpress+env+11.17.0.patch', import.meta.url));

function git(args) {
  const result = spawnSync('git', ['apply', ...args, patch], { cwd: root, encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.signal) throw new Error(`git apply interrompu : ${result.signal}`);
  return result;
}

// wp-env 11.17 uses the removed CommonJS default export of simple-git 3.
if (git(['--reverse', '--check']).status === 0) {
  console.log('Correctif de compatibilité wp-env déjà appliqué.');
} else {
  const check = git(['--check']);
  if (check.status !== 0) throw new Error(`Correctif wp-env incompatible : ${check.stderr}`);
  const applied = git([]);
  if (applied.status !== 0) throw new Error(`Échec du correctif wp-env : ${applied.stderr}`);
  console.log('Correctif de compatibilité wp-env / simple-git 4 appliqué.');
}
