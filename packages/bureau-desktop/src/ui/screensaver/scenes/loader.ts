import type { SceneFactory, SceneId } from './types';

/** Chargement à la demande : une scène n'est téléchargée que si on la choisit (ou qu'on l'essaie). */
export function loadScene(id: SceneId): Promise<SceneFactory> {
  switch (id) {
    case 'tunnel':
      return import('./tunnel').then((m) => m.create);
    case 'windows':
      return import('./windows').then((m) => m.create);
    case 'graph':
      return import('./graph').then((m) => m.create);
    case 'voxel':
      return import('./voxel').then((m) => m.create);
  }
}
