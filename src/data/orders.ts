/**
 * 30 seeded orders for Logística Andina. Everything is derived from SEED, so the
 * build output and every browser see exactly the same orders, times and routes.
 * Times are minutes since 00:00 of the simulated day.
 */
import { CUSTOMERS, DRIVERS, PRODUCTS, type ItemShape } from './catalog';
import { PLACES, buildRoute, type Route } from './map';
import { SEED, createRng } from './random';

export const STATES = ['recibido', 'preparando', 'despachado', 'en-camino', 'entregado'] as const;
export type OrderState = (typeof STATES)[number];

export interface OrderItem {
  sku: string;
  name: string;
  unit: string;
  shape: ItemShape;
  qty: number;
}

export interface StateEvent {
  state: OrderState;
  at: number;
}

export type IncidentKind = 'demora' | 'ausente' | 'averia';

/** A seeded problem on the road: the truck stops at `at` until it is resolved. */
export interface SeededIncident {
  kind: IncidentKind;
  at: number;
}

/** Fields a person can choose when creating an order by hand. */
export interface OrderSpec {
  id: string;
  customer: string;
  placeId: string;
  items: { sku: string; qty: number }[];
}

export interface Order {
  id: string;
  customer: string;
  placeId: string;
  placeName: string;
  address: string;
  items: OrderItem[];
  history: StateEvent[];
  route: Route;
  /** Driver id (see DRIVERS). It can be reassigned at runtime. */
  driver: string;
  incident?: SeededIncident;
  /** True for orders created by hand in the demo. */
  manual?: boolean;
}

/** Simulated clock starts at 10:00 and the base orders arrive between 07:30 and 10:00. */
export const SIM_START = 10 * 60;
export const SIM_END = 21 * 60;
export const ORDER_COUNT = 30;
/** Minutes per map unit while driving, and minutes spent at each stop. */
const DRIVE_PER_UNIT = 0.11;
export const STOP_DWELL = 4;

const STREETS = ['Bv. San Juan', 'Duarte Quirós', 'Obispo Trejo', 'Caseros', 'Santa Rosa', 'Av. Olmos', 'Jacinto Ríos', 'Rodríguez Peña'];

export function makeOrder(index: number, receivedAt: number, spec?: OrderSpec): Order {
  const rng = createRng(SEED + index * 7919);
  const seededPlace = PLACES[(index * 5 + rng.int(0, 3)) % PLACES.length]!;
  const place = (spec && PLACES.find((p) => p.id === spec.placeId)) || seededPlace;
  const others = rng.shuffle(PLACES.filter((p) => p.id !== place.id)).slice(0, rng.int(0, 2));
  const route = buildRoute([...others.map((p) => p.id), place.id]);

  const products = rng.shuffle(PRODUCTS).slice(0, rng.int(3, 6));
  const seededItems = products.map((p) => ({ ...p, qty: rng.int(1, 12) }));
  const items = spec
    ? spec.items.flatMap(({ sku, qty }) => {
        const p = PRODUCTS.find((x) => x.sku === sku);
        return p ? [{ ...p, qty }] : [];
      })
    : seededItems;

  const preparando = receivedAt + rng.int(4, 10);
  const despachado = preparando + rng.int(14, 30);
  const enCamino = despachado + rng.int(5, 12);
  const drive = Math.round(route.length * DRIVE_PER_UNIT);
  const entregado = enCamino + drive + others.length * STOP_DWELL;

  const id = spec?.id ?? `LA-${2040 + index * 3 + rng.int(0, 2)}`;
  const customer = spec?.customer ?? CUSTOMERS[(index + rng.int(0, 4)) % CUSTOMERS.length]!;
  const address = `${rng.pick(STREETS)} ${rng.int(2, 38) * 50}`;
  const driver = rng.pick(DRIVERS).id;

  let incident: SeededIncident | undefined;
  if (!spec && index % 7 === 3) incident = { kind: 'demora', at: Math.round(enCamino + (entregado - enCamino) * 0.45) };
  else if (!spec && index % 11 === 5) incident = { kind: 'ausente', at: entregado - 1 };
  else if (!spec && index % 17 === 8) incident = { kind: 'averia', at: Math.round(enCamino + (entregado - enCamino) * 0.3) };

  return {
    id,
    customer,
    placeId: place.id,
    placeName: place.name,
    address,
    items,
    history: [
      { state: 'recibido', at: receivedAt },
      { state: 'preparando', at: preparando },
      { state: 'despachado', at: despachado },
      { state: 'en-camino', at: enCamino },
      { state: 'entregado', at: entregado },
    ],
    route,
    driver,
    ...(incident ? { incident } : {}),
    ...(spec ? { manual: true } : {}),
  };
}

const arrivalRng = createRng(SEED);
export const ORDERS: readonly Order[] = Array.from({ length: ORDER_COUNT }, (_, i) =>
  makeOrder(i, 7 * 60 + 30 + i * 5 + arrivalRng.int(0, 3)),
);

/** Simulated new orders that keep arriving at the warehouse after the clock starts. */
const incoming = new Map<number, Order>();
export function incomingOrder(n: number): Order {
  let order = incoming.get(n);
  if (!order) {
    order = makeOrder(ORDER_COUNT + n, SIM_START + 6 + n * 9);
    incoming.set(n, order);
  }
  return order;
}

export const MAX_INCOMING = 80;

const byId = new Map(ORDERS.map((o) => [o.id, o]));
/** Base orders only: the ones with a static tracking page. */
export const findOrder = (id: string): Order | undefined => byId.get(id.trim().toUpperCase());
