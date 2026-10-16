import { defineConfig } from '@playwright/test';
import { baseUse, viewportProjects } from './playwright.base';

process.env.THEME = 'jchable-bureau';

export default defineConfig({
  testDir: './tests/e2e-bureau',
  outputDir: 'test-results/bureau',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: true,
  retries: 0,
  reporter: 'list',
  use: baseUse,
  projects: viewportProjects,
});
