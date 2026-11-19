/**
 * In-app notices: a small card slides down inside the interface (no real push).
 * The container is persisted across navigations, so a notice survives a page change.
 */
import { gsap } from 'gsap';
import type { OrderState } from '../data/orders';
import { reducedMotion } from './motion';

export function toast(message: string, state: OrderState | 'neutral', title?: string): void {
  const host = document.querySelector<HTMLElement>('[data-toasts]');
  if (!host) return;
  let stack = host.querySelector<HTMLElement>('.toasts__stack');
  if (!stack) {
    stack = document.createElement('div');
    stack.className = 'toasts__stack wrap';
    host.append(stack);
  }

  const el = document.createElement('div');
  el.className = 'toast';
  if (state !== 'neutral') el.dataset.state = state;
  const strong = document.createElement('strong');
  strong.textContent = title ?? 'Aviso';
  const text = document.createElement('span');
  text.textContent = message;
  el.append(strong, text);
  stack.prepend(el);

  const max = window.matchMedia('(min-width: 720px)').matches ? 3 : 2;
  while (stack.children.length > max) stack.lastElementChild?.remove();

  const remove = (): void => {
    if (reducedMotion()) {
      el.remove();
      return;
    }
    gsap.to(el, { autoAlpha: 0, y: -16, duration: 0.3, ease: 'power2.in', onComplete: () => el.remove() });
  };

  if (!reducedMotion()) {
    gsap.fromTo(el, { autoAlpha: 0, y: -28, scale: 0.96 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.5, ease: 'back.out(1.6)' });
  }
  window.setTimeout(remove, 3800);
}
