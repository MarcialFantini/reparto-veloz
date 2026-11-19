/**
 * Order model on top of the seeded data. Everything is a pure function of the
 * simulated minute `t` plus a small set of user overrides (created orders,
 * reassigned drivers, resolved incidents), so every view derives the same truth.
 */
import { getDriver, type Driver } from '../data/catalog';
import {
  MAX_INCOMING,
  ORDERS,
  ORDER_COUNT,
  SIM_START,
  STATES,
  STOP_DWELL,
  findOrder,
  incomingOrder,
  makeOrder,
  type IncidentKind,
  type Order,
  type OrderSpec,
  type OrderState,
} from '../data/orders';

export interface StateMeta {
  label: string;
  short: string;
  /** Sentence used by the in-app notices. */
  notice: string;
}

export const STATE_META: Record<OrderState, StateMeta> = {
  recibido: { label: 'Recibido', short: 'Recibido', notice: 'recibimos tu pedido' },
  preparando: { label: 'Preparando', short: 'Preparando', notice: 'estamos armando tu pedido' },
  despachado: { label: 'Despachado', short: 'Despachado', notice: 'tu pedido salió del depósito' },
  'en-camino': { label: 'En camino', short: 'En camino', notice: 'tu pedido está en camino' },
  entregado: { label: 'Entregado', short: 'Entregado', notice: 'tu pedido fue entregado' },
};

export const INCIDENT_META: Record<IncidentKind, { label: string; detail: string }> = {
  demora: { label: 'Demora en ruta', detail: 'Corte de tránsito en la ruta. El camión está detenido.' },
  ausente: { label: 'Cliente ausente', detail: 'Nadie recibe en destino. La entrega quedó en espera.' },
  averia: { label: 'Falla del vehículo', detail: 'El camión reportó una falla y necesita otro chofer.' },
};

/** Minutes after which the control centre closes an incident on its own. */
export const AUTO_RESOLVE = 40;
/** Tolerance over the promised time that still counts as on time. */
export const ON_TIME_TOLERANCE = 10;

export type Resolution = 'resuelta' | 'reasignada' | 'reprogramada';

export interface Overrides {
  created: { n: number; receivedAt: number; spec: OrderSpec }[];
  reassigned: Record<string, string>;
  resolved: Record<string, { at: number; how: Resolution; driver?: string }>;
}

export const emptyOverrides = (): Overrides => ({ created: [], reassigned: {}, resolved: {} });

let OV: Overrides = emptyOverrides();
let version = 0;
const createdCache = new Map<string, Order>();

/** Installs the overrides every function below reads (the client store calls this). */
export function useOverrides(next: Overrides): void {
  OV = next;
  version++;
}
export const overridesVersion = (): number => version;

export const stateIndex = (s: OrderState): number => STATES.indexOf(s);
export const timeOf = (order: Order, s: OrderState): number => order.history[stateIndex(s)]!.at;
/** Promised delivery time (before any incident). */
export const etaOf = (order: Order): number => timeOf(order, 'entregado');

/* ---------- Incidents ---------- */

export function incidentEnd(order: Order): number {
  const inc = order.incident;
  if (!inc) return -Infinity;
  return OV.resolved[order.id]?.at ?? inc.at + AUTO_RESOLVE;
}

export type IncidentStatus = 'none' | 'upcoming' | 'open' | 'resolved';
export function incidentStatus(order: Order, t: number): IncidentStatus {
  const inc = order.incident;
  if (!inc) return 'none';
  if (t < inc.at) return 'upcoming';
  return t < incidentEnd(order) ? 'open' : 'resolved';
}

/** Order-local time: it stands still while an incident is open. */
export function orderTime(order: Order, t: number): number {
  const inc = order.incident;
  if (!inc || t <= inc.at) return t;
  const end = incidentEnd(order);
  return t < end ? inc.at : t - (end - inc.at);
}

/** Minutes the order is running late at minute t. */
export function delayAt(order: Order, t: number): number {
  return t - orderTime(order, t);
}

/** Effective time of a base timestamp, once the incident (if any) is known. */
function effective(order: Order, at: number): number {
  const inc = order.incident;
  if (!inc || at <= inc.at) return at;
  return at + (incidentEnd(order) - inc.at);
}

/* ---------- State and progress ---------- */

/** Current state at simulated minute t, or null if the order does not exist yet. */
export function stateAt(order: Order, t: number): OrderState | null {
  const local = orderTime(order, t);
  let current: OrderState | null = null;
  for (const ev of order.history) if (ev.at <= local) current = ev.state;
  return current;
}

/** Arrival estimate as known at minute t (it slips while an incident is open). */
export function etaAt(order: Order, t: number): number {
  return etaOf(order) + delayAt(order, t);
}

/** When a state happened (or is expected), as known at minute t. */
export function timeAt(order: Order, s: OrderState, t: number): number {
  const base = timeOf(order, s);
  const inc = order.incident;
  if (!inc || base <= inc.at) return base;
  return base + delayAt(order, Math.max(t, inc.at));
}

/** 0..1 progress of the truck along its route at minute t, pausing at each stop. */
export function routeProgress(order: Order, t: number): number {
  const local = orderTime(order, t);
  const start = timeOf(order, 'en-camino');
  const end = etaOf(order);
  if (local <= start) return 0;
  if (local >= end) return 1;
  const stops = order.route.stops;
  const drive = end - start - (stops.length - 1) * STOP_DWELL;
  const keys: [number, number][] = [[start, 0]];
  stops.slice(0, -1).forEach((s, k) => {
    const arrive = start + s.at * drive + k * STOP_DWELL;
    keys.push([arrive, s.at], [arrive + STOP_DWELL, s.at]);
  });
  keys.push([end, 1]);
  for (let i = 1; i < keys.length; i++) {
    const [t1, p1] = keys[i]!;
    const [t0, p0] = keys[i - 1]!;
    if (local <= t1) return t1 === t0 ? p1 : p0 + ((local - t0) / (t1 - t0)) * (p1 - p0);
  }
  return 1;
}

export const driverOf = (order: Order): Driver => getDriver(OV.reassigned[order.id] ?? order.driver);

export function isOnTime(order: Order): boolean {
  return effective(order, etaOf(order)) <= etaOf(order) + ON_TIME_TOLERANCE;
}

/* ---------- Order collections ---------- */

function createdOrder(c: Overrides['created'][number]): Order {
  let o = createdCache.get(c.spec.id);
  if (!o) {
    o = makeOrder(1000 + c.n, c.receivedAt, c.spec);
    createdCache.set(c.spec.id, o);
  }
  return o;
}

/** Every order that exists at minute t: seeded, simulated arrivals and hand-made. */
export function ordersAt(t: number): Order[] {
  const list: Order[] = [...ORDERS];
  for (let n = 0; n < MAX_INCOMING; n++) {
    const o = incomingOrder(n);
    if (o.history[0]!.at > t) break;
    list.push(o);
  }
  for (const c of OV.created) if (c.receivedAt <= t) list.push(createdOrder(c));
  return list;
}

export function findAnyOrder(id: string): Order | undefined {
  const key = id.trim().toUpperCase();
  const base = findOrder(key);
  if (base) return base;
  for (const c of OV.created) if (c.spec.id === key) return createdOrder(c);
  for (let n = 0; n < MAX_INCOMING; n++) if (incomingOrder(n).id === key) return incomingOrder(n);
  return undefined;
}

export const nextCreatedNumber = (): number => OV.created.length;
export const createdId = (n: number): string => `LA-${5001 + n}`;

/* ---------- Events (activity feed and notifications) ---------- */

export type EventTone = OrderState | 'incident' | 'resolved';
export interface FeedEvent {
  key: string;
  at: number;
  orderId: string;
  tone: EventTone;
  title: string;
  text: string;
}

let eventCache: { minute: number; version: number; list: FeedEvent[] } | null = null;

/** All events that happened up to minute t, newest first. Cached per minute. */
export function eventsUntil(t: number): FeedEvent[] {
  const minute = Math.floor(t);
  if (eventCache && eventCache.minute === minute && eventCache.version === version) return eventCache.list;
  const list: FeedEvent[] = [];
  for (const o of ordersAt(minute)) {
    const driver = driverOf(o).name.split(' ')[0];
    for (const ev of o.history) {
      const at = effective(o, ev.at);
      if (at > minute) continue;
      const text =
        ev.state === 'recibido'
          ? `${o.customer} · ${o.placeName}`
          : ev.state === 'en-camino'
            ? `${driver} salió hacia ${o.placeName}`
            : ev.state === 'entregado'
              ? `Entregado a ${o.customer}`
              : ev.state === 'despachado'
                ? `Cargado en el camión de ${driver}`
                : `Armando ${o.items.length} productos`;
      list.push({ key: `${o.id}:${ev.state}`, at, orderId: o.id, tone: ev.state, title: `${o.id} · ${STATE_META[ev.state].label}`, text });
    }
    const inc = o.incident;
    if (inc && inc.at <= minute) {
      list.push({ key: `${o.id}:inc`, at: inc.at, orderId: o.id, tone: 'incident', title: `${o.id} · ${INCIDENT_META[inc.kind].label}`, text: INCIDENT_META[inc.kind].detail });
      const end = incidentEnd(o);
      if (end <= minute) {
        const r = OV.resolved[o.id];
        const how = r ? `${r.how === 'reasignada' ? 'Reasignada' : r.how === 'reprogramada' ? 'Reprogramada' : 'Resuelta'} por el equipo` : 'Resuelta por el centro de control';
        list.push({ key: `${o.id}:res`, at: end, orderId: o.id, tone: 'resolved', title: `${o.id} · Incidencia cerrada`, text: how });
      }
    }
  }
  list.sort((a, b) => b.at - a.at || a.key.localeCompare(b.key));
  eventCache = { minute, version, list };
  return list;
}

/* ---------- Metrics ---------- */

export interface Metrics {
  delivered: number;
  onTimePct: number;
  avgMinutes: number;
  perHour: { hour: number; count: number; late: number }[];
  byState: Record<OrderState, number>;
  openIncidents: number;
  activeTrucks: number;
  total: number;
}

export function metricsAt(t: number): Metrics {
  const byState = Object.fromEntries(STATES.map((s) => [s, 0])) as Record<OrderState, number>;
  const firstHour = 7;
  const lastHour = Math.max(firstHour, Math.floor(t / 60));
  const perHour = Array.from({ length: lastHour - firstHour + 1 }, (_, i) => ({ hour: firstHour + i, count: 0, late: 0 }));
  let delivered = 0;
  let onTime = 0;
  let sum = 0;
  let open = 0;
  let total = 0;
  for (const o of ordersAt(t)) {
    const s = stateAt(o, t);
    if (!s) continue;
    total++;
    byState[s]++;
    if (incidentStatus(o, t) === 'open') open++;
    if (s === 'entregado') {
      delivered++;
      const at = effective(o, etaOf(o));
      const ok = isOnTime(o);
      if (ok) onTime++;
      sum += at - timeOf(o, 'recibido');
      const bucket = perHour[Math.floor(at / 60) - firstHour];
      if (bucket) {
        bucket.count++;
        if (!ok) bucket.late++;
      }
    }
  }
  return {
    delivered,
    onTimePct: delivered ? (onTime / delivered) * 100 : 100,
    avgMinutes: delivered ? sum / delivered : 0,
    perHour,
    byState,
    openIncidents: open,
    activeTrucks: byState['en-camino'],
    total,
  };
}

/* ---------- Formatting ---------- */

export function clock(t: number): string {
  const m = ((Math.floor(t) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function countdown(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m === 0) return 'llegando';
  if (m < 60) return `en ${m} min`;
  return `en ${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
}

export const itemCount = (order: Order): number => order.items.reduce((sum, i) => sum + i.qty, 0);

export { SIM_START, ORDER_COUNT };
