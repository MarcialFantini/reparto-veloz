/**
 * Métricas: KPIs and two live charts (deliveries per hour, cumulative on-time rate).
 * Charts are plain SVG drawn at the container's pixel width, with hover and keyboard
 * tooltips and a table view for every value.
 */
import { gsap } from 'gsap';
import { STATES, type Order } from '../../data/orders';
import { sim } from '../../lib/sim';
import { clock, etaAt, isOnTime, metricsAt, ordersAt, stateAt, timeOf } from '../../lib/status';
import { reducedMotion } from '../motion';

const SERIES_A = '#2e5be8';
const SERIES_B = '#f06a2c';
const FIRST_HOUR = 8;

interface Delivered {
  at: number;
  ok: boolean;
  minutes: number;
}

function deliveredAt(t: number): Delivered[] {
  return ordersAt(t).flatMap((o: Order) =>
    stateAt(o, t) === 'entregado' ? [{ at: etaAt(o, t), ok: isOnTime(o), minutes: etaAt(o, t) - timeOf(o, 'recibido') }] : [],
  );
}

export function init(root: HTMLElement): () => void {
  const hoursEl = root.querySelector<HTMLElement>('[data-chart="hours"]');
  const ontimeEl = root.querySelector<HTMLElement>('[data-chart="ontime"]');
  const tip = root.querySelector<HTMLElement>('[data-chart-tip]');
  if (!hoursEl || !ontimeEl || !tip) return () => {};
  let lastMinute = -1;
  let first = true;
  let hourData: { hour: number; a: number; b: number }[] = [];
  let lineData: { t: number; pct: number; n: number }[] = [];

  /* ---------- tooltip ---------- */
  function showTip(x: number, y: number, title: string, rows: [string, string, string][]): void {
    tip!.replaceChildren();
    const strong = document.createElement('strong');
    strong.textContent = title;
    tip!.append(strong);
    for (const [color, label, value] of rows) {
      const row = document.createElement('span');
      row.className = 'tip-row';
      const key = document.createElement('span');
      key.className = 'tip-key';
      key.style.background = color;
      const text = document.createElement('span');
      text.textContent = `${value} · ${label}`;
      row.append(key, text);
      tip!.append(row);
    }
    tip!.hidden = false;
    const w = tip!.offsetWidth;
    tip!.style.left = `${Math.min(window.innerWidth - w - 8, Math.max(8, x - w / 2))}px`;
    tip!.style.top = `${Math.max(8, y - tip!.offsetHeight - 12)}px`;
  }
  const hideTip = (): void => {
    tip!.hidden = true;
  };

  /* ---------- chart 1: stacked columns ---------- */
  function drawHours(): void {
    const width = hoursEl!.clientWidth || 320;
    const height = 230;
    const pad = { l: 28, r: 6, t: 18, b: 24 };
    const innerW = width - pad.l - pad.r;
    const innerH = height - pad.t - pad.b;
    const max = Math.max(4, ...hourData.map((d) => d.a + d.b));
    const step = Math.ceil(max / 4);
    const top = step * 4;
    const band = innerW / Math.max(1, hourData.length);
    const barW = Math.min(24, band * 0.6);
    const y = (v: number): number => pad.t + innerH - (v / top) * innerH;
    let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Entregas por hora, a tiempo y con demora">`;
    for (let i = 0; i <= 4; i++) {
      const v = step * i;
      svg += `<line class="c-grid" x1="${pad.l}" x2="${width - pad.r}" y1="${y(v)}" y2="${y(v)}"/><text class="c-axis" x="${pad.l - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
    }
    hourData.forEach((d, i) => {
      const cx = pad.l + band * i + band / 2;
      const x = cx - barW / 2;
      const ha = (d.a / top) * innerH;
      const hb = (d.b / top) * innerH;
      const base = pad.t + innerH;
      const gap = d.a && d.b ? 2 : 0;
      // Bottom segment square at the baseline; the top segment carries the 4px rounded end.
      const segA = d.a ? `<path class="c-seg" fill="${SERIES_A}" d="${roundTop(x, base - ha, barW, ha, d.b ? 0 : 4)}"/>` : '';
      const segB = d.b ? `<path class="c-seg" fill="${SERIES_B}" d="${roundTop(x, base - ha - gap - hb, barW, hb, 4)}"/>` : '';
      const total = d.a + d.b;
      svg += `<g class="c-bar" tabindex="0" role="img" aria-label="${clock(d.hour * 60)}: ${d.a} a tiempo, ${d.b} con demora" data-i="${i}">
<rect class="c-hit" x="${cx - band / 2}" y="${pad.t}" width="${band}" height="${innerH}" fill="transparent"/>${segA}${segB}
${total ? `<text class="c-val" x="${cx}" y="${base - ha - gap - hb - 5}" text-anchor="middle">${total}</text>` : ''}</g>`;
      if (hourData.length <= 8 || i % 2 === 0) svg += `<text class="c-axis" x="${cx}" y="${height - 6}" text-anchor="middle">${String(d.hour).padStart(2, '0')}h</text>`;
    });
    svg += `<line x1="${pad.l}" x2="${width - pad.r}" y1="${pad.t + innerH}" y2="${pad.t + innerH}" stroke="#bdb3a0" stroke-width="1"/></svg>`;
    hoursEl!.innerHTML = svg;
    if (first && !reducedMotion()) gsap.from(hoursEl!.querySelectorAll('.c-seg'), { scaleY: 0, transformOrigin: '50% 100%', duration: 0.6, stagger: 0.03, ease: 'power3.out' });
  }

  function roundTop(x: number, y: number, w: number, h: number, r: number): string {
    const rr = Math.min(r, h, w / 2);
    return `M${x} ${y + h}V${y + rr}Q${x} ${y} ${x + rr} ${y}H${x + w - rr}Q${x + w} ${y} ${x + w} ${y + rr}V${y + h}Z`;
  }

  /* ---------- chart 2: line with crosshair ---------- */
  const lineGeom = { pad: { l: 34, r: 40, t: 14, b: 24 }, width: 0, height: 230, min: 50 };
  const lx = (i: number): number => {
    const { pad, width } = lineGeom;
    return pad.l + (lineData.length > 1 ? (i / (lineData.length - 1)) * (width - pad.l - pad.r) : 0);
  };
  const ly = (v: number): number => {
    const { pad, height, min } = lineGeom;
    return pad.t + (height - pad.t - pad.b) * (1 - (Math.max(min, v) - min) / (100 - min));
  };

  function drawLine(): void {
    lineGeom.width = ontimeEl!.clientWidth || 320;
    const { pad, width, height } = lineGeom;
    let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" tabindex="0" aria-label="Puntualidad acumulada. Usá las flechas para recorrer los valores." data-line>`;
    for (const v of [50, 60, 70, 80, 90, 100]) {
      svg += `<line class="c-grid" x1="${pad.l}" x2="${width - pad.r}" y1="${ly(v)}" y2="${ly(v)}"/><text class="c-axis" x="${pad.l - 6}" y="${ly(v) + 4}" text-anchor="end">${v}</text>`;
    }
    svg += `<line class="c-target" x1="${pad.l}" x2="${width - pad.r}" y1="${ly(90)}" y2="${ly(90)}"/><text class="c-axis" x="${width - pad.r + 4}" y="${ly(90) + 4}">obj.</text>`;
    if (lineData.length) {
      const pts = lineData.map((d, i) => `${lx(i).toFixed(1)} ${ly(d.pct).toFixed(1)}`);
      svg += `<path class="c-area" d="M${lx(0)} ${ly(lineGeom.min)}L${pts.join('L')}L${lx(lineData.length - 1)} ${ly(lineGeom.min)}Z"/>`;
      svg += `<path class="c-line" d="M${pts.join('L')}"/>`;
      const last = lineData[lineData.length - 1]!;
      svg += `<circle class="c-dot" r="4.5" cx="${lx(lineData.length - 1)}" cy="${ly(last.pct)}"/><text class="c-val" x="${lx(lineData.length - 1) + 8}" y="${ly(last.pct) - 6}">${Math.round(last.pct)} %</text>`;
      lineData.forEach((d, i) => {
        if (d.t % 60 === 0 && (lineData.length < 30 || (d.t / 60) % 2 === 0)) svg += `<text class="c-axis" x="${lx(i)}" y="${height - 6}" text-anchor="middle">${clock(d.t).slice(0, 2)}h</text>`;
      });
    }
    svg += `<line class="c-cross" data-cross x1="0" x2="0" y1="${pad.t}" y2="${height - pad.b}" visibility="hidden"/><circle class="c-dot" data-cross-dot r="4.5" visibility="hidden"/></svg>`;
    ontimeEl!.innerHTML = svg;
  }

  let crossIndex = -1;
  function cross(i: number, clientX?: number, clientY?: number): void {
    const svg = ontimeEl!.querySelector('svg');
    const d = lineData[i];
    if (!svg || !d) return;
    crossIndex = i;
    const line = svg.querySelector('[data-cross]');
    const dot = svg.querySelector('[data-cross-dot]');
    line?.setAttribute('x1', String(lx(i)));
    line?.setAttribute('x2', String(lx(i)));
    line?.setAttribute('visibility', 'visible');
    dot?.setAttribute('cx', String(lx(i)));
    dot?.setAttribute('cy', String(ly(d.pct)));
    dot?.setAttribute('visibility', 'visible');
    const box = svg.getBoundingClientRect();
    showTip(clientX ?? box.left + lx(i), clientY ?? box.top + ly(d.pct), clock(d.t), [[SERIES_A, `${d.n} entregas`, `${Math.round(d.pct)} %`]]);
  }
  function uncross(): void {
    crossIndex = -1;
    ontimeEl!.querySelectorAll('[data-cross],[data-cross-dot]').forEach((el) => el.setAttribute('visibility', 'hidden'));
    hideTip();
  }

  /* ---------- tables ---------- */
  function tables(): void {
    const tb1 = root.querySelector('[data-table="hours"] tbody');
    if (tb1) tb1.innerHTML = hourData.map((d) => `<tr><td>${String(d.hour).padStart(2, '0')}:00</td><td>${d.a}</td><td>${d.b}</td></tr>`).join('');
    const tb2 = root.querySelector('[data-table="ontime"] tbody');
    if (tb2) tb2.innerHTML = lineData.filter((d) => d.t % 60 === 0).map((d) => `<tr><td>${clock(d.t)}</td><td>${Math.round(d.pct)} %</td><td>${d.n}</td></tr>`).join('');
  }

  /* ---------- data ---------- */
  function compute(t: number): void {
    const list = deliveredAt(t);
    const lastHour = Math.max(FIRST_HOUR, Math.floor(t / 60));
    hourData = Array.from({ length: lastHour - FIRST_HOUR + 1 }, (_, i) => {
      const hour = FIRST_HOUR + i;
      const inHour = list.filter((d) => Math.floor(d.at / 60) === hour);
      return { hour, a: inHour.filter((d) => d.ok).length, b: inHour.filter((d) => !d.ok).length };
    });
    lineData = [];
    for (let s = FIRST_HOUR * 60; s <= t; s += 15) {
      const upTo = list.filter((d) => d.at <= s);
      if (!upTo.length) continue;
      lineData.push({ t: s, pct: (upTo.filter((d) => d.ok).length / upTo.length) * 100, n: upTo.length });
    }
    if (list.length) lineData.push({ t: Math.floor(t), pct: (list.filter((d) => d.ok).length / list.length) * 100, n: list.length });

    const m = metricsAt(t);
    const set = (k: string, v: string): void => {
      const el = root.querySelector<HTMLElement>(`[data-m="${k}"]`);
      if (!el || el.textContent === v) return;
      el.textContent = v;
      if (!first && !reducedMotion()) gsap.fromTo(el, { yPercent: -35, autoAlpha: 0.2 }, { yPercent: 0, autoAlpha: 1, duration: 0.35 });
    };
    set('ontime', String(Math.round(m.onTimePct)));
    set('avg', String(Math.round(m.avgMinutes)));
    const lastHourCount = list.filter((d) => d.at > t - 60).length;
    const prevHourCount = list.filter((d) => d.at > t - 120 && d.at <= t - 60).length;
    set('lasthour', String(lastHourCount));
    set('delivered', String(m.delivered));
    const delta = root.querySelector('[data-m-delta="lasthour"]');
    if (delta) delta.textContent = `${lastHourCount >= prevHourCount ? '+' : ''}${lastHourCount - prevHourCount} contra la hora anterior`;
    const total = root.querySelector('[data-m-delta="delivered"]');
    if (total) total.textContent = `de ${m.total} pedidos · ${m.openIncidents} con incidencia`;
    for (const s of STATES) {
      const el = root.querySelector(`[data-m-state="${s}"]`);
      if (el) el.textContent = String(m.byState[s]);
    }
  }

  function render(t: number): void {
    compute(t);
    drawHours();
    drawLine();
    tables();
    if (crossIndex >= 0) cross(Math.min(crossIndex, lineData.length - 1));
    first = false;
  }

  const onTick = (t: number): void => {
    const minute = Math.floor(t);
    if (minute === lastMinute) return;
    lastMinute = minute;
    render(t);
  };

  /* ---------- interaction ---------- */
  const barOf = (e: Event): SVGGElement | null => (e.target as Element).closest<SVGGElement>('.c-bar');
  const showBar = (g: SVGGElement, x?: number, y?: number): void => {
    const d = hourData[Number(g.dataset.i)];
    if (!d) return;
    const r = g.getBoundingClientRect();
    showTip(x ?? r.left + r.width / 2, y ?? r.top + 20, `${String(d.hour).padStart(2, '0')}:00 a ${String(d.hour + 1).padStart(2, '0')}:00`, [
      [SERIES_A, 'a tiempo', String(d.a)],
      [SERIES_B, 'con demora', String(d.b)],
    ]);
  };
  const onBarMove = (e: PointerEvent): void => {
    const g = barOf(e);
    if (g) showBar(g, e.clientX, e.clientY);
    else hideTip();
  };
  const onBarFocus = (e: FocusEvent): void => {
    const g = barOf(e);
    if (g) showBar(g);
  };
  const onLineMove = (e: PointerEvent): void => {
    const svg = ontimeEl.querySelector('svg');
    if (!svg || !lineData.length) return;
    const x = e.clientX - svg.getBoundingClientRect().left;
    let best = 0;
    lineData.forEach((_, i) => {
      if (Math.abs(lx(i) - x) < Math.abs(lx(best) - x)) best = i;
    });
    cross(best, e.clientX, e.clientY);
  };
  const onLineKey = (e: KeyboardEvent): void => {
    if (!(e.target as Element).matches('[data-line]') || !lineData.length) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const next = crossIndex < 0 ? lineData.length - 1 : crossIndex + (e.key === 'ArrowRight' ? 1 : -1);
      cross(Math.max(0, Math.min(lineData.length - 1, next)));
    } else if (e.key === 'Escape') uncross();
  };

  hoursEl.addEventListener('pointermove', onBarMove);
  hoursEl.addEventListener('pointerleave', hideTip);
  hoursEl.addEventListener('focusin', onBarFocus);
  hoursEl.addEventListener('focusout', hideTip);
  ontimeEl.addEventListener('pointermove', onLineMove);
  ontimeEl.addEventListener('pointerleave', uncross);
  ontimeEl.addEventListener('keydown', onLineKey);
  ontimeEl.addEventListener('focusout', uncross);
  const ro = new ResizeObserver(() => {
    drawHours();
    drawLine();
  });
  ro.observe(hoursEl);

  onTick(sim.now());
  const unsub = sim.subscribe(onTick);
  return () => {
    unsub();
    ro.disconnect();
    hideTip();
  };
}
