/**
 * Scène « Bureau en voxels » : un petit bureau isométrique (plateau, tiroirs, écran CRT et clavier, tasse,
 * plante, lampe, livres) fait de cubes, qui tourne lentement sur lui-même. L'écran s'allume au bout de
 * quelques secondes et affiche des lignes de code qui défilent, puis s'éteint et se rallume en cycle.
 * La géométrie est calculée une seule fois ; chaque image trie les cubes par profondeur et ne trace
 * que leurs faces visibles (haut et deux côtés), ombrées selon l'orientation.
 */
import { depthSort, lerp, project, rotateX, rotateY, v3, type Camera, type Vec3 } from './math3d';
import { DEFAULT_COLORS, type SceneColors, type SceneFactory } from './types';

type Rgb = [number, number, number];

const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));
const smoothstep = (a: number, b: number, x: number): number => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Lit `#rgb`, `#rrggbb` ou `rgb()/rgba()` ; sinon renvoie la couleur de secours. */
function parseColor(value: string, fallback: string): Rgb {
  const text = value.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text);
  if (hex) {
    const digits = hex[1] ?? '';
    const h = digits.length === 3 ? [...digits].map((c) => c + c).join('') : digits;
    return [Number.parseInt(h.slice(0, 2), 16), Number.parseInt(h.slice(2, 4), 16), Number.parseInt(h.slice(4, 6), 16)];
  }
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(text);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])].map((n) => Math.min(255, Math.max(0, n))) as Rgb;
  return fallback === value ? [128, 128, 128] : parseColor(fallback, fallback);
}

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** Faces dessinables : 0 dessus, 1 +z, 2 +x, 3 -x, 4 -z (le dessous n'est jamais visible, la caméra est en plongée). */
const FACE_LIGHT = [1, 0.86, 0.64, 0.5, 0.74];
const FACE_BIT = [1, 2, 4, 8, 16];
/** Sommets de chaque face, en signes (x, y, z) d'un cube de demi-côté 1. */
const FACE_CORNERS: ReadonlyArray<ReadonlyArray<readonly [number, number, number]>> = [
  [[-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1]],
  [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]],
  [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]],
  [[-1, -1, -1], [-1, 1, -1], [-1, 1, 1], [-1, -1, 1]],
  [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1]],
];
const FACE_NORMAL: ReadonlyArray<readonly [number, number, number]> = [[0, 1, 0], [0, 0, 1], [1, 0, 0], [-1, 0, 0], [0, 0, -1]];
const FACE_NEIGHBOR = FACE_NORMAL;

/** Une couleur déclinée en cinq tons, un par face. */
type Material = readonly string[];

function material(color: Rgb): Material {
  return FACE_LIGHT.map((f) => `rgb(${Math.round(color[0] * f)},${Math.round(color[1] * f)},${Math.round(color[2] * f)})`);
}

interface Voxel {
  /** Centre dans le repère du bureau (centré sur l'origine). */
  x: number;
  y: number;
  z: number;
  /** Faces exposées (aucun voisin) : bits de FACE_BIT. */
  mask: number;
  material: Material | null;
  /** Pixel d'écran : la couleur dépend alors de l'animation. */
  pixel?: { col: number; row: number };
}

interface Dust {
  x: number;
  y: number;
  z: number;
  size: number;
  speed: number;
  phase: number;
  material: Material;
}

/** Dimensions de l'écran (en pixels de cubes) et position du bureau dans la grille. */
const SCREEN_COLS = 10;
const SCREEN_ROWS = 8;
const SCREEN_X0 = 7;
const SCREEN_Y0 = 11;
const SCREEN_Z = 7;
const ORIGIN = { x: 11, y: 9, z: 5.5 };
const CODE_LINES = 48;
const DUST_COUNT = 28;
const DUST_BOX = { x: 16, yMin: -9, yMax: 14, z: 12 };
/** Période du cycle de l'écran (s) : éteint jusqu'à 3 s, allumé jusqu'à 17 s, puis il s'éteint. */
const SCREEN_CYCLE = 20;
const SPIN_SPEED = 0.2;
const START_YAW = -0.9;
const PITCH = -0.5;
const DISTANCE = 80;
const FLOOR_TILE = 3;
const FLOOR_HALF = 7;

export const create: SceneFactory = (context) => {
  let { width, height } = context;
  const { rng } = context;
  const colors: SceneColors = context.colors;
  const rgb = (key: keyof SceneColors): Rgb => parseColor(colors[key], DEFAULT_COLORS[key]);
  const desk = rgb('desk');
  const paper = rgb('paper');
  const ink = rgb('ink');
  const yellow = rgb('yellow');
  const sky = rgb('sky');
  const accent = rgb('accent');

  const matDesk = material(desk);
  const matDeskDark = material(mix(desk, ink, 0.28));
  const matDeskLight = material(mix(desk, paper, 0.2));
  const matCase = material(mix(paper, ink, 0.1));
  const matBezel = material(mix(paper, ink, 0.28));
  const matKeyA = material(paper);
  const matKeyB = material(mix(paper, ink, 0.3));
  const matInk = material(mix(ink, paper, 0.08));
  const matAccent = material(accent);
  const matYellow = material(yellow);
  const matSky = material(sky);
  const matCoffee = material(mix(ink, yellow, 0.18));
  const matTerracotta = material(mix(yellow, ink, 0.4));
  const matLeafA = material(mix(desk, yellow, 0.35));
  const matLeafB = material(mix(desk, sky, 0.3));
  const matPaper = material(paper);

  // --- Écran : un fond éteint, un fond allumé par niveau de luminosité, trois couleurs de texte par niveau.
  const LEVELS = 4;
  const screenOff = mix(ink, sky, 0.08);
  const screenBg = Array.from({ length: LEVELS + 1 }, (_, level) => material(mix(screenOff, accent, (0.4 * level) / LEVELS)));
  const textColors: Rgb[] = [sky, yellow, mix(sky, paper, 0.55)];
  const screenText = textColors.map((color) =>
    Array.from({ length: LEVELS + 1 }, (_, level) => material(mix(mix(screenOff, accent, (0.4 * level) / LEVELS), color, level / LEVELS))),
  );

  // Lignes de code : mots de 1 à 4 pixels séparés par un blanc ; 0 = vide, 1..3 = couleur de texte.
  const code: Uint8Array[] = [];
  for (let i = 0; i < CODE_LINES; i++) {
    const line = new Uint8Array(SCREEN_COLS);
    let col = Math.floor(rng() * 3) * (rng() < 0.5 ? 1 : 0);
    const tone = rng() < 0.3 ? 2 : 1;
    while (col < SCREEN_COLS) {
      const length = 1 + Math.floor(rng() * 4);
      const colorIndex = rng() < 0.25 ? 3 : tone;
      for (let k = 0; k < length && col + k < SCREEN_COLS; k++) line[col + k] = colorIndex;
      col += length + 1;
      if (rng() < 0.12) break;
    }
    code.push(line);
  }

  // --- Géométrie : grille de cellules entières, puis liste des voxels ayant au moins une face exposée.
  const cells = new Map<string, { x: number; y: number; z: number; material: Material | null; pixel?: { col: number; row: number } }>();
  const key = (x: number, y: number, z: number): string => `${x},${y},${z}`;
  const put = (x: number, y: number, z: number, mat: Material | null, pixel?: { col: number; row: number }): void => {
    cells.set(key(x, y, z), { x, y, z, material: mat, pixel });
  };
  const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, mat: Material): void => {
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) put(x, y, z, mat);
  };

  // Plateau, caisson à tiroirs à gauche, deux pieds à droite.
  box(0, 7, 0, 21, 7, 10, matDesk);
  box(0, 0, 0, 4, 6, 10, matDeskDark);
  for (const [y0, y1] of [[1, 2], [4, 5]] as const) box(0, y0, 10, 4, y1, 10, matDeskLight);
  put(2, 2, 11, matYellow);
  put(2, 5, 11, matYellow);
  box(20, 0, 0, 21, 6, 1, matDeskDark);
  box(20, 0, 9, 21, 6, 10, matDeskDark);

  // Écran CRT : socle, pied, caisson, lunette, dalle de pixels, bosse arrière.
  box(9, 8, 3, 14, 8, 6, matCase);
  box(10, 9, 4, 13, 9, 6, matCase);
  box(7, 11, 3, 16, 18, 6, matCase);
  box(9, 12, 1, 14, 17, 2, matCase);
  box(6, 10, SCREEN_Z, 17, 19, SCREEN_Z, matBezel);
  for (let row = 0; row < SCREEN_ROWS; row++) {
    for (let col = 0; col < SCREEN_COLS; col++) put(SCREEN_X0 + col, SCREEN_Y0 + SCREEN_ROWS - 1 - row, SCREEN_Z, null, { col, row });
  }

  // Clavier : touches en damier.
  for (let x = 7; x <= 16; x++) for (let z = 8; z <= 9; z++) put(x, 8, z, (x + z) % 2 === 0 ? matKeyA : matKeyB);

  // Tasse de café.
  box(19, 8, 1, 20, 9, 2, matAccent);
  box(19, 9, 1, 20, 9, 2, matAccent);
  put(19, 9, 1, matCoffee);
  put(20, 9, 1, matCoffee);
  put(19, 9, 2, matCoffee);
  put(20, 9, 2, matCoffee);
  put(21, 9, 1, matAccent);

  // Plante : pot, tige et feuillage.
  box(1, 8, 6, 3, 9, 8, matTerracotta);
  put(2, 9, 7, matCoffee);
  for (const y of [10, 11, 12]) put(2, y, 7, matLeafA);
  for (const [x, y, z, m] of [
    [1, 11, 7, matLeafB], [3, 11, 7, matLeafB], [1, 12, 7, matLeafB], [3, 12, 7, matLeafB],
    [2, 12, 6, matLeafB], [2, 12, 8, matLeafB], [2, 13, 7, matLeafA],
  ] as const) put(x, y, z, m);

  // Lampe : base, pied, abat-jour.
  box(19, 8, 7, 20, 8, 8, matInk);
  box(19, 9, 7, 19, 12, 7, matInk);
  box(18, 13, 6, 20, 13, 8, matYellow);
  put(19, 14, 7, matInk);

  // Pile de livres.
  box(1, 8, 1, 4, 8, 3, matAccent);
  box(2, 9, 1, 4, 9, 3, matYellow);
  box(1, 10, 1, 3, 10, 3, matSky);
  box(1, 11, 2, 3, 11, 3, matPaper);

  const voxels: Voxel[] = [];
  for (const cell of cells.values()) {
    const { x: cx, y: cy, z: cz } = cell;
    let mask = 0;
    for (let f = 0; f < FACE_NEIGHBOR.length; f++) {
      const [dx, dy, dz] = FACE_NEIGHBOR[f]!;
      if (!cells.has(key(cx + dx, cy + dy, cz + dz))) mask |= FACE_BIT[f]!;
    }
    if (mask === 0) continue;
    voxels.push({ x: cx + 0.5 - ORIGIN.x, y: cy + 0.5 - ORIGIN.y, z: cz + 0.5 - ORIGIN.z, mask, material: cell.material, pixel: cell.pixel });
  }

  // --- Poussière : petits cubes qui montent doucement et se réinjectent en bas.
  const dustMaterials = [matPaper, matSky, matYellow];
  const dust: Dust[] = [];
  for (let i = 0; i < DUST_COUNT; i++) {
    dust.push({
      x: (rng() * 2 - 1) * DUST_BOX.x,
      y: lerp(DUST_BOX.yMin, DUST_BOX.yMax, rng()),
      z: (rng() * 2 - 1) * DUST_BOX.z,
      size: lerp(0.12, 0.3, rng()),
      speed: lerp(0.3, 0.8, rng()),
      phase: rng() * Math.PI * 2,
      material: dustMaterials[Math.floor(rng() * dustMaterials.length)]!,
    });
  }

  let time = 0;

  /** Luminosité de l'écran entre 0 (éteint) et 1 : allumage vers 3 s, extinction vers 17 s, puis cycle. */
  const screenPower = (): number => {
    const phase = time % SCREEN_CYCLE;
    return smoothstep(3, 3.8, phase) * (1 - smoothstep(17, 17.8, phase));
  };

  const screenMaterial = (pixel: { col: number; row: number }, level: number, scroll: number): Material => {
    if (level <= 0) return screenBg[0]!;
    const line = code[(pixel.row + scroll) % CODE_LINES]!;
    const tone = line[pixel.col] ?? 0;
    return (tone === 0 ? screenBg[level] : screenText[tone - 1]?.[level]) ?? screenBg[0]!;
  };

  interface Drawable {
    cx: number;
    cy: number;
    cz: number;
    half: number;
    mask: number;
    material: Material;
    alpha: number;
    order: number;
  }

  return {
    step(dtMs) {
      const dt = Number.isFinite(dtMs) ? Math.max(0, dtMs) / 1000 : 0;
      time += dt;
      for (const d of dust) {
        d.y += d.speed * dt;
        if (d.y > DUST_BOX.yMax) {
          d.y = DUST_BOX.yMin;
          d.x = (rng() * 2 - 1) * DUST_BOX.x;
          d.z = (rng() * 2 - 1) * DUST_BOX.z;
        }
      }
    },

    draw(ctx) {
      const w = Math.max(1, width);
      const h = Math.max(1, height);

      // Fond dégradé sombre, redessiné en entier.
      const back = ctx.createLinearGradient(0, 0, 0, h);
      const top = mix(ink, accent, 0.22);
      const bottom = mix(ink, desk, 0.4);
      back.addColorStop(0, `rgb(${Math.round(top[0])},${Math.round(top[1])},${Math.round(top[2])})`);
      back.addColorStop(1, `rgb(${Math.round(bottom[0])},${Math.round(bottom[1])},${Math.round(bottom[2])})`);
      ctx.globalAlpha = 1;
      ctx.fillStyle = back;
      ctx.fillRect(0, 0, w, h);

      // Caméra : le bureau tient dans l'image quelle que soit sa taille.
      const pixelsPerUnit = Math.min(w / 38, h / 32);
      const camera: Camera = { width: w, height: h, fov: pixelsPerUnit * DISTANCE, near: 0.1 };
      const yaw = START_YAW + time * SPIN_SPEED;
      /** Repère du bureau → repère caméra (rotation, miroir en z pour regarder vers -z, plongée). */
      const toCamera = (p: Vec3, translate: boolean): Vec3 => {
        const r = rotateY(p, yaw);
        const q = rotateX(v3(r.x, r.y, -r.z), PITCH);
        return translate ? v3(q.x, q.y, q.z + DISTANCE) : q;
      };
      const ex = toCamera(v3(1, 0, 0), false);
      const ey = toCamera(v3(0, 1, 0), false);
      const ez = toCamera(v3(0, 0, 1), false);

      // Sol en damier discret et ombre portée du bureau.
      const floorY = -ORIGIN.y;
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = `rgb(${Math.round(lerp(desk[0], paper[0], 0.35))},${Math.round(lerp(desk[1], paper[1], 0.35))},${Math.round(lerp(desk[2], paper[2], 0.35))})`;
      const quad = (corners: ReadonlyArray<readonly [number, number, number]>): boolean => {
        const pts = corners.map(([x, y, z]) => project(toCamera(v3(x, y, z), true), camera));
        if (pts.some((p) => p === null)) return false;
        ctx.beginPath();
        pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p!.x, p!.y) : ctx.lineTo(p!.x, p!.y)));
        ctx.closePath();
        ctx.fill();
        return true;
      };
      for (let i = -FLOOR_HALF; i < FLOOR_HALF; i++) {
        for (let j = -FLOOR_HALF; j < FLOOR_HALF; j++) {
          if ((i + j) % 2 !== 0) continue;
          const mx = (i + 0.5) * FLOOR_TILE;
          const mz = (j + 0.5) * FLOOR_TILE;
          if (Math.hypot(mx, mz) > FLOOR_HALF * FLOOR_TILE) continue;
          const x0 = i * FLOOR_TILE;
          const z0 = j * FLOOR_TILE;
          const x1 = x0 + FLOOR_TILE;
          const z1 = z0 + FLOOR_TILE;
          quad([[x0, floorY, z0], [x1, floorY, z0], [x1, floorY, z1], [x0, floorY, z1]]);
        }
      }
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = 'rgb(0,0,0)';
      quad([
        [-ORIGIN.x, floorY, -ORIGIN.z], [22 - ORIGIN.x, floorY, -ORIGIN.z],
        [22 - ORIGIN.x, floorY, 11 - ORIGIN.z], [-ORIGIN.x, floorY, 11 - ORIGIN.z],
      ]);

      // Cubes : centre en repère caméra, tri du plus loin au plus proche.
      const level = Math.round(screenPower() * LEVELS);
      const scroll = Math.floor(time * 2.5);
      const items: Drawable[] = [];
      for (const v of voxels) {
        const c = toCamera(v3(v.x, v.y, v.z), true);
        items.push({
          cx: c.x, cy: c.y, cz: c.z, half: 0.5, mask: v.mask, alpha: 1, order: 0,
          material: v.pixel ? screenMaterial(v.pixel, level, scroll) : (v.material as Material),
        });
      }
      for (const d of dust) {
        const sway = Math.sin(time * 0.7 + d.phase) * 0.6;
        const c = toCamera(v3(d.x + sway, d.y, d.z), true);
        items.push({ cx: c.x, cy: c.y, cz: c.z, half: d.size / 2, mask: 31, alpha: 0.75, order: 1, material: d.material });
      }
      const sorted = depthSort(items, (it) => it.cx * it.cx + it.cy * it.cy + it.cz * it.cz);

      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(0.4, pixelsPerUnit * 0.035);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      for (const it of sorted) {
        ctx.globalAlpha = it.alpha;
        for (let f = 0; f < FACE_BIT.length; f++) {
          if ((it.mask & FACE_BIT[f]!) === 0) continue;
          const n = FACE_NORMAL[f]!;
          const nx = ex.x * n[0] + ey.x * n[1] + ez.x * n[2];
          const ny = ex.y * n[0] + ey.y * n[1] + ez.y * n[2];
          const nz = ex.z * n[0] + ey.z * n[1] + ez.z * n[2];
          // Élimination des faces arrière : la normale doit regarder vers la caméra (à l'origine).
          if (nx * (it.cx + it.half * nx) + ny * (it.cy + it.half * ny) + nz * (it.cz + it.half * nz) >= 0) continue;
          const pts = FACE_CORNERS[f]!.map(([sx, sy, sz]) =>
            project(
              v3(
                it.cx + it.half * (sx * ex.x + sy * ey.x + sz * ez.x),
                it.cy + it.half * (sx * ex.y + sy * ey.y + sz * ez.y),
                it.cz + it.half * (sx * ex.z + sy * ey.z + sz * ez.z),
              ),
              camera,
            ),
          );
          if (pts.some((p) => p === null)) continue;
          ctx.beginPath();
          ctx.moveTo(pts[0]!.x, pts[0]!.y);
          for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]!.x, pts[i]!.y);
          ctx.closePath();
          ctx.fillStyle = it.material[f]!;
          ctx.fill();
          if (it.order === 0) ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    },

    resize(newWidth, newHeight) {
      width = newWidth;
      height = newHeight;
    },
  };
};
