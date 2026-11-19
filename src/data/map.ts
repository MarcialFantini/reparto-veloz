/**
 * Stylized, hand-made street graph of Córdoba. The same geometry draws the map
 * and builds every route, so the truck always runs over a drawn street.
 */
import { createRng } from './random';

export const MAP_SIZE = 400;
const C = 200;
const R_INNER = 44;
const R_MID = 106;
const R_OUTER = 168;

type Dir = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';
const DIRS: readonly { id: Dir; deg: number; avenue: string }[] = [
  { id: 'e', deg: 0, avenue: 'Av. 24 de Septiembre' },
  { id: 'se', deg: 45, avenue: 'Av. Sabattini' },
  { id: 's', deg: 90, avenue: 'Av. Vélez Sarsfield' },
  { id: 'sw', deg: 135, avenue: 'Av. Fuerza Aérea' },
  { id: 'w', deg: 180, avenue: 'Av. Colón' },
  { id: 'nw', deg: 225, avenue: 'Av. Rafael Núñez' },
  { id: 'n', deg: 270, avenue: 'Av. Monseñor P. Cabrera' },
  { id: 'ne', deg: 315, avenue: 'Av. Juan B. Justo' },
];

export interface MapNode {
  id: string;
  x: number;
  y: number;
}

export interface MapEdge {
  a: string;
  b: string;
  /** Arc edges run clockwise from a to b around the map center. */
  arc?: number;
  street: string;
}

const round = (n: number): number => Math.round(n * 10) / 10;
const polar = (r: number, deg: number): { x: number; y: number } => {
  const rad = (deg * Math.PI) / 180;
  return { x: round(C + r * Math.cos(rad)), y: round(C + r * Math.sin(rad)) };
};

const nodes: MapNode[] = [{ id: 'center', x: C, y: C }];
const edges: MapEdge[] = [];

DIRS.forEach((d, i) => {
  nodes.push({ id: `in-${d.id}`, ...polar(R_INNER, d.deg) });
  nodes.push({ id: `mid-${d.id}`, ...polar(R_MID, d.deg) });
  nodes.push({ id: `out-${d.id}`, ...polar(R_OUTER, d.deg) });
  edges.push({ a: 'center', b: `in-${d.id}`, street: d.avenue });
  edges.push({ a: `in-${d.id}`, b: `mid-${d.id}`, street: d.avenue });
  edges.push({ a: `mid-${d.id}`, b: `out-${d.id}`, street: d.avenue });
  const next = DIRS[(i + 1) % DIRS.length]!;
  edges.push({ a: `in-${d.id}`, b: `in-${next.id}`, arc: R_INNER, street: 'Bulevares' });
  edges.push({ a: `out-${d.id}`, b: `out-${next.id}`, arc: R_OUTER, street: 'Av. Circunvalación' });
});

export const DEPOT: MapNode = { id: 'depot', x: 356, y: 356 };
nodes.push(DEPOT);
edges.push({ a: 'depot', b: 'out-se', street: 'Ruta 9' });

export const MAP_NODES: readonly MapNode[] = nodes;
export const MAP_EDGES: readonly MapEdge[] = edges;
const nodeById = new Map(nodes.map((n) => [n.id, n]));
export const getNode = (id: string): MapNode => {
  const n = nodeById.get(id);
  if (!n) throw new Error(`Unknown map node ${id}`);
  return n;
};

export const AVENUES = DIRS.map((d) => ({ id: d.id, name: d.avenue }));

/** Delivery spots: each one sits on a node of the graph. */
export interface Place {
  id: string;
  name: string;
  node: string;
}

export const PLACES: readonly Place[] = [
  { id: 'centro', name: 'Centro', node: 'center' },
  { id: 'alta-cordoba', name: 'Alta Córdoba', node: 'mid-n' },
  { id: 'general-paz', name: 'General Paz', node: 'mid-ne' },
  { id: 'pueyrredon', name: 'Pueyrredón', node: 'mid-e' },
  { id: 'san-vicente', name: 'San Vicente', node: 'mid-se' },
  { id: 'jardin', name: 'Jardín', node: 'mid-s' },
  { id: 'guemes', name: 'Güemes', node: 'mid-sw' },
  { id: 'alberdi', name: 'Alberdi', node: 'mid-w' },
  { id: 'cerro', name: 'Cerro de las Rosas', node: 'mid-nw' },
  { id: 'arguello', name: 'Argüello', node: 'out-nw' },
  { id: 'los-boulevares', name: 'Los Boulevares', node: 'out-n' },
  { id: 'villa-libertador', name: 'Villa El Libertador', node: 'out-sw' },
];
const placeById = new Map(PLACES.map((p) => [p.id, p]));
export const getPlace = (id: string): Place => {
  const p = placeById.get(id);
  if (!p) throw new Error(`Unknown place ${id}`);
  return p;
};

/* ---------- Neighbourhood shapes (simple hand-drawn blobs) ---------- */

function blob(cx: number, cy: number, r: number, seed: number, stretch = 1): string {
  const rng = createRng(seed);
  const count = 7;
  const pts = Array.from({ length: count }, (_, i) => {
    const ang = (i / count) * Math.PI * 2;
    const rr = r * (0.78 + rng.next() * 0.34);
    return { x: cx + Math.cos(ang) * rr * stretch, y: cy + Math.sin(ang) * rr };
  });
  // Closed Catmull-Rom spline converted to cubic Béziers.
  let d = `M${round(pts[0]!.x)} ${round(pts[0]!.y)}`;
  for (let i = 0; i < count; i++) {
    const p0 = pts[(i - 1 + count) % count]!;
    const p1 = pts[i]!;
    const p2 = pts[(i + 1) % count]!;
    const p3 = pts[(i + 2) % count]!;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += `C${round(c1.x)} ${round(c1.y)} ${round(c2.x)} ${round(c2.y)} ${round(p2.x)} ${round(p2.y)}`;
  }
  return `${d}Z`;
}

export interface Hood {
  name: string;
  d: string;
  lx: number;
  ly: number;
}

const hoodAt = (name: string, r: number, deg: number, size: number, seed: number, stretch = 1): Hood => {
  const p = polar(r, deg);
  return { name, d: blob(p.x, p.y, size, seed, stretch), lx: p.x, ly: p.y };
};

export const HOODS: readonly Hood[] = [
  hoodAt('Alta Córdoba', 78, 292, 19, 11, 1.1),
  hoodAt('General Paz', 82, 337, 20, 12),
  hoodAt('Pueyrredón', 136, 22, 18, 13),
  hoodAt('San Vicente', 134, 67, 19, 14),
  hoodAt('Nueva Córdoba', 76, 112, 17, 15),
  hoodAt('Jardín', 140, 112, 17, 16),
  hoodAt('Güemes', 80, 157, 17, 17),
  hoodAt('Alberdi', 80, 202, 19, 18, 1.15),
  hoodAt('Cerro de las Rosas', 136, 247, 19, 19),
  hoodAt('Villa Cabrera', 136, 292, 16, 20),
  hoodAt('Villa El Libertador', 138, 157, 17, 21),
  hoodAt('Alto Alberdi', 138, 202, 15, 22),
];

export const PARK = { name: 'Parque Sarmiento', d: blob(236, 252, 14, 31, 1.2) };
export const RIVER = 'M-10 128C40 120 78 150 112 152S164 140 196 156S250 182 284 166S346 140 410 152';
export const RIVER_NAME = 'Río Suquía';

/* ---------- Routing ---------- */

interface Step {
  edge: MapEdge;
  forward: boolean;
  len: number;
}

function edgeLength(e: MapEdge): number {
  if (e.arc) return e.arc * (Math.PI / 4);
  const a = getNode(e.a);
  const b = getNode(e.b);
  return Math.hypot(b.x - a.x, b.y - a.y);
}

const adjacency = new Map<string, { to: string; step: Step }[]>();
for (const e of edges) {
  const len = edgeLength(e);
  const listA = adjacency.get(e.a) ?? [];
  const listB = adjacency.get(e.b) ?? [];
  listA.push({ to: e.b, step: { edge: e, forward: true, len } });
  listB.push({ to: e.a, step: { edge: e, forward: false, len } });
  adjacency.set(e.a, listA);
  adjacency.set(e.b, listB);
}

function shortestPath(from: string, to: string): Step[] {
  const dist = new Map<string, number>([[from, 0]]);
  const prev = new Map<string, { node: string; step: Step }>();
  const open = new Set<string>([from]);
  while (open.size) {
    let current = '';
    let best = Infinity;
    for (const n of open) {
      const d = dist.get(n) ?? Infinity;
      if (d < best) {
        best = d;
        current = n;
      }
    }
    open.delete(current);
    if (current === to) break;
    for (const link of adjacency.get(current) ?? []) {
      const nd = best + link.step.len;
      if (nd < (dist.get(link.to) ?? Infinity)) {
        dist.set(link.to, nd);
        prev.set(link.to, { node: current, step: link.step });
        open.add(link.to);
      }
    }
  }
  const steps: Step[] = [];
  let cursor = to;
  while (cursor !== from) {
    const p = prev.get(cursor);
    if (!p) break;
    steps.unshift(p.step);
    cursor = p.node;
  }
  return steps;
}

function segment(step: Step): string {
  const target = getNode(step.forward ? step.edge.b : step.edge.a);
  if (step.edge.arc) {
    const r = step.edge.arc;
    return `A${r} ${r} 0 0 ${step.forward ? 1 : 0} ${target.x} ${target.y}`;
  }
  return `L${target.x} ${target.y}`;
}

/** Path string for one edge, used to draw the streets. */
export function edgePath(e: MapEdge): string {
  const a = getNode(e.a);
  return `M${a.x} ${a.y}${segment({ edge: e, forward: true, len: 0 })}`;
}

export interface RouteStop {
  placeId: string;
  name: string;
  x: number;
  y: number;
  /** 0..1 position along the route path. */
  at: number;
}

export interface Route {
  d: string;
  length: number;
  stops: RouteStop[];
}

/** Builds a route from the depot through every stop (the last one is the customer). */
export function buildRoute(placeIds: readonly string[]): Route {
  let d = `M${DEPOT.x} ${DEPOT.y}`;
  let from = DEPOT.id;
  let total = 0;
  const marks: { place: Place; len: number }[] = [];
  for (const id of placeIds) {
    const place = getPlace(id);
    for (const step of shortestPath(from, place.node)) {
      d += segment(step);
      total += step.len;
    }
    marks.push({ place, len: total });
    from = place.node;
  }
  const stops = marks.map(({ place, len }) => {
    const n = getNode(place.node);
    return { placeId: place.id, name: place.name, x: n.x, y: n.y, at: total ? len / total : 1 };
  });
  return { d, length: Math.round(total), stops };
}
