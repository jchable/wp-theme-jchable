import type { PrefsApi } from '../core/prefs';
import type { BureauApp, BureauConfig } from '../core/types';

export interface StartMenuOptions {
  button: HTMLElement;
  config: BureauConfig;
  prefs: PrefsApi;
  apps: readonly BureauApp[];
  /** Pages du menu du site (Accueil, À propos…) et flux RSS. */
  links: ReadonlyArray<{ label: string; href: string }>;
  openApp: (id: string) => void;
  /** Ouvre une page du blog (dans une fenêtre si elle a du contenu, sinon navigation normale). */
  openPage: (href: string) => void;
  resetIcons: () => void;
  startScreensaver: () => void;
  shutdown: () => void;
  fetchJson: <T>(url: string) => Promise<T>;
  onToggle: (open: boolean) => void;
  /** Vrai : l'écran de veille est proposé (grand écran uniquement). */
  screensaverAvailable: boolean;
}

interface PostSummary {
  title?: { rendered?: string };
  link?: string;
}

const decode = (html: string): string => new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '';

/** Menu Démarrer : programmes, derniers articles, liens, réglages, arrêt. */
export class StartMenu {
  private menu: HTMLElement | null = null;
  private documents: HTMLElement | null = null;
  private documentsLoaded = false;
  private docs: Array<{ label: string; href: string }> | null = null;
  private loading: Promise<void> | null = null;

  constructor(private readonly options: StartMenuOptions) {}

  get isOpen(): boolean {
    return this.menu !== null;
  }

  toggle(): void {
    if (this.menu) this.close(true);
    else this.open();
  }

  close(restoreFocus: boolean): void {
    if (!this.menu) return;
    this.menu.remove();
    this.menu = null;
    document.removeEventListener('pointerdown', this.onOutside, true);
    document.removeEventListener('keydown', this.onKey, true);
    this.options.onToggle(false);
    if (restoreFocus) this.options.button.focus({ preventScroll: true });
  }

  private readonly onOutside = (event: Event): void => {
    const target = event.target as Node;
    if (this.menu && !this.menu.contains(target) && !this.options.button.contains(target)) this.close(false);
  };

  private readonly onKey = (event: KeyboardEvent): void => {
    if (!this.menu) return;
    const items = [...this.menu.querySelectorAll<HTMLElement>('[role^="menuitem"]')];
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.close(true);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      items[(index + step + items.length) % items.length]?.focus();
    } else if (event.key === 'Home') {
      event.preventDefault();
      items[0]?.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      items[items.length - 1]?.focus();
    } else if (event.key === 'Tab') {
      this.close(false);
    }
  };

  private open(): void {
    const { button } = this.options;
    button.scrollIntoView({ block: 'nearest' });
    const menu = document.createElement('div');
    menu.className = 'bmenu';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', 'Menu Démarrer');
    menu.append(this.buildPrograms(), this.buildDocuments(), this.buildLinks(), this.buildSettings());
    document.body.append(menu);
    this.menu = menu;
    const rect = button.getBoundingClientRect();
    menu.style.left = `${Math.max(4, Math.min(rect.left, window.innerWidth - menu.offsetWidth - 4))}px`;
    menu.style.bottom = `${Math.max(4, window.innerHeight - rect.top + 6)}px`;
    document.addEventListener('pointerdown', this.onOutside, true);
    document.addEventListener('keydown', this.onKey, true);
    this.options.onToggle(true);
    menu.querySelector<HTMLElement>('[role^="menuitem"]')?.focus();
    if (!this.documentsLoaded) void this.loadDocuments();
  }


  private group(title: string): HTMLElement {
    const group = document.createElement('div');
    group.className = 'bmenu-group';
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', title);
    const heading = document.createElement('p');
    heading.className = 'bmenu-heading';
    heading.setAttribute('aria-hidden', 'true');
    heading.textContent = title;
    group.append(heading);
    return group;
  }

  private action(label: string, run: () => void): HTMLButtonElement {
    const item = document.createElement('button');
    item.type = 'button';
    item.setAttribute('role', 'menuitem');
    item.textContent = label;
    item.addEventListener('click', () => {
      this.close(false);
      run();
    });
    return item;
  }

  private link(label: string, href: string): HTMLAnchorElement {
    const item = document.createElement('a');
    item.setAttribute('role', 'menuitem');
    item.href = href;
    item.textContent = label;
    return item;
  }

  private checkbox(label: string, checked: boolean, change: (value: boolean) => void): HTMLButtonElement {
    const item = document.createElement('button');
    item.type = 'button';
    item.setAttribute('role', 'menuitemcheckbox');
    item.setAttribute('aria-checked', String(checked));
    item.textContent = label;
    item.addEventListener('click', () => {
      const next = item.getAttribute('aria-checked') !== 'true';
      item.setAttribute('aria-checked', String(next));
      change(next);
    });
    return item;
  }

  private buildPrograms(): HTMLElement {
    const group = this.group('Programmes');
    for (const app of this.options.apps) group.append(this.action(app.title, () => this.options.openApp(app.id)));
    return group;
  }

  private buildDocuments(): HTMLElement {
    const group = this.group('Documents');
    this.documents = group;
    if (this.docs) this.fillDocuments(group, this.docs);
    else this.note(group, 'Chargement…');
    return group;
  }

  private loadDocuments(): Promise<void> {
    // Une seule requête à la fois : rouvrir le menu avant la réponse ne double pas les documents.
    this.loading ??= this.fetchDocuments().finally(() => (this.loading = null));
    return this.loading;
  }

  private async fetchDocuments(): Promise<void> {
    const { config, fetchJson } = this.options;
    try {
      const posts = await fetchJson<PostSummary[]>(`${config.restUrl}wp/v2/posts?per_page=5&_fields=title,link`);
      const docs: Array<{ label: string; href: string }> = [];
      for (const post of Array.isArray(posts) ? posts : []) {
        const link = post.link;
        if (typeof link === 'string' && /^https?:/.test(link)) docs.push({ label: decode(post.title?.rendered ?? link), href: link });
      }
      this.docs = docs;
      this.documentsLoaded = true;
      if (this.documents) this.fillDocuments(this.documents, docs);
    } catch {
      if (this.documents) this.fillDocuments(this.documents, null);
    }
  }

  /** Remplit le groupe « Documents » ; `null` : le chargement a échoué. */
  private fillDocuments(group: HTMLElement, docs: ReadonlyArray<{ label: string; href: string }> | null): void {
    group.querySelectorAll('.bmenu-note, [role="menuitem"]').forEach((node) => node.remove());
    if (docs === null) this.note(group, 'Documents indisponibles.');
    else if (docs.length === 0) this.note(group, 'Aucun document.');
    else for (const doc of docs) group.append(this.link(doc.label, doc.href));
  }

  private note(group: HTMLElement, text: string): void {
    const p = document.createElement('p');
    p.className = 'bmenu-note';
    p.textContent = text;
    group.append(p);
  }

  private buildLinks(): HTMLElement {
    const group = this.group('Blog');
    for (const { label, href } of this.options.links) {
      const item = this.link(label, href);
      item.addEventListener('click', (event) => {
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) return; // nouvel onglet : navigation normale
        event.preventDefault();
        this.close(false);
        this.options.openPage(href);
      });
      group.append(item);
    }
    return group;
  }

  private buildSettings(): HTMLElement {
    const { prefs, resetIcons, startScreensaver, shutdown, screensaverAvailable } = this.options;
    const group = this.group('Paramètres');
    group.append(
      this.checkbox('Son', prefs.get().sound, (value) => prefs.update((p) => (p.sound = value))),
    );
    if (screensaverAvailable) {
      group.append(
        this.checkbox('Écran de veille automatique', prefs.get().screensaver, (value) =>
          prefs.update((p) => (p.screensaver = value)),
        ),
        this.action('Lancer l’écran de veille', startScreensaver),
      );
    }
    group.append(this.action('Réorganiser les icônes', resetIcons), this.action('Arrêter…', shutdown));
    return group;
  }
}
