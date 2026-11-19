/**
 * Order sheet orchestrator: one clock subscription drives every scene,
 * so "Adelantar 1 hora" moves hero, timeline, map and notices together.
 */
import { gsap } from 'gsap';
import { findOrder, type Order, type OrderState } from '../data/orders';
import { sim } from '../lib/sim';
import { INCIDENT_META, STATE_META, clock, countdown, delayAt, driverOf, etaAt, incidentStatus, stateAt } from '../lib/status';
import { reducedMotion } from './motion';
import { toast } from './toasts';
import { createTimeline } from './scenes/timeline';
import { createLiveMap } from './scenes/livemap';
import { createPacking } from './scenes/packing';
import { createReceipt } from './scenes/receipt';

interface Scene {
  update(state: OrderState, changed: boolean, t: number): void;
  destroy(): void;
}

function createHero(root: HTMLElement, order: Order): Scene {
  const wipe = root.querySelector<HTMLElement>('[data-hero-wipe]');
  const label = root.querySelector<HTMLElement>('[data-state-label]');
  const etaLabel = root.querySelector<HTMLElement>('[data-eta-label]');
  const etaTime = root.querySelector<HTMLElement>('[data-eta-time]');
  const etaCount = root.querySelector<HTMLElement>('[data-eta-count]');

  const driverName = root.querySelector<HTMLElement>('[data-driver-name]');
  const driverTruck = root.querySelector<HTMLElement>('[data-driver-truck]');

  const paint = (state: OrderState): void => {
    document.body.dataset.state = state;
    if (label) label.textContent = STATE_META[state].label;
  };

  return {
    update(state, changed, t) {
      const delivered = state === 'entregado';
      const eta = etaAt(order, t);
      const open = incidentStatus(order, t) === 'open' && order.incident;
      const late = Math.round(delayAt(order, t));
      if (etaLabel) etaLabel.textContent = delivered ? 'Entregado a las' : open ? 'Nueva estimación' : 'Llegada estimada';
      if (etaTime) etaTime.textContent = clock(eta);
      if (etaCount) {
        etaCount.textContent = delivered
          ? 'Firmá la recepción más abajo'
          : open
            ? `${INCIDENT_META[open.kind].label} · +${late} min`
            : `${countdown(eta - t)}${late > 0 ? ` · con ${late} min de demora` : ''}`;
      }
      const driver = driverOf(order);
      if (driverName && driverName.textContent !== driver.name) driverName.textContent = driver.name;
      if (driverTruck && driverTruck.textContent !== driver.truck) driverTruck.textContent = driver.truck;
      if (!changed || !wipe || reducedMotion()) {
        paint(state);
        return;
      }
      wipe.style.background = `var(--st-${state})`;
      gsap
        .timeline()
        .fromTo(wipe, { scaleY: 0 }, { scaleY: 1, duration: 0.55, ease: 'power3.inOut' })
        .add(() => paint(state))
        .set(wipe, { scaleY: 0 })
        .fromTo(label, { yPercent: 60, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.45, ease: 'power3.out' });
    },
    destroy() {
      gsap.killTweensOf(wipe);
    },
  };
}

export function init(root: HTMLElement): () => void {
  const host = root.querySelector<HTMLElement>('[data-order]');
  const order = findOrder(host?.dataset.order ?? '');
  if (!host || !order) return () => {};

  const scenes: Scene[] = [createHero(host, order)];
  const timeline = createTimeline(host);
  if (timeline) scenes.push({ update: (s, c) => timeline.update(s, c), destroy: timeline.destroy });
  for (const make of [createLiveMap, createPacking, createReceipt]) {
    const scene = make(host, order);
    if (scene) scenes.push(scene);
  }

  let last: OrderState = stateAt(order, sim.now()) ?? 'recibido';
  for (const s of scenes) s.update(last, false, sim.now());

  const unsub = sim.subscribe((t) => {
    const state = stateAt(order, t) ?? 'recibido';
    const changed = state !== last;
    if (changed) {
      toast(`Pedido ${order.id}: ${STATE_META[state].notice}.`, state, STATE_META[state].label);
    }
    last = state;
    for (const s of scenes) s.update(state, changed, t);
  });

  return () => {
    unsub();
    for (const s of scenes) s.destroy();
  };
}
