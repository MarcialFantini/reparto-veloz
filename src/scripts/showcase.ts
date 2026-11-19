/**
 * `?showcase`: a hands-free ~30 s tour for recording the portfolio video, without cursor.
 * Entry → order sheet (map, packing) → Flota → Pedidos → Métricas → Incidencias →
 * Depósito with the command palette → back to the entry. Nothing is persisted.
 */
import { navigate } from 'astro:transitions/client';
import { gsap } from 'gsap';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import { ORDERS, SIM_START, findOrder, type Order } from '../data/orders';
import { sim } from '../lib/sim';
import { etaOf, timeOf } from '../lib/status';
import { openPalette } from './commands';

gsap.registerPlugin(ScrollToPlugin);

const ORDER: Order = findOrder('LA-2074') ?? ORDERS[0]!;
const url = (path: string): string => `${path}?showcase`;

/** Drive the simulated clock from `from` to `to` over `seconds`. */
function runClock(tl: gsap.core.Timeline, from: number, to: number, seconds: number, at: number | string): void {
  const proxy = { t: from };
  tl.to(
    proxy,
    {
      t: to,
      duration: seconds,
      ease: 'none',
      onStart: () => sim.set(from),
      onUpdate: () => {
        if (Math.abs(proxy.t - sim.now()) >= 0.25) sim.set(proxy.t);
      },
    },
    at,
  );
}

function scrollTo(tl: gsap.core.Timeline, target: string | number, at: number | string): void {
  tl.add(() => {
    const el = typeof target === 'number' ? target : document.querySelector(target);
    if (el === null) return;
    const offset = window.innerWidth < 720 ? 150 : 120;
    gsap.to(window, { scrollTo: { y: el, offsetY: offset, autoKill: false }, duration: 0.8, ease: 'power2.inOut' });
  }, at);
}

const click = (selector: string): void => {
  document.querySelector<HTMLElement>(selector)?.click();
};

function typeInto(tl: gsap.core.Timeline, selector: string, text: string, at: number): void {
  [...text].forEach((_, i) => {
    tl.add(() => {
      const input = document.querySelector<HTMLInputElement>(selector);
      if (!input) return;
      input.value = text.slice(0, i + 1);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, at + i * 0.09);
  });
}

export function prepareShowcase(page: string): void {
  sim.setPaused(true);
  if (page === 'order') {
    sim.clearOrder(ORDER.id);
    sim.set(timeOf(ORDER, 'despachado') + 2);
  }
  if (page === 'entry') sim.set(SIM_START);
  window.scrollTo(0, 0);
}

export function runShowcase(page: string): () => void {
  const tl = gsap.timeline();

  switch (page) {
    case 'entry': {
      const form = document.querySelector<HTMLFormElement>('[data-lookup]');
      typeInto(tl, '#order-number', ORDER.id, 0.6);
      tl.add(() => form?.requestSubmit(), 1.6);
      break;
    }
    case 'order': {
      const leave = timeOf(ORDER, 'en-camino');
      tl.add(() => sim.set(leave), 1.1);
      scrollTo(tl, '[data-livemap]', 1.6);
      runClock(tl, leave, leave + (etaOf(ORDER) - leave) * 0.7, 3, 1.9);
      scrollTo(tl, '[data-packing]', 5.0);
      tl.add(() => click('[data-pack-all]'), 5.6);
      tl.add(() => void navigate(url('/flota')), 7.6);
      break;
    }
    case 'warehouse':
    case 'fleet':
    case 'metrics':
      tl.add(() => sim.setSpeed(10), 0.2);
      break;
  }

  if (page === 'fleet') {
    tl.add(() => {
      const rows = document.querySelectorAll<HTMLElement>('[data-select]');
      rows[Math.min(2, rows.length - 1)]?.click();
    }, 1.6);
    tl.add(() => void navigate(url('/pedidos')), 4.8);
  }

  if (page === 'orders') {
    typeInto(tl, '[data-filter-q]', 'centro', 0.5);
    tl.add(() => click('[data-orders-body] [data-open]'), 1.8);
    tl.add(() => document.querySelector<HTMLDialogElement>('[data-drawer]')?.close(), 3.6);
    tl.add(() => void navigate(url('/metricas')), 3.9);
  }

  if (page === 'metrics') {
    scrollTo(tl, '.metrics', 0.8);
    tl.add(() => void navigate(url('/incidencias')), 4.2);
  }

  if (page === 'incidents') {
    tl.add(() => click('[data-i-resolve]'), 1.4);
    tl.add(() => void navigate(url('/deposito')), 3.4);
  }

  if (page === 'warehouse') {
    tl.add(() => openPalette(), 2.4);
    typeInto(tl, '[data-palette-input]', 'carla', 2.7);
    tl.add(() => document.querySelector<HTMLDialogElement>('[data-palette]')?.close(), 4.1);
    tl.add(() => void navigate(url('/')), 4.4);
  }

  return () => {
    tl.kill();
    gsap.killTweensOf(window);
    sim.setPaused(true);
  };
}
