import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLang } from '../core/i18n';
import type { WindowManager } from '../core/windows';
import { Taskbar } from './taskbar';

function makeBar(): { root: HTMLElement; taskbar: Taskbar } {
  const root = document.createElement('div');
  root.className = 'taskbar';
  root.innerHTML =
    '<a class="start-button" href="#">Démarrer</a><span class="taskbar-tab">Page</span><time class="taskbar-clock" datetime="2026">2026</time>';
  document.body.append(root);
  const windows = { subscribe: () => () => undefined, list: () => [] } as unknown as WindowManager;
  const taskbar = new Taskbar({ root, windows, locale: 'fr-FR', onStart: () => undefined });
  taskbar.mount();
  return { root, taskbar };
}

const flush = async (): Promise<void> => {
  // Le calendrier est un module à part, chargé au premier clic.
  await vi.dynamicImportSettled();
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

let bar: ReturnType<typeof makeBar>;
beforeEach(() => {
  bar = makeBar();
});
afterEach(() => {
  bar.taskbar.destroy();
  bar.root.remove();
  document.querySelectorAll('.bclock-pop').forEach((el) => el.remove());
});

describe('l’horloge de la barre des tâches est un vrai bouton', () => {
  it('bouton nommé « Date et heure », qui ouvre un dialogue', () => {
    const button = bar.root.querySelector<HTMLButtonElement>('button.taskbar-clock-button')!;
    expect(button).not.toBeNull();
    expect(button.type).toBe('button');
    expect(button.querySelector('.taskbar-clock-label')!.textContent).toBe('Date et heure');
    expect(button.hasAttribute('aria-label')).toBe(false); // le nom vient du contenu : libellé + heure visible
    expect(button.getAttribute('aria-haspopup')).toBe('dialog');
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('le nom suit la langue', () => {
    bar.taskbar.destroy();
    bar.root.remove();
    setLang('en');
    bar = makeBar();
    expect(bar.root.querySelector('button.taskbar-clock-button .taskbar-clock-label')!.textContent).toBe('Date and time');
  });

  it('l’élément <time> reste dedans et continue d’afficher l’heure', () => {
    const time = bar.root.querySelector<HTMLTimeElement>('button.taskbar-clock-button > time.taskbar-clock')!;
    expect(time).not.toBeNull();
    expect(time.textContent).toMatch(/^\d{2}:\d{2}$/);
  });

  it("sans horloge dans la barre, rien ne casse", () => {
    bar.taskbar.destroy();
    bar.root.remove();
    const root = document.createElement('div');
    root.className = 'taskbar';
    root.innerHTML = '<a class="start-button" href="#">Démarrer</a>';
    document.body.append(root);
    const windows = { subscribe: () => () => undefined, list: () => [] } as unknown as WindowManager;
    const taskbar = new Taskbar({ root, windows, locale: 'fr-FR', onStart: () => undefined });
    expect(() => taskbar.mount()).not.toThrow();
    expect(root.querySelector('button.taskbar-clock-button')).toBeNull();
    taskbar.destroy();
    root.remove();
    bar = makeBar(); // pour que le nettoyage de fin de test ait quelque chose à détruire
  });
});

describe('ouverture du calendrier', () => {
  it('un clic ouvre la fenêtre, un second clic la ferme, et aria-expanded suit', async () => {
    const button = bar.root.querySelector<HTMLButtonElement>('button.taskbar-clock-button')!;
    button.click();
    await flush();
    expect(document.querySelectorAll('.bclock-pop')).toHaveLength(1);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    button.click();
    await flush();
    expect(document.querySelector('.bclock-pop')).toBeNull();
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(button);
  });

  it('deux clics très rapprochés (avant le chargement) n’ouvrent qu’une fenêtre', async () => {
    const button = bar.root.querySelector<HTMLButtonElement>('button.taskbar-clock-button')!;
    button.click();
    button.click();
    await flush();
    expect(document.querySelectorAll('.bclock-pop')).toHaveLength(1);
  });

  it('la barre détruite ferme la fenêtre', async () => {
    bar.root.querySelector<HTMLButtonElement>('button.taskbar-clock-button')!.click();
    await flush();
    bar.taskbar.destroy();
    expect(document.querySelector('.bclock-pop')).toBeNull();
  });
});
