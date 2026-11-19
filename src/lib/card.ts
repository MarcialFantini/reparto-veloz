/** Kanban card markup, shared by the server render and the client (new orders). */
import { findOrder, type Order, type OrderState } from '../data/orders';
import { clock, driverOf, etaAt, incidentStatus, itemCount } from './status';

const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);

export function cardHtml(order: Order, state: OrderState, t: number): string {
  const linked = Boolean(findOrder(order.id));
  const tag = linked ? 'a' : 'div';
  const href = linked ? ` href="/pedido/${order.id}"` : '';
  const when = cardWhen(order, state, t);
  return `<${tag} class="kcard" data-card="${order.id}" data-flip-id="${order.id}" data-state="${state}"${href}>
<span class="kcard__id display">${order.id}</span>
<span class="kcard__customer">${esc(order.customer)}</span>
<span class="kcard__meta">${esc(order.placeName)} · ${itemCount(order)} bultos · ${esc(driverOf(order).name.split(' ')[0] ?? '')}</span>
<span class="kcard__time" data-card-time>${when}</span>
</${tag}>`;
}

export function cardWhen(order: Order, state: OrderState, t: number): string {
  if (state === 'entregado') return `Entregado ${clock(etaAt(order, t))}`;
  if (incidentStatus(order, t) === 'open') return `Demorado · ${clock(etaAt(order, t))}`;
  return `Llega ${clock(etaAt(order, t))}`;
}
