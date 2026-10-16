export interface MenuItem {
  label: string;
  action: () => void;
}

/** Petit menu contextuel (clic droit) : navigation aux flèches, Échap ou clic ailleurs pour fermer. */
export function showContextMenu(x: number, y: number, items: readonly MenuItem[]): void {
  document.querySelector('.bctx')?.remove();
  const previous = document.activeElement;
  const menu = document.createElement('div');
  menu.className = 'bctx';
  menu.setAttribute('role', 'menu');

  const buttons = items.map((item) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('role', 'menuitem');
    button.textContent = item.label;
    button.addEventListener('click', () => {
      close(false);
      item.action();
    });
    menu.append(button);
    return button;
  });

  const close = (restoreFocus: boolean): void => {
    menu.remove();
    document.removeEventListener('pointerdown', onOutside, true);
    document.removeEventListener('keydown', onKey, true);
    if (restoreFocus && previous instanceof HTMLElement) previous.focus({ preventScroll: true });
  };
  const onOutside = (event: Event): void => {
    if (!menu.contains(event.target as Node)) close(false);
  };
  const onKey = (event: KeyboardEvent): void => {
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      buttons[(index + step + buttons.length) % buttons.length]?.focus();
    } else if (event.key === 'Tab') {
      close(false);
    }
  };

  document.body.append(menu);
  const width = menu.offsetWidth;
  const height = menu.offsetHeight;
  menu.style.left = `${Math.max(0, Math.min(x, window.innerWidth - width - 4))}px`;
  menu.style.top = `${Math.max(0, Math.min(y, window.innerHeight - height - 4))}px`;
  document.addEventListener('pointerdown', onOutside, true);
  document.addEventListener('keydown', onKey, true);
  buttons[0]?.focus();
}
