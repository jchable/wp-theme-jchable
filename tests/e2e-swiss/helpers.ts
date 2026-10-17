import type { Page } from '@playwright/test';

/**
 * Numéros 01, 02… effectivement affichés par le compteur CSS « swiss-post ».
 * Le navigateur ne résout pas les compteurs dans getComputedStyle : on rejoue donc la règle CSS à partir des valeurs
 * calculées (counter-reset de la liste, counter-increment et content du ::before de chaque carte).
 */
export async function feedNumbers(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const list = document.querySelector('.swiss-feed .wp-block-post-template');
    if (!list) return [];
    const reset = getComputedStyle(list).counterReset.match(/swiss-post (-?\d+)/);
    let n = reset ? Number(reset[1]) : 0;
    return [...list.querySelectorAll('.swiss-card')].map((card) => {
      const style = getComputedStyle(card, '::before');
      const inc = style.counterIncrement.match(/swiss-post (-?\d+)/);
      if (!inc || !style.content.startsWith('counter(swiss-post, decimal-leading-zero)')) return '?';
      n += Number(inc[1]);
      return String(n).padStart(2, '0');
    });
  });
}
