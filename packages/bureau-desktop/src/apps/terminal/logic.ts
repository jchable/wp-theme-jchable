/** Logique pure du terminal : analyse de la ligne, historique, formats de date. */

export interface ParsedCommand {
  name: string;
  args: string[];
}

/** Découpe une ligne : nom en minuscules, arguments séparés par des espaces. */
export function parseCommand(line: string): ParsedCommand | null {
  const parts = line.trim().split(/\s+/).filter((p) => p !== '');
  const [first, ...args] = parts;
  if (first === undefined) return null;
  return { name: first.toLowerCase(), args };
}

/** Historique des lignes saisies, parcouru avec ↑ / ↓. */
export class History {
  private items: string[] = [];
  private cursor = 0;
  private draft = '';

  constructor(private readonly max = 100) {}

  push(line: string): void {
    const value = line.trim();
    this.cursor = this.items.length;
    this.draft = '';
    if (value === '' || this.items[this.items.length - 1] === value) {
      this.cursor = this.items.length;
      return;
    }
    this.items.push(value);
    if (this.items.length > this.max) this.items.shift();
    this.cursor = this.items.length;
  }

  /** Ligne précédente ; `current` est la saisie en cours, mémorisée au premier recul. */
  prev(current: string): string {
    if (this.cursor >= this.items.length) {
      this.draft = current;
      this.cursor = this.items.length;
    }
    if (this.items.length === 0) return current;
    if (this.cursor > 0) this.cursor -= 1;
    return this.items[this.cursor] ?? current;
  }

  /** Ligne suivante ; au bout, rend la saisie en cours mémorisée. */
  next(): string {
    if (this.cursor >= this.items.length) return this.draft;
    this.cursor += 1;
    if (this.cursor >= this.items.length) return this.draft;
    return this.items[this.cursor] ?? this.draft;
  }
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** jj.mm.aaaa depuis une date ISO (WordPress, heure locale du site) ou un objet Date. */
export function formatDate(value: string | Date): string {
  if (typeof value === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (m) return `${m[3]}.${m[2]}.${m[1]}`;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '??.??.????';
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
  }
  if (Number.isNaN(value.getTime())) return '??.??.????';
  return `${pad(value.getDate())}.${pad(value.getMonth() + 1)}.${value.getFullYear()}`;
}

/** Date et heure courantes dans la langue du site. */
export function formatDateTime(date: Date, locale: string): string {
  const options: Intl.DateTimeFormatOptions = { dateStyle: 'full', timeStyle: 'medium' };
  try {
    return new Intl.DateTimeFormat(locale.replace('_', '-'), options).format(date);
  } catch {
    return new Intl.DateTimeFormat('fr-FR', options).format(date);
  }
}

/** Décode les entités HTML sans toucher au DOM vivant : document inerte, texte seul. */
export function decodeEntities(input: string): string {
  const doc = new DOMParser().parseFromString(input, 'text/html');
  return doc.documentElement.textContent ?? '';
}
