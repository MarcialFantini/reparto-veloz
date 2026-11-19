/**
 * Flota: every truck on the road moves on the shared map at once.
 * Positions come from the same route geometry and clock as the client view.
 */
import { gsap } from 'gsap';
import type { Order } from '../../data/orders';
import { sim } from '../../lib/sim';
import {
  INCIDENT_META,
  clock,
  countdown,
  driverOf,
  etaAt,
  incidentStatus,
  itemCount,
  ordersAt,
  routeProgress,
  stateAt,
} from '../../lib/status';
import { orderHref } from '../chrome';
import { reducedMotion } from '../motion';
import { toast } from '../toasts';

const SVG = 'http://www.w3.org/2000/svg';
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);

interface Truck {
  order: Order;
  g: SVGGElement;
  body: SVGGElement;
  path: SVGPathElement;
  length: number;
}

export function init(root: HTMLElement): () => void {
  const routesLayer = root.querySelector<SVGGElement>('[data-fleet-routes]');
  const stopsLayer = root.querySelector<SVGGElement>('[data-fleet-stops]');
  const trucksLayer = root.querySelector<SVGGElement>('[data-fleet-trucks]');
  const list = root.querySelector<HTMLElement>('[data-fleet-list]');
  const detail = root.querySelector<HTMLElement>('[data-fleet-detail]');
  const count = root.querySelector<HTMLElement>('[data-fleet-count]');
  const options = root.querySelector<HTMLTemplateElement>('[data-driver-options]');
  if (!routesLayer || !stopsLayer || !trucksLayer || !list || !detail) return () => {};

  const trucks = new Map<string, Truck>();
  let selected = new URLSearchParams(location.search).get('camion');
  let lastMinute = -1;
  let first = true;

  function makeTruck(order: Order): Truck {
    const path = document.createElementNS(SVG, 'path');
    path.setAttribute('d', order.route.d);
    path.setAttribute('class', 'froute');
    routesLayer!.append(path);

    const g = document.createElementNS(SVG, 'g');
    g.setAttribute('class', 'ftruck');
    g.setAttribute('tabindex', '0');
    g.setAttribute('role', 'button');
    g.dataset.id = order.id;
    g.innerHTML = `<circle class="ftruck__halo" r="17"></circle>
<g class="ftruck__body"><circle class="ftruck__bg" r="11"></circle>
<rect class="ftruck__cargo" x="-7" y="-4" width="9" height="8" rx="1.5"></rect>
<rect class="ftruck__cab" x="2.5" y="-3.5" width="4.5" height="7" rx="1.5"></rect></g>
<g class="ftruck__tag" transform="translate(0 -19)"><rect x="-12" y="-7" width="24" height="12" rx="6"></rect><text y="2">${esc(driverOf(order).initials)}</text></g>`;
    trucksLayer!.append(g);
    const body = g.querySelector<SVGGElement>('.ftruck__body')!;
    const truck = { order, g, body, path, length: path.getTotalLength() };
    if (!reducedMotion() && !first) gsap.from(g, { scale: 0, transformOrigin: '50% 50%', duration: 0.5, ease: 'back.out(2)' });
    return truck;
  }

  function place(truck: Truck, t: number, animate: boolean): void {
    const p = routeProgress(truck.order, t);
    const at = truck.path.getPointAtLength(p * truck.length);
    const ahead = truck.path.getPointAtLength(Math.min(truck.length, p * truck.length + 2));
    const behind = truck.path.getPointAtLength(Math.max(0, p * truck.length - 2));
    const angle = (Math.atan2(ahead.y - behind.y, ahead.x - behind.x) * 180) / Math.PI;
    const stuck = incidentStatus(truck.order, t) === 'open';
    truck.g.classList.toggle('is-stuck', stuck);
    const label = `${driverOf(truck.order).name}, pedido ${truck.order.id} hacia ${truck.order.placeName}${stuck ? ', detenido' : ''}`;
    if (truck.g.getAttribute('aria-label') !== label) truck.g.setAttribute('aria-label', label);
    if (animate) {
      gsap.to(truck.g, { x: at.x, y: at.y, duration: 0.26, ease: 'none', overwrite: 'auto' });
      gsap.to(truck.body, { rotation: `${angle}_short`, duration: 0.26, ease: 'none', overwrite: 'auto' });
    } else {
      gsap.set(truck.g, { x: at.x, y: at.y });
      gsap.set(truck.body, { rotation: angle });
    }
  }

  function drawStops(order: Order | undefined, t: number): void {
    stopsLayer!.innerHTML = '';
    if (!order) return;
    const p = routeProgress(order, t);
    order.route.stops.forEach((s, i) => {
      const last = i === order.route.stops.length - 1;
      const g = document.createElementNS(SVG, 'g');
      g.setAttribute('class', `fstop${last ? ' is-final' : ''}`);
      g.setAttribute('transform', `translate(${s.x} ${s.y})`);
      g.innerHTML = `<circle r="${last ? 9 : 7.5}"></circle><text y="3.5">${last ? '★' : i + 1}</text>${!last && p >= s.at ? '<path d="M-6 -6 6 6M6 -6-6 6" stroke="#16130f" stroke-width="2.5" stroke-linecap="round"></path>' : ''}`;
      stopsLayer!.append(g);
    });
  }

  function renderDetail(t: number): void {
    const truck = selected ? trucks.get(selected) : undefined;
    if (!truck) {
      detail!.innerHTML = '<p class="fleet__empty">Elegí un camión en el mapa o en la lista para ver su detalle.</p>';
      return;
    }
    const o = truck.order;
    const d = driverOf(o);
    const p = routeProgress(o, t);
    const stuck = incidentStatus(o, t) === 'open' && o.incident;
    const eta = etaAt(o, t);
    const stops = o.route.stops
      .map((s, i) => {
        const last = i === o.route.stops.length - 1;
        const done = last ? false : p >= s.at;
        return `<li class="${done ? 'is-done' : ''}"><span>${last ? `★ ${esc(o.customer)}` : `Parada ${i + 1}`} · ${esc(s.name)}</span><span>${done ? 'Visitada' : last ? clock(eta) : 'Pendiente'}</span></li>`;
      })
      .join('');
    const items = o.items.map((it) => `<li><span>${esc(it.name)}</span><strong>${it.qty} ${esc(it.unit)}</strong></li>`).join('');
    detail!.innerHTML = `<div class="fdetail">
<div class="fdetail__who"><span class="avatar">${esc(d.initials)}</span><div><p class="fdetail__name">${esc(d.name)}</p><p class="fdetail__meta">${esc(d.truck)} · ${esc(d.vehicle)} · zona ${esc(d.zone)}</p></div></div>
<div class="fdetail__eta${stuck ? ' is-stuck' : ''}"><span><strong>${o.id}</strong><br>${stuck ? esc(INCIDENT_META[stuck.kind].label) : countdown(eta - t)}</span><span class="display">${clock(eta)}</span></div>
<div><p class="fdetail__section">Próximas paradas · ${Math.round(p * 100)} % del recorrido</p><ol class="fdetail__stops">${stops}</ol></div>
<div><p class="fdetail__section">Carga · ${itemCount(o)} bultos</p><ul class="fdetail__items">${items}</ul></div>
<form class="fdetail__reassign" data-reassign><label class="field">Reasignar a otro chofer<select name="driver">${options?.innerHTML ?? ''}</select></label><button class="btn" type="submit">Reasignar</button></form>
<div class="fdetail__actions"><a class="btn btn--ghost" href="${orderHref(o.id)}">Ver seguimiento</a>${stuck ? '<button class="btn" type="button" data-resolve>Marcar resuelta</button>' : ''}</div>
</div>`;
    const select = detail!.querySelector<HTMLSelectElement>('select');
    if (select) select.value = d.id;
  }

  function renderList(t: number, active: Order[]): void {
    if (count) count.textContent = String(active.length);
    list!.innerHTML = active.length
      ? active
          .map((o) => {
            const d = driverOf(o);
            const stuck = incidentStatus(o, t) === 'open';
            const p = routeProgress(o, t);
            return `<li><button type="button" class="trow${stuck ? ' is-stuck' : ''}" data-select="${o.id}" aria-pressed="${o.id === selected}">
<span class="avatar">${esc(d.initials)}</span>
<span class="trow__main"><span class="trow__name">${esc(d.name)} · ${o.id}</span><span class="trow__sub">${stuck ? 'Detenido · ' : ''}${esc(o.placeName)} · ${itemCount(o)} bultos</span></span>
<span class="trow__eta">${clock(etaAt(o, t))}</span>
<span class="trow__bar" aria-hidden="true"><span style="transform: scaleX(${p.toFixed(3)})"></span></span></button></li>`;
          })
          .join('')
      : '<li class="fleet__empty">No hay camiones en ruta en este momento.</li>';
  }

  function kpis(t: number, active: Order[], all: Order[]): void {
    const set = (k: string, v: number): void => {
      const el = root.querySelector<HTMLElement>(`[data-kpi="${k}"]`);
      if (el && el.textContent !== String(v)) {
        el.textContent = String(v);
        if (!first && !reducedMotion()) gsap.fromTo(el, { yPercent: -40, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.4, ease: 'back.out(2)' });
      }
    };
    set('active', active.length);
    set('stuck', active.filter((o) => incidentStatus(o, t) === 'open').length);
    set('parcels', active.reduce((n, o) => n + itemCount(o), 0));
    set('waiting', all.filter((o) => stateAt(o, t) === 'despachado').length);
  }

  function select(id: string | null): void {
    selected = id;
    for (const tr of trucks.values()) {
      const on = tr.order.id === id;
      tr.g.classList.toggle('is-selected', on);
      tr.path.classList.toggle('is-selected', on);
      if (on) tr.g.parentNode?.append(tr.g);
    }
    const t = sim.now();
    drawStops(id ? trucks.get(id)?.order : undefined, t);
    renderDetail(t);
    list!.querySelectorAll<HTMLElement>('[data-select]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.select === id)));
  }

  function update(t: number): void {
    const all = ordersAt(t);
    const active = all.filter((o) => stateAt(o, t) === 'en-camino');
    const ids = new Set(active.map((o) => o.id));
    for (const [id, tr] of trucks) {
      if (ids.has(id)) continue;
      tr.path.remove();
      if (reducedMotion()) tr.g.remove();
      else gsap.to(tr.g, { scale: 0, autoAlpha: 0, transformOrigin: '50% 50%', duration: 0.35, onComplete: () => tr.g.remove() });
      trucks.delete(id);
      if (selected === id) {
        selected = null;
        drawStops(undefined, t);
      }
    }
    for (const o of active) {
      let tr = trucks.get(o.id);
      const fresh = !tr;
      if (!tr) {
        tr = makeTruck(o);
        trucks.set(o.id, tr);
      }
      place(tr, t, !first && !fresh && !reducedMotion());
    }
    const minute = Math.floor(t);
    if (minute !== lastMinute || first) {
      lastMinute = minute;
      const focusInDetail = detail!.contains(document.activeElement);
      if (selected && !trucks.has(selected)) selected = null;
      if (!selected && !focusInDetail && active[0]) {
        selected = active[0].id;
        if (!first) select(selected);
      }
      // Never rebuild a panel the user is interacting with.
      const focus = document.activeElement;
      if (!list!.contains(focus)) renderList(t, active);
      kpis(t, active, all);
      if (first) select(selected);
      else {
        drawStops(selected ? trucks.get(selected)?.order : undefined, t);
        if (!detail!.contains(focus)) renderDetail(t);
      }
    }
    first = false;
  }

  const onPick = (e: Event): void => {
    const target = e.target as Element;
    const truck = target.closest<SVGGElement>('.ftruck');
    const row = target.closest<HTMLElement>('[data-select]');
    const id = truck?.dataset.id ?? row?.dataset.select;
    if (id) select(id);
  };
  const onKey = (e: KeyboardEvent): void => {
    if ((e.key === 'Enter' || e.key === ' ') && (e.target as Element).closest('.ftruck')) {
      e.preventDefault();
      onPick(e);
    }
  };
  const onSubmit = (e: SubmitEvent): void => {
    const form = (e.target as HTMLElement).closest<HTMLFormElement>('[data-reassign]');
    if (!form || !selected) return;
    e.preventDefault();
    const driver = new FormData(form).get('driver');
    if (typeof driver !== 'string' || driver === trucks.get(selected)?.order.driver) return;
    sim.reassign(selected, driver);
    toast(`${selected} ahora lo lleva otro chofer. Todas las vistas se actualizaron.`, 'en-camino', 'Pedido reasignado');
    trucks.get(selected)?.g.querySelector('.ftruck__tag text')?.replaceChildren(driverOf(trucks.get(selected)!.order).initials);
    renderDetail(sim.now());
  };
  const onClick = (e: MouseEvent): void => {
    if ((e.target as Element).closest('[data-resolve]') && selected) {
      sim.resolve(selected, 'resuelta');
      toast(`La incidencia de ${selected} quedó resuelta. El camión retoma la ruta.`, 'entregado', 'Incidencia resuelta');
    }
  };

  root.querySelector('[data-fleet-svg]')?.addEventListener('click', onPick);
  root.querySelector('[data-fleet-svg]')?.addEventListener('keydown', onKey as EventListener);
  list.addEventListener('click', onPick);
  detail.addEventListener('submit', onSubmit);
  detail.addEventListener('click', onClick);

  update(sim.now());
  const unsub = sim.subscribe((t) => update(t));

  return () => {
    unsub();
    for (const tr of trucks.values()) gsap.killTweensOf([tr.g, tr.body]);
    list.removeEventListener('click', onPick);
    detail.removeEventListener('submit', onSubmit);
    detail.removeEventListener('click', onClick);
  };
}
