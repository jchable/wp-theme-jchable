import type { MessageKey } from './i18n';

export interface PaletteColor {
  hex: string;
  /** Clé du nom de la couleur dans `i18n.ts`. */
  nameKey: MessageKey;
}

const color = (hex: string): PaletteColor => ({ hex: `#${hex}`, nameKey: `color_${hex}` as MessageKey });

/** Les 28 couleurs de Windows 95, en deux rangées de 14 (la première commence par le noir, la seconde par le blanc). */
export const PALETTE: readonly PaletteColor[] = [
  ...['000000', '808080', '800000', '808000', '008000', '008080', '000080', '800080', '808040', '004040', '0080ff', '004080', '4000ff', '804000'],
  ...['ffffff', 'c0c0c0', 'ff0000', 'ffff00', '00ff00', '00ffff', '0000ff', 'ff00ff', 'ffff80', '00ff80', '80ffff', '8080ff', 'ff0080', 'ff8040'],
].map(color);

export const PALETTE_COLUMNS = 14;
export const DEFAULT_FOREGROUND = '#000000';
export const DEFAULT_BACKGROUND = '#ffffff';

export function colorName(hex: string): MessageKey | null {
  return PALETTE.find((c) => c.hex === hex)?.nameKey ?? null;
}
