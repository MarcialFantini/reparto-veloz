/**
 * Command palette (Ctrl/Cmd+K) and keyboard shortcuts. Searches orders, drivers,
 * views and actions; everything it runs goes through the shared store.
 */
import { navigate } from 'astro:transitions/client';
import { gsap } from 'gsap';
import { DRIVERS } from '../data/catalog';
import { sim, type Speed } from '../lib/sim';
import { STATE_META, driverOf, ordersAt, stateAt } from '../lib/status';
import { VIEWS } from '../lib/views';
import { orderHref } from './chrome';
import { reducedMotion } from './motion';
import { toast } from './toasts';

interface Command {
  id: string;
  group: 'Vistas' | 'Acciones' | 'Pedidos' | 'Choferes';
  label: string;
  hint: string;
  keywords: string;
  run: () => void;
}

const fold = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const go = (href: string): void => void navigate(sim.isShowcase ? `${href}${href.includes('?') ? '&' : '?'}showcase` : href);

function commands(): Command[] {
  const t = sim.now();
  const list: Command[] = VIEWS.map((v) => ({
    id: `view:${v.id}`,
    group: 'Vistas',
    label: `Ir a ${v.label}`,
    hint: v.hint,
    keywords: `${v.label} vista ir`,
    run: () => go(v.href),
  }));
  list.push(
    { id: 'act:pause', group: 'Acciones', label: sim.paused ? 'Reanudar la simulación' : 'Pausar la simulación', hint: 'P', keywords: 'pausa pausar reanudar play', run: () => sim.togglePause() },
    ...([1, 4, 10] as Speed[]).map((s, i) => ({
      id: `act:speed${s}`,
      group: 'Acciones' as const,
      label: `Velocidad ${s}x`,
      hint: String(i + 1),
      keywords: `velocidad rapido speed ${s}x`,
      run: () => sim.setSpeed(s),
    })),
    { id: 'act:hour', group: 'Acciones', label: 'Adelantar 1 hora', hint: 'H', keywords: 'adelantar hora tiempo', run: () => sim.advance(60) },
    { id: 'act:new', group: 'Acciones', label: 'Crear un pedido nuevo', hint: 'N', keywords: 'nuevo crear pedido alta', run: () => go('/pedidos?nuevo') },
    { id: 'act:read', group: 'Acciones', label: 'Marcar notificaciones como leídas', hint: '', keywords: 'notificaciones leidas avisos', run: () => sim.markRead() },
    { id: 'act:help', group: 'Acciones', label: 'Ver atajos de teclado', hint: '?', keywords: 'ayuda atajos teclado', run: () => openHelp() },
    { id: 'act:reset', group: 'Acciones', label: 'Reiniciar demo', hint: '', keywords: 'reiniciar reset borrar', run: () => { sim.reset(); location.reload(); } },
  );
  for (const o of ordersAt(t)) {
    const s = stateAt(o, t);
    list.push({
      id: `order:${o.id}`,
      group: 'Pedidos',
      label: `${o.id} · ${o.customer}`,
      hint: `${o.placeName} · ${s ? STATE_META[s].label : ''}`,
      keywords: `${o.id} ${o.id.replace('LA-', '')} ${o.customer} ${o.placeName} ${driverOf(o).name}`,
      run: () => go(orderHref(o.id)),
    });
  }
  for (const d of DRIVERS) {
    list.push({ id: `driver:${d.id}`, group: 'Choferes', label: d.name, hint: `${d.truck} · zona ${d.zone}`, keywords: `${d.name} ${d.truck} ${d.zone} chofer repartidor`, run: () => go(`/repartidores?chofer=${d.id}`) });
  }
  return list;
}

function search(query: string): Command[] {
  const all = commands();
  const q = fold(query.trim());
  if (!q) return [...all.filter((c) => c.group !== 'Pedidos' && c.group !== 'Choferes'), ...all.filter((c) => c.group === 'Pedidos').slice(-5)];
  const terms = q.split(/\s+/);
  return all
    .map((c) => {
      const hay = fold(`${c.label} ${c.keywords}`);
      if (!terms.every((term) => hay.includes(term))) return null;
      const score = (fold(c.label).startsWith(q) ? 0 : 1) + (c.group === 'Pedidos' && /\d/.test(q) ? -1 : 0);
      return { c, score };
    })
    .filter((x): x is { c: Command; score: number } => x !== null)
    .sort((a, b) => a.score - b.score)
    .slice(0, 40)
    .map((x) => x.c);
}

function openHelp(): void {
  document.querySelector<HTMLDialogElement>('[data-help]')?.showModal();
}

export function openPalette(prefill = ''): void {
  const dialog = document.querySelector<HTMLDialogElement>('[data-palette]');
  const input = dialog?.querySelector<HTMLInputElement>('[data-palette-input]');
  if (!dialog || !input || dialog.open) return;
  dialog.showModal();
  input.value = prefill;
  input.dispatchEvent(new Event('input'));
  input.focus();
  if (!reducedMotion()) gsap.fromTo(dialog.querySelector('.palette__box'), { y: -16, scale: 0.98, autoAlpha: 0 }, { y: 0, scale: 1, autoAlpha: 1, duration: 0.28, ease: 'power3.out' });
}

export function bindCommands(): () => void {
  const dialog = document.querySelector<HTMLDialogElement>('[data-palette]');
  const input = dialog?.querySelector<HTMLInputElement>('[data-palette-input]');
  const listEl = dialog?.querySelector<HTMLUListElement>('[data-palette-list]');
  const helpBtn = document.querySelector<HTMLButtonElement>('[data-open-help]');
  const openers = [...document.querySelectorAll<HTMLButtonElement>('[data-open-palette]')];
  let results: Command[] = [];
  let active = 0;
  let pendingG = 0;

  const paint = (): void => {
    if (!listEl || !input) return;
    let group = '';
    let html = '';
    results.forEach((c, i) => {
      if (c.group !== group) {
        group = c.group;
        html += `<li class="palette__group" role="presentation">${group}</li>`;
      }
      html += `<li class="palette__item${i === active ? ' is-active' : ''}" role="option" id="cmd-${i}" aria-selected="${i === active}" data-index="${i}">
<span class="palette__label">${c.label.replace(/</g, '&lt;')}</span><span class="palette__hint">${c.hint.replace(/</g, '&lt;')}</span></li>`;
    });
    listEl.innerHTML = html || '<li class="palette__empty" role="presentation">Sin resultados. Probá con un número de pedido, un barrio o un chofer.</li>';
    input.setAttribute('aria-activedescendant', results.length ? `cmd-${active}` : '');
    listEl.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' });
  };

  const run = (i: number): void => {
    const c = results[i];
    if (!c) return;
    dialog?.close();
    c.run();
    if (c.group === 'Acciones' && c.id !== 'act:help' && c.id !== 'act:new') toast(c.label, 'neutral', 'Comando');
  };

  const onInput = (): void => {
    results = search(input?.value ?? '');
    active = 0;
    paint();
  };
  const onInputKey = (e: KeyboardEvent): void => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const n = results.length;
      if (!n) return;
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + n) % n;
      paint();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      run(active);
    }
  };
  const onListClick = (e: MouseEvent): void => {
    const item = (e.target as HTMLElement).closest<HTMLElement>('[data-index]');
    if (item) run(Number(item.dataset.index));
  };
  const onDialogClick = (e: MouseEvent): void => {
    if (e.target === dialog) dialog?.close();
  };

  const typing = (el: EventTarget | null): boolean =>
    el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

  const onKey = (e: KeyboardEvent): void => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (dialog?.open) dialog.close();
      else openPalette();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey || typing(e.target) || document.querySelector('dialog[open]')) return;
    const key = e.key.toLowerCase();
    if (pendingG && Date.now() - pendingG < 1200) {
      pendingG = 0;
      const view = VIEWS.find((v) => v.key === key);
      if (view) {
        e.preventDefault();
        go(view.href);
      }
      return;
    }
    switch (key) {
      case '/':
        e.preventDefault();
        openPalette();
        break;
      case '?':
        openHelp();
        break;
      case 'g':
        pendingG = Date.now();
        break;
      case 'p':
        sim.togglePause();
        toast(sim.paused ? 'La simulación quedó en pausa.' : 'La simulación sigue en vivo.', 'neutral', sim.paused ? 'En pausa' : 'En vivo');
        break;
      case '1':
      case '2':
      case '3':
        sim.setSpeed(([1, 4, 10] as const)[Number(key) - 1]!);
        break;
      case 'h':
        sim.advance(60);
        toast('La simulación avanzó una hora.', 'neutral', 'Adelantaste 1 hora');
        break;
      case 'n':
        go('/pedidos?nuevo');
        break;
    }
  };

  const onOpen = (): void => openPalette();
  input?.addEventListener('input', onInput);
  input?.addEventListener('keydown', onInputKey);
  listEl?.addEventListener('click', onListClick);
  dialog?.addEventListener('click', onDialogClick);
  helpBtn?.addEventListener('click', openHelp);
  openers.forEach((b) => b.addEventListener('click', onOpen));
  document.addEventListener('keydown', onKey);

  return () => {
    input?.removeEventListener('input', onInput);
    input?.removeEventListener('keydown', onInputKey);
    listEl?.removeEventListener('click', onListClick);
    dialog?.removeEventListener('click', onDialogClick);
    helpBtn?.removeEventListener('click', openHelp);
    openers.forEach((b) => b.removeEventListener('click', onOpen));
    document.removeEventListener('keydown', onKey);
  };
}
