/**
 * Scene 1 · Entry. The typed number gets the same view-transition-name as the big
 * number on the order sheet, so it travels to its place during the page transition.
 */
import { navigate } from 'astro:transitions/client';
import { gsap } from 'gsap';
import { findOrder } from '../data/orders';
import { sim } from '../lib/sim';
import { STATE_META, clock, stateAt } from '../lib/status';
import { reducedMotion } from './motion';

export function normalizeOrderId(raw: string): string {
  const clean = raw.trim().toUpperCase().replace(/\s+/g, '');
  const digits = clean.replace(/^LA-?/, '');
  return /^\d{4}$/.test(digits) ? `LA-${digits}` : clean;
}

export function orderUrl(id: string): string {
  return `/pedido/${id}${sim.isShowcase ? '?showcase' : ''}`;
}

export function init(root: HTMLElement): () => void {
  const form = root.querySelector<HTMLFormElement>('[data-lookup]');
  const input = form?.querySelector<HTMLInputElement>('input');
  const error = root.querySelector<HTMLElement>('[data-lookup-error]');
  const samples = [...root.querySelectorAll<HTMLAnchorElement>('[data-sample]')];
  const inlineClock = root.querySelector<HTMLElement>('[data-sim-clock-inline]');

  const paintSamples = (t: number): void => {
    if (inlineClock) inlineClock.textContent = clock(t);
    for (const a of samples) {
      const order = findOrder(a.dataset.sample ?? '');
      const s = order ? stateAt(order, t) : null;
      if (!s || a.dataset.state === s) continue;
      a.dataset.state = s;
      const chip = a.querySelector<HTMLElement>('[data-sample-state]');
      if (chip) chip.textContent = STATE_META[s].label;
    }
  };
  paintSamples(sim.now());
  const unsub = sim.subscribe(paintSamples);

  const onSubmit = (event: SubmitEvent): void => {
    event.preventDefault();
    if (!input || !error) return;
    const id = normalizeOrderId(input.value);
    const order = id ? findOrder(id) : undefined;
    if (!order) {
      error.textContent = id
        ? `No encontramos el pedido ${id}. Probá con uno de la lista de ejemplo.`
        : 'Escribí un número de pedido para continuar.';
      input.setAttribute('aria-invalid', 'true');
      if (!reducedMotion()) gsap.fromTo(input, { x: -10 }, { x: 0, duration: 0.5, ease: 'elastic.out(1, 0.3)' });
      input.focus();
      return;
    }
    error.textContent = '';
    input.value = order.id;
    input.removeAttribute('aria-invalid');
    // Hand the shared name to the input; the sample with the same id must give it up.
    for (const a of samples) {
      const label = a.querySelector<HTMLElement>('.sample__id');
      if (label && a.dataset.sample === order.id) label.style.viewTransitionName = 'none';
    }
    input.style.viewTransitionName = `order-${order.id}`;
    void navigate(orderUrl(order.id));
  };

  const onInput = (): void => {
    if (error) error.textContent = '';
    input?.removeAttribute('aria-invalid');
  };

  const onSampleClick = (event: MouseEvent): void => {
    if (!sim.isShowcase) return;
    const a = event.currentTarget as HTMLAnchorElement;
    event.preventDefault();
    void navigate(orderUrl(a.dataset.sample ?? ''));
  };

  form?.addEventListener('submit', onSubmit);
  input?.addEventListener('input', onInput);
  samples.forEach((a) => a.addEventListener('click', onSampleClick));

  if (!reducedMotion()) {
    gsap.from(root.querySelectorAll('.entry__title span, .entry__lead, .lookup'), {
      y: 28,
      autoAlpha: 0,
      duration: 0.7,
      stagger: 0.08,
      ease: 'power3.out',
    });
    gsap.from(root.querySelectorAll('.journey__step'), {
      yPercent: 100,
      duration: 0.7,
      stagger: 0.06,
      delay: 0.2,
      ease: 'power3.out',
    });
  }

  return () => {
    unsub();
    form?.removeEventListener('submit', onSubmit);
    input?.removeEventListener('input', onInput);
    samples.forEach((a) => a.removeEventListener('click', onSampleClick));
  };
}
