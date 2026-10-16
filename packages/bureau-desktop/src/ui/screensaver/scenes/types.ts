/**
 * Contrat d'une scène d'écran de veille. Chaque scène est un module `scenes/<id>.ts`
 * qui exporte `create: SceneFactory`, chargé seulement quand on la choisit.
 * Les scènes dessinent en 2D avec de la 3D logicielle (voir math3d.ts) : aucune dépendance, aucun WebGL.
 */

export type SceneId = 'tunnel' | 'windows' | 'graph' | 'planet' | 'voxel' | 'classic';

/** Couleurs du thème Bureau (valeurs par défaut du thème, lues dans les variables CSS quand elles existent). */
export interface SceneColors {
  desk: string;
  paper: string;
  ink: string;
  yellow: string;
  sky: string;
  accent: string;
}

export const DEFAULT_COLORS: SceneColors = {
  desk: '#2E6F6C',
  paper: '#F2F0EA',
  ink: '#101010',
  yellow: '#FFE14D',
  sky: '#9AD0FF',
  accent: '#2D3FC8',
};

export interface SceneContext {
  width: number;
  height: number;
  /** Générateur aléatoire (injectable pour des tests déterministes) : valeurs dans [0, 1[. */
  rng: () => number;
  colors: SceneColors;
  /** Titres d'articles récents du blog, pour les scènes qui en affichent (peut être vide). */
  titles: readonly string[];
  siteName: string;
  lang: 'fr' | 'en';
}

export interface Scene {
  /** Avance la simulation ; `dtMs` est déjà borné par l'appelant (≤ 100 ms). */
  step(dtMs: number): void;
  /** Dessine une image complète (fond compris) sur le canevas, aux dimensions courantes. */
  draw(ctx: CanvasRenderingContext2D): void;
  resize(width: number, height: number): void;
}

export type SceneFactory = (context: SceneContext) => Scene;
