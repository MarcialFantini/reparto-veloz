/**
 * Delivery receipt: signature on a canvas (finger or mouse) and a star rating
 * with a closing animation. Unlocks when the order is delivered.
 */
import { gsap } from 'gsap';
import type { Order, OrderState } from '../../data/orders';
import { sim } from '../../lib/sim';
import { etaAt } from '../../lib/status';
import { reducedMotion } from '../motion';
import { toast } from '../toasts';

interface Point {
  x: number;
  y: number;
}

/** A loose hand-written scribble, in 0..1 pad coordinates, for "Firmar por mí". */
const AUTO_SIGNATURE: Point[][] = [
  [
    { x: 0.08, y: 0.62 }, { x: 0.12, y: 0.3 }, { x: 0.16, y: 0.62 }, { x: 0.2, y: 0.32 }, { x: 0.24, y: 0.6 },
    { x: 0.3, y: 0.48 }, { x: 0.36, y: 0.58 }, { x: 0.4, y: 0.42 }, { x: 0.44, y: 0.6 }, { x: 0.5, y: 0.36 },
    { x: 0.53, y: 0.62 }, { x: 0.58, y: 0.46 }, { x: 0.63, y: 0.6 }, { x: 0.68, y: 0.4 }, { x: 0.72, y: 0.58 },
    { x: 0.8, y: 0.5 }, { x: 0.9, y: 0.44 },
  ],
  [{ x: 0.1, y: 0.72 }, { x: 0.5, y: 0.7 }, { x: 0.86, y: 0.66 }],
];

export function createReceipt(root: HTMLElement, order: Order) {
  const section = root.querySelector<HTMLElement>('[data-receipt]');
  const canvas = section?.querySelector<HTMLCanvasElement>('[data-pad]');
  const ctx = canvas?.getContext('2d');
  if (!section || !canvas || !ctx) return null;

  const locked = section.querySelector<HTMLElement>('[data-receipt-locked]')!;
  const body = section.querySelector<HTMLElement>('[data-receipt-body]')!;
  const jump = section.querySelector<HTMLButtonElement>('[data-jump-eta]');
  const clearBtn = section.querySelector<HTMLButtonElement>('[data-pad-clear]')!;
  const autoBtn = section.querySelector<HTMLButtonElement>('[data-pad-auto]')!;
  const confirmBtn = section.querySelector<HTMLButtonElement>('[data-pad-confirm]')!;
  const signOk = section.querySelector<HTMLElement>('[data-sign-ok]')!;
  const hint = section.querySelector<HTMLElement>('[data-pad-hint]');
  const stars = section.querySelector<HTMLFieldSetElement>('[data-stars]')!;
  const form = section.querySelector<HTMLFormElement>('[data-rate-form]')!;
  const send = section.querySelector<HTMLButtonElement>('[data-rate-send]')!;
  const done = section.querySelector<HTMLElement>('[data-receipt-done]')!;
  const stamp = section.querySelector<HTMLElement>('[data-stamp]');
  const burst = section.querySelector<HTMLElement>('[data-burst]');
  const labels = [...section.querySelectorAll<HTMLLabelElement>('.star')];

  let drawing = false;
  let hasInk = false;
  let last: Point | null = null;
  let autoTween: gsap.core.Tween | null = null;

  function fit(): void {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const { width, height } = canvas!.getBoundingClientRect();
    if (!width) return;
    canvas!.width = Math.round(width * ratio);
    canvas!.height = Math.round(height * ratio);
    ctx!.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx!.lineCap = 'round';
    ctx!.lineJoin = 'round';
    ctx!.lineWidth = 3;
    ctx!.strokeStyle = '#16130f';
    const saved = sim.signature(order.id);
    if (saved) {
      const img = new Image();
      img.onload = () => ctx!.drawImage(img, 0, 0, width, height);
      img.src = saved;
    }
  }

  const local = (e: PointerEvent): Point => {
    const r = canvas!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  function segment(a: Point, b: Point): void {
    ctx!.beginPath();
    ctx!.moveTo(a.x, a.y);
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    ctx!.quadraticCurveTo(a.x, a.y, mid.x, mid.y);
    ctx!.lineTo(b.x, b.y);
    ctx!.stroke();
  }

  function inked(): void {
    if (!hasInk) {
      hasInk = true;
      confirmBtn.disabled = false;
      if (hint) gsap.to(hint, { autoAlpha: 0, duration: 0.2 });
    }
  }

  const onDown = (e: PointerEvent): void => {
    if (sim.signature(order.id)) return;
    drawing = true;
    last = local(e);
    canvas.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent): void => {
    if (!drawing || !last) return;
    const p = local(e);
    segment(last, p);
    last = p;
    inked();
  };
  const onUp = (): void => {
    drawing = false;
    last = null;
  };

  function clear(): void {
    autoTween?.kill();
    const { width, height } = canvas!.getBoundingClientRect();
    ctx!.clearRect(0, 0, width, height);
    hasInk = false;
    confirmBtn.disabled = true;
    if (hint) gsap.set(hint, { autoAlpha: 1 });
  }

  /** Draws the scripted signature stroke by stroke. Also used by the showcase. */
  function autoSign(): Promise<void> {
    clear();
    const { width, height } = canvas!.getBoundingClientRect();
    const strokes = AUTO_SIGNATURE.map((s) => s.map((p) => ({ x: p.x * width, y: p.y * height })));
    const total = strokes.reduce((n, s) => n + s.length - 1, 0);
    return new Promise((resolve) => {
      const state = { i: 0 };
      let drawn = 0;
      const drawUpTo = (n: number): void => {
        while (drawn < n) {
          let k = drawn;
          for (const s of strokes) {
            if (k < s.length - 1) {
              segment(s[k]!, s[k + 1]!);
              break;
            }
            k -= s.length - 1;
          }
          drawn++;
        }
        inked();
      };
      if (reducedMotion()) {
        drawUpTo(total);
        resolve();
        return;
      }
      autoTween = gsap.to(state, {
        i: total,
        duration: 1.1,
        ease: 'power1.inOut',
        onUpdate: () => drawUpTo(Math.floor(state.i)),
        onComplete: () => {
          drawUpTo(total);
          resolve();
        },
      });
    });
  }

  function lockSignature(): void {
    confirmBtn.disabled = true;
    clearBtn.disabled = true;
    autoBtn.disabled = true;
    signOk.hidden = false;
    stars.disabled = false;
  }

  function confirmSign(): void {
    if (!hasInk) return;
    sim.setSignature(order.id, canvas!.toDataURL('image/png'));
    lockSignature();
    toast(`Recibimos la firma del pedido ${order.id}.`, 'entregado', 'Firma registrada');
    labels[4]?.querySelector('input')?.focus();
  }

  function paintStars(n: number): void {
    labels.forEach((l, i) => l.classList.toggle('is-on', i < n));
  }

  const onStarChange = (): void => {
    const value = Number(new FormData(form).get('rating') ?? 0);
    paintStars(value);
    send.disabled = !value;
    if (!reducedMotion() && value) {
      gsap.fromTo(labels.slice(0, value).map((l) => l.querySelector('svg')), { scale: 0.6 }, { scale: 1, duration: 0.4, stagger: 0.04, ease: 'back.out(3)' });
    }
  };

  function finale(value: number, animate: boolean): void {
    paintStars(value);
    stars.disabled = true;
    stars.classList.add('is-final');
    send.hidden = true;
    done.hidden = false;
    if (!animate || reducedMotion() || !burst) return;
    const colors = ['--st-recibido', '--st-preparando', '--st-despachado', '--st-en-camino', '--st-entregado'];
    const box = burst.getBoundingClientRect();
    const origin = labels[value - 1]?.getBoundingClientRect();
    const ox = origin ? origin.left - box.left + origin.width / 2 : box.width / 2;
    const oy = origin ? origin.top - box.top + origin.height / 2 : box.height / 2;
    const bits = Array.from({ length: 26 }, (_, i) => {
      const bit = document.createElement('span');
      bit.className = 'burst__bit';
      bit.style.background = `var(${colors[i % colors.length]})`;
      bit.style.left = `${ox}px`;
      bit.style.top = `${oy}px`;
      burst.append(bit);
      return bit;
    });
    gsap
      .timeline({ onComplete: () => bits.forEach((b) => b.remove()) })
      .to(labels.slice(0, value).map((l) => l.querySelector('svg')), { scale: 1.35, duration: 0.18, stagger: 0.05, yoyo: true, repeat: 1, ease: 'power2.out' })
      .to(
        bits,
        {
          x: () => gsap.utils.random(-170, 170),
          y: () => gsap.utils.random(-150, 120),
          rotation: () => gsap.utils.random(-360, 360),
          duration: 0.9,
          ease: 'expo.out',
        },
        0.1,
      )
      .to(bits, { autoAlpha: 0, duration: 0.4 }, 0.7)
      .fromTo(stamp, { scale: 2.4, autoAlpha: 0, rotation: 8 }, { scale: 1, autoAlpha: 1, rotation: -8, duration: 0.45, ease: 'back.out(1.4)' }, 0.25)
      .fromTo('[data-thanks]', { y: 12, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.4 }, 0.6);
  }

  const onSubmit = (e: SubmitEvent): void => {
    e.preventDefault();
    const value = Number(new FormData(form).get('rating') ?? 0);
    if (!value) return;
    sim.setRating(order.id, value);
    finale(value, true);
    toast(`Calificaste la entrega con ${value} de 5.`, 'entregado', '¡Gracias!');
  };

  const onJump = (): void => {
    // Jump to the arrival; if an incident is still open, close it first.
    if (order.incident && sim.now() >= order.incident.at) sim.resolve(order.id, 'resuelta');
    sim.set(Math.max(sim.now(), etaAt(order, sim.now())) + 1);
  };

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  clearBtn.addEventListener('click', clear);
  autoBtn.addEventListener('click', () => void autoSign());
  confirmBtn.addEventListener('click', confirmSign);
  stars.addEventListener('change', onStarChange);
  form.addEventListener('submit', onSubmit);
  jump?.addEventListener('click', onJump);
  const ro = new ResizeObserver(() => fit());

  let unlocked = false;
  function unlock(animate: boolean): void {
    if (unlocked) return;
    unlocked = true;
    locked.hidden = true;
    body.hidden = false;
    ro.observe(canvas!);
    if (sim.signature(order.id)) lockSignature();
    const rating = sim.rating(order.id);
    if (rating) {
      const input = labels[rating - 1]?.querySelector('input');
      if (input) input.checked = true;
      finale(rating, false);
    }
    if (animate && !reducedMotion()) gsap.from(body, { y: 30, autoAlpha: 0, duration: 0.6, ease: 'power3.out' });
  }

  return {
    update(state: OrderState, changed: boolean): void {
      if (state === 'entregado') unlock(changed);
    },
    autoSign,
    confirmSign,
    destroy(): void {
      autoTween?.kill();
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      form.removeEventListener('submit', onSubmit);
      jump?.removeEventListener('click', onJump);
    },
  };
}
