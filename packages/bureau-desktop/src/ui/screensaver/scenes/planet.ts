/**
 * Scène « Planète de code » : un globe dont la surface est tissée de glyphes de code et de markdown,
 * entouré d'un halo, de quelques satellites portant des étiquettes de fichiers, sur un fond étoilé.
 * Canvas 2D uniquement ; tout l'aléatoire vient de `context.rng`.
 */
import { project, rotateX, rotateY, rotateZ, v3, type Camera, type Vec3 } from './math3d';
import type { Scene, SceneFactory } from './types';

const GLYPH_COUNT = 560;
const STAR_COUNT = 140;
const SATELLITE_LABELS = ['.md', '.ts', '.php', '.json'];
const SYMBOLS = ['#', '{', '}', '(', ')', ';', '=', '>', '*', '_', '`', '0', '1', '<', '/', '[', ']', '$', '+'];
const WORDS = ['const', 'fn', '##', 'git', 'WP', 'let', '=>', '</>', 'null', '---'];
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
/** Distance de la caméra au centre de la planète, en rayons. */
const DISTANCE = 4;
/** Inclinaison de l'axe de la planète (et du système d'orbites) vers la caméra. */
const TILT = 0.38;
const ORBIT_SEGMENTS = 48;

function normalize(v: Vec3): Vec3 {
  const n = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / n, y: v.y / n, z: v.z / n };
}

/** Direction du soleil dans le repère de l'écran (il éclaire en haut à gauche, côté caméra). */
const LIGHT = normalize(v3(-0.65, 0.45, -0.6));

interface Glyph {
  /** Point sur la sphère unité, avant rotation. */
  p: Vec3;
  text: string;
  /** 0 : clair, 1 : jaune (markdown), 2 : ciel (accolades, parenthèses). */
  tone: 0 | 1 | 2;
}

interface Star {
  x: number;
  y: number;
  size: number;
  phase: number;
  speed: number;
}

interface Satellite {
  label: string;
  /** Inclinaison de l'orbite, nœud ascendant, rayon (en rayons de planète), phase initiale, vitesse (rad/ms). */
  incline: number;
  node: number;
  radius: number;
  phase: number;
  speed: number;
}

interface OrbitSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  behind: boolean;
}

interface PlacedSatellite {
  satellite: Satellite;
  x: number;
  y: number;
  scale: number;
  depth: number;
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

/** Ajoute de la transparence à une couleur `#rgb` ou `#rrggbb` ; toute autre syntaxe est renvoyée telle quelle. */
function withAlpha(color: string, alpha: number): string {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return color;
  const digits = m[1] ?? '';
  const hex = digits.length === 3 ? digits.replace(/./g, (c) => c + c) : digits;
  const n = Number.parseInt(hex, 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${clamp01(alpha).toFixed(3)})`;
}

function pick<T>(items: readonly T[], rng: () => number): T {
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))] as T;
}

function toneOf(text: string): Glyph['tone'] {
  if (/^[#*`_-]/.test(text)) return 1;
  if (/[{}()[\]<>]/.test(text)) return 2;
  return 0;
}

function makeGlyphs(rng: () => number): Glyph[] {
  const glyphs: Glyph[] = [];
  for (let i = 0; i < GLYPH_COUNT; i++) {
    // Spirale de Fibonacci : répartition quasi uniforme sur la sphère.
    const y = 1 - (2 * (i + 0.5)) / GLYPH_COUNT;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const a = i * GOLDEN_ANGLE;
    const text = rng() < 0.16 ? pick(WORDS, rng) : pick(SYMBOLS, rng);
    glyphs.push({ p: v3(Math.cos(a) * r, y, Math.sin(a) * r), text, tone: toneOf(text) });
  }
  return glyphs;
}

function makeStars(rng: () => number): Star[] {
  return Array.from({ length: STAR_COUNT }, () => ({
    x: rng(),
    y: rng(),
    size: rng() < 0.15 ? 2 : 1,
    phase: rng() * Math.PI * 2,
    speed: 0.0008 + rng() * 0.0022,
  }));
}

function makeSatellites(rng: () => number): Satellite[] {
  const count = 3 + (rng() < 0.5 ? 1 : 0);
  return Array.from({ length: count }, (_, i) => ({
    label: SATELLITE_LABELS[i % SATELLITE_LABELS.length] ?? '.md',
    incline: 0.35 + rng() * 1.0,
    node: rng() * Math.PI * 2,
    radius: 1.45 + i * 0.22 + rng() * 0.1,
    phase: rng() * Math.PI * 2,
    speed: (0.00035 + rng() * 0.00025) * (i % 2 === 0 ? 1 : -1),
  }));
}

export const create: SceneFactory = (context) => {
  const { rng, colors } = context;
  let width = Math.max(1, context.width);
  let height = Math.max(1, context.height);
  let time = 0;

  const glyphs = makeGlyphs(rng);
  const stars = makeStars(rng);
  const satellites = makeSatellites(rng);
  const toneColors = [colors.paper, colors.yellow, colors.sky];

  /** Point d'orbite dans le repère de la caméra (planète centrée à `DISTANCE`). */
  function orbitPoint(s: Satellite, angle: number, spin: number): Vec3 {
    let p = v3(Math.cos(angle) * s.radius, 0, Math.sin(angle) * s.radius);
    p = rotateX(p, s.incline);
    p = rotateY(p, s.node + spin * 0.15);
    p = rotateX(p, TILT);
    return v3(p.x, p.y, p.z + DISTANCE);
  }

  function drawBackground(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    ctx.globalAlpha = 1;
    ctx.fillStyle = colors.ink;
    ctx.fillRect(0, 0, width, height);
    const sky = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(width, height) * 0.7);
    sky.addColorStop(0, withAlpha(colors.desk, 0.35));
    sky.addColorStop(1, withAlpha(colors.ink, 0));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = colors.paper;
    for (const star of stars) {
      ctx.globalAlpha = clamp01(0.45 + 0.45 * Math.sin(star.phase + time * star.speed));
      ctx.fillRect(Math.floor(star.x * width), Math.floor(star.y * height), star.size, star.size);
    }
    ctx.globalAlpha = 1;
  }

  function draw(ctx: CanvasRenderingContext2D): void {
    const radius = Math.max(1, Math.min(width, height) * 0.3);
    // Focale choisie pour que le globe couvre `radius` pixels de rayon à `DISTANCE`.
    const fov = radius * Math.sqrt(DISTANCE * DISTANCE - 1);
    const camera: Camera = { width, height, fov, near: 0.1 };
    const cx = width / 2;
    const cy = height / 2;
    const spin = time * 0.00014;

    drawBackground(ctx, cx, cy);

    // Satellites et anneaux d'orbite : ce qui passe derrière la planète est dessiné avant elle.
    const placed: PlacedSatellite[] = [];
    const rings: OrbitSegment[] = [];
    for (const satellite of satellites) {
      let prev3 = orbitPoint(satellite, 0, spin);
      let prev = project(prev3, camera);
      for (let k = 1; k <= ORBIT_SEGMENTS; k++) {
        const cur3 = orbitPoint(satellite, (k / ORBIT_SEGMENTS) * Math.PI * 2, spin);
        const cur = project(cur3, camera);
        if (prev && cur) {
          rings.push({ x1: prev.x, y1: prev.y, x2: cur.x, y2: cur.y, behind: (prev3.z + cur3.z) / 2 > DISTANCE });
        }
        prev3 = cur3;
        prev = cur;
      }
      const pos = orbitPoint(satellite, satellite.phase + time * satellite.speed, spin);
      const pr = project(pos, camera);
      if (pr) placed.push({ satellite, x: pr.x, y: pr.y, scale: pr.scale, depth: pos.z });
    }

    const drawRings = (behind: boolean): void => {
      ctx.lineWidth = 1;
      ctx.strokeStyle = withAlpha(colors.sky, behind ? 0.18 : 0.4);
      ctx.beginPath();
      for (const seg of rings) {
        if (seg.behind !== behind) continue;
        ctx.moveTo(seg.x1, seg.y1);
        ctx.lineTo(seg.x2, seg.y2);
      }
      ctx.stroke();
    };

    const drawSatellite = (sat: PlacedSatellite): void => {
      const size = Math.max(1, Math.round(radius * 0.085 * (sat.scale / (fov / DISTANCE)) * 2) / 2);
      ctx.font = `bold ${size}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const w = sat.satellite.label.length * size * 0.62 + size * 1.2;
      const h = size * 1.7;
      ctx.fillStyle = colors.paper;
      ctx.fillRect(sat.x - w / 2, sat.y - h / 2, w, h);
      ctx.strokeStyle = colors.yellow;
      ctx.lineWidth = 1;
      ctx.strokeRect(sat.x - w / 2, sat.y - h / 2, w, h);
      ctx.fillStyle = colors.ink;
      ctx.fillText(sat.satellite.label, sat.x, sat.y);
    };

    drawRings(true);
    for (const sat of placed.filter((s) => s.depth > DISTANCE)) drawSatellite(sat);

    // Halo atmosphérique.
    const halo = ctx.createRadialGradient(cx, cy, radius * 0.9, cx, cy, radius * 1.45);
    halo.addColorStop(0, withAlpha(colors.sky, 0.45));
    halo.addColorStop(0.35, withAlpha(colors.sky, 0.14));
    halo.addColorStop(1, withAlpha(colors.sky, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.45, 0, Math.PI * 2);
    ctx.fill();

    // Disque de la planète, plus clair du côté du soleil.
    const body = ctx.createRadialGradient(cx + LIGHT.x * radius * 0.4, cy - LIGHT.y * radius * 0.4, radius * 0.1, cx, cy, radius);
    body.addColorStop(0, withAlpha(colors.desk, 0.95));
    body.addColorStop(1, withAlpha(colors.ink, 0.95));
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    // Glyphes de l'hémisphère visible, du plus loin au plus proche.
    const visible: { glyph: Glyph; x: number; y: number; facing: number; day: number }[] = [];
    for (const glyph of glyphs) {
      let p = rotateY(glyph.p, spin);
      p = rotateX(p, TILT);
      p = rotateZ(p, 0.12);
      const facing = -p.z;
      if (facing <= 0.02) continue;
      const pr = project(v3(p.x, p.y, p.z + DISTANCE), camera);
      if (!pr) continue;
      const day = clamp01(-1.4 * (p.x * LIGHT.x + p.y * LIGHT.y + p.z * LIGHT.z) + 0.5);
      visible.push({ glyph, x: pr.x, y: pr.y, facing, day });
    }
    visible.sort((a, b) => a.facing - b.facing);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let lastFont = '';
    for (const v of visible) {
      const size = Math.max(1, Math.round(radius * 0.085 * (0.45 + 0.55 * v.facing) * 2) / 2);
      const font = `${size}px monospace`;
      if (font !== lastFont) {
        ctx.font = font;
        lastFont = font;
      }
      // Assombri vers le limbe et du côté nuit.
      ctx.globalAlpha = clamp01(Math.pow(v.facing, 0.8) * (0.28 + 0.72 * v.day));
      ctx.fillStyle = v.day < 0.3 ? colors.sky : (toneColors[v.glyph.tone] ?? colors.paper);
      ctx.fillText(v.glyph.text, v.x, v.y);
    }
    ctx.globalAlpha = 1;

    // Terminateur : ombre de nuit le long de la direction du soleil, limitée au disque.
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();
    const night = ctx.createLinearGradient(
      cx + LIGHT.x * radius * 0.2,
      cy - LIGHT.y * radius * 0.2,
      cx - LIGHT.x * radius * 0.9,
      cy + LIGHT.y * radius * 0.9,
    );
    night.addColorStop(0, withAlpha(colors.ink, 0));
    night.addColorStop(1, withAlpha(colors.ink, 0.6));
    ctx.fillStyle = night;
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    ctx.restore();

    drawRings(false);
    for (const sat of placed.filter((s) => s.depth <= DISTANCE).sort((a, b) => b.depth - a.depth)) drawSatellite(sat);

    // Signature discrète.
    if (context.siteName) {
      const size = Math.max(1, Math.min(14, Math.round(Math.min(width, height) * 0.03)));
      ctx.font = `${size}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = colors.paper;
      ctx.fillText(context.siteName, cx, Math.max(size, height - size));
      ctx.globalAlpha = 1;
    }
  }

  const scene: Scene = {
    step(dtMs) {
      time += Math.max(0, dtMs);
    },
    draw,
    resize(w, h) {
      width = Math.max(1, w);
      height = Math.max(1, h);
    },
  };
  return scene;
};
