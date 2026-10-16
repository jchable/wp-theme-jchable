/**
 * Scène « Graphe de connaissances » : des sujets (gros nœuds) et des articles (petits nœuds) reliés
 * par des arêtes, dans un nuage 3D qui respire lentement pendant que la caméra tourne autour.
 * Des impulsions lumineuses voyagent le long des arêtes.
 */
import { project, rotateX, rotateY, v3, type Camera, type Projected, type Vec3 } from './math3d';
import type { Scene, SceneContext, SceneFactory } from './types';

const SUBJECTS = {
  fr: ['Code', 'Mémoire', 'Agents', 'Docs', 'Outils', 'Web'],
  en: ['Code', 'Memory', 'Agents', 'Docs', 'Tools', 'Web'],
} as const;

/** Rayon du nuage et distance de la caméra (unités du monde). */
const RADIUS = 100;
const DISTANCE = 300;
const ARTICLES = 44;
const MAX_PULSES = 8;
const LABEL_MAX = 22;
const BACKGROUND = '#070b1f';

interface Node {
  /** Position après la simulation de force. */
  base: Vec3;
  vx: number;
  vy: number;
  vz: number;
  subject: boolean;
  /** Rayon dans le monde. */
  radius: number;
  color: string;
  label: string;
  /** Phases du mouvement « respirant », une par axe. */
  phase: Vec3;
}

interface Edge {
  a: number;
  b: number;
  rest: number;
}

interface Pulse {
  edge: number;
  /** Avancement de 0 à 1 le long de l'arête. */
  t: number;
  speed: number;
  reverse: boolean;
}

interface Placed {
  node: Node;
  p: Projected;
  /** 1 près de la caméra, 0 au fond du nuage. */
  near: number;
  r: number;
}

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

function truncate(title: string): string {
  const text = title.trim().replace(/\s+/g, ' ');
  return text.length > LABEL_MAX ? `${text.slice(0, LABEL_MAX - 1).trimEnd()}…` : text;
}

/** Point aléatoire uniforme sur une sphère de rayon `r`. */
function onSphere(rng: () => number, r: number): Vec3 {
  const z = rng() * 2 - 1;
  const phi = rng() * Math.PI * 2;
  const s = Math.sqrt(1 - z * z);
  return v3(r * s * Math.cos(phi), r * s * Math.sin(phi), r * z);
}

/** Quelques itérations de répulsion (tous les couples) et de ressorts le long des arêtes. */
function settle(nodes: Node[], edges: Edge[]): void {
  for (let iteration = 0; iteration < 150; iteration++) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]!;
        const b = nodes[j]!;
        const dx = a.base.x - b.base.x;
        const dy = a.base.y - b.base.y;
        const dz = a.base.z - b.base.z;
        const d2 = dx * dx + dy * dy + dz * dz + 1;
        const f = 900 / d2 / Math.sqrt(d2);
        a.vx += dx * f;
        a.vy += dy * f;
        a.vz += dz * f;
        b.vx -= dx * f;
        b.vy -= dy * f;
        b.vz -= dz * f;
      }
    }
    for (const edge of edges) {
      const a = nodes[edge.a]!;
      const b = nodes[edge.b]!;
      const dx = b.base.x - a.base.x;
      const dy = b.base.y - a.base.y;
      const dz = b.base.z - a.base.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-6;
      const f = ((d - edge.rest) / d) * 0.02;
      a.vx += dx * f;
      a.vy += dy * f;
      a.vz += dz * f;
      b.vx -= dx * f;
      b.vy -= dy * f;
      b.vz -= dz * f;
    }
    for (const n of nodes) {
      // Légère attraction vers le centre, amortissement, déplacement borné.
      n.vx = (n.vx - n.base.x * 0.004) * 0.8;
      n.vy = (n.vy - n.base.y * 0.004) * 0.8;
      n.vz = (n.vz - n.base.z * 0.004) * 0.8;
      const speed = Math.hypot(n.vx, n.vy, n.vz);
      const k = speed > 8 ? 8 / speed : 1;
      n.base = v3(n.base.x + n.vx * k, n.base.y + n.vy * k, n.base.z + n.vz * k);
    }
  }
  // Remet le nuage à l'échelle voulue.
  const far = nodes.reduce((m, n) => Math.max(m, Math.hypot(n.base.x, n.base.y, n.base.z)), 1e-6);
  const scale = RADIUS / far;
  for (const n of nodes) n.base = v3(n.base.x * scale, n.base.y * scale, n.base.z * scale);
}

export const create: SceneFactory = (context: SceneContext): Scene => {
  const { rng, colors } = context;
  let width = context.width;
  let height = context.height;
  let time = 0;

  const names = SUBJECTS[context.lang === 'en' ? 'en' : 'fr'];
  const palette = [colors.yellow, colors.sky, colors.paper, colors.accent, colors.desk, colors.yellow];
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  names.forEach((label, i) => {
    nodes.push({
      base: onSphere(rng, RADIUS * 0.5),
      vx: 0,
      vy: 0,
      vz: 0,
      subject: true,
      radius: 7,
      color: palette[i % palette.length]!,
      label,
      phase: v3(rng() * 6.28, rng() * 6.28, rng() * 6.28),
    });
  });
  for (let i = 0; i < names.length; i++) edges.push({ a: i, b: (i + 1) % names.length, rest: RADIUS * 0.9 });

  for (let i = 0; i < ARTICLES; i++) {
    const first = Math.floor(rng() * names.length);
    const index = nodes.length;
    nodes.push({
      base: onSphere(rng, RADIUS),
      vx: 0,
      vy: 0,
      vz: 0,
      subject: false,
      radius: 2.6 + rng() * 0.8,
      color: palette[first % palette.length]!,
      label: i < context.titles.length ? truncate(context.titles[i] ?? '') : '',
      phase: v3(rng() * 6.28, rng() * 6.28, rng() * 6.28),
    });
    edges.push({ a: first, b: index, rest: RADIUS * 0.55 });
    if (rng() < 0.5) {
      const second = (first + 1 + Math.floor(rng() * (names.length - 1))) % names.length;
      edges.push({ a: second, b: index, rest: RADIUS * 0.55 });
    }
  }
  settle(nodes, edges);

  const newPulse = (): Pulse => ({
    edge: Math.floor(rng() * edges.length),
    t: rng(),
    speed: 0.0004 + rng() * 0.0005,
    reverse: rng() < 0.5,
  });
  const pulses: Pulse[] = Array.from({ length: MAX_PULSES }, newPulse);

  /** Position animée d'un nœud : sa position de repos plus un léger mouvement respirant. */
  function positionOf(n: Node): Vec3 {
    const amp = n.subject ? 4 : 7;
    return v3(
      n.base.x + Math.sin(time * 0.0009 + n.phase.x) * amp,
      n.base.y + Math.sin(time * 0.0011 + n.phase.y) * amp,
      n.base.z + Math.sin(time * 0.0007 + n.phase.z) * amp,
    );
  }

  return {
    step(dtMs) {
      const dt = Number.isFinite(dtMs) ? Math.max(0, dtMs) : 0;
      time += dt;
      for (let i = 0; i < pulses.length; i++) {
        const pulse = pulses[i]!;
        pulse.t += pulse.speed * dt;
        if (pulse.t >= 1) pulses[i] = { ...newPulse(), t: 0 };
      }
    },

    resize(w, h) {
      width = w;
      height = h;
    },

    draw(ctx) {
      const camera: Camera = { width, height, fov: Math.max(1, Math.min(width, height) * 1.15), near: 1 };
      const yaw = time * 0.0002;
      const pitch = 0.35 + Math.sin(time * 0.00007) * 0.2;

      // Fond bleu nuit et halo central.
      ctx.globalAlpha = 1;
      ctx.fillStyle = BACKGROUND;
      ctx.fillRect(0, 0, width, height);
      const halo = Math.max(1, Math.hypot(width, height) * 0.45);
      const glow = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, halo);
      glow.addColorStop(0, colors.accent);
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);
      ctx.globalAlpha = 1;

      // Projection de tous les nœuds.
      const placed: (Placed | null)[] = nodes.map((node) => {
        const q = rotateX(rotateY(positionOf(node), yaw), pitch);
        const p = project(v3(q.x, q.y, q.z + DISTANCE), camera);
        if (!p) return null;
        return {
          node,
          p,
          near: clamp01((DISTANCE + RADIUS - p.depth) / (2 * RADIUS)),
          r: Math.max(0.5, node.radius * p.scale),
        };
      });

      // Arêtes, plus discrètes au fond.
      ctx.lineWidth = 1;
      ctx.strokeStyle = colors.sky;
      for (const edge of edges) {
        const a = placed[edge.a];
        const b = placed[edge.b];
        if (!a || !b) continue;
        ctx.globalAlpha = 0.05 + 0.45 * ((a.near + b.near) / 2);
        ctx.beginPath();
        ctx.moveTo(a.p.x, a.p.y);
        ctx.lineTo(b.p.x, b.p.y);
        ctx.stroke();
      }

      // Nœuds, du plus loin au plus proche.
      const visible = placed.filter((p): p is Placed => p !== null).sort((a, b) => b.p.depth - a.p.depth);
      for (const { node, p, near, r } of visible) {
        const g = ctx.createRadialGradient(p.x - r * 0.3, p.y - r * 0.3, r * 0.1, p.x, p.y, r);
        g.addColorStop(0, colors.paper);
        g.addColorStop(0.35, node.color);
        g.addColorStop(1, colors.ink);
        ctx.globalAlpha = 0.4 + 0.6 * near;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Impulsions lumineuses le long des arêtes.
      for (const pulse of pulses) {
        const edge = edges[pulse.edge];
        const a = edge && placed[edge.a];
        const b = edge && placed[edge.b];
        if (!a || !b) continue;
        const t = pulse.reverse ? 1 - pulse.t : pulse.t;
        const x = a.p.x + (b.p.x - a.p.x) * t;
        const y = a.p.y + (b.p.y - a.p.y) * t;
        const size = Math.max(1, (2.5 * (a.p.scale + b.p.scale)) / 2);
        const g = ctx.createRadialGradient(x, y, 0, x, y, size * 2);
        g.addColorStop(0, colors.paper);
        g.addColorStop(0.4, colors.yellow);
        g.addColorStop(1, 'rgba(255, 225, 77, 0)');
        ctx.globalAlpha = 0.5 + 0.5 * ((a.near + b.near) / 2);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, size * 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Libellés : seulement les nœuds proches et assez grands.
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = colors.paper;
      for (const { node, p, near, r } of visible) {
        if (!node.label) continue;
        const readable = node.subject ? r >= 8 : r >= 6 && p.depth < DISTANCE;
        if (!readable) continue;
        const size = Math.max(9, Math.min(15, r * (node.subject ? 0.9 : 1.2)));
        ctx.font = `${node.subject ? 'bold ' : ''}${Math.round(size)}px monospace`;
        ctx.globalAlpha = 0.45 + 0.55 * near;
        ctx.fillText(node.label, p.x, p.y + r + 3);
      }
      ctx.globalAlpha = 1;
    },
  };
};
