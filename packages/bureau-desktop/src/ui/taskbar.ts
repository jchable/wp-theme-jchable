import { t } from '../core/ui-i18n';
import type { WindowManager } from '../core/windows';
import type { ClockCalendar } from './clockCalendar/popup';

export interface TaskbarOptions {
  root: HTMLElement;
  windows: WindowManager;
  locale: string;
  onStart: () => void;
}

/** Barre des tâches : onglets des fenêtres ouvertes, horloge en direct, bouton Démarrer. */
export class Taskbar {
  private readonly tabs: HTMLElement;
  private clockTimer: number | undefined;
  private unsubscribe: (() => void) | null = null;
  private readonly start: HTMLElement | null;
  private clockButton: HTMLButtonElement | null = null;
  private calendar: ClockCalendar | null = null;
  private calendarLoading = false;

  constructor(private readonly options: TaskbarOptions) {
    const { root } = options;
    this.start = root.querySelector<HTMLElement>('.start-button');
    this.tabs = document.createElement('div');
    this.tabs.className = 'bwin-tabs';
    const anchor = root.querySelector('.taskbar-tab');
    if (anchor) anchor.after(this.tabs);
    else root.append(this.tabs);
  }

  get startButton(): HTMLElement | null {
    return this.start;
  }

  mount(): void {
    const { start } = this;
    if (start) {
      start.setAttribute('aria-haspopup', 'menu');
      start.setAttribute('aria-expanded', 'false');
      start.addEventListener('click', (event) => {
        event.preventDefault();
        this.options.onStart();
      });
    }
    this.unsubscribe = this.options.windows.subscribe(() => this.renderTabs());
    this.renderTabs();
    this.upgradeClock();
    this.tickClock();
    this.clockTimer = window.setInterval(() => this.tickClock(), 15_000);
  }

  destroy(): void {
    window.clearInterval(this.clockTimer);
    this.calendar?.destroy();
    this.calendar = null;
    this.unsubscribe?.();
    this.tabs.remove();
  }

  setStartExpanded(expanded: boolean): void {
    this.start?.setAttribute('aria-expanded', String(expanded));
  }

  /** L'heure devient un vrai bouton : Entrée, Espace ou clic ouvrent le calendrier (chargé à ce moment-là). */
  private upgradeClock(): void {
    const clock = this.options.root.querySelector<HTMLTimeElement>('time.taskbar-clock');
    if (!clock || this.clockButton) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'taskbar-clock-button';
    button.setAttribute('aria-haspopup', 'dialog');
    button.setAttribute('aria-expanded', 'false');
    // Le nom du bouton est « Date et heure » suivi de l'heure affichée : il contient donc le texte visible (WCAG 2.5.3).
    const label = document.createElement('span');
    label.className = 'taskbar-clock-label';
    label.textContent = t('clock.label');
    clock.replaceWith(button);
    button.append(label, clock);
    button.addEventListener('click', () => void this.toggleCalendar());
    this.clockButton = button;
  }

  private async toggleCalendar(): Promise<void> {
    const button = this.clockButton;
    if (!button || this.calendarLoading) return;
    if (!this.calendar) {
      this.calendarLoading = true;
      try {
        const { createClockCalendar } = await import('./clockCalendar/popup');
        this.calendar = createClockCalendar({
          anchor: button,
          onToggle: (open) => button.setAttribute('aria-expanded', String(open)),
        });
        this.calendar.open();
      } catch {
        /* le module n'a pas pu se charger : le prochain clic réessaiera */
      } finally {
        this.calendarLoading = false;
      }
      return;
    }
    this.calendar.toggle();
  }

  private tickClock(): void {
    const clock = this.options.root.querySelector<HTMLTimeElement>('time.taskbar-clock');
    if (!clock) return;
    const now = new Date();
    let text: string;
    try {
      text = new Intl.DateTimeFormat(this.options.locale, { hour: '2-digit', minute: '2-digit' }).format(now);
    } catch {
      text = now.toTimeString().slice(0, 5);
    }
    clock.textContent = text;
    clock.dateTime = now.toISOString();
  }

  private renderTabs(): void {
    const { windows } = this.options;
    this.tabs.replaceChildren(
      ...windows.list().map((info) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'bwin-tab';
        button.dataset['id'] = info.id;
        button.textContent = info.title;
        button.setAttribute('aria-pressed', String(info.active && !info.minimized));
        button.addEventListener('click', () => {
          if (info.active && !info.minimized) windows.minimize(info.id);
          else windows.restore(info.id);
        });
        return button;
      }),
    );
  }
}
