/** Petits outils de 3D logicielle (sans WebGL) : rotations, projection en perspective, tri des faces. */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const v3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

export function rotateX(p: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: p.x, y: p.y * c - p.z * s, z: p.y * s + p.z * c };
}

export function rotateY(p: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: p.x * c + p.z * s, y: p.y, z: -p.x * s + p.z * c };
}

export function rotateZ(p: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c, z: p.z };
}

/** La caméra est à l'origine et regarde vers +z ; `fov` est la focale en pixels. */
export interface Camera {
  width: number;
  height: number;
  fov: number;
  /** Plan proche : les points plus près que cela ne sont pas dessinés. */
  near: number;
}

export interface Projected {
  x: number;
  y: number;
  /** Facteur d'échelle en pixels par unité à cette profondeur. */
  scale: number;
  depth: number;
}

/** Projette un point en perspective ; `null` s'il est derrière (ou trop près de) la caméra. +y est vers le haut de l'écran. */
export function project(p: Vec3, camera: Camera): Projected | null {
  if (p.z <= camera.near) return null;
  const scale = camera.fov / p.z;
  return { x: camera.width / 2 + p.x * scale, y: camera.height / 2 - p.y * scale, scale, depth: p.z };
}

/** Générateur pseudo-aléatoire déterministe (Mulberry32) : valeurs dans [0, 1[. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Du plus loin au plus proche (algorithme du peintre) ; ne modifie pas le tableau d'origine. */
export function depthSort<T>(items: readonly T[], depthOf: (item: T) => number): T[] {
  return [...items].sort((a, b) => depthOf(b) - depthOf(a));
}
