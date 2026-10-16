import { afterEach, describe, expect, it } from 'vitest';
import { missingKeys, setLang } from '../../core/i18n';
import { messages } from './i18n';
import { createScreensaver } from './overlay';

describe('screensaver i18n', () => {
  afterEach(() => document.querySelectorAll('.bscr-overlay').forEach((n) => n.remove()));

  it('a les mêmes clés en français et en anglais', () => {
    expect(missingKeys(messages)).toEqual([]);
  });

  it('annonce le texte en anglais', () => {
    setLang('en');
    const saver = createScreensaver({
      reducedMotion: () => true,
      requestFrame: () => 1,
      cancelFrame: () => undefined,
    });
    saver.start();
    expect(document.querySelector('.bscr-sr')?.textContent).toBe('Screensaver. Move the mouse or press a key to return.');
    saver.destroy();
  });
});
