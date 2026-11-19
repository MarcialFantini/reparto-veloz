/**
 * Scene 3 · Live map. The truck rides the route with MotionPathPlugin; the tween is
 * paused and its progress is driven by the simulated clock, so it stays in sync.
 */
import { gsap } from 'gsap';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import type { Order, OrderState } from '../../data/orders';
import { INCIDENT_META, clock, countdown, etaAt, incidentStatus, routeProgress, stateIndex, timeOf } from '../../lib/status';
import { reducedMotion } from '../motion';

gsap.registerPlugin(MotionPathPlugin);

export function createLiveMap(root: HTMLElement, order: Order) {
  const section = root.querySelector<HTMLElement>('[data-livemap]');
  const truck = section?.querySelector<SVGGElement>('[data-truck]');
  const done = section?.querySelector<SVGPathElement>('[data-route-done]');
  if (!section || !truck || !done) return null;

  const status = section.querySelector<HTMLElement>('[data-map-status]');
  const count = section.querySelector<HTMLElement>('[data-map-count]');
  const mapStops = [...section.querySelectorAll<SVGGElement>('[data-map-stop]')];
  const listStops = [...section.querySelectorAll<HTMLElement>('[data-list-stop]')];
  const stops = order.route.stops;
  const leave = timeOf(order, 'en-camino');
  const crossed = new Set<number>();

  const ride = gsap.to(truck, {
    motionPath: { path: done, align: done, alignOrigin: [0.5, 0.5], autoRotate: true },
    duration: 1,
    ease: 'none',
    paused: true,
    onUpdate: () => {
      done.style.strokeDashoffset = String(1 - ride.progress());
    },
  });
  ride.progress(0.0001).progress(0);
  let follow: gsap.core.Tween | null = null;

  const cross = (i: number, animate: boolean): void => {
    if (crossed.has(i)) return;
    crossed.add(i);
    const mark = mapStops[i]?.querySelector('.stop__cross');
    const item = listStops[i];
    const strike = item?.querySelector('.stoplist__strike');
    item?.classList.add('is-done');
    const label = item?.querySelector('[data-stop-status]');
    if (label) label.textContent = i === stops.length - 1 ? 'Entregado' : 'Visitada';
    if (animate) {
      gsap.to(mark ?? [], { strokeDashoffset: 0, duration: 0.4, ease: 'power2.out' });
      gsap.to(strike ?? [], { scaleX: 1, duration: 0.5, ease: 'power3.inOut' });
      gsap.fromTo(mapStops[i] ?? [], { scale: 1.5, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.5, ease: 'back.out(2)' });
    } else {
      gsap.set(mark ?? [], { strokeDashoffset: 0 });
      gsap.set(strike ?? [], { scaleX: 1 });
    }
  };

  let first = true;
  return {
    update(state: OrderState, _changed: boolean, t: number): void {
      const p = routeProgress(order, t);
      const still = reducedMotion() || first;
      follow?.kill();
      if (still) ride.progress(p);
      else follow = gsap.to(ride, { progress: p, duration: 0.3, ease: 'none' });

      stops.forEach((s, i) => {
        const reached = i === stops.length - 1 ? state === 'entregado' : p >= s.at - 0.0005;
        if (reached) cross(i, !still);
      });

      const idx = stateIndex(state);
      const eta = etaAt(order, t);
      const etaEl = section.querySelector<HTMLElement>('[data-map-eta]');
      if (etaEl) etaEl.textContent = clock(eta);
      const open = incidentStatus(order, t) === 'open' ? order.incident : undefined;
      section.classList.toggle('is-stuck', Boolean(open));
      if (status) {
        if (idx < stateIndex('en-camino')) status.textContent = `Sale del depósito a las ${clock(leave)}`;
        else if (open) status.textContent = `Detenido: ${INCIDENT_META[open.kind].label}`;
        else if (state === 'entregado') status.textContent = `Entregado a las ${clock(eta)} en ${order.placeName}`;
        else {
          const next = stops.find((s) => s.at > p + 0.0005) ?? stops[stops.length - 1];
          status.textContent = `En camino hacia ${next?.name ?? order.placeName}`;
        }
      }
      if (count) count.textContent = state === 'entregado' ? 'Entregado' : countdown(eta - t);
      first = false;
    },
    destroy(): void {
      follow?.kill();
      ride.kill();
    },
  };
}
