import { execFileSync } from 'node:child_process';

// Active le thème à tester (variable THEME, « jchable » par défaut) avant de lancer la suite.
export default async function globalSetup(): Promise<void> {
  const theme = process.env.THEME ?? 'jchable';
  execFileSync('npx', ['wp-env', 'run', 'cli', 'wp', 'theme', 'activate', theme], {
    stdio: 'pipe',
    shell: true,
  });
}
