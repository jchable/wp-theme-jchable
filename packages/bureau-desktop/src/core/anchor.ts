/** Va vers une ancre de la page (#recherche…) et donne le focus à son premier champ. Ne lève jamais. */
export function focusAnchor(hash: string): void {
  if (!hash.startsWith('#') || hash.length < 2) return;
  let id: string;
  try {
    id = decodeURIComponent(hash.slice(1));
  } catch {
    return;
  }
  const target = document.getElementById(id);
  if (!target) return;
  target.scrollIntoView?.({ block: 'center' }); // absent de jsdom
  target.querySelector<HTMLElement>('input, button, textarea, select, a[href]')?.focus();
}
