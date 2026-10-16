import type { AppContext } from '../../core/types';
import { getLang } from '../../core/i18n';
import { t, type MessageKey } from './i18n';
import { decodeEntities, formatDate, formatDateTime, parseCommand } from './logic';

export const PROMPT = 'C:\\Blog>';

export interface RunnerDeps {
  /** Écrit une ligne dans la sortie (texte brut). */
  print(line: string): void;
  clear(): void;
  /** Change de page ; par défaut `window.location.assign`. */
  navigate?: (url: string) => void;
  now?: () => Date;
}

export interface Runner {
  welcome(): void;
  run(line: string): Promise<void>;
}

interface Post {
  slug: string;
  title: string;
  date: string;
  link: string;
}

const HELP_KEYS: readonly MessageKey[] = [
  'helpTitle',
  'helpHelp',
  'helpLs',
  'helpCat',
  'helpCd',
  'helpWhoami',
  'helpDate',
  'helpClear',
  'helpDoom',
  'helpWordpad',
  'helpExit',
];

const GAGS: ReadonlyArray<{ match: string; line: MessageKey; bsod: MessageKey }> = [
  { match: 'sudo rm -rf /', line: 'gagSudoLine', bsod: 'gagSudoBsod' },
  { match: 'rm -rf /', line: 'gagRmLine', bsod: 'gagRmBsod' },
  { match: 'format c:', line: 'gagFormatLine', bsod: 'gagFormatBsod' },
];

const isHttpUrl = (value: unknown): value is string => typeof value === 'string' && /^https?:\/\//i.test(value);

function toPosts(data: unknown): Post[] {
  if (!Array.isArray(data)) throw new Error('réponse inattendue');
  const posts: Post[] = [];
  for (const item of data as unknown[]) {
    if (typeof item !== 'object' || item === null) continue;
    const o = item as Record<string, unknown>;
    if (typeof o.slug !== 'string' || typeof o.link !== 'string') continue;
    const rawTitle = (o.title as { rendered?: unknown } | undefined)?.rendered;
    posts.push({
      slug: o.slug,
      title: decodeEntities(typeof rawTitle === 'string' ? rawTitle : ''),
      date: typeof o.date === 'string' ? o.date : '',
      link: o.link,
    });
  }
  return posts;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname || 'localhost';
  } catch {
    return 'localhost';
  }
}

export function createRunner(ctx: AppContext, deps: RunnerDeps): Runner {
  const { print } = deps;
  const navigate = deps.navigate ?? ((url: string) => window.location.assign(url));
  const now = deps.now ?? (() => new Date());
  const posts: Post[] = [];

  const api = (path: string): string => `${ctx.config.restUrl}${path}`;

  async function ls(): Promise<void> {
    let list: Post[];
    try {
      list = toPosts(await ctx.fetchJson<unknown>(api('wp/v2/posts?per_page=10&_fields=slug,title,date,link')));
    } catch {
      print(t('networkError'));
      return;
    }
    posts.splice(0, posts.length, ...list);
    if (list.length === 0) print(t('emptyDir'));
    for (const p of list) print(`${formatDate(p.date)}  ${p.slug}.md`);
  }

  async function cat(args: string[]): Promise<void> {
    const wanted = args.join(' ').replace(/\.md$/i, '');
    if (wanted === '') {
      print(t('catSyntax'));
      return;
    }
    let url = posts.find((p) => p.slug === wanted)?.link;
    if (url === undefined) {
      try {
        const found = await ctx.fetchJson<unknown>(api(`wp/v2/posts?slug=${encodeURIComponent(wanted)}&_fields=link`));
        const first: unknown = Array.isArray(found) ? found[0] : undefined;
        const link = (first as { link?: unknown } | undefined)?.link;
        url = typeof link === 'string' ? link : undefined;
      } catch {
        print(t('networkError'));
        return;
      }
    }
    if (!isHttpUrl(url)) {
      print(t('fileNotFound', { name: wanted }));
      return;
    }
    navigate(url);
  }

  function gag(normalized: string): boolean {
    const g = GAGS.find((x) => x.match === normalized);
    if (!g) return false;
    print(t(g.line));
    ctx.openBsod(t(g.bsod));
    return true;
  }

  return {
    welcome() {
      print(t('welcomeVersion', { site: ctx.config.siteName }));
      print(t('welcomeHint'));
      print('');
    },

    async run(line) {
      const cmd = parseCommand(line);
      if (!cmd) return;
      if (gag([cmd.name, ...cmd.args].join(' ').toLowerCase())) return;
      switch (cmd.name) {
        case 'help':
          HELP_KEYS.forEach((key) => print(t(key)));
          return;
        case 'ls':
          await ls();
          return;
        case 'cat':
          await cat(cmd.args);
          return;
        case 'cd':
          if (cmd.args[0]?.toLowerCase().replace(/[\\/]$/, '') === 'archives') navigate(ctx.config.sitemapUrl);
          else print(t('pathNotFound'));
          return;
        case 'whoami':
          print(t('whoami', { host: hostOf(ctx.config.homeUrl) }));
          return;
        case 'date':
          print(formatDateTime(now(), getLang() === 'en' ? 'en-GB' : 'fr-FR'));
          return;
        case 'clear':
          deps.clear();
          return;
        case 'doom':
          ctx.openApp('doom');
          return;
        case 'wordpad':
          ctx.openApp('wordpad');
          return;
        case 'exit':
          ctx.close();
          return;
        default:
          print(t('unknownCommand', { name: cmd.name }));
      }
    },
  };
}
