// Réglages communs aux suites Playwright (parent et thèmes enfants).
export const baseUse = {
  baseURL: process.env.WP_BASE_URL ?? 'http://localhost:8888',
  trace: 'retain-on-failure' as const,
  // Les tests vérifient les textes français ; l'anglais est testé explicitement (i18n.spec.ts).
  locale: 'fr-FR',
};

export const viewportProjects = [
  { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
  { name: 'tablet', use: { viewport: { width: 768, height: 1024 } } },
  { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
];
