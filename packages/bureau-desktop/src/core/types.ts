/**
 * Contrat entre le bureau (fenêtres, barre des tâches…) et les applis.
 * Chaque appli est un module `src/apps/<id>/index.ts` qui exporte `mount` et `unmount`.
 */

/** Réglages transmis par le PHP (wp_add_inline_script). */
export interface BureauConfig {
  homeUrl: string;
  restUrl: string;
  locale: string;
  assetsUrl: string;
  siteName: string;
  sitemapUrl: string;
  feedUrl: string;
  /** Adresse (dossier) du moteur et des données de DOOM. */
  doomBaseUrl: string;
}

/** Réglages du visiteur que la fenêtre Préférences peut lire et changer. */
export interface DesktopSettings {
  /** Langue de l'interface : « auto » suit le navigateur. */
  lang: 'auto' | 'fr' | 'en';
  sound: boolean;
  /** Écran de veille automatique activé ? */
  screensaver: boolean;
  /** Identifiant de la scène (tunnel, windows, graph, planet, voxel, classic). */
  saverScene: string;
  /** Délai d'inactivité en minutes (1, 2, 3, 5, 10, 15 ou 30). */
  saverDelayMin: number;
}

export type SoundName = 'ohoh' | 'recycle' | 'ding' | 'error';

/** Stockage propre à une appli : clés préfixées, jamais d'exception, valeurs en mémoire si le navigateur refuse. */
export interface AppStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

/** Ce que le bureau donne à une appli quand il la monte. */
export interface AppContext {
  readonly config: BureauConfig;
  /** Arguments passés à l'ouverture (ex. { slug: 'mon-article' } pour le WordPad). */
  readonly args: Readonly<Record<string, unknown>>;
  readonly storage: AppStorage;
  /** Change le titre de la fenêtre. */
  setTitle(title: string): void;
  /** Ferme la fenêtre de l'appli. */
  close(): void;
  /** Ouvre une autre appli (ou la ramène au premier plan). */
  openApp(id: string, args?: Record<string, unknown>): void;
  /** Affiche l'écran bleu plein écran. */
  openBsod(message?: string): void;
  /** Joue un son, seulement si le visiteur l'a activé et après une première interaction. */
  playSound(name: SoundName): void;
  /** Lit et change les préférences du visiteur (enregistrées dans son navigateur). */
  readonly settings?: {
    get(): Readonly<DesktopSettings>;
    update(patch: Partial<DesktopSettings>): void;
  };
  /** Lance l'aperçu plein écran d'un écran de veille. */
  previewScreensaver?(sceneId: string): void;
  /** Remet les icônes du bureau dans leur rangement d'origine. */
  resetIcons?(): void;
  /** GET JSON sur l'API REST du site : rejette en cas d'erreur réseau ou HTTP. */
  fetchJson<T>(url: string): Promise<T>;
}

/** Module d'une appli. Une fenêtre = une instance ; l'état peut vivre dans le module. */
export interface AppModule {
  mount(el: HTMLElement, ctx: AppContext): void | Promise<void>;
  unmount(): void;
}

/** Description d'une appli dans le registre. */
export interface BureauApp {
  id: string;
  /** Titre affiché dans la barre de la fenêtre (ex. « DOOM.EXE »). */
  title: string;
  /** Nom du pictogramme (fichier assets/icons/<icon>.svg). */
  icon: string;
  defaultSize: { w: number; h: number };
  /** Sur petit écran : plein écran, ou indisponible. */
  mobile: 'fullscreen' | 'unsupported';
  /** Message affiché quand `mobile` vaut « unsupported ». */
  unsupportedMessage?: string;
  /** Vrai : Échap et toutes les touches vont à l'appli tant qu'elle a le focus (DOOM). */
  capturesKeyboard?: boolean;
  /** Import dynamique du module de l'appli. */
  load(): Promise<AppModule>;
}
