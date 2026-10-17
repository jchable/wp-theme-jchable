import { defineConfig } from '@playwright/test';
import { baseUse, viewportProjects } from './playwright.base';

process.env.THEME = 'jchable-swiss';

export default defineConfig({
  testDir: './tests/e2e-swiss',
  outputDir: 'test-results/swiss',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: true,
  retries: 0,
  reporter: 'list',
  use: baseUse,
  projects: viewportProjects,
});
