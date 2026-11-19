/**
 * Scene 2 · Timeline. Done stages show their final pose, the current one loops,
 * pending ones wait in their initial pose. Only transform, opacity and stroke.
 */
import { gsap } from 'gsap';
import { STATES, type OrderState } from '../../data/orders';
import { stateIndex } from '../../lib/status';
import { reducedMotion } from '../motion';

type Pose = 'start' | 'end';

const q = (art: Element, part: string): SVGElement[] => [...art.querySelectorAll<SVGElement>(`[data-part="${part}"]`)];

function pose(art: Element, kind: OrderState, at: Pose): void {
  const end = at === 'end';
  switch (kind) {
    case 'recibido':
    case 'entregado':
      gsap.set(q(art, 'check'), { strokeDasharray: 1, strokeDashoffset: end ? 0 : 1 });
      gsap.set(q(art, 'badge'), { scale: end ? 1 : 0, transformOrigin: '50% 50%' });
      gsap.set(q(art, 'paper'), { y: 0 });
      gsap.set(q(art, 'parcel'), { y: 0, autoAlpha: end ? 1 : 0 });
      break;
    case 'preparando':
      gsap.set([...q(art, 'item'), ...q(art, 'item2')], { y: end ? 26 : 0, autoAlpha: end ? 0 : 1 });
      gsap.set([...q(art, 'flap-l'), ...q(art, 'flap-r')], { scaleY: end ? -0.35 : 1, transformOrigin: '50% 100%' });
      break;
    case 'despachado':
      gsap.set(q(art, 'tape'), { scaleY: end ? 1 : 0, transformOrigin: '50% 0%' });
      gsap.set(q(art, 'roll'), { y: end ? 44 : 0, autoAlpha: end ? 0 : 1 });
      break;
    case 'en-camino':
      gsap.set(q(art, 'truck'), { x: end ? 6 : 0 });
      gsap.set(q(art, 'lines'), { autoAlpha: end ? 0 : 1 });
      break;
  }
}

function loop(art: Element, kind: OrderState): gsap.core.Timeline {
  const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.4 });
  switch (kind) {
    case 'recibido':
      pose(art, kind, 'start');
      tl.fromTo(q(art, 'paper'), { y: 14, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.7, ease: 'power2.out' })
        .to(q(art, 'badge'), { scale: 1, duration: 0.4, ease: 'back.out(2.4)' })
        .to(q(art, 'check'), { strokeDashoffset: 0, duration: 0.35, ease: 'power1.inOut' })
        .to({}, { duration: 1 })
        .to([...q(art, 'badge')], { scale: 0, duration: 0.25 })
        .set(q(art, 'check'), { strokeDashoffset: 1 });
      break;
    case 'preparando':
      pose(art, kind, 'start');
      tl.fromTo(q(art, 'item'), { y: -6, autoAlpha: 1 }, { y: 26, autoAlpha: 0, duration: 0.6, ease: 'power2.in' })
        .fromTo(q(art, 'item2'), { y: -6, autoAlpha: 1 }, { y: 28, autoAlpha: 0, duration: 0.6, ease: 'power2.in' }, '-=0.25')
        .to(q(art, 'flap-l'), { scaleY: -0.35, duration: 0.35, ease: 'power2.in' })
        .to(q(art, 'flap-r'), { scaleY: -0.35, duration: 0.35, ease: 'power2.in' }, '-=0.15')
        .to({}, { duration: 0.8 })
        .to([...q(art, 'flap-l'), ...q(art, 'flap-r')], { scaleY: 1, duration: 0.3, ease: 'power2.out' });
      break;
    case 'despachado':
      pose(art, kind, 'start');
      tl.to(q(art, 'roll'), { y: 44, duration: 0.9, ease: 'power1.inOut' })
        .to(q(art, 'tape'), { scaleY: 1, duration: 0.9, ease: 'power1.inOut' }, '<')
        .to(q(art, 'roll'), { autoAlpha: 0, duration: 0.2 })
        .to({}, { duration: 0.8 })
        .set(q(art, 'roll'), { y: 0, autoAlpha: 1 })
        .set(q(art, 'tape'), { scaleY: 0 });
      break;
    case 'en-camino':
      pose(art, kind, 'start');
      tl.repeatDelay(0);
      tl.to(q(art, 'wheel'), { rotation: 360, transformOrigin: '50% 50%', duration: 0.6, ease: 'none', repeat: 2 }, 0)
        .fromTo(q(art, 'truck'), { y: 0 }, { y: -1.5, duration: 0.15, yoyo: true, repeat: 11, ease: 'sine.inOut' }, 0)
        .fromTo(q(art, 'lines'), { x: 6, autoAlpha: 1 }, { x: -10, autoAlpha: 0, duration: 0.6, ease: 'none', repeat: 2 }, 0);
      break;
    case 'entregado':
      // The journey ends here: play once and rest on the final pose.
      pose(art, kind, 'start');
      tl.repeat(0);
      tl.fromTo(q(art, 'parcel'), { y: -24, autoAlpha: 1 }, { y: 0, duration: 0.6, ease: 'bounce.out' })
        .to(q(art, 'badge'), { scale: 1, duration: 0.4, ease: 'back.out(2.4)' })
        .to(q(art, 'check'), { strokeDashoffset: 0, duration: 0.35 });
      break;
  }
  return tl;
}

export interface TimelineScene {
  update(state: OrderState, changed: boolean): void;
  destroy(): void;
}

export function createTimeline(root: HTMLElement): TimelineScene | null {
  const section = root.querySelector<HTMLElement>('[data-timeline]');
  if (!section) return null;
  const stages = [...section.querySelectorAll<HTMLElement>('[data-stage]')];
  const fill = section.querySelector<HTMLElement>('[data-rail-fill]');
  let active: gsap.core.Timeline | null = null;

  let shown: OrderState | null = null;

  const update = (state: OrderState, changed: boolean): void => {
    // Rebuild only when the stage actually changes, so the current loop keeps playing.
    if (state === shown) return;
    shown = state;
    const current = stateIndex(state);
    const still = reducedMotion();
    active?.kill();
    active = null;

    stages.forEach((li, i) => {
      const kind = STATES[i]!;
      const art = li.querySelector('[data-art]');
      const status = i < current ? 'done' : i === current ? 'current' : 'todo';
      li.dataset.status = status;
      if (status === 'current') li.setAttribute('aria-current', 'step');
      else li.removeAttribute('aria-current');
      const flag = li.querySelector('[data-stage-flag]');
      if (flag) flag.textContent = status === 'current' ? 'Ahora' : status === 'done' ? 'Listo' : 'Pendiente';
      const label = li.querySelector('[data-stage-time-label]');
      if (label) label.textContent = status === 'todo' ? 'Estimado' : 'A las';
      if (!art) return;
      if (status === 'current' && !still) active = loop(art, kind);
      else pose(art, kind, status === 'todo' ? 'start' : 'end');

      if (changed && status === 'current' && !still) {
        gsap.fromTo(li.querySelector('.stage__art'), { scale: 0.8 }, { scale: 1, duration: 0.6, ease: 'back.out(2)' });
      }
    });

    const ratio = current / (STATES.length - 1);
    if (fill) {
      if (still || !changed) gsap.set(fill, { scaleY: ratio });
      else gsap.to(fill, { scaleY: ratio, duration: 0.8, ease: 'power2.inOut' });
    }
  };

  return {
    update,
    destroy: () => {
      active?.kill();
    },
  };
}
