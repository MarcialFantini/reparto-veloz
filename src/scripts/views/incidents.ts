/** Incidencias: open exceptions with live timers and actions, plus today's history. */
import { gsap } from 'gsap';
import type { Order } from '../../data/orders';
import { sim } from '../../lib/sim';
import {
  AUTO_RESOLVE,
  INCIDENT_META,
  clock,
  delayAt,
  driverOf,
  etaAt,
  incidentEnd,
  incidentStatus,
  itemCount,
  ordersAt,
} from '../../lib/status';
import { orderHref } from '../chrome';
import { reducedMotion } from '../motion';
import { toast } from '../toasts';

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);

export function init(root: HTMLElement): () => void {
  const openList = root.querySelector<HTMLElement>('[data-open-list]');
  const closedList = root.querySelector<HTMLElement>('[data-closed-list]');
  const options = root.querySelector<HTMLTemplateElement>('[data-driver-options]');
  if (!openList || !closedList) return () => {};
  let lastMinute = -1;
  let openIds = '';

  function cardHtml(o: Order, t: number): string {
    const inc = o.incident!;
    const d = driverOf(o);
    const elapsed = Math.floor(t - inc.at);
    return `<li class="panel icard" data-incident="${o.id}">
<div class="icard__head"><a class="icard__id display" href="${orderHref(o.id)}">${o.id}</a><span class="icard__kind">${INCIDENT_META[inc.kind].label}</span></div>
<p>${INCIDENT_META[inc.kind].detail} ${esc(o.customer)} · ${esc(o.placeName)} · ${itemCount(o)} bultos. Chofer: <strong>${esc(d.name)}</strong> (${esc(d.truck)}).</p>
<dl class="icard__facts"><div><dt>Abierta hace</dt><dd data-i-elapsed>${elapsed} min</dd></div><div><dt>Demora</dt><dd data-i-delay>+${Math.round(delayAt(o, t))} min</dd></div><div><dt>Nueva llegada</dt><dd data-i-eta>${clock(etaAt(o, t))}</dd></div></dl>
<div class="icard__timer" title="Tiempo hasta el cierre automático"><span data-i-timer style="transform: scaleX(${Math.min(1, elapsed / AUTO_RESOLVE).toFixed(3)})"></span></div>
<form class="icard__actions" data-i-reassign><label class="field">Reasignar a otro chofer<select name="driver">${options?.innerHTML ?? ''}</select></label><button class="btn" type="submit">Reasignar</button></form>
<div class="icard__actions"><button type="button" class="btn btn--ghost" data-i-resolve="resuelta">Marcar resuelta</button>${inc.kind === 'ausente' ? '<button type="button" class="btn btn--ghost" data-i-resolve="reprogramada">Reprogramar entrega</button>' : ''}</div>
</li>`;
  }

  function render(t: number): void {
    const all = ordersAt(t).filter((o) => o.incident);
    const open = all.filter((o) => incidentStatus(o, t) === 'open').sort((a, b) => a.incident!.at - b.incident!.at);
    const closed = all.filter((o) => incidentStatus(o, t) === 'resolved').sort((a, b) => incidentEnd(b) - incidentEnd(a));
    const ids = open.map((o) => o.id).join(',');

    if (ids !== openIds && !openList!.contains(document.activeElement)) {
      const before = new Set(openIds.split(',').filter(Boolean));
      openIds = ids;
      openList!.innerHTML = open.length
        ? open.map((o) => cardHtml(o, t)).join('')
        : '<li class="icards__empty">Sin incidencias abiertas. Todo el reparto avanza normal.</li>';
      open.forEach((o) => {
        const sel = openList!.querySelector<HTMLSelectElement>(`[data-incident="${o.id}"] select`);
        if (sel) {
          const alt = [...sel.options].find((op) => op.value !== driverOf(o).id);
          sel.value = alt?.value ?? driverOf(o).id;
        }
      });
      const fresh = open.filter((o) => !before.has(o.id)).map((o) => openList!.querySelector(`[data-incident="${o.id}"]`));
      if (before.size && fresh.length && !reducedMotion()) gsap.from(fresh, { x: -30, autoAlpha: 0, duration: 0.5, ease: 'power3.out' });
    } else {
      for (const o of open) {
        const card = openList!.querySelector(`[data-incident="${o.id}"]`);
        if (!card) continue;
        const elapsed = Math.floor(t - o.incident!.at);
        const set = (sel: string, v: string): void => {
          const el = card.querySelector(sel);
          if (el && el.textContent !== v) el.textContent = v;
        };
        set('[data-i-elapsed]', `${elapsed} min`);
        set('[data-i-delay]', `+${Math.round(delayAt(o, t))} min`);
        set('[data-i-eta]', clock(etaAt(o, t)));
        const timer = card.querySelector<HTMLElement>('[data-i-timer]');
        if (timer) timer.style.transform = `scaleX(${Math.min(1, elapsed / AUTO_RESOLVE).toFixed(3)})`;
      }
    }

    const team = closed.filter((o) => incidentEnd(o) - o.incident!.at < AUTO_RESOLVE).length;
    closedList!.innerHTML = closed.length
      ? closed
          .slice(0, 12)
          .map((o) => {
            const by = incidentEnd(o) - o.incident!.at < AUTO_RESOLVE ? 'Resuelta por el equipo' : 'Cerrada por el centro de control';
            return `<li class="feed__item"><a class="feed__link" href="${orderHref(o.id)}"><span class="feed__dot" data-tone="resolved"></span><span class="feed__body"><span class="feed__title">${o.id} · ${INCIDENT_META[o.incident!.kind].label}</span><span class="feed__text">${by} · ${Math.round(incidentEnd(o) - o.incident!.at)} min de demora</span></span><time class="feed__time">${clock(incidentEnd(o))}</time></a></li>`;
          })
          .join('')
      : '<li class="feed__empty">Todavía no se cerró ninguna incidencia.</li>';

    const minutes = all.reduce((n, o) => n + Math.round(delayAt(o, t)), 0);
    const kpi = (k: string, v: string): void => {
      const el = root.querySelector(`[data-ikpi="${k}"]`);
      if (el) el.textContent = v;
    };
    kpi('open', String(open.length));
    kpi('closed', String(closed.length));
    kpi('minutes', String(minutes));
    kpi('team', String(team));
  }

  const onTick = (t: number): void => {
    const minute = Math.floor(t);
    if (minute === lastMinute) return;
    lastMinute = minute;
    render(t);
  };

  const removeCard = (id: string): void => {
    openIds = '';
    const card = openList.querySelector(`[data-incident="${id}"]`);
    const done = (): void => {
      lastMinute = -1;
      onTick(sim.now());
    };
    (document.activeElement as HTMLElement | null)?.blur();
    if (card && !reducedMotion()) gsap.to(card, { x: 40, autoAlpha: 0, height: 0, duration: 0.4, ease: 'power2.in', onComplete: done });
    else done();
  };

  const onClick = (e: MouseEvent): void => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-i-resolve]');
    const card = btn?.closest<HTMLElement>('[data-incident]');
    if (!btn || !card) return;
    const id = card.dataset.incident ?? '';
    sim.resolve(id, btn.dataset.iResolve === 'reprogramada' ? 'reprogramada' : 'resuelta');
    toast(`${id} retoma su recorrido. La nueva hora de llegada ya se ve en todas las vistas.`, 'entregado', 'Incidencia resuelta');
    removeCard(id);
  };
  const onSubmit = (e: SubmitEvent): void => {
    const form = (e.target as HTMLElement).closest<HTMLFormElement>('[data-i-reassign]');
    const card = form?.closest<HTMLElement>('[data-incident]');
    if (!form || !card) return;
    e.preventDefault();
    const id = card.dataset.incident ?? '';
    const driver = String(new FormData(form).get('driver') ?? '');
    sim.reassign(id, driver);
    toast(`${id} pasó a otro chofer y la incidencia quedó cerrada.`, 'en-camino', 'Pedido reasignado');
    removeCard(id);
  };

  openList.addEventListener('click', onClick);
  openList.addEventListener('submit', onSubmit);
  onTick(sim.now());
  const unsub = sim.subscribe(onTick);
  return () => {
    unsub();
    openList.removeEventListener('click', onClick);
    openList.removeEventListener('submit', onSubmit);
  };
}
