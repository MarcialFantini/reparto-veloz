/**
 * Scene 4 · Order contents. Each product flies into a CSS 3D box; when the last
 * one lands the flaps fold shut and the tape runs across the top.
 */
import { gsap } from 'gsap';
import type { Order, OrderState } from '../../data/orders';
import { sim } from '../../lib/sim';
import { reducedMotion } from '../motion';
import { toast } from '../toasts';

const OPEN = { front: 150, back: 210 };
const SHUT = { front: 270, back: 90 };

export function createPacking(root: HTMLElement, order: Order) {
  const section = root.querySelector<HTMLElement>('[data-packing]');
  if (!section) return null;
  const buttons = [...section.querySelectorAll<HTMLButtonElement>('[data-sku]')];
  const level = section.querySelector<HTMLElement>('[data-box-fill]');
  const front = section.querySelector<HTMLElement>('[data-flap="front"]');
  const back = section.querySelector<HTMLElement>('[data-flap="back"]');
  const tape = section.querySelector<HTMLElement>('[data-tape]');
  const stage = section.querySelector<HTMLElement>('.stage3d');
  const count = section.querySelector<HTMLElement>('[data-pack-count]');
  const packAll = section.querySelector<HTMLButtonElement>('[data-pack-all]');
  const reset = section.querySelector<HTMLButtonElement>('[data-pack-reset]');
  const total = buttons.length;
  const packed = new Set(sim.packed(order.id).filter((sku) => buttons.some((b) => b.dataset.sku === sku)));
  let closed = false;
  let inFlight = 0;

  const levelY = (n: number): number => 48 - (n / total) * 82;

  function paintButton(btn: HTMLButtonElement): void {
    const on = packed.has(btn.dataset.sku ?? '');
    btn.setAttribute('aria-pressed', String(on));
    const label = btn.querySelector('[data-item-state]');
    if (label) label.textContent = on ? 'En la caja' : 'Empacar';
  }

  function paintBox(animate: boolean): void {
    const n = packed.size;
    if (count) count.textContent = String(n);
    const vars = { y: levelY(n), autoAlpha: n ? 1 : 0 };
    if (animate) gsap.to(level, { ...vars, duration: 0.4, ease: 'back.out(2)' });
    else gsap.set(level, vars);
    if (packAll) packAll.disabled = n === total;
    if (n === total && !closed) close(animate);
    if (n < total && closed) open(animate);
  }

  function close(animate: boolean): void {
    closed = true;
    if (!animate) {
      gsap.set(front, { rotationX: SHUT.front });
      gsap.set(back, { rotationX: SHUT.back });
      gsap.set(tape, { scaleY: 1 });
      return;
    }
    gsap
      .timeline({ delay: 0.15 })
      .to(back, { rotationX: SHUT.back, duration: 0.5, ease: 'power2.inOut' })
      .to(front, { rotationX: SHUT.front, duration: 0.5, ease: 'power2.inOut' }, '-=0.25')
      .to(tape, { scaleY: 1, duration: 0.45, ease: 'power3.inOut' })
      .fromTo(stage, { y: 0 }, { y: -6, duration: 0.12, yoyo: true, repeat: 1, ease: 'power1.out' }, '<');
    toast(`La caja del pedido ${order.id} quedó cerrada y lista.`, 'despachado', 'Caja cerrada');
  }

  function open(animate: boolean): void {
    closed = false;
    const d = animate ? 0.4 : 0;
    gsap.to(tape, { scaleY: 0, duration: d });
    gsap.to(front, { rotationX: OPEN.front, duration: d, ease: 'power2.out' });
    gsap.to(back, { rotationX: OPEN.back, duration: d, ease: 'power2.out' });
  }

  function save(): void {
    sim.setPacked(order.id, [...packed]);
  }

  function fly(btn: HTMLButtonElement, delay: number, done: () => void): void {
    const icon = btn.querySelector('svg');
    if (!icon || !stage || reducedMotion()) {
      done();
      return;
    }
    const from = icon.getBoundingClientRect();
    const to = stage.getBoundingClientRect();
    const token = icon.cloneNode(true) as SVGElement;
    token.classList.add('fly-token');
    Object.assign(token.style, { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px` });
    document.body.append(token);
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height * 0.42 - (from.top + from.height / 2);
    inFlight++;
    gsap
      .timeline({
        delay,
        onComplete: () => {
          token.remove();
          inFlight--;
          done();
        },
      })
      .to(token, { x: dx, duration: 0.6, ease: 'power1.inOut' }, 0)
      .to(token, { y: dy - 70, duration: 0.3, ease: 'power2.out' }, 0)
      .to(token, { y: dy, duration: 0.3, ease: 'power2.in' }, 0.3)
      .to(token, { rotation: 200, scale: 0.6, duration: 0.6, ease: 'none' }, 0)
      .to(token, { autoAlpha: 0, duration: 0.12 }, 0.52);
  }

  function pack(btn: HTMLButtonElement, delay = 0): void {
    const sku = btn.dataset.sku ?? '';
    if (packed.has(sku) || closed) return;
    packed.add(sku);
    paintButton(btn);
    save();
    fly(btn, delay, () => paintBox(!reducedMotion()));
  }

  const onClick = (event: Event): void => {
    const btn = event.currentTarget as HTMLButtonElement;
    const sku = btn.dataset.sku ?? '';
    if (packed.has(sku)) {
      if (inFlight) return;
      packed.delete(sku);
      paintButton(btn);
      save();
      paintBox(!reducedMotion());
      return;
    }
    pack(btn);
  };

  const onPackAll = (): void => {
    buttons.filter((b) => !packed.has(b.dataset.sku ?? '')).forEach((b, i) => pack(b, i * 0.14));
  };

  const onReset = (): void => {
    packed.clear();
    buttons.forEach(paintButton);
    save();
    paintBox(!reducedMotion());
  };

  buttons.forEach((b) => {
    paintButton(b);
    b.addEventListener('click', onClick);
  });
  packAll?.addEventListener('click', onPackAll);
  reset?.addEventListener('click', onReset);
  gsap.set(front, { rotationX: OPEN.front });
  gsap.set(back, { rotationX: OPEN.back });
  gsap.set(tape, { scaleY: 0 });
  paintBox(false);

  return {
    update(_state: OrderState, _changed: boolean, _t: number): void {},
    /** Used by the showcase to pack everything on cue. */
    packAll: onPackAll,
    reset: onReset,
    destroy(): void {
      buttons.forEach((b) => b.removeEventListener('click', onClick));
      packAll?.removeEventListener('click', onPackAll);
      reset?.removeEventListener('click', onReset);
      document.querySelectorAll('.fly-token').forEach((t) => t.remove());
    },
  };
}
