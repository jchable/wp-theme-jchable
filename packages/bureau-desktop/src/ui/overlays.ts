import { t } from '../core/ui-i18n';

/** Écrans plein écran : écran bleu et écran d'arrêt. */

/** Écran bleu. N'importe quelle touche ou un clic le referme et rend le focus. */
export function showBsod(message: string = t('bsod.default')): void {
  const previous = document.activeElement;
  const overlay = document.createElement('div');
  overlay.className = 'bbsod';
  overlay.setAttribute('role', 'alertdialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', t('bsod.aria'));
  overlay.tabIndex = -1;

  const title = document.createElement('p');
  title.className = 'bbsod-title';
  title.textContent = t('bsod.title');
  const text = document.createElement('p');
  text.textContent = message;
  const hint = document.createElement('p');
  hint.textContent = t('bsod.hint');
  overlay.append(title, text, hint);

  const close = (): void => {
    overlay.remove();
    document.removeEventListener('keydown', onKey, true);
    if (previous instanceof HTMLElement) previous.focus({ preventScroll: true });
  };
  const onKey = (event: KeyboardEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    close();
  };
  overlay.addEventListener('click', close);
  document.addEventListener('keydown', onKey, true);
  document.body.append(overlay);
  overlay.focus();
}

/** « Vous pouvez maintenant éteindre votre ordinateur » : un clic ou une touche recharge la page. */
export function showShutdown(reload: () => void = () => location.reload()): void {
  const overlay = document.createElement('div');
  overlay.className = 'bshutdown';
  overlay.setAttribute('role', 'alertdialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', t('shutdown.aria'));
  overlay.tabIndex = -1;
  const text = document.createElement('p');
  text.textContent = t('shutdown.text');
  const hint = document.createElement('p');
  hint.className = 'bshutdown-hint';
  hint.textContent = t('shutdown.hint');
  overlay.append(text, hint);
  const restart = (): void => reload();
  overlay.addEventListener('click', restart);
  overlay.addEventListener('keydown', restart);
  document.body.append(overlay);
  overlay.focus();
}
