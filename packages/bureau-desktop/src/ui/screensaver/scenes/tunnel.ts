/**
 * Écran de veille « Tunnel néon » : vol continu dans un tunnel octogonal de grilles néon
 * (anneaux + arêtes longitudinales, brouillard, léger lacet), avec au bout un grand « JC » extrudé qui tourne doucement.
 * Canvas 2D uniquement ; tout passe par step(dtMs) et context.rng (aucun Math.random ni Date.now).
 */
import { depthSort, project, rotateX, rotateY, type Camera, type Vec3, v3 } from './math3d';
import { DEFAULT_COLORS, type Scene, type SceneColors, type SceneFactory } from './types';

type Rgb = readonly [number, number, number];

const TAU = Math.PI * 2;
/** Rayon du tunnel (unités du monde) et pas entre deux anneaux. */
const RADIUS = 3.2;
const RING_GAP = 1.2;
/** Profondeur visible ; le brouillard efface tout avant cette distance. */
const FAR = 14;
/** Distance du JC à la caméra. */
const LOGO_Z = 8;
const LOGO_SCALE = 2.4;
const LOGO_DEPTH = 0.5;
const SPEED = 4.5; // unités par seconde
const RING_COUNT = Math.ceil(FAR / RING_GAP) + 1;
const SIDES = 8;
const SPARK_COUNT = 36;
const NEAR = 0.2;

function parseColor(value: string, fallback: string): Rgb {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim()) ?? /^#([0-9a-f]{6})$/i.exec(fallback)!;
  let hex = m[1]!;
  if (hex.length === 3) hex = hex.replace(/./g, (c) => c + c);
  const n = parseInt(hex, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const rgb = (c: Rgb): string => `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;
const rgba = (c: Rgb, a: number): string => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a.toFixed(3)})`;
const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Contours des lettres (x vers la droite, y vers le haut, hauteur 1) : polygones simples, sens trigonométrique. */
const LETTER_J: readonly (readonly [number, number])[] = [
  [0.48, 1], [0.7, 1], [0.7, 0.22], [0.48, 0], [0.22, 0], [0, 0.22], [0, 0.4], [0.22, 0.4],
  [0.22, 0.3], [0.3, 0.22], [0.42, 0.22], [0.48, 0.3],
];
const LETTER_C: readonly (readonly [number, number])[] = [
  [0.7, 1], [0.18, 1], [0, 0.82], [0, 0.18], [0.18, 0], [0.7, 0], [0.7, 0.22],
  [0.26, 0.22], [0.22, 0.26], [0.22, 0.74], [0.26, 0.78], [0.7, 0.78],
];

interface Letter {
  front: Vec3[];
  back: Vec3[];
  /** Normale sortante de chaque arête (dans le plan de la lettre), de l'arête i à i+1. */
  normals: Vec3[];
}

function buildLetter(points: readonly (readonly [number, number])[], offsetX: number): Letter {
  const pts = points.map(([x, y]) => [(x + offsetX - 0.8) * LOGO_SCALE, (y - 0.5) * LOGO_SCALE] as const);
  let area = 0;
  pts.forEach(([x, y], i) => {
    const [nx, ny] = pts[(i + 1) % pts.length]!;
    area += x * ny - nx * y;
  });
  const sign = area >= 0 ? 1 : -1;
  const normals = pts.map(([x, y], i) => {
    const [nx, ny] = pts[(i + 1) % pts.length]!;
    const dx = nx - x;
    const dy = ny - y;
    const len = Math.hypot(dx, dy) || 1;
    return v3((sign * dy) / len, (-sign * dx) / len, 0);
  });
  return {
    front: pts.map(([x, y]) => v3(x, y, -LOGO_DEPTH / 2)),
    back: pts.map(([x, y]) => v3(x, y, LOGO_DEPTH / 2)),
    normals,
  };
}

// Le J occupe [0, 0.7], le C commence à 0.9 : largeur totale 1,6 centrée sur 0,8.
const LETTERS: readonly Letter[] = [buildLetter(LETTER_J, 0), buildLetter(LETTER_C, 0.9)];

const LIGHT = (() => {
  const l = v3(-0.35, 0.55, -0.75);
  const n = Math.hypot(l.x, l.y, l.z);
  return v3(l.x / n, l.y / n, l.z / n);
})();

interface Quad {
  pts: { x: number; y: number }[];
  depth: number;
  shade: number;
}

export const create: SceneFactory = (context) => {
  let width = Math.max(1, context.width);
  let height = Math.max(1, context.height);
  const camera: Camera = { width, height, fov: Math.max(1, Math.min(width, height)), near: NEAR };

  const colors: SceneColors = context.colors ?? DEFAULT_COLORS;
  const accent = parseColor(colors.accent, DEFAULT_COLORS.accent);
  const yellow = parseColor(colors.yellow, DEFAULT_COLORS.yellow);
  const sky = parseColor(colors.sky, DEFAULT_COLORS.sky);
  const ink = parseColor(colors.ink, DEFAULT_COLORS.ink);
  // Sur fond sombre, l'accent (bleu profond) est éclairci pour rester lisible comme néon.
  const neonFar = mix(accent, sky, 0.45);
  const background = rgb(mix(ink, accent, 0.14));

  // Tout l'aléatoire vient de context.rng : phases du lacet, du JC et étincelles.
  const rng = context.rng;
  const swayPhaseX = rng() * TAU;
  const swayPhaseY = rng() * TAU;
  const logoPhaseY = rng() * TAU;
  const logoPhaseX = rng() * TAU;
  const sparkAngle = new Float64Array(SPARK_COUNT);
  const sparkRadius = new Float64Array(SPARK_COUNT);
  const sparkZ = new Float64Array(SPARK_COUNT);
  const respawn = (i: number, z: number): void => {
    sparkAngle[i] = rng() * TAU;
    sparkRadius[i] = 0.2 + rng() * 0.7;
    sparkZ[i] = z;
  };
  for (let i = 0; i < SPARK_COUNT; i++) respawn(i, NEAR + rng() * FAR);

  let time = 0; // ms
  let travel = 0; // distance parcourue (unités)

  // Tampons réutilisés : 16 points par anneau (8 coins et 8 milieux d'arêtes), deux anneaux à la fois.
  let farX = new Float64Array(SIDES * 2);
  let farY = new Float64Array(SIDES * 2);
  let nearX = new Float64Array(SIDES * 2);
  let nearY = new Float64Array(SIDES * 2);
  const cornerCos = Array.from({ length: SIDES }, (_, i) => Math.cos(((i + 0.5) * TAU) / SIDES));
  const cornerSin = Array.from({ length: SIDES }, (_, i) => Math.sin(((i + 0.5) * TAU) / SIDES));

  /** Axe du tunnel à la profondeur absolue s : un lacet doux. */
  const swayX = (s: number): number => Math.sin(s * 0.13 + swayPhaseX) * 0.9;
  const swayY = (s: number): number => Math.cos(s * 0.09 + swayPhaseY) * 0.7;

  /** Position écran d'un point (x, y) du tunnel à la profondeur z (relative à la caméra) ; écrit dans out. */
  const out = { x: 0, y: 0, scale: 0 };
  const place = (x: number, y: number, z: number): void => {
    const zc = Math.max(z, NEAR * 2);
    const angle = time * 0.00008 + zc * 0.035;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const wx = x * c - y * s + swayX(travel + zc) - swayX(travel);
    const wy = x * s + y * c + swayY(travel + zc) - swayY(travel);
    const scale = camera.fov / zc;
    out.x = width / 2 + wx * scale;
    out.y = height / 2 - wy * scale;
    out.scale = scale;
  };

  /** Calcule les 16 points d'un anneau situé à la profondeur z. */
  const ringPoints = (z: number, xs: Float64Array, ys: Float64Array): void => {
    for (let i = 0; i < SIDES; i++) {
      place(cornerCos[i]! * RADIUS, cornerSin[i]! * RADIUS, z);
      xs[i * 2] = out.x;
      ys[i * 2] = out.y;
    }
    for (let i = 0; i < SIDES; i++) {
      const j = (i + 1) % SIDES;
      xs[i * 2 + 1] = (xs[i * 2]! + xs[j * 2]!) / 2;
      ys[i * 2 + 1] = (ys[i * 2]! + ys[j * 2]!) / 2;
    }
  };

  /** Du jaune (proche) au bleu néon (loin) en passant par le ciel. */
  const depthColor = (z: number): Rgb => {
    const u = clamp01(z / FAR);
    return u < 0.5 ? mix(yellow, sky, u * 2) : mix(sky, neonFar, (u - 0.5) * 2);
  };
  const fade = (z: number): number => {
    const fog = Math.pow(clamp01(1 - z / FAR), 1.6);
    return fog * clamp01((z - NEAR) / 1.2);
  };

  const strokeBoth = (ctx: CanvasRenderingContext2D, color: Rgb, alpha: number, lineWidth: number): void => {
    // Halo large et discret, puis trait net : le même tracé sert pour les deux.
    ctx.strokeStyle = rgb(color);
    ctx.globalAlpha = alpha * 0.2;
    ctx.lineWidth = lineWidth * 3.5;
    ctx.stroke();
    ctx.globalAlpha = alpha;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  };

  const drawTunnel = (ctx: CanvasRenderingContext2D): void => {
    const base = Math.floor(travel / RING_GAP);
    const offset = travel - base * RING_GAP;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    let haveFar = false;
    for (let k = RING_COUNT; k >= 0; k--) {
      const z = k * RING_GAP - offset;
      ringPoints(z, nearX, nearY);
      if (haveFar) {
        const zf = (k + 1) * RING_GAP - offset;
        const zMid = (Math.max(z, NEAR * 2) + zf) / 2;
        const pulse = 0.78 + 0.22 * Math.sin((base + k) * 0.55 - time * 0.004);
        const a = fade(zMid) * pulse;
        if (a > 0.01) {
          const w = Math.min(4, Math.max(0.5, (camera.fov / zMid) * 0.012));
          ctx.beginPath();
          for (let i = 0; i < SIDES * 2; i++) {
            ctx.moveTo(nearX[i]!, nearY[i]!);
            ctx.lineTo(farX[i]!, farY[i]!);
          }
          strokeBoth(ctx, depthColor(zMid), a * 0.8, w * 0.7);
        }
      }
      // L'anneau lui-même (les milieux d'arêtes sont alignés avec les coins : on ne trace que les coins).
      const pulse = 0.78 + 0.22 * Math.sin((base + k) * 0.55 - time * 0.004);
      const ra = fade(z) * pulse;
      if (ra > 0.01) {
        const w = Math.min(5, Math.max(0.6, (camera.fov / Math.max(z, NEAR * 2)) * 0.02));
        ctx.beginPath();
        ctx.moveTo(nearX[0]!, nearY[0]!);
        for (let i = 1; i < SIDES; i++) ctx.lineTo(nearX[i * 2]!, nearY[i * 2]!);
        ctx.closePath();
        strokeBoth(ctx, depthColor(z), ra, w);
      }
      [farX, nearX] = [nearX, farX];
      [farY, nearY] = [nearY, farY];
      haveFar = true;
    }
  };

  const drawSparks = (ctx: CanvasRenderingContext2D): void => {
    const inner = RADIUS * Math.cos(Math.PI / SIDES);
    for (let i = 0; i < SPARK_COUNT; i++) {
      const z = sparkZ[i]!;
      const a = fade(z) * 0.9;
      if (a <= 0.02) continue;
      const x = Math.cos(sparkAngle[i]!) * sparkRadius[i]! * inner;
      const y = Math.sin(sparkAngle[i]!) * sparkRadius[i]! * inner;
      place(x, y, z);
      const x1 = out.x;
      const y1 = out.y;
      place(x, y, z + 0.7);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(out.x, out.y);
      ctx.strokeStyle = rgb(mix(sky, yellow, 0.5));
      ctx.globalAlpha = a;
      ctx.lineWidth = Math.min(3, Math.max(0.5, (camera.fov / z) * 0.012));
      ctx.stroke();
    }
  };

  const pathOf = (ctx: CanvasRenderingContext2D, pts: readonly { x: number; y: number }[]): void => {
    ctx.beginPath();
    ctx.moveTo(pts[0]!.x, pts[0]!.y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]!.x, pts[i]!.y);
    ctx.closePath();
  };

  const drawLogo = (ctx: CanvasRenderingContext2D): void => {
    const ay = Math.sin(time * 0.0007 + logoPhaseY) * 0.85;
    const ax = Math.sin(time * 0.0005 + logoPhaseX) * 0.18;
    const cx = swayX(travel + LOGO_Z) - swayX(travel);
    const cy = swayY(travel + LOGO_Z) - swayY(travel);
    const toWorld = (p: Vec3): Vec3 => {
      const r = rotateX(rotateY(p, ay), ax);
      return v3(r.x + cx, r.y + cy, r.z + LOGO_Z);
    };

    // Halo derrière le logo.
    const gx = width / 2 + cx * (camera.fov / LOGO_Z);
    const gy = height / 2 - cy * (camera.fov / LOGO_Z);
    const gr = Math.max(1, camera.fov * 0.45);
    const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
    glow.addColorStop(0, rgba(mix(sky, accent, 0.3), 0.35));
    glow.addColorStop(1, rgba(accent, 0));
    ctx.globalAlpha = 1;
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    for (const letter of LETTERS) {
      const front = letter.front.map((p) => project(toWorld(p), camera));
      const back = letter.back.map((p) => project(toWorld(p), camera));
      if (front.some((p) => !p) || back.some((p) => !p)) continue;
      const f = front as NonNullable<(typeof front)[number]>[];
      const b = back as NonNullable<(typeof back)[number]>[];

      // Face arrière, puis flancs visibles du plus loin au plus proche, puis face avant.
      ctx.globalAlpha = 1;
      ctx.fillStyle = rgb(mix(ink, accent, 0.5));
      pathOf(ctx, b);
      ctx.fill();

      const quads: Quad[] = [];
      const n = f.length;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const normal = rotateX(rotateY(letter.normals[i]!, ay), ax);
        const mid = toWorld(
          v3(
            (letter.front[i]!.x + letter.front[j]!.x) / 2,
            (letter.front[i]!.y + letter.front[j]!.y) / 2,
            0,
          ),
        );
        // Le flanc est visible si sa normale regarde vers la caméra (placée à l'origine).
        if (normal.x * mid.x + normal.y * mid.y + normal.z * mid.z >= 0) continue;
        const lit = Math.max(0, normal.x * LIGHT.x + normal.y * LIGHT.y + normal.z * LIGHT.z);
        quads.push({ pts: [f[i]!, f[j]!, b[j]!, b[i]!], depth: mid.z, shade: 0.3 + 0.7 * lit });
      }
      ctx.lineWidth = 1;
      ctx.strokeStyle = rgb(ink);
      for (const q of depthSort(quads, (x) => x.depth)) {
        ctx.fillStyle = rgb(mix(mix(ink, accent, 0.7), sky, q.shade));
        pathOf(ctx, q.pts);
        ctx.fill();
        ctx.stroke();
      }

      ctx.fillStyle = rgb(yellow);
      pathOf(ctx, f);
      ctx.fill();
      ctx.lineWidth = Math.max(1, camera.fov * 0.004);
      ctx.strokeStyle = rgb(mix(yellow, ink, 0.6));
      ctx.stroke();
    }
  };

  const scene: Scene = {
    step(dtMs) {
      const dt = Math.max(0, dtMs);
      time += dt;
      const move = (SPEED * dt) / 1000;
      travel += move;
      for (let i = 0; i < SPARK_COUNT; i++) {
        const z = sparkZ[i]! - move * 2.2;
        if (z < NEAR * 2) respawn(i, FAR - rng() * 2);
        else sparkZ[i] = z;
      }
    },
    draw(ctx) {
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);
      drawTunnel(ctx);
      drawSparks(ctx);
      drawLogo(ctx);
      ctx.restore();
    },
    resize(w, h) {
      width = Math.max(1, w);
      height = Math.max(1, h);
      camera.width = width;
      camera.height = height;
      camera.fov = Math.max(1, Math.min(width, height));
    },
  };
  return scene;
};
