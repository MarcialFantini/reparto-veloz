/** Repartidores: live status and today's numbers per driver. */
import { gsap } from 'gsap';
import { DRIVERS } from '../../data/catalog';
import type { Order } from '../../data/orders';
import { sim } from '../../lib/sim';
import { STATE_META, clock, driverOf, etaAt, incidentStatus, isOnTime, itemCount, ordersAt, stateAt, stateIndex } from '../../lib/status';
import { orderHref } from '../chrome';
import { reducedMotion } from '../motion';

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);
const pct = (n: number): string => `${Math.round(n)}%`;
const dec = (n: number): string => n.toFixed(1).replace('.', ',');

export function init(root: HTMLElement): () => void {
  const cards = new Map(DRIVERS.map((d) => [d.id, root.querySelector<HTMLElement>(`[data-driver="${d.id}"]`)]));
  let lastMinute = -1;
  let first = true;

  const setText = (el: Element | null | undefined, value: string): void => {
    if (!el || el.textContent === value) return;
    el.textContent = value;
    if (!first && !reducedMotion()) gsap.fromTo(el, { yPercent: -30, autoAlpha: 0.2 }, { yPercent: 0, autoAlpha: 1, duration: 0.35 });
  };

  function render(t: number): void {
    const all = ordersAt(t);
    const ratings = sim.ratings();
    const byDriver = new Map<string, Order[]>(DRIVERS.map((d) => [d.id, []]));
    for (const o of all) byDriver.get(driverOf(o).id)?.push(o);
    let route = 0;
    let free = 0;
    let doneAll = 0;
    let onTimeAll = 0;
    const firstHour = 8;
    const hours = Math.max(1, Math.floor(t / 60) - firstHour + 1);

    DRIVERS.forEach((d, i) => {
      const card = cards.get(d.id);
      if (!card) return;
      const mine = byDriver.get(d.id) ?? [];
      const states = mine.map((o) => ({ o, s: stateAt(o, t) }));
      const delivered = states.filter((x) => x.s === 'entregado').map((x) => x.o);
      const onRoad = states.filter((x) => x.s === 'en-camino').map((x) => x.o);
      const stuck = onRoad.filter((o) => incidentStatus(o, t) === 'open');
      const loading = states.filter((x) => x.s === 'despachado').map((x) => x.o);
      const onTime = delivered.filter(isOnTime).length;
      doneAll += delivered.length;
      onTimeAll += onTime;
      if (onRoad.length) route++;
      else free++;

      const status = stuck.length ? ['Detenido', 'badge--alert'] : onRoad.length ? ['En ruta', ''] : loading.length ? ['Cargando', ''] : ['Disponible', 'badge--ok'];
      const badge = card.querySelector<HTMLElement>('[data-d-status]');
      if (badge) {
        badge.textContent = status[0]!;
        badge.className = `badge ${status[1]}`;
        if (status[0] === 'En ruta') badge.dataset.state = 'en-camino';
        else if (status[0] === 'Cargando') badge.dataset.state = 'despachado';
        else delete badge.dataset.state;
      }

      setText(card.querySelector('[data-d="done"]'), String(delivered.length));
      setText(card.querySelector('[data-d="ontime"]'), delivered.length ? pct((onTime / delivered.length) * 100) : '–');
      setText(card.querySelector('[data-d="parcels"]'), String(delivered.reduce((n, o) => n + itemCount(o), 0)));
      const given = mine.map((o) => ratings[o.id]).filter((r): r is number => typeof r === 'number');
      const base = 4.4 + ((i * 37) % 6) / 10;
      const rating = given.length ? (base * 4 + given.reduce((a, b) => a + b, 0)) / (4 + given.length) : base;
      setText(card.querySelector('[data-d="rating"]'), dec(rating));

      const bars = card.querySelector<HTMLElement>('[data-d-bars]');
      if (bars) {
        const counts = Array.from({ length: Math.min(hours, 12) }, (_, k) => {
          const hour = firstHour + Math.max(0, hours - 12) + k;
          return delivered.filter((o) => Math.floor(etaAt(o, t) / 60) === hour).length;
        });
        const max = Math.max(1, ...counts);
        if (bars.children.length !== counts.length) bars.innerHTML = counts.map(() => '<span></span>').join('');
        [...bars.children].forEach((b, k) => ((b as HTMLElement).style.transform = `scaleY(${Math.max(0.04, counts[k]! / max)})`));
      }

      const now = card.querySelector<HTMLElement>('[data-d-now]');
      const current = onRoad[0];
      if (now) {
        now.textContent = current
          ? `${stuck.length ? 'Detenido con' : 'Llevando'} ${current.id} a ${current.placeName} · llega ${clock(etaAt(current, t))}`
          : loading[0]
            ? `Cargando ${loading[0].id} en el depósito`
            : 'Disponible en el depósito de Ruta 9';
      }
      const queue = card.querySelector<HTMLElement>('[data-d-queue]');
      if (queue && !queue.contains(document.activeElement)) {
        const next = states
          .filter((x) => x.s && x.s !== 'entregado')
          .sort((a, b) => stateIndex(b.s!) - stateIndex(a.s!))
          .slice(0, 3);
        queue.innerHTML = next
          .map((x) => `<li><a href="${orderHref(x.o.id)}"><span><strong>${x.o.id}</strong> · ${esc(x.o.placeName)}</span><span>${STATE_META[x.s!].label}</span></a></li>`)
          .join('');
      }
    });

    setText(root.querySelector('[data-dkpi="route"]'), String(route));
    setText(root.querySelector('[data-dkpi="free"]'), String(free));
    setText(root.querySelector('[data-dkpi="done"]'), String(doneAll));
    setText(root.querySelector('[data-dkpi="ontime"]'), doneAll ? pct((onTimeAll / doneAll) * 100) : '–');
    first = false;
  }

  const onTick = (t: number): void => {
    const minute = Math.floor(t);
    if (minute === lastMinute) return;
    lastMinute = minute;
    render(t);
  };
  onTick(sim.now());
  const unsub = sim.subscribe(onTick);

  const focus = new URLSearchParams(location.search).get('chofer');
  const card = focus ? cards.get(focus) : null;
  if (card) {
    card.classList.add('is-focus');
    card.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' });
  }

  return unsub;
}
