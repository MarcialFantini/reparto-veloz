/**
 * Pedidos: searchable, filterable and sortable table of every order, CSV export,
 * a detail drawer with live actions and a form to create new orders.
 */
import { gsap } from 'gsap';
import { STATES, type Order, type OrderState } from '../../data/orders';
import { getPlace } from '../../data/map';
import { sim } from '../../lib/sim';
import {
  INCIDENT_META,
  STATE_META,
  clock,
  countdown,
  delayAt,
  driverOf,
  etaAt,
  findAnyOrder,
  incidentStatus,
  itemCount,
  ordersAt,
  stateAt,
  stateIndex,
  timeAt,
  timeOf,
} from '../../lib/status';
import { findOrder } from '../../data/orders';
import { reducedMotion } from '../motion';
import { toast } from '../toasts';

type SortKey = 'id' | 'customer' | 'place' | 'driver' | 'state' | 'parcels' | 'received' | 'eta';
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);
const fold = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

interface Row {
  order: Order;
  state: OrderState;
  stuck: boolean;
  eta: number;
}

export function init(root: HTMLElement): () => void {
  const body = root.querySelector<HTMLElement>('[data-orders-body]');
  const summary = root.querySelector<HTMLElement>('[data-orders-summary]');
  const q = root.querySelector<HTMLInputElement>('[data-filter-q]');
  const place = root.querySelector<HTMLSelectElement>('[data-filter-place]');
  const driver = root.querySelector<HTMLSelectElement>('[data-filter-driver]');
  const chips = [...root.querySelectorAll<HTMLButtonElement>('[data-filter-state]')];
  const drawer = root.querySelector<HTMLDialogElement>('[data-drawer]');
  const drawerBody = root.querySelector<HTMLElement>('[data-drawer-body]');
  const newDialog = root.querySelector<HTMLDialogElement>('[data-new-dialog]');
  const newForm = root.querySelector<HTMLFormElement>('[data-new-form]');
  const newError = root.querySelector<HTMLElement>('[data-new-error]');
  const options = root.querySelector<HTMLTemplateElement>('[data-driver-options]');
  if (!body || !drawer || !drawerBody || !newDialog || !newForm) return () => {};

  const params = new URLSearchParams(location.search);
  let stateFilter = params.get('estado') ?? '';
  let sort: SortKey = 'received';
  let dir = -1;
  let rows: Row[] = [];
  let lastMinute = -1;
  let openId: string | null = null;
  const seen = new Set<string>();

  function collect(t: number): Row[] {
    return ordersAt(t).flatMap((order) => {
      const state = stateAt(order, t);
      return state ? [{ order, state, stuck: incidentStatus(order, t) === 'open', eta: etaAt(order, t) }] : [];
    });
  }

  function filtered(all: Row[]): Row[] {
    const term = fold(q?.value.trim() ?? '');
    return all.filter((r) => {
      if (stateFilter === 'incidencia' ? !r.stuck : stateFilter && r.state !== stateFilter) return false;
      if (place?.value && r.order.placeId !== place.value) return false;
      if (driver?.value && driverOf(r.order).id !== driver.value) return false;
      if (!term) return true;
      return fold(`${r.order.id} ${r.order.customer} ${r.order.placeName} ${driverOf(r.order).name}`).includes(term);
    });
  }

  function sorted(list: Row[]): Row[] {
    const key = (r: Row): string | number => {
      switch (sort) {
        case 'id': return r.order.id;
        case 'customer': return r.order.customer;
        case 'place': return r.order.placeName;
        case 'driver': return driverOf(r.order).name;
        case 'state': return stateIndex(r.state);
        case 'parcels': return itemCount(r.order);
        case 'received': return timeOf(r.order, 'recibido');
        case 'eta': return r.eta;
      }
    };
    return [...list].sort((a, b) => {
      const ka = key(a);
      const kb = key(b);
      return (typeof ka === 'number' && typeof kb === 'number' ? ka - kb : String(ka).localeCompare(String(kb), 'es')) * dir;
    });
  }

  function render(t: number): void {
    rows = collect(t);
    const counts: Record<string, number> = { all: rows.length, incidencia: rows.filter((r) => r.stuck).length };
    for (const s of STATES) counts[s] = rows.filter((r) => r.state === s).length;
    for (const [k, v] of Object.entries(counts)) {
      const el = root.querySelector(`[data-chip-count="${k}"]`);
      if (el) el.textContent = String(v);
    }
    const view = sorted(filtered(rows));
    if (summary) summary.textContent = `Mostrando ${view.length} de ${rows.length} pedidos · actualizado a las ${clock(t)}`;
    if (body!.contains(document.activeElement)) return;
    body!.innerHTML = view.length
      ? view
          .map((r) => {
            const o = r.order;
            const fresh = seen.size > 0 && !seen.has(o.id);
            const late = Math.round(delayAt(o, t));
            const etaText = r.state === 'entregado' ? `Entregado ${clock(r.eta)}` : r.stuck ? `Demorado · ${clock(r.eta)}` : `${clock(r.eta)} · ${countdown(r.eta - t)}`;
            return `<tr data-row="${o.id}" class="${fresh ? 'is-new' : ''}${r.stuck ? ' is-stuck-row' : ''}">
<td class="c-id"><button type="button" data-open="${o.id}" aria-label="Ver detalle del pedido ${o.id}">${o.id}</button></td>
<td class="c-customer">${esc(o.customer)}<span class="mobile-meta"> · ${esc(o.placeName)} · ${esc(driverOf(o).name)}</span></td>
<td class="c-place">${esc(o.placeName)}</td>
<td class="c-driver">${esc(driverOf(o).name)}</td>
<td class="c-state"><span class="badge" data-state="${r.state}">${STATE_META[r.state].label}</span>${r.stuck ? ' <span class="badge badge--alert">Incidencia</span>' : ''}</td>
<td class="c-parcels num">${itemCount(o)}</td>
<td class="c-received num">${clock(timeOf(o, 'recibido'))}</td>
<td class="c-eta num"><strong>${etaText}</strong>${late > 0 && r.state !== 'entregado' ? ` <span class="sr-only">con ${late} minutos de demora</span>` : ''}</td>
</tr>`;
          })
          .join('')
      : '<tr><td colspan="8" class="fleet__empty" style="padding:18px">Ningún pedido coincide con los filtros.</td></tr>';
    for (const r of rows) seen.add(r.order.id);
  }

  function drawerHtml(o: Order, t: number): string {
    const state = stateAt(o, t) ?? 'recibido';
    const d = driverOf(o);
    const inc = o.incident;
    const status = incidentStatus(o, t);
    const steps = STATES.map((s) => {
      const done = stateIndex(s) <= stateIndex(state);
      return `<li class="${done ? 'is-done' : ''}${s === state ? ' is-now' : ''}" data-state="${s}"><span>${STATE_META[s].label}</span><span>${done ? '' : 'est. '}${clock(timeAt(o, s, t))}</span></li>`;
    }).join('');
    const items = o.items.map((i) => `<li><span>${esc(i.name)}</span><strong>${i.qty} ${esc(i.unit)}</strong></li>`).join('');
    const incident =
      inc && status !== 'none' && status !== 'upcoming'
        ? `<div class="dbox${status === 'open' ? ' dbox--alert' : ''}"><p class="dbox__title">${INCIDENT_META[inc.kind].label} · ${status === 'open' ? 'abierta' : 'cerrada'}</p>
<p>${INCIDENT_META[inc.kind].detail}</p>${status === 'open' ? `<div class="drawer__actions" style="margin-top:10px"><button type="button" class="btn" data-resolve="resuelta">Marcar resuelta</button>${inc.kind === 'ausente' ? '<button type="button" class="btn btn--ghost" data-resolve="reprogramada">Reprogramar entrega</button>' : ''}</div>` : ''}</div>`
        : '';
    const tracking = findOrder(o.id) ? `<a class="btn btn--ghost" href="/pedido/${o.id}">Vista del cliente</a>` : '';
    return `<div class="drawer__head"><div><p class="eyebrow">${o.manual ? 'Pedido creado en la demo' : 'Pedido'}</p><h2 id="drawer-title" class="display drawer__title">${o.id}</h2></div>
<button type="button" class="iconbtn" data-close aria-label="Cerrar"><svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M5 5l10 10M15 5 5 15" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"></path></svg></button></div>
<p><span class="badge" data-state="${state}">${STATE_META[state].label}</span> <strong>${esc(o.customer)}</strong> · ${esc(o.address)}, ${esc(getPlace(o.placeId).name)}</p>
<div class="dbox"><p class="dbox__title">Llegada ${state === 'entregado' ? 'real' : 'estimada'}: ${clock(etaAt(o, t))}</p><ol class="dsteps">${steps}</ol></div>
${incident}
<div class="dbox"><p class="dbox__title">Chofer: ${esc(d.name)} · ${esc(d.truck)}</p>
<form class="fdetail__reassign" data-reassign style="margin-top:8px"><label class="field">Reasignar<select name="driver">${options?.innerHTML ?? ''}</select></label><button class="btn" type="submit">Reasignar</button></form></div>
<div class="dbox"><p class="dbox__title">${o.items.length} productos · ${itemCount(o)} bultos</p><ul class="dlist">${items}</ul></div>
<div class="drawer__actions">${tracking}<a class="btn btn--ghost" href="/flota?camion=${o.id}">Ver en Flota</a></div>`;
  }

  function openDrawer(id: string): void {
    const o = findAnyOrder(id);
    if (!o) return;
    openId = o.id;
    drawerBody!.innerHTML = drawerHtml(o, sim.now());
    const select = drawerBody!.querySelector<HTMLSelectElement>('select');
    if (select) select.value = driverOf(o).id;
    if (!drawer!.open) drawer!.showModal();
    if (!reducedMotion()) gsap.fromTo(drawerBody, { x: 60, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.35, ease: 'power3.out' });
  }

  function refreshDrawer(t: number): void {
    if (!openId || !drawer!.open || drawerBody!.contains(document.activeElement) && document.activeElement?.tagName === 'SELECT') return;
    const o = findAnyOrder(openId);
    if (!o) return;
    const focusedClose = document.activeElement?.closest('[data-close]');
    drawerBody!.innerHTML = drawerHtml(o, t);
    const select = drawerBody!.querySelector<HTMLSelectElement>('select');
    if (select) select.value = driverOf(o).id;
    if (focusedClose) drawerBody!.querySelector<HTMLElement>('[data-close]')?.focus();
  }

  function exportCsv(): void {
    const t = sim.now();
    const view = sorted(filtered(rows));
    const head = ['Pedido', 'Cliente', 'Dirección', 'Barrio', 'Chofer', 'Camión', 'Estado', 'Incidencia', 'Bultos', 'Recibido', 'Llegada', 'Demora (min)'];
    const lines = view.map((r) => {
      const o = r.order;
      const d = driverOf(o);
      return [o.id, o.customer, o.address, o.placeName, d.name, d.truck, STATE_META[r.state].label, r.stuck ? 'Abierta' : '', itemCount(o), clock(timeOf(o, 'recibido')), clock(r.eta), Math.round(delayAt(o, t))];
    });
    const csv = [head, ...lines].map((cols) => cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `pedidos-logistica-andina-${clock(t).replace(':', '')}.csv`;
    document.body.append(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast(`Exportaste ${view.length} pedidos en CSV.`, 'neutral', 'Exportación lista');
  }

  function paintSort(): void {
    root.querySelectorAll<HTMLButtonElement>('[data-sort]').forEach((b) => {
      const th = b.closest('th');
      if (b.dataset.sort === sort) th?.setAttribute('aria-sort', dir === 1 ? 'ascending' : 'descending');
      else th?.removeAttribute('aria-sort');
    });
  }

  const rerender = (): void => {
    lastMinute = -1;
    render(sim.now());
  };

  const onTick = (t: number): void => {
    const minute = Math.floor(t);
    if (minute === lastMinute) return;
    lastMinute = minute;
    render(t);
    refreshDrawer(t);
  };

  const onRootClick = (e: MouseEvent): void => {
    const el = e.target as HTMLElement;
    const sortBtn = el.closest<HTMLButtonElement>('[data-sort]');
    if (sortBtn) {
      const key = sortBtn.dataset.sort as SortKey;
      dir = key === sort ? -dir : 1;
      sort = key;
      paintSort();
      rerender();
      return;
    }
    const chip = el.closest<HTMLButtonElement>('[data-filter-state]');
    if (chip) {
      stateFilter = chip.dataset.filterState ?? '';
      chips.forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
      rerender();
      return;
    }
    const row = el.closest<HTMLElement>('[data-row]');
    if (row && body!.contains(row)) openDrawer(row.dataset.row ?? '');
    if (el.closest('[data-export]')) exportCsv();
    if (el.closest('[data-new-order]')) openNew();
  };

  const onDrawerClick = (e: MouseEvent): void => {
    const el = e.target as HTMLElement;
    if (e.target === drawer || el.closest('[data-close]')) {
      drawer!.close();
      return;
    }
    const resolve = el.closest<HTMLButtonElement>('[data-resolve]');
    if (resolve && openId) {
      sim.resolve(openId, resolve.dataset.resolve === 'reprogramada' ? 'reprogramada' : 'resuelta');
      toast(`La incidencia de ${openId} quedó cerrada.`, 'entregado', 'Incidencia resuelta');
      refreshDrawer(sim.now());
      rerender();
    }
  };

  const onDrawerSubmit = (e: SubmitEvent): void => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const value = new FormData(form).get('driver');
    if (!openId || typeof value !== 'string') return;
    const o = findAnyOrder(openId);
    if (!o || driverOf(o).id === value) return;
    sim.reassign(openId, value);
    toast(`${openId} ahora lo lleva ${driverOf(o).name}.`, 'en-camino', 'Pedido reasignado');
    refreshDrawer(sim.now());
    rerender();
  };

  function openNew(): void {
    if (newError) newError.textContent = '';
    newDialog!.showModal();
    if (!reducedMotion()) gsap.fromTo(newForm, { x: 60, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.35, ease: 'power3.out' });
  }

  const onNewSubmit = (e: SubmitEvent): void => {
    e.preventDefault();
    const data = new FormData(newForm!);
    const items = data.getAll('sku').map((sku) => ({ sku: String(sku), qty: Math.max(1, Math.min(99, Number(data.get(`qty-${sku}`)) || 1)) }));
    if (!items.length) {
      if (newError) newError.textContent = 'Elegí al menos un producto.';
      return;
    }
    const id = sim.createOrder({ customer: String(data.get('customer')), placeId: String(data.get('place')), items });
    newDialog!.close();
    toast(`${id} entró como Recibido. Ya aparece en el depósito, la tabla y las métricas.`, 'recibido', 'Pedido creado');
    stateFilter = '';
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.filterState === '')));
    if (q) q.value = '';
    rerender();
    openDrawer(id);
  };
  const onNewClick = (e: MouseEvent): void => {
    if (e.target === newDialog || (e.target as HTMLElement).closest('[data-close]')) newDialog!.close();
  };

  root.addEventListener('click', onRootClick);
  q?.addEventListener('input', rerender);
  place?.addEventListener('change', rerender);
  driver?.addEventListener('change', rerender);
  drawer.addEventListener('click', onDrawerClick);
  drawer.addEventListener('submit', onDrawerSubmit);
  drawer.addEventListener('close', () => (openId = null));
  newForm.addEventListener('submit', onNewSubmit);
  newDialog.addEventListener('click', onNewClick);

  chips.forEach((c) => c.setAttribute('aria-pressed', String((c.dataset.filterState ?? '') === stateFilter)));
  paintSort();
  render(sim.now());
  const unsub = sim.subscribe(onTick);
  if (params.has('nuevo')) openNew();
  const want = params.get('pedido');
  if (want) openDrawer(want);

  return () => {
    unsub();
    root.removeEventListener('click', onRootClick);
    if (drawer.open) drawer.close();
    if (newDialog.open) newDialog.close();
  };
}
