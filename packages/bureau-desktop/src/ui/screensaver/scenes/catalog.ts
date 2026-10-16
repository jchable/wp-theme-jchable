import { makeT } from '../../../core/i18n';
import type { SceneId } from './types';

/** Les écrans de veille proposés, dans l'ordre d'affichage des préférences. */
export const SCENE_IDS: readonly SceneId[] = ['tunnel', 'windows', 'graph', 'planet', 'voxel', 'classic'];

export const DEFAULT_SCENE: SceneId = 'tunnel';

export const isSceneId = (value: unknown): value is SceneId =>
  typeof value === 'string' && (SCENE_IDS as readonly string[]).includes(value);

export const messages = {
  fr: {
    'scene.tunnel': 'Tunnel néon',
    'scene.windows': 'Fenêtres flottantes',
    'scene.graph': 'Graphe de connaissances',
    'scene.planet': 'Planète de code',
    'scene.voxel': 'Bureau en voxels',
    'scene.classic': 'Badge JC',
    'scene.tunnel.desc': 'Un vol dans un tunnel de grilles néon, avec un « JC » en 3D au bout.',
    'scene.windows.desc': 'Des fenêtres du bureau, avec les derniers articles, qui dérivent dans l’espace.',
    'scene.graph.desc': 'Un graphe 3D de sujets et d’articles qui pulse, vu en orbite.',
    'scene.planet.desc': 'Un globe tapissé de code et de markdown, avec ses satellites.',
    'scene.voxel.desc': 'Un petit bureau en cubes qui tourne et dont l’écran s’allume.',
    'scene.classic.desc': 'Le badge « JC » qui rebondit sur un ciel étoilé.',
  },
  en: {
    'scene.tunnel': 'Neon tunnel',
    'scene.windows': 'Floating windows',
    'scene.graph': 'Knowledge graph',
    'scene.planet': 'Code planet',
    'scene.voxel': 'Voxel desk',
    'scene.classic': 'JC badge',
    'scene.tunnel.desc': 'A flight through a tunnel of neon grids, with a 3D “JC” at the end.',
    'scene.windows.desc': 'Desktop windows showing your latest posts, drifting through space.',
    'scene.graph.desc': 'A pulsing 3D graph of topics and posts, seen from orbit.',
    'scene.planet.desc': 'A globe covered in code and markdown, with its satellites.',
    'scene.voxel.desc': 'A little desk made of cubes, turning while its screen lights up.',
    'scene.classic.desc': 'The “JC” badge bouncing over a starry sky.',
  },
};

const t = makeT(messages);

export const sceneLabel = (id: SceneId): string => t(`scene.${id}`);
export const sceneDescription = (id: SceneId): string => t(`scene.${id}.desc`);
