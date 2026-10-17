import { describe, expect, it } from 'vitest';
import { setLang, missingKeys } from '../../../core/i18n';
import { DEFAULT_SCENE, SCENE_IDS, isSceneId, messages, sceneDescription, sceneLabel } from './catalog';

describe('catalogue des écrans de veille', () => {
  it('propose les quatre scènes 3D, avec le bureau en voxels par défaut', () => {
    expect(SCENE_IDS).toEqual(['tunnel', 'windows', 'graph', 'voxel']);
    expect(DEFAULT_SCENE).toBe('voxel');
  });

  it('reconnaît les identifiants valides seulement', () => {
    expect(isSceneId('voxel')).toBe(true);
    expect(isSceneId('planet')).toBe(false); // écrans de veille retirés
    expect(isSceneId('classic')).toBe(false);
    expect(isSceneId('nope')).toBe(false);
    expect(isSceneId(undefined)).toBe(false);
  });

  it('chaque scène a un nom et une description dans les deux langues', () => {
    expect(missingKeys(messages)).toEqual([]);
    for (const id of SCENE_IDS) {
      expect(sceneLabel(id)).toBeTruthy();
      expect(sceneDescription(id).length).toBeGreaterThan(10);
    }
  });

  it('les noms suivent la langue courante', () => {
    expect(sceneLabel('tunnel')).toBe('Tunnel néon');
    setLang('en');
    expect(sceneLabel('tunnel')).toBe('Neon tunnel');
  });
});
