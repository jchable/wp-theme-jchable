import { defineConfig } from '@playwright/test';
import { baseUse, viewportProjects } from './playwright.base';

process.env.THEME = 'jchable-arcade';

export default defineConfig({
  testDir: './tests/e2e-arcade',
  outputDir: 'test-results/arcade',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: true,
  retries: 0,
  reporter: 'list',
  use: baseUse,
  projects: viewportProjects,
});
