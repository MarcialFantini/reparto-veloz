/**
 * Client store: the shared simulated clock plus every user action.
 * One instance survives Astro client-side navigations (module cache), and it is
 * saved to localStorage so a reload keeps the story going. All views subscribe here.
 */
import { SIM_END, SIM_START, type OrderSpec } from '../data/orders';
import { getDriver } from '../data/catalog';
import { createdId, emptyOverrides, findAnyOrder, nextCreatedNumber, useOverrides, type Overrides, type Resolution } from './status';

type Listener = (t: number, prev: number) => void;

const KEY = 'logistica-andina:v3';
const TICK_MS = 250;
export const SPEEDS = [1, 4, 10] as const;
export type Speed = (typeof SPEEDS)[number];

export interface ActionEntry {
  at: number;
  title: string;
  text: string;
  orderId?: string;
}

interface Saved {
  t: number;
  speed: Speed;
  paused: boolean;
  packed: Record<string, string[]>;
  signature: Record<string, string>;
  rating: Record<string, number>;
  overrides: Overrides;
  actions: ActionEntry[];
  /** Simulated minute up to which notifications were read. */
  readAt: number;
}

const empty = (): Saved => ({
  t: SIM_START,
  speed: 1,
  paused: false,
  packed: {},
  signature: {},
  rating: {},
  overrides: emptyOverrides(),
  actions: [],
  readAt: SIM_START,
});

const showcase = typeof location !== 'undefined' && new URLSearchParams(location.search).has('showcase');

function load(): Saved {
  if (showcase || typeof localStorage === 'undefined') return empty();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Partial<Saved>;
    const base = empty();
    return {
      ...base,
      ...parsed,
      overrides: { ...base.overrides, ...(parsed.overrides ?? {}) },
      t: Math.min(Number(parsed.t) || SIM_START, SIM_END),
      speed: SPEEDS.includes(parsed.speed as Speed) ? (parsed.speed as Speed) : 1,
    };
  } catch {
    return empty();
  }
}

const saved = load();
useOverrides(saved.overrides);
let t = saved.t;
let timer: number | undefined;
let persistTimer: number | undefined;
const listeners = new Set<Listener>();
const controlListeners = new Set<() => void>();

function writeNow(): void {
  if (showcase) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...saved, t }));
  } catch {
    /* storage unavailable: the demo keeps working in memory */
  }
}

/** Ticks persist at most once per second; user actions persist immediately. */
function persist(immediate = false): void {
  if (immediate) {
    window.clearTimeout(persistTimer);
    persistTimer = undefined;
    writeNow();
    return;
  }
  if (persistTimer !== undefined) return;
  persistTimer = window.setTimeout(() => {
    persistTimer = undefined;
    writeNow();
  }, 1000);
}

function emit(prev: number): void {
  for (const fn of listeners) fn(t, prev);
}

function controlsChanged(): void {
  for (const fn of controlListeners) fn();
}

function changed(entry?: ActionEntry): void {
  if (entry) saved.actions = [entry, ...saved.actions].slice(0, 60);
  useOverrides(saved.overrides);
  persist(true);
  emit(t);
}

export const sim = {
  now: (): number => t,
  isShowcase: showcase,
  get speed(): Speed {
    return saved.speed;
  },
  get paused(): boolean {
    return saved.paused;
  },
  set(next: number): void {
    const prev = t;
    t = Math.max(0, Math.min(next, SIM_END));
    persist();
    emit(prev);
  },
  advance(minutes: number): void {
    sim.set(t + minutes);
  },
  setSpeed(next: Speed): void {
    saved.speed = next;
    saved.paused = false;
    persist(true);
    controlsChanged();
  },
  setPaused(next: boolean): void {
    saved.paused = next;
    persist(true);
    controlsChanged();
  },
  togglePause(): void {
    sim.setPaused(!saved.paused);
  },
  onControls(fn: () => void): () => void {
    controlListeners.add(fn);
    return () => controlListeners.delete(fn);
  },
  subscribe(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  start(): void {
    if (timer !== undefined) return;
    timer = window.setInterval(() => {
      if (document.hidden || saved.paused || t >= SIM_END) return;
      sim.advance((saved.speed * TICK_MS) / 1000);
    }, TICK_MS);
  },
  reset(): void {
    Object.assign(saved, empty());
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    useOverrides(saved.overrides);
    t = SIM_START;
  },

  /* ---------- Actions (shared everywhere) ---------- */
  actions: (): readonly ActionEntry[] => saved.actions,
  readAt: (): number => saved.readAt,
  markRead(): void {
    saved.readAt = t;
    persist(true);
    controlsChanged();
  },
  createOrder(spec: Omit<OrderSpec, 'id'>): string {
    const n = nextCreatedNumber();
    const id = createdId(n);
    saved.overrides.created.push({ n, receivedAt: Math.floor(t), spec: { ...spec, id } });
    changed({ at: t, title: `Pedido ${id} creado`, text: `${spec.customer} · ${spec.items.length} productos`, orderId: id });
    return id;
  },
  reassign(orderId: string, driverId: string): void {
    saved.overrides.reassigned[orderId] = driverId;
    const order = findAnyOrder(orderId);
    const resolveIncident = order?.incident && order.incident.at <= t && !saved.overrides.resolved[orderId];
    if (resolveIncident) saved.overrides.resolved[orderId] = { at: t, how: 'reasignada', driver: driverId };
    changed({ at: t, title: `${orderId} reasignado`, text: `Ahora lo lleva ${getDriver(driverId).name}`, orderId });
  },
  resolve(orderId: string, how: Resolution): void {
    saved.overrides.resolved[orderId] = { at: t, how };
    changed({ at: t, title: `${orderId} · incidencia ${how}`, text: 'La entrega retoma su recorrido', orderId });
  },

  /** Forget packing, signature and rating of one order (showcase loop). */
  clearOrder(id: string): void {
    delete saved.packed[id];
    delete saved.signature[id];
    delete saved.rating[id];
    persist();
  },
  packed: (id: string): string[] => saved.packed[id] ?? [],
  setPacked(id: string, skus: string[]): void {
    saved.packed[id] = skus;
    persist(true);
  },
  signature: (id: string): string | undefined => saved.signature[id],
  setSignature(id: string, dataUrl: string): void {
    saved.signature[id] = dataUrl;
    changed({ at: t, title: `${id} firmado`, text: 'Recepción confirmada en destino', orderId: id });
  },
  rating: (id: string): number | undefined => saved.rating[id],
  ratings: (): Readonly<Record<string, number>> => saved.rating,
  setRating(id: string, stars: number): void {
    saved.rating[id] = stars;
    changed({ at: t, title: `${id} calificado`, text: `${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}`, orderId: id });
  },
};
