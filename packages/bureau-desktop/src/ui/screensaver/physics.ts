/** Simulation pure et déterministe du badge « JC » et du champ d'étoiles. */

export type Rng = () => number;

export interface Badge {
  x: number;
  y: number;
  /** Vitesse en pixels par milliseconde. */
  vx: number;
  vy: number;
  w: number;
  h: number;
}

export interface Star {
  x: number;
  y: number;
  /** Dérive horizontale en px/ms (négative : vers la gauche). */
  vx: number;
  size: number;
  alpha: number;
}

export interface Scene {
  width: number;
  height: number;
  badge: Badge;
  stars: Star[];
}

const BADGE_VX = 0.11;
const BADGE_VY = 0.08;

/** Générateur pseudo-aléatoire déterministe (mulberry32), pour les tests. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function badgeSize(width: number, height: number): number {
  const wanted = Math.round(Math.min(width, height) * 0.2);
  return Math.max(0, Math.min(Math.max(wanted, 56), 120, width, height));
}

function starCount(width: number, height: number): number {
  return Math.max(30, Math.min(260, Math.round((width * height) / 6000)));
}

/** Position dans [0, max] repliée par rebonds, et sens de la vitesse. */
function reflect(pos: number, vel: number, max: number): [number, number] {
  if (max <= 0) return [0, vel];
  const period = 2 * max;
  const m = ((pos % period) + period) % period;
  return m <= max ? [m, vel] : [period - m, -vel];
}

function wrap(value: number, size: number): number {
  if (size <= 0) return 0;
  const r = ((value % size) + size) % size;
  return r >= size ? 0 : r;
}

export function createScene(width: number, height: number, rng: Rng): Scene {
  const size = badgeSize(width, height);
  const badge: Badge = {
    w: size,
    h: size,
    x: rng() * Math.max(0, width - size),
    y: rng() * Math.max(0, height - size),
    vx: rng() < 0.5 ? -BADGE_VX : BADGE_VX,
    vy: rng() < 0.5 ? -BADGE_VY : BADGE_VY,
  };
  const stars: Star[] = [];
  for (let i = 0, n = starCount(width, height); i < n; i++) {
    stars.push({
      x: rng() * width,
      y: rng() * height,
      // Dérive lente : 2 à 12 px par seconde.
      vx: -(0.002 + rng() * 0.01),
      size: rng() < 0.8 ? 1 : 2,
      alpha: 0.4 + rng() * 0.6,
    });
  }
  return { width, height, badge, stars };
}

export function step(scene: Scene, dtMs: number): void {
  if (!Number.isFinite(dtMs) || dtMs <= 0) return;
  const { badge } = scene;
  [badge.x, badge.vx] = reflect(badge.x + badge.vx * dtMs, badge.vx, scene.width - badge.w);
  [badge.y, badge.vy] = reflect(badge.y + badge.vy * dtMs, badge.vy, scene.height - badge.h);
  for (const star of scene.stars) star.x = wrap(star.x + star.vx * dtMs, scene.width);
}

export function resize(scene: Scene, width: number, height: number): void {
  const fx = scene.width > 0 ? width / scene.width : 1;
  const fy = scene.height > 0 ? height / scene.height : 1;
  scene.width = width;
  scene.height = height;
  const { badge } = scene;
  badge.w = Math.min(badge.w, width);
  badge.h = Math.min(badge.h, height);
  badge.x = Math.max(0, Math.min(badge.x, width - badge.w));
  badge.y = Math.max(0, Math.min(badge.y, height - badge.h));
  for (const star of scene.stars) {
    star.x = wrap(star.x * fx, width);
    star.y = Math.max(0, Math.min(star.y * fy, Math.max(0, height - 1e-6)));
  }
}
