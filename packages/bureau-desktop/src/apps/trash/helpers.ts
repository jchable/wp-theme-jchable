import { getLang } from '../../core/i18n';
import { t } from './i18n';
import type { TrashItem } from './items';

const NBSP = ' ';

/** Somme des tailles (en Ko). */
export function totalSize(items: readonly Pick<TrashItem, 'sizeKo'>[]): number {
  return items.reduce((sum, item) => sum + item.sizeKo, 0);
}

/** Séparateur de milliers : espace insécable en français, virgule en anglais. */
function groupThousands(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, getLang() === 'fr' ? NBSP : ',');
}

/** « 14 Ko », « 1 234 Ko » ; à partir de 10 000 Ko : « 12,3 Mo » (en anglais : « 14 KB », « 1,234 KB », « 12.3 MB »). */
export function formatSize(ko: number): string {
  const value = Math.max(0, Math.round(ko));
  if (value >= 10_000) {
    const fixed = (value / 1024).toFixed(1);
    const mo = getLang() === 'fr' ? fixed.replace('.', ',') : fixed;
    return `${mo}${NBSP}${t('unitMo')}`;
  }
  return `${groupThousands(value)}${NBSP}${t('unitKo')}`;
}

/** « 2025-03-14 » devient « 14/03/2025 » (sans passer par Date : pas de décalage de fuseau). */
export function formatDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return iso;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

/** « 0 objet », « 1 objet », « 8 objets » (en anglais : « 0 items », « 1 item »). */
export function formatCount(n: number): string {
  const plural = getLang() === 'fr' ? n > 1 : n !== 1;
  return t(plural ? 'countMany' : 'countOne', { n });
}

/** Nouvel index de sélection après une touche de navigation ; -1 si la liste est vide. */
export function moveSelection(index: number, key: string, length: number): number {
  if (length <= 0) return -1;
  const last = length - 1;
  const current = Math.min(Math.max(index, 0), last);
  switch (key) {
    case 'ArrowDown':
      return index < 0 ? 0 : Math.min(current + 1, last);
    case 'ArrowUp':
      return index < 0 ? 0 : Math.max(current - 1, 0);
    case 'Home':
      return 0;
    case 'End':
      return last;
    default:
      return index < 0 ? -1 : current;
  }
}
