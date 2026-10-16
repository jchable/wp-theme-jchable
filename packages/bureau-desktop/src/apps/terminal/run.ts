import type { AppContext } from '../../core/types';
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

const NETWORK_ERROR = 'Impossible de joindre le serveur.';

const HELP_LINES = [
  'Commandes disponibles :',
  '  help          cette liste',
  '  ls            les 10 derniers articles',
  '  cat <slug>    ouvre un article',
  '  cd archives   le plan du site',
  '  whoami        qui êtes-vous ?',
  '  date          la date et l\'heure',
  '  clear         efface l\'écran',
  '  doom          lance DOOM',
  '  wordpad       ouvre le WordPad',
  '  exit          ferme le terminal',
];

const GAGS: ReadonlyArray<{ match: string; line: string; bsod: string }> = [
  {
    match: 'sudo rm -rf /',
    line: 'Suppression de / en cours... Vous n\'avez pas les droits, mais Windows s\'en moque.',
    bsod: 'Vous avez essayé sudo sur un système qui ne connaît pas sudo. Le système a préféré s\'arrêter pour réfléchir à ses choix.',
  },
  {
    match: 'rm -rf /',
    line: 'Suppression de tous les fichiers... 1%... 2%... Oh non.',
    bsod: 'Tous vos fichiers ont été supprimés. Même ceux de vos voisins. Veuillez redémarrer et faire comme si de rien n\'était.',
  },
  {
    match: 'format c:',
    line: 'ATTENTION : toutes les données du lecteur C: seront perdues. Formatage...',
    bsod: 'Le lecteur C: a été formaté. Le blog va très bien, merci. Appuyez sur une touche pour faire semblant de continuer.',
  },
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
      print(NETWORK_ERROR);
      return;
    }
    posts.splice(0, posts.length, ...list);
    if (list.length === 0) print('Le répertoire est vide.');
    for (const p of list) print(`${formatDate(p.date)}  ${p.slug}.md`);
  }

  async function cat(args: string[]): Promise<void> {
    const wanted = args.join(' ').replace(/\.md$/i, '');
    if (wanted === '') {
      print('Syntaxe : cat <article>');
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
        print(NETWORK_ERROR);
        return;
      }
    }
    if (!isHttpUrl(url)) {
      print(`Fichier introuvable : ${wanted}`);
      return;
    }
    navigate(url);
  }

  function gag(normalized: string): boolean {
    const g = GAGS.find((x) => x.match === normalized);
    if (!g) return false;
    print(g.line);
    ctx.openBsod(g.bsod);
    return true;
  }

  return {
    welcome() {
      print(`${ctx.config.siteName} [version 1.0]`);
      print('Tapez help pour la liste des commandes.');
      print('');
    },

    async run(line) {
      const cmd = parseCommand(line);
      if (!cmd) return;
      if (gag([cmd.name, ...cmd.args].join(' ').toLowerCase())) return;
      switch (cmd.name) {
        case 'help':
          HELP_LINES.forEach(print);
          return;
        case 'ls':
          await ls();
          return;
        case 'cat':
          await cat(cmd.args);
          return;
        case 'cd':
          if (cmd.args[0]?.toLowerCase().replace(/[\\/]$/, '') === 'archives') navigate(ctx.config.sitemapUrl);
          else print("Le chemin d'accès spécifié est introuvable.");
          return;
        case 'whoami':
          print(`visiteur@${hostOf(ctx.config.homeUrl)}`);
          return;
        case 'date':
          print(formatDateTime(now(), ctx.config.locale));
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
          print(`'${cmd.name}' n'est pas reconnu en tant que commande interne ou externe. Tapez help.`);
      }
    },
  };
}
