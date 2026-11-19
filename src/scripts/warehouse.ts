/**
 * Scene 5 · Warehouse board. Orders move between columns on their own with GSAP Flip
 * while simulated new orders keep arriving. Counters per state follow the clock.
 */
import { gsap } from 'gsap';
import { Flip } from 'gsap/Flip';
import { STATES, type Order, type OrderState } from '../data/orders';
import { cardHtml, cardWhen } from '../lib/card';
import { sim } from '../lib/sim';
import { STATE_META, incidentStatus, ordersAt, stateAt, timeOf } from '../lib/status';
import { reducedMotion } from './motion';
import { toast } from './toasts';

gsap.registerPlugin(Flip);

const DELIVERED_VISIBLE = 6;

export function init(root: HTMLElement): () => void {
  const board = root.querySelector<HTMLElement>('[data-board]');
  if (!board) return () => {};
  const lists = new Map(STATES.map((s) => [s, board.querySelector<HTMLElement>(`[data-col="${s}"]`)!]));
  const colCounts = new Map(STATES.map((s) => [s, board.querySelector<HTMLElement>(`#col-${s} [data-col-count]`)]));
  const counters = new Map(STATES.map((s) => [s, root.querySelector<HTMLElement>(`[data-counter="${s}"] [data-count]`)]));
  const more = board.querySelector<HTMLElement>('[data-more]');
  const known = new Map<string, OrderState>();
  const template = document.createElement('template');

  let now = sim.now();

  function cardFor(order: Order, state: OrderState): HTMLElement {
    let el = board!.querySelector<HTMLElement>(`[data-card="${order.id}"]`);
    if (!el) {
      template.innerHTML = cardHtml(order, state, now);
      el = template.content.firstElementChild as HTMLElement;
    }
    el.dataset.state = state;
    el.classList.toggle('is-stuck', incidentStatus(order, now) === 'open');
    const time = el.querySelector('[data-card-time]');
    const when = cardWhen(order, state, now);
    if (time && time.textContent !== when) time.textContent = when;
    return el;
  }

  const signatures = new Map<OrderState, string>();

  function render(t: number, animate: boolean): void {
    now = t;
    const columns = new Map<OrderState, Order[]>(STATES.map((s) => [s, []]));
    const arrivals: Order[] = [];
    const delivered: Order[] = [];
    for (const o of ordersAt(t)) {
      const s = stateAt(o, t);
      if (!s) continue;
      const prev = known.get(o.id);
      if (animate && prev !== s) {
        if (!prev) arrivals.push(o);
        else if (s === 'entregado') delivered.push(o);
      }
      known.set(o.id, s);
      columns.get(s)!.push(o);
    }

    // Nothing moved since the last tick: skip the DOM work entirely.
    const changedCols = STATES.filter((s) => {
      const sig = columns.get(s)!.map((o) => o.id).join(',');
      if (signatures.get(s) === sig) return false;
      signatures.set(s, sig);
      return true;
    });
    if (!changedCols.length) {
      // Membership is stable: only refresh times and delay flags.
      for (const s of STATES) for (const o of columns.get(s)!) if (s !== 'entregado') cardFor(o, s);
      return;
    }

    // Only cards in columns that changed can move: measure just those.
    const moving = changedCols.flatMap((s) => [...lists.get(s)!.querySelectorAll<HTMLElement>('.kcard')]);
    const flipState = animate && !reducedMotion() && moving.length ? Flip.getState(moving) : null;
    const keep = new Set<HTMLElement>();

    for (const s of STATES) {
      const list = lists.get(s)!;
      const orders = columns.get(s)!.sort((a, b) => timeOf(b, s) - timeOf(a, s));
      const visible = s === 'entregado' ? orders.slice(0, DELIVERED_VISIBLE) : orders;
      visible.forEach((o, i) => {
        const el = cardFor(o, s);
        keep.add(el);
        if (list.children[i] !== el) list.insertBefore(el, list.children[i] ?? null);
      });
      const count = orders.length;
      const counter = counters.get(s);
      if (counter && counter.textContent?.trim() !== String(count)) {
        counter.textContent = String(count);
        if (animate && !reducedMotion()) {
          gsap.fromTo(counter, { yPercent: -70, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.5, ease: 'back.out(2)' });
        }
      }
      const colCount = colCounts.get(s);
      if (colCount) colCount.textContent = String(count);
      if (s === 'entregado' && more) {
        const hidden = count - visible.length;
        more.textContent = hidden > 0 ? `y ${hidden} entregados antes` : '';
      }
    }
    board!.querySelectorAll<HTMLElement>('.kcard').forEach((el) => {
      if (!keep.has(el)) el.remove();
    });

    if (flipState) {
      Flip.from(flipState, {
        targets: changedCols.flatMap((s) => [...lists.get(s)!.querySelectorAll<HTMLElement>('.kcard')]),
        simple: true,
        duration: 0.8,
        ease: 'power3.inOut',
        stagger: 0.02,
        onEnter: (els) => gsap.fromTo(els, { autoAlpha: 0, scale: 0.7 }, { autoAlpha: 1, scale: 1, duration: 0.55, ease: 'back.out(1.8)' }),
      });
    }

    if (arrivals.length + delivered.length > 2) {
      toast(`${arrivals.length} pedidos nuevos y ${delivered.length} entregas en este tramo.`, 'neutral', 'Resumen del depósito');
    } else {
      for (const o of arrivals) toast(`${o.id} · ${o.customer}, ${o.placeName}.`, 'recibido', 'Pedido nuevo');
      for (const o of delivered) toast(`${o.id} llegó a ${o.placeName}.`, 'entregado', STATE_META.entregado.label);
    }
  }

  render(sim.now(), false);
  const unsub = sim.subscribe((t) => render(t, true));

  if (!reducedMotion()) {
    gsap.from(root.querySelectorAll('.counter'), { yPercent: 40, autoAlpha: 0, duration: 0.6, stagger: 0.05, ease: 'power3.out' });
  }

  return () => {
    unsub();
    Flip.killFlipsOf(board.querySelectorAll('.kcard'));
  };
}
