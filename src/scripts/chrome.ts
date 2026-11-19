/**
 * Shared chrome on every page: live clock and controls, notifications centre
 * with unread badge, open-incident counter in the nav and the reset button.
 */
import { gsap } from 'gsap';
import { findOrder } from '../data/orders';
import { sim, SPEEDS, type Speed } from '../lib/sim';
import { clock, eventsUntil, findAnyOrder, incidentStatus, ordersAt, type FeedEvent } from '../lib/status';
import { reducedMotion } from './motion';
import { toast } from './toasts';

export const orderHref = (id: string): string => (findOrder(id) ? `/pedido/${id}` : `/pedidos?pedido=${id}`);

const NOTIFY_TONES = new Set(['incident', 'resolved', 'entregado']);

export interface NoticeItem {
  key: string;
  at: number;
  title: string;
  text: string;
  tone: string;
  orderId?: string;
}

/** Notifications: incidents, resolutions, deliveries and everything the user did. */
export function notifications(t: number): NoticeItem[] {
  const events = eventsUntil(t).filter((e: FeedEvent) => NOTIFY_TONES.has(e.tone) || (e.tone === 'recibido' && findAnyOrder(e.orderId)?.manual));
  const actions = sim.actions().map((a, i) => ({ key: `act:${i}:${a.at}`, at: a.at, title: a.title, text: a.text, tone: 'action', orderId: a.orderId }));
  return [...actions, ...events].sort((a, b) => b.at - a.at).slice(0, 40);
}

export function noticeHtml(n: NoticeItem, unread = false): string {
  const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);
  const href = n.orderId ? orderHref(n.orderId) : null;
  const body = `<span class="feed__dot" data-tone="${n.tone}" aria-hidden="true"></span>
<span class="feed__body"><span class="feed__title">${esc(n.title)}</span><span class="feed__text">${esc(n.text)}</span></span>
<time class="feed__time">${clock(n.at)}</time>`;
  return `<li class="feed__item${unread ? ' is-unread' : ''}" data-key="${esc(n.key)}">${href ? `<a class="feed__link" href="${href}">${body}</a>` : `<div class="feed__link">${body}</div>`}</li>`;
}

export function bindChrome(): () => void {
  const clockEl = document.querySelector<HTMLElement>('[data-sim-clock]');
  const pill = document.querySelector<HTMLElement>('[data-live-pill]');
  const pillLabel = document.querySelector<HTMLElement>('[data-live-label]');
  const pause = document.querySelector<HTMLButtonElement>('[data-pause]');
  const speeds = [...document.querySelectorAll<HTMLButtonElement>('[data-speed]')];
  const advance = document.querySelector<HTMLButtonElement>('[data-advance]');
  const reset = document.querySelector<HTMLButtonElement>('[data-reset]');
  const bell = document.querySelector<HTMLButtonElement>('[data-bell]');
  const badge = document.querySelector<HTMLElement>('[data-bell-badge]');
  const panel = document.querySelector<HTMLElement>('[data-notif-panel]');
  const list = document.querySelector<HTMLElement>('[data-notif-list]');
  const markRead = document.querySelector<HTMLButtonElement>('[data-mark-read]');
  const incidentCount = document.querySelector<HTMLElement>('[data-incident-count]');
  let lastMinute = -1;
  let lastUnread = -1;

  const paintControls = (): void => {
    const paused = sim.paused;
    pill?.classList.toggle('is-paused', paused);
    if (pillLabel) pillLabel.textContent = paused ? 'Pausa' : 'En vivo';
    if (pause) {
      pause.setAttribute('aria-pressed', String(paused));
      pause.setAttribute('aria-label', paused ? 'Reanudar la simulación' : 'Pausar la simulación');
      pause.querySelector('[data-icon-pause]')?.toggleAttribute('hidden', paused);
      pause.querySelector('[data-icon-play]')?.toggleAttribute('hidden', !paused);
    }
    for (const b of speeds) b.setAttribute('aria-pressed', String(!paused && Number(b.dataset.speed) === sim.speed));
    paintNotices(sim.now(), true);
  };

  function paintNotices(t: number, force = false): void {
    const minute = Math.floor(t);
    if (!force && minute === lastMinute) return;
    lastMinute = minute;
    const items = notifications(t);
    const unread = items.filter((n) => n.at > sim.readAt()).length;
    if (badge) {
      badge.hidden = unread === 0;
      badge.textContent = unread > 99 ? '99+' : String(unread);
      if (unread > lastUnread && lastUnread >= 0 && !reducedMotion()) {
        gsap.fromTo(badge, { scale: 1.6 }, { scale: 1, duration: 0.4, ease: 'back.out(3)' });
      }
    }
    bell?.setAttribute('aria-label', unread ? `Notificaciones, ${unread} sin leer` : 'Notificaciones');
    lastUnread = unread;
    if (list && panel && !panel.hidden) {
      list.innerHTML = items.length
        ? items.map((n) => noticeHtml(n, n.at > sim.readAt())).join('')
        : '<li class="feed__empty">Todavía no hay notificaciones.</li>';
    }
    if (incidentCount) {
      const open = ordersAt(t).filter((o) => incidentStatus(o, t) === 'open').length;
      incidentCount.hidden = open === 0;
      incidentCount.textContent = String(open);
    }
  }

  const render = (t: number): void => {
    if (clockEl) clockEl.textContent = clock(t);
    paintNotices(t);
  };
  render(sim.now());
  paintControls();
  const unsub = sim.subscribe(render);
  const unControls = sim.onControls(paintControls);

  const onPause = (): void => sim.togglePause();
  const onSpeed = (e: Event): void => sim.setSpeed(Number((e.currentTarget as HTMLElement).dataset.speed) as Speed);
  const onAdvance = (): void => {
    sim.advance(60);
    toast('La simulación avanzó una hora. Todas las vistas se actualizaron.', 'neutral', 'Adelantaste 1 hora');
  };
  const onReset = (): void => {
    sim.reset();
    location.reload();
  };

  const closePanel = (): void => {
    if (!panel || panel.hidden) return;
    panel.hidden = true;
    bell?.setAttribute('aria-expanded', 'false');
  };
  const onBell = (): void => {
    if (!panel) return;
    const open = panel.hidden;
    panel.hidden = !open;
    bell?.setAttribute('aria-expanded', String(open));
    if (open) {
      paintNotices(sim.now(), true);
      if (!reducedMotion()) gsap.fromTo(panel, { y: -8, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.25, ease: 'power2.out' });
      markRead?.focus();
    }
  };
  const onMarkRead = (): void => {
    sim.markRead();
    lastUnread = 0;
  };
  const onDocClick = (e: MouseEvent): void => {
    const target = e.target as Node;
    if (panel && !panel.hidden && !panel.contains(target) && !bell?.contains(target)) closePanel();
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && panel && !panel.hidden) {
      closePanel();
      bell?.focus();
    }
  };

  pause?.addEventListener('click', onPause);
  speeds.forEach((b) => b.addEventListener('click', onSpeed));
  advance?.addEventListener('click', onAdvance);
  reset?.addEventListener('click', onReset);
  bell?.addEventListener('click', onBell);
  markRead?.addEventListener('click', onMarkRead);
  document.addEventListener('click', onDocClick);
  document.addEventListener('keydown', onKey);

  return () => {
    unsub();
    unControls();
    pause?.removeEventListener('click', onPause);
    speeds.forEach((b) => b.removeEventListener('click', onSpeed));
    advance?.removeEventListener('click', onAdvance);
    reset?.removeEventListener('click', onReset);
    bell?.removeEventListener('click', onBell);
    markRead?.removeEventListener('click', onMarkRead);
    document.removeEventListener('click', onDocClick);
    document.removeEventListener('keydown', onKey);
  };
}

export { SPEEDS };

/** Live activity panel (present on the ops views). */
export function bindActivity(): () => void {
  const list = document.querySelector<HTMLElement>('[data-activity]');
  if (!list) return () => {};
  const limit = Number(list.dataset.limit ?? 14);
  let lastMinute = -1;
  let known = new Set<string>();

  const render = (t: number, force = false): void => {
    const minute = Math.floor(t);
    if (!force && minute === lastMinute) return;
    lastMinute = minute;
    const actions = sim.actions().map((a, i) => ({ key: `act:${i}:${a.at}`, at: a.at, title: a.title, text: a.text, tone: 'action', orderId: a.orderId }));
    const items = [...actions, ...eventsUntil(t)].sort((a, b) => b.at - a.at).slice(0, limit);
    const fresh = known.size ? items.filter((n) => !known.has(n.key)).map((n) => n.key) : [];
    known = new Set(items.map((n) => n.key));
    list.innerHTML = items.map((n) => noticeHtml(n)).join('');
    if (fresh.length && !reducedMotion()) {
      const els = fresh.map((k) => list.querySelector(`[data-key="${CSS.escape(k)}"]`)).filter(Boolean);
      gsap.fromTo(els, { x: -18, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.45, stagger: 0.05, ease: 'power3.out' });
    }
  };
  render(sim.now(), true);
  return sim.subscribe((t) => render(t));
}
