import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const require = createRequire(import.meta.url);
const envPackage = require.resolve('@wordpress/env/package.json');
const envRequire = createRequire(envPackage);

test('wp-env utilise la fabrique simple-git 4 et clone un dépôt local', async () => {
  for (const path of ['lib/download-sources.js', 'lib/runtime/docker/download-wp-phpunit.js']) {
    assert.match(readFileSync(join(dirname(envPackage), path), 'utf8'), /const \{ simpleGit: SimpleGit \} = require\( 'simple-git' \)/);
  }
  const { simpleGit } = envRequire('simple-git');
  const dir = mkdtempSync(join(tmpdir(), 'jchable-git-compat-'));
  try {
    const source = join(dir, 'source.git');
    mkdirSync(source);
    await simpleGit(source).init(true, { '--initial-branch': 'main' });
    await simpleGit().clone(source, join(dir, 'clone'));
    assert.match(readFileSync(join(dir, 'clone', '.git', 'HEAD'), 'utf8'), /refs\/heads\/main/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('js-yaml garde safeLoad/dump et sa CLI fonctionne avec argparse 2', () => {
  const yaml = envRequire('js-yaml');
  const object = { services: { wordpress: { ports: ['8898:80'] } } };
  assert.deepEqual(yaml.safeLoad(yaml.dump(object)), object);
  const yamlRoot = dirname(envRequire.resolve('js-yaml/package.json'));
  const output = execFileSync(process.execPath, [join(yamlRoot, 'bin/js-yaml.js')], {
    input: 'site: local\n',
    encoding: 'utf8',
  });
  assert.deepEqual(JSON.parse(output), { site: 'local' });
});
