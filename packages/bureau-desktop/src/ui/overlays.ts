/** Écrans plein écran : écran bleu et écran d'arrêt. */

const DEFAULT_BSOD = 'Une erreur fatale est survenue. Le blog va tenter de continuer.';

/** Écran bleu. N'importe quelle touche ou un clic le referme et rend le focus. */
export function showBsod(message: string = DEFAULT_BSOD): void {
  const previous = document.activeElement;
  const overlay = document.createElement('div');
  overlay.className = 'bbsod';
  overlay.setAttribute('role', 'alertdialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Écran bleu');
  overlay.tabIndex = -1;

  const title = document.createElement('p');
  title.className = 'bbsod-title';
  title.textContent = 'jchable Bureau';
  const text = document.createElement('p');
  text.textContent = message;
  const hint = document.createElement('p');
  hint.textContent = 'Appuyez sur une touche pour continuer _';
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
  overlay.setAttribute('aria-label', 'Arrêt du système');
  overlay.tabIndex = -1;
  const text = document.createElement('p');
  text.textContent = 'Vous pouvez maintenant éteindre votre ordinateur.';
  const hint = document.createElement('p');
  hint.className = 'bshutdown-hint';
  hint.textContent = 'Cliquez ou appuyez sur une touche pour redémarrer.';
  overlay.append(text, hint);
  const restart = (): void => reload();
  overlay.addEventListener('click', restart);
  overlay.addEventListener('keydown', restart);
  document.body.append(overlay);
  overlay.focus();
}
