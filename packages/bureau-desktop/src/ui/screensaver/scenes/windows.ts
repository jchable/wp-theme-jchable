/** Scène « Fenêtres flottantes » : des fenêtres du Bureau dérivent dans l'espace 3D et viennent passer devant la caméra. */
import { depthSort, project, rotateX, rotateY, rotateZ, v3, type Camera, type Projected, type Vec3 } from './math3d';
import type { SceneColors, SceneFactory } from './types';

const WINDOW_COUNT = 20;
const STAR_COUNT = 50;
const Z_FAR = 16;
/** En deçà, la fenêtre est recyclée au fond (elle ne doit jamais toucher le plan proche). */
const Z_RECYCLE = 1.3;
const TITLE_BAR = 0.3;
const MONO = 'ui-monospace, "Cascadia Code", Menlo, Consolas, monospace';
const MIN_FONT_PX = 6;
/** Taille de police du repère local du titre (le repère est ensuite mis à l'échelle de la carte). */
const TEXT_PX = 20;
/** Largeur d'un caractère monospace, en fraction de la taille de police. */
const CHAR_RATIO = 0.6;

const FALLBACK_TITLES = {
  fr: ['Bienvenue', 'Notes.txt'],
  en: ['Welcome', 'Notes.txt'],
} as const;

interface FloatingWindow {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** Dimensions dans le plan de la fenêtre, en unités du monde. */
  w: number;
  h: number;
  /** Phases et vitesses des oscillations de lacet, tangage et roulis. */
  phase: [number, number, number];
  speed: [number, number, number];
  tint: number;
  title: string;
  /** Longueur relative (0..1) de chaque ligne de contenu. */
  lines: number[];
}

/** Tronque `title` avec « … » pour tenir en `maxChars` caractères ; chaîne vide s'il n'y a pas la place. */
export function fitTitle(title: string, maxChars: number): string {
  const room = Math.floor(maxChars);
  if (!(room >= 2)) return '';
  if (title.length <= room) return title;
  return `${title.slice(0, room - 1).trimEnd()}…`;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

function tintColors(tint: number, c: SceneColors): { bar: string; text: string } {
  switch (tint) {
    case 0: return { bar: c.accent, text: c.paper };
    case 1: return { bar: '#3d3d38', text: c.paper };
    case 2: return { bar: c.yellow, text: c.ink };
    default: return { bar: c.sky, text: c.ink };
  }
}

export const create: SceneFactory = (context) => {
  const { rng, colors } = context;
  let width = Math.max(1, context.width);
  let height = Math.max(1, context.height);
  let time = 0;

  const pool: readonly string[] =
    context.titles.length > 0 ? context.titles : FALLBACK_TITLES[context.lang === 'en' ? 'en' : 'fr'];
  const range = (lo: number, hi: number): number => lo + (hi - lo) * rng();

  const fovOf = (): number => 0.9 * Math.max(1, Math.min(width, height));

  /** (Re)place une fenêtre à la profondeur `z`, avec des paramètres tirés au sort. */
  function spawn(win: FloatingWindow | null, z: number): FloatingWindow {
    const fov = fovOf();
    const spreadX = (width / 2 / fov) * 0.55;
    const spreadY = (height / 2 / fov) * 0.55;
    const next: FloatingWindow = win ?? {
      x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, w: 0, h: 0,
      phase: [0, 0, 0], speed: [0, 0, 0], tint: 0, title: '', lines: [],
    };
    next.z = z;
    next.x = (rng() * 2 - 1) * z * spreadX;
    next.y = (rng() * 2 - 1) * z * spreadY;
    next.vx = range(-0.12, 0.12);
    next.vy = range(-0.08, 0.08);
    next.vz = -range(0.5, 1.1);
    next.w = range(2.6, 3.8);
    next.h = range(1.7, 2.6);
    next.phase = [range(0, 6.28), range(0, 6.28), range(0, 6.28)];
    next.speed = [range(0.25, 0.55), range(0.2, 0.45), range(0.15, 0.35)];
    next.tint = Math.floor(rng() * 4);
    next.title = pool[Math.floor(rng() * pool.length) % pool.length] ?? '';
    next.lines = Array.from({ length: 4 + Math.floor(rng() * 3) }, () => range(0.35, 1));
    return next;
  }

  const windows: FloatingWindow[] = [];
  for (let i = 0; i < WINDOW_COUNT; i++) {
    windows.push(spawn(null, range(Z_RECYCLE + 0.5, Z_FAR)));
  }

  const stars = Array.from({ length: STAR_COUNT }, () => ({
    x: rng(),
    y: rng(),
    size: rng() < 0.25 ? 2 : 1,
    phase: range(0, 6.28),
  }));

  function drawWindow(ctx: CanvasRenderingContext2D, win: FloatingWindow, camera: Camera): void {
    // Apparition progressive au fond et disparition juste avant le recyclage
    const fade = Math.min(clamp((Z_FAR - win.z) / (Z_FAR * 0.3), 0, 1), clamp((win.z - Z_RECYCLE) / 1.5, 0, 1));
    if (fade <= 0.01) return;

    // Orientation : bascule douce autour de la face de la fenêtre (elle ne se retourne jamais)
    const yaw = Math.sin(time * win.speed[0] + win.phase[0]) * 0.6;
    const pitch = Math.sin(time * win.speed[1] + win.phase[1]) * 0.25;
    const roll = Math.sin(time * win.speed[2] + win.phase[2]) * 0.12;
    const orient = (p: Vec3): Vec3 => rotateY(rotateX(rotateZ(p, roll), pitch), yaw);
    const ex = orient(v3(1, 0, 0));
    const ey = orient(v3(0, 1, 0));
    const at = (u: number, v: number): Projected | null =>
      project(v3(win.x + ex.x * u + ey.x * v, win.y + ex.y * u + ey.y * v, win.z + ex.z * u + ey.z * v), camera);

    const hw = win.w / 2;
    const hh = win.h / 2;
    const corners = [at(-hw, hh), at(hw, hh), at(hw, -hh), at(-hw, -hh)];
    const pts: Projected[] = [];
    for (const p of corners) {
      if (!p) return;
      pts.push(p);
    }
    const minX = Math.min(...pts.map((p) => p.x));
    const maxX = Math.max(...pts.map((p) => p.x));
    const minY = Math.min(...pts.map((p) => p.y));
    const maxY = Math.max(...pts.map((p) => p.y));
    if (maxX < 0 || minX > width || maxY < 0 || minY > height) return;

    const centre = at(0, 0);
    if (!centre) return;
    const scale = centre.scale;
    const lineWidth = clamp(scale * 0.05, 1, 4);

    /** Trace un quadrilatère du plan de la fenêtre (coins u0,v0 et u1,v1) ; faux s'il passe derrière la caméra. */
    const quadPath = (u0: number, v0: number, u1: number, v1: number): boolean => {
      const a = at(u0, v0);
      const b = at(u1, v0);
      const c = at(u1, v1);
      const d = at(u0, v1);
      if (!a || !b || !c || !d) return false;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.closePath();
      return true;
    };

    ctx.lineJoin = 'miter';
    ctx.lineWidth = lineWidth;

    // Ombre portée dure, décalée dans le plan de la fenêtre
    const off = 0.14;
    ctx.globalAlpha = fade * 0.55;
    ctx.fillStyle = colors.ink;
    if (quadPath(-hw + off, hh - off, hw + off, -hh - off)) ctx.fill();

    ctx.globalAlpha = fade;
    ctx.fillStyle = colors.paper;
    ctx.strokeStyle = colors.ink;
    if (!quadPath(-hw, hh, hw, -hh)) return;
    ctx.fill();

    // Trop petite pour les détails : un simple rectangle de papier encadré
    if (maxX - minX < 24) {
      ctx.stroke();
      return;
    }

    const tint = tintColors(win.tint, colors);
    ctx.fillStyle = tint.bar;
    if (quadPath(-hw, hh, hw, hh - TITLE_BAR)) {
      ctx.fill();
      ctx.stroke();
    }

    // Contenu : lignes de texte grisées
    const lines = win.lines;
    const bodyTop = hh - TITLE_BAR - 0.25;
    const step = (win.h - TITLE_BAR - 0.5) / lines.length;
    ctx.strokeStyle = '#b4b1a6';
    ctx.lineWidth = clamp(scale * 0.07, 1, 6);
    ctx.beginPath();
    for (let i = 0; i < lines.length; i++) {
      const v = bodyTop - i * step - step * 0.35;
      const a = at(-hw + 0.25, v);
      const b = at(-hw + 0.25 + (win.w - 0.5) * (lines[i] ?? 1), v);
      if (a && b) {
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
    }
    ctx.stroke();

    // Cadre extérieur par-dessus le contenu
    ctx.strokeStyle = colors.ink;
    ctx.lineWidth = lineWidth;
    if (quadPath(-hw, hh, hw, -hh)) ctx.stroke();

    // Trois pastilles
    const barMid = hh - TITLE_BAR / 2;
    const radius = TITLE_BAR * 0.22 * scale;
    if (radius >= 1.5) {
      ctx.fillStyle = colors.paper;
      ctx.lineWidth = Math.max(1, lineWidth * 0.6);
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const p = at(-hw + 0.2 + i * 0.2, barMid);
        if (p) {
          ctx.moveTo(p.x + radius, p.y);
          ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        }
      }
      ctx.fill();
      ctx.stroke();
    }

    // Le titre est dessiné dans le repère de la carte (affine tirée de trois points projetés), pour en suivre
    // l'orientation ; il est tronqué selon la place disponible et omis s'il serait trop petit pour être lu.
    const fontWorld = TITLE_BAR * 0.62;
    if (fontWorld * scale >= MIN_FONT_PX) {
      const title = fitTitle(win.title, ((win.w - 0.9) / (fontWorld * CHAR_RATIO)));
      const origin = title ? at(-hw + 0.75, barMid) : null;
      const right = origin ? at(-hw + 0.75 + 0.5, barMid) : null;
      const down = origin ? at(-hw + 0.75, barMid - 0.5) : null;
      if (title && origin && right && down) {
        // 1 pixel du repère local = fontWorld / TEXT_PX unités du monde ; 0,5 est l'écart des points de mesure.
        const k = fontWorld / TEXT_PX / 0.5;
        ctx.save();
        ctx.transform((right.x - origin.x) * k, (right.y - origin.y) * k, (down.x - origin.x) * k, (down.y - origin.y) * k, origin.x, origin.y);
        ctx.font = `bold ${TEXT_PX}px ${MONO}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = tint.text;
        ctx.fillText(title, 0, 0);
        ctx.restore();
      }
    }
  }

  return {
    step(dtMs) {
      const dt = Math.max(0, dtMs) / 1000;
      time += dt;
      for (const win of windows) {
        win.x += win.vx * dt;
        win.y += win.vy * dt;
        win.z += win.vz * dt;
        if (win.z < Z_RECYCLE) spawn(win, Z_FAR);
      }
    },

    draw(ctx) {
      // Fond : bureau qui s'assombrit vers le bas, puis quelques étoiles
      ctx.globalAlpha = 1;
      ctx.fillStyle = colors.desk;
      ctx.fillRect(0, 0, width, height);
      const shade = ctx.createLinearGradient(0, 0, 0, height);
      shade.addColorStop(0, 'rgba(0,0,0,0)');
      shade.addColorStop(1, 'rgba(0,0,0,0.8)');
      ctx.fillStyle = shade;
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = colors.paper;
      for (const star of stars) {
        ctx.globalAlpha = 0.35 + 0.35 * Math.sin(time * 1.5 + star.phase);
        ctx.fillRect(Math.floor(star.x * width), Math.floor(star.y * height), star.size, star.size);
      }
      ctx.globalAlpha = 1;

      const camera: Camera = { width, height, fov: fovOf(), near: 0.1 };
      for (const win of depthSort(windows, (w) => w.z)) drawWindow(ctx, win, camera);
      ctx.globalAlpha = 1;
    },

    resize(w, h) {
      width = Math.max(1, w);
      height = Math.max(1, h);
    },
  };
};
