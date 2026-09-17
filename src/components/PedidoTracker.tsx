import { useEffect, useMemo, useState } from "preact/hooks";
import {
  ESTADO_META,
  type EstadoPedido,
  type HistorialEvento,
  type Pedido,
  type Reprogramado,
} from "../types/pedido";
import * as preact from "preact";

/* ------------------------------------------------------------------ */
/* localStorage namespace — shared with RatingForm for symmetry.      */
/* ------------------------------------------------------------------ */

const STORAGE_RESCHEDULES = "repartoveloz:reschedules";

interface RescheduleRecord {
  fecha: string;
  franja: "mañana" | "tarde";
}

function loadReschedule(codigo: string): RescheduleRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_RESCHEDULES);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, RescheduleRecord>;
    return map[codigo] ?? null;
  } catch {
    return null;
  }
}

function saveReschedule(
  codigo: string,
  record: RescheduleRecord,
): RescheduleRecord | null {
  if (typeof window === "undefined") return record;
  try {
    const raw = window.localStorage.getItem(STORAGE_RESCHEDULES);
    const map = (raw ? (JSON.parse(raw) as Record<string, RescheduleRecord>) : {});
    map[codigo] = record;
    window.localStorage.setItem(STORAGE_RESCHEDULES, JSON.stringify(map));
    return record;
  } catch {
    return record;
  }
}

/* ------------------------------------------------------------------ */
/* Date helpers for the reschedule picker (next 7 days, skip today    */
/* and Sundays, es-AR labels).                                        */
/* ------------------------------------------------------------------ */

interface DateOption {
  /** ISO YYYY-MM-DD in the user's local timezone. */
  iso: string;
  /** Display label, e.g. "Vie 18 sep". */
  label: string;
  /** Short weekday for the chip. */
  weekday: string;
}

function getNextDateOptions(count = 7): DateOption[] {
  const out: DateOption[] = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  // Start at tomorrow.
  cursor.setDate(cursor.getDate() + 1);
  // Guard against pathological loops (shouldn't happen but cheap to bound).
  let safety = 0;
  while (out.length < count && safety < 30) {
    safety += 1;
    const day = cursor.getDay(); // 0 = Sunday, 6 = Saturday
    if (day !== 0) {
      const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
      const label = cursor.toLocaleDateString("es-AR", {
        weekday: "short",
        day: "2-digit",
        month: "short",
      });
      const weekday = cursor
        .toLocaleDateString("es-AR", { weekday: "short" })
        .replace(".", "");
      out.push({ iso, label, weekday });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-AR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

function formatTimeOnly(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

function formatEta(min: number | null, estado: EstadoPedido): string {
  if (estado === "entregado") return "Entregado";
  if (min == null) return "—";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

function formatEtaLargo(min: number | null, estado: EstadoPedido): string {
  if (estado === "entregado") return "Entregado";
  if (min == null) return "Sin ETA";
  if (min < 60) return `Llega en ${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `Llega en ${h} h` : `Llega en ${h} h ${m} min`;
}

/* Preact's JSX type definitions don't expose the `path` attribute on
   <animateMotion>, but every browser reads it. We render the element
   via a small typed wrapper so the build stays strict. */
function motionAlongPath(pathD: string) {
  const Motion = "animateMotion" as unknown as (
    props: Record<string, string | number>,
  ) => preact.JSX.Element;
  return <Motion dur="3.5s" repeatCount="indefinite" path={pathD} />;
}

/* ------------------------------------------------------------------ */
/* Inline status icons (no icon library, SVG per estado)              */
/* ------------------------------------------------------------------ */

function IconoEstado({ estado, className }: { estado: EstadoPedido; className?: string }) {
  const cn = className ?? "h-7 w-7";
  switch (estado) {
    case "preparando":
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
          class={cn}
        >
          <path d="M21 8L12 3 3 8l9 5 9-5z"></path>
          <path d="M3 8v8l9 5 9-5V8"></path>
        </svg>
      );
    case "en_camino":
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
          class={cn}
        >
          <path d="M2 17h12V7H2z"></path>
          <path d="M14 11h4l3 3v3h-7"></path>
          <circle cx="6.5" cy="17.5" r="1.6"></circle>
          <circle cx="17" cy="17.5" r="1.6"></circle>
        </svg>
      );
    case "entregado":
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
          class={cn}
        >
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="8 12 11 15 16 9"></polyline>
        </svg>
      );
    case "demorado":
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
          class={cn}
        >
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
      );
  }
}

function IconoCopiar({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={className ?? "h-4 w-4"}
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>
  );
}

function IconoCheck({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={className ?? "h-4 w-4"}
    >
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  );
}

function IconoTelefono({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={className ?? "h-4 w-4"}
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.86 19.86 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92z"></path>
    </svg>
  );
}

function IconoWhatsApp({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      class={className ?? "h-4 w-4"}
    >
      <path d="M19.11 4.91A10 10 0 0 0 3.6 17.06L2 22l5.06-1.58a10 10 0 0 0 4.78 1.22h.01a10 10 0 0 0 7.26-16.73zm-7.26 15.36h-.01a8.34 8.34 0 0 1-4.25-1.16l-.3-.18-3 .94.96-2.92-.2-.31a8.36 8.36 0 1 1 6.8 3.63zm4.58-6.27c-.25-.13-1.48-.73-1.71-.81-.23-.08-.4-.13-.56.13-.17.25-.65.81-.79.98-.15.17-.29.19-.54.06-.25-.13-1.06-.39-2.02-1.24-.75-.66-1.25-1.48-1.4-1.73-.15-.25-.02-.39.11-.51.11-.11.25-.29.38-.44.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.34-.77-1.84-.2-.48-.4-.42-.56-.43h-.48c-.17 0-.44.06-.67.31s-.88.86-.88 2.1.9 2.43 1.03 2.6c.13.17 1.77 2.7 4.29 3.79.6.26 1.07.42 1.43.53.6.19 1.15.16 1.58.1.48-.07 1.48-.61 1.69-1.2.21-.59.21-1.1.15-1.2-.06-.1-.23-.16-.48-.29z"></path>
    </svg>
  );
}

function IconoCalendario({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={className ?? "h-4 w-4"}
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
      <line x1="16" y1="2" x2="16" y2="6"></line>
      <line x1="8" y1="2" x2="8" y2="6"></line>
      <line x1="3" y1="10" x2="21" y2="10"></line>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Route map — abstract SVG, no external API                          */
/* ------------------------------------------------------------------ */

function MapaRuta({ pedido }: { pedido: Pedido }) {
  // Deterministic pseudo-random offset, stable across renders.
  const seed = pedido.codigo
    .split("")
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const startX = 70;
  const startY = 220;
  const midX = 180 + ((seed % 30) - 15);
  const midY = 130 - ((seed % 25) - 12);
  const endX = 290;
  const endY = 90;
  const pathD = `M${startX} ${startY} Q${midX} ${midY} ${endX} ${endY}`;
  const showRoute =
    pedido.estado === "preparando" ||
    pedido.estado === "en_camino" ||
    pedido.estado === "entregado";
  const showMovingDot = pedido.estado === "en_camino";

  return (
    <svg
      viewBox="0 0 360 240"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={`Mapa esquemático del envío ${pedido.codigo}`}
      class="block h-56 w-full sm:h-64"
    >
      <defs>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#E6E6E6" stroke-width="0.6"></path>
        </pattern>
        <pattern id="blocks" width="40" height="40" patternUnits="userSpaceOnUse">
          <rect width="36" height="36" x="2" y="2" fill="#FFFFFF"></rect>
          <rect width="36" height="36" x="2" y="2" fill="url(#grid)"></rect>
        </pattern>
      </defs>

      <rect width="360" height="240" fill="url(#blocks)"></rect>

      {/* Roads */}
      <g stroke="#E6E6E6" stroke-width="2" fill="none">
        <line x1="0" y1="60" x2="360" y2="60"></line>
        <line x1="0" y1="180" x2="360" y2="180"></line>
        <line x1="80" y1="0" x2="80" y2="240"></line>
        <line x1="260" y1="0" x2="260" y2="240"></line>
      </g>
      <g stroke="#D0D5DB" stroke-width="0.6" stroke-dasharray="2 4">
        <line x1="0" y1="120" x2="360" y2="120"></line>
        <line x1="180" y1="0" x2="180" y2="240"></line>
      </g>

      {/* River */}
      <path
        d="M-10 200 Q80 170 160 200 T360 200 L360 240 L-10 240 Z"
        fill="#EEF1F6"
        opacity="0.9"
      ></path>

      {/* Route */}
      {showRoute && (
        <g>
          <path
            d={pathD}
            stroke="#1B2845"
            stroke-width="2.5"
            fill="none"
            stroke-linecap="round"
            stroke-dasharray={pedido.estado === "preparando" ? "4 4" : "0"}
            opacity="0.85"
          ></path>
          <circle cx={startX} cy={startY} r="6" fill="#1B2845"></circle>
          <circle cx={endX} cy={endY} r="6" fill="#E76F2C"></circle>
          {showMovingDot && (
            <circle r="5" fill="#E76F2C">
              {/* animateMotion's `path` attribute isn't typed in Preact's
                  JSX definitions, but browsers do read it. */}
              {motionAlongPath(pathD)}
            </circle>
          )}
        </g>
      )}

      {/* Labels */}
      <g
        font-family='"Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif'
        font-size="9"
        font-weight="600"
        fill="#1B2845"
      >
        <text x={startX - 8} y={startY + 22} text-anchor="end">
          Depósito
        </text>
        <text x={endX + 10} y={endY + 4} text-anchor="start">
          {pedido.cliente.split(" ")[0]}
        </text>
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Status badge — large icon + text per brand spec                    */
/* ------------------------------------------------------------------ */

function BadgeEstado({ estado }: { estado: EstadoPedido }) {
  const meta = ESTADO_META[estado];
  const animate =
    estado === "en_camino" || estado === "demorado" ? "animate-pulse" : "";
  return (
    <span
      class={[
        "inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[12px] font-bold uppercase tracking-[0.16em] ring-2 sm:text-[13px]",
        meta.bgClass,
        meta.textClass,
        meta.ringClass,
      ].join(" ")}
      aria-label={`Estado del envío: ${meta.label}`}
    >
      <span
        aria-hidden="true"
        class={["grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/70 ring-1", animate].join(" ")}
      >
        <IconoEstado estado={estado} className="h-3.5 w-3.5" />
      </span>
      <span>{meta.label}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers used by the reschedule flow                                */
/* ------------------------------------------------------------------ */

const FRANJAS: ReadonlyArray<{ id: "mañana" | "tarde"; label: string; detail: string }> = [
  { id: "mañana", label: "Mañana", detail: "9 a 13 h" },
  { id: "tarde", label: "Tarde", detail: "13 a 18 h" },
];

function formatFechaCorta(iso: string): string {
  const [y, m, d] = iso.split("-").map((n) => Number.parseInt(n, 10));
  if (!y || !m || !d) return iso;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("es-AR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

function formatFechaReprogramacion(r: Reprogramado): string {
  return `${formatFechaCorta(r.fecha)} · ${r.franja}`;
}

/* ------------------------------------------------------------------ */
/* Reschedule section (visible when estado === "demorado")            */
/* ------------------------------------------------------------------ */

interface RescheduleSectionProps {
  pedido: Pedido;
  onConfirm: (seleccion: { fecha: string; franja: "mañana" | "tarde" }) => void;
}

function RescheduleSection({ pedido, onConfirm }: RescheduleSectionProps) {
  const dateOptions = useMemo(() => getNextDateOptions(7), []);
  const [open, setOpen] = useState(false);
  const [fecha, setFecha] = useState<string>(dateOptions[0]?.iso ?? "");
  const [franja, setFranja] = useState<"mañana" | "tarde">("mañana");

  // Reset selected date if the option list ever changes underneath us.
  useEffect(() => {
    if (!dateOptions.some((d) => d.iso === fecha)) {
      setFecha(dateOptions[0]?.iso ?? "");
    }
  }, [dateOptions, fecha]);

  if (!open) {
    return (
      <section
        aria-labelledby="reprogramar-heading"
        class="rounded-[1.75rem] border border-state-demorado-ring bg-state-demorado-bg p-5 sm:p-6"
      >
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2
              id="reprogramar-heading"
              class="font-mono text-[10px] uppercase tracking-[0.18em] text-state-demorado-text"
            >
              ¿No estabas en tu domicilio?
            </h2>
            <p class="mt-2 max-w-xl text-[15px] font-semibold text-state-demorado-text sm:text-[16px]">
              Elegí una nueva franja para que el repartidor vuelva a pasar por el
              pedido <span class="font-mono">{pedido.codigo}</span>.
            </p>
            <p class="mt-1 text-[13px] text-state-demorado-text/80">
              Próximos 7 días disponibles, sin contar domingos.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            class="inline-flex h-11 shrink-0 items-center justify-center gap-2 self-stretch rounded-xl bg-delivery px-5 text-[13px] font-bold uppercase tracking-[0.16em] text-white ring-1 ring-delivery transition-colors hover:bg-accent-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy sm:self-auto"
          >
            <IconoCalendario className="h-4 w-4" />
            Reprogramar visita
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="reprogramar-heading"
      class="rounded-[1.75rem] border border-state-demorado-ring bg-papel-soft p-5 sm:p-6"
    >
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="reprogramar-heading"
            class="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted"
          >
            Reprogramar visita
          </h2>
          <p class="mt-2 text-[15px] font-semibold text-navy sm:text-[16px]">
            Elegí una nueva fecha y franja horaria para el pedido{" "}
            <span class="font-mono">{pedido.codigo}</span>.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          class="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-soft underline-offset-4 hover:text-accent-deep hover:underline"
        >
          Cancelar
        </button>
      </div>

      <fieldset class="mt-5">
        <legend class="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted">
          Nueva fecha
        </legend>
        <div class="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3">
          {dateOptions.map((opt) => {
            const selected = opt.iso === fecha;
            return (
              <button
                type="button"
                key={opt.iso}
                onClick={() => setFecha(opt.iso)}
                aria-pressed={selected}
                class={[
                  "flex flex-col items-start rounded-xl border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy",
                  selected
                    ? "border-delivery bg-accent-soft text-accent-deep ring-2 ring-accent"
                    : "border-gris bg-papel-soft text-navy hover:border-accent hover:text-accent-deep",
                ].join(" ")}
              >
                <span class="font-mono text-[10px] uppercase tracking-[0.16em] opacity-70">
                  {opt.weekday}
                </span>
                <span class="mt-0.5 font-mono text-[14px] font-semibold tabular">
                  {opt.label.split(" ").slice(1).join(" ")}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset class="mt-5">
        <legend class="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted">
          Franja horaria
        </legend>
        <div class="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {FRANJAS.map((f) => {
            const selected = f.id === franja;
            return (
              <label
                key={f.id}
                class={[
                  "flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors",
                  selected
                    ? "border-delivery bg-accent-soft ring-2 ring-accent"
                    : "border-gris bg-papel-soft hover:border-accent",
                ].join(" ")}
              >
                <input
                  type="radio"
                  name="franja"
                  value={f.id}
                  checked={selected}
                  onChange={() => setFranja(f.id)}
                  class="h-4 w-4 accent-delivery"
                />
                <span>
                  <span class="block text-[14px] font-semibold text-navy">
                    {f.label}
                  </span>
                  <span class="block text-[12px] text-ink-soft">
                    {f.detail}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
        <button
          type="button"
          onClick={() => setOpen(false)}
          class="inline-flex h-11 items-center justify-center rounded-xl px-5 text-[13px] font-semibold uppercase tracking-[0.16em] text-ink-soft ring-1 ring-gris transition-colors hover:text-accent-deep hover:ring-accent"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => fecha && onConfirm({ fecha, franja })}
          disabled={!fecha}
          class="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-delivery px-5 text-[13px] font-bold uppercase tracking-[0.16em] text-white ring-1 ring-delivery transition-colors hover:bg-accent-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy disabled:cursor-not-allowed disabled:opacity-60"
        >
          Confirmar reprogramación
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Reschedule success banner (visible when reprogramado is set)       */
/* ------------------------------------------------------------------ */

function RescheduleConfirmed({ pedido }: { pedido: Pedido }) {
  if (!pedido.reprogramado) return null;
  const r = pedido.reprogramado;
  return (
    <section
      aria-labelledby="reprogramado-heading"
      class="flex items-start gap-3 rounded-[1.75rem] border border-state-entregado-ring bg-state-entregado-bg p-5 sm:p-6"
    >
      <span
        aria-hidden="true"
        class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-state-entregado-text ring-2 ring-state-entregado-ring"
      >
        <IconoCheck className="h-4 w-4" />
      </span>
      <div class="flex-1">
        <h2
          id="reprogramado-heading"
          class="font-mono text-[10px] uppercase tracking-[0.18em] text-state-entregado-text"
        >
          Reprogramación confirmada
        </h2>
        <p class="mt-1 text-[15px] font-semibold text-state-entregado-text sm:text-[16px]">
          Vamos a volver a pasar con tu pedido{" "}
          <span class="font-mono">{pedido.codigo}</span> el{" "}
          <span class="font-mono">{formatFechaCorta(r.fecha)}</span> por la{" "}
          <span class="font-mono">{r.franja}</span>.
        </p>
        <p class="mt-1 text-[12px] text-state-entregado-text/80">
          El estado del pedido pasó a “Preparando”.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Main island                                                        */
/* ------------------------------------------------------------------ */

interface Props {
  pedido: Pedido;
}

export default function PedidoTracker({ pedido }: Props) {
  const [copiado, setCopiado] = useState(false);
  /* Mutable copy of the pedido. Mutated by the reschedule flow so the
   * badge, timeline and map reflect the new state immediately. On mount
   * we hydrate any saved reschedule from localStorage. */
  const [pedidoActual, setPedidoActual] = useState<Pedido>(pedido);

  useEffect(() => {
    const saved = loadReschedule(pedido.codigo);
    if (!saved) return;
    setPedidoActual((prev) => {
      if (prev.estado !== "demorado") return prev;
      const last = prev.historial[prev.historial.length - 1];
      const yaReprogramado =
        last?.descripcion.startsWith("Reprogramado por el destinatario") ?? false;
      const nuevoEvento: HistorialEvento = {
        timestamp: new Date().toISOString(),
        descripcion: `Reprogramado por el destinatario — nueva franja: ${formatFechaReprogramacion(saved)}`,
        ubicacion: "Confirmado por el destinatario",
      };
      return {
        ...prev,
        estado: "preparando",
        reprogramado: saved,
        historial: yaReprogramado ? prev.historial : [...prev.historial, nuevoEvento],
      };
    });
  }, [pedido.codigo]);

  const meta = ESTADO_META[pedidoActual.estado];
  const ultimoEvento =
    pedidoActual.historial[pedidoActual.historial.length - 1];

  const handleCopiar = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(pedidoActual.codigo);
      } else {
        // Fallback for older browsers / non-https previews.
        const ta = document.createElement("textarea");
        ta.value = pedidoActual.codigo;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  };

  const handleConfirmarReprogramacion = (seleccion: {
    fecha: string;
    franja: "mañana" | "tarde";
  }) => {
    const record: RescheduleRecord = {
      fecha: seleccion.fecha,
      franja: seleccion.franja,
    };
    saveReschedule(pedido.codigo, record);
    setPedidoActual((prev) => {
      const nuevoEvento: HistorialEvento = {
        timestamp: new Date().toISOString(),
        descripcion: `Reprogramado por el destinatario — nueva franja: ${formatFechaReprogramacion(record)}`,
        ubicacion: "Confirmado por el destinatario",
      };
      return {
        ...prev,
        estado: "preparando",
        reprogramado: record,
        historial: [...prev.historial, nuevoEvento],
      };
    });
  };

  return (
    <div class="space-y-6 sm:space-y-8">
      {/* Hero — codigo + status badge + ETA ----------------------- */}
      <section
        aria-labelledby="estado-heading"
        class="rounded-[1.75rem] border border-gris bg-papel-soft p-5 shadow-[0_1px_0_rgba(27,40,69,0.04)] sm:p-7"
      >
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="space-y-1">
            <p class="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted">
              Pedido
            </p>
            <div class="flex flex-wrap items-center gap-2 sm:gap-3">
              <h1
                id="estado-heading"
                class="font-mono text-[26px] font-semibold tracking-[0.12em] text-navy sm:text-[32px]"
              >
                {pedidoActual.codigo}
              </h1>
              <button
                type="button"
                onClick={handleCopiar}
                aria-label={
                  copiado
                    ? `Código ${pedidoActual.codigo} copiado al portapapeles`
                    : `Copiar código ${pedidoActual.codigo} al portapapeles`
                }
                aria-live="polite"
                class={[
                  "inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold uppercase tracking-[0.16em] ring-1 transition-colors",
                  copiado
                    ? "bg-state-entregado-bg text-state-entregado-text ring-state-entregado-ring"
                    : "bg-papel text-ink-soft ring-gris hover:text-accent-deep hover:ring-accent",
                ].join(" ")}
              >
                {copiado ? (
                  <>
                    <IconoCheck className="h-3.5 w-3.5" />
                    Copiado
                  </>
                ) : (
                  <>
                    <IconoCopiar className="h-3.5 w-3.5" />
                    Copiar código
                  </>
                )}
              </button>
            </div>
          </div>

          <BadgeEstado estado={pedidoActual.estado} />
        </div>

        <div class="mt-6 flex flex-col gap-5 sm:flex-row sm:items-center">
          <div
            class={[
              "grid h-14 w-14 shrink-0 place-items-center rounded-2xl ring-2 sm:h-16 sm:w-16",
              meta.bgClass,
              meta.textClass,
              meta.ringClass,
            ].join(" ")}
            aria-hidden="true"
          >
            <IconoEstado estado={pedidoActual.estado} className="h-7 w-7 sm:h-8 sm:w-8" />
          </div>
          <div class="flex-1">
            <p class="text-[19px] font-semibold tracking-tight text-navy sm:text-[22px]">
              {meta.descripcion}
            </p>
            <p class="mt-1 text-[14px] text-ink-soft">
              {pedidoActual.estado === "entregado"
                ? `Entregado el ${formatDateTime(pedidoActual.historial[pedidoActual.historial.length - 1].timestamp)}`
                : `Última actualización: ${formatTimeOnly(ultimoEvento.timestamp)} · ${ultimoEvento.ubicacion}`}
            </p>
            {pedidoActual.reprogramado && (
              <p class="mt-1 text-[12px] font-semibold text-state-entregado-text">
                Visita reprogramada · {formatFechaReprogramacion(pedidoActual.reprogramado)}
              </p>
            )}
          </div>
          <div class="shrink-0 rounded-2xl border border-gris bg-papel px-4 py-3 text-left sm:text-right">
            <p class="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted">
              ETA
            </p>
            <p class="font-mono text-[18px] font-semibold tracking-tight text-navy tabular sm:text-[20px]">
              {formatEta(pedidoActual.etaMinutos, pedidoActual.estado)}
            </p>
            <p class="mt-0.5 text-[12px] text-ink-soft">
              {formatEtaLargo(pedidoActual.etaMinutos, pedidoActual.estado)}
            </p>
          </div>
        </div>
      </section>

      {/* Reschedule (only when demorado) + confirmation (after reprogramar) */}
      {pedidoActual.estado === "demorado" && (
        <RescheduleSection
          pedido={pedidoActual}
          onConfirm={handleConfirmarReprogramacion}
        />
      )}
      {pedidoActual.reprogramado && <RescheduleConfirmed pedido={pedidoActual} />}

      {/* Map -------------------------------------------------------- */}
      <section
        aria-labelledby="mapa-heading"
        class="overflow-hidden rounded-[1.75rem] border border-gris bg-papel-soft"
      >
        <div class="flex items-center justify-between border-b border-gris px-5 py-3 sm:px-6">
          <h2
            id="mapa-heading"
            class="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted"
          >
            Recorrido
          </h2>
          <span class="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted">
            CABA · vista esquemática
          </span>
        </div>
        <MapaRuta pedido={pedidoActual} />
        <div class="flex flex-wrap items-center justify-between gap-3 border-t border-gris bg-papel px-5 py-3 text-[11px] text-ink-soft sm:px-6">
          <div class="flex items-center gap-4">
            <span class="inline-flex items-center gap-1.5">
              <span class="h-2 w-2 rounded-full bg-navy"></span>
              Origen
            </span>
            <span class="inline-flex items-center gap-1.5">
              <span class="h-2 w-2 rounded-full bg-accent"></span>
              Destino
            </span>
          </div>
          <span class="font-mono uppercase tracking-[0.18em]">
            {pedidoActual.estado === "entregado"
              ? "Recorrido completado"
              : estadoRecorridoLabel(pedidoActual.estado)}
          </span>
        </div>
      </section>

      {/* Timeline + side info --------------------------------------- */}
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <section
          aria-labelledby="historial-heading"
          class="rounded-[1.75rem] border border-gris bg-papel-soft p-5 sm:p-6 lg:col-span-3"
        >
          <h2
            id="historial-heading"
            class="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted"
          >
            Línea de tiempo
          </h2>
          <ol class="mt-5 space-y-0">
            {pedidoActual.historial.map((evento, i) => {
              const isLast = i === pedidoActual.historial.length - 1;
              const isCurrent =
                pedidoActual.estado !== "entregado" &&
                pedidoActual.estado !== "demorado" &&
                i === pedidoActual.historial.length - 1;
              const isCurrentDelayed =
                pedidoActual.estado === "demorado" &&
                i === pedidoActual.historial.length - 1;
              const dotBase =
                "z-10 grid h-6 w-6 shrink-0 place-items-center rounded-full ring-4";
              const dotClass = isCurrent
                ? `${meta.bgClass} ${meta.textClass} ${meta.ringClass} animate-pulse`
                : isCurrentDelayed
                  ? `${meta.bgClass} ${meta.textClass} ${meta.ringClass} animate-pulse`
                  : "bg-navy ring-papel-line";
              const dotInner = isCurrent || isCurrentDelayed ? (
                <span aria-hidden="true" class={`h-2 w-2 rounded-full ${meta.dotClass}`}></span>
              ) : (
                <IconoCheck className={`h-3 w-3 ${i === pedidoActual.historial.length - 1 && pedidoActual.estado === "entregado" ? "text-white" : "text-white"}`} />
              );
              return (
                <li class="relative flex gap-4 pb-6 last:pb-0">
                  <div class="relative flex flex-col items-center pt-0.5">
                    <span
                      aria-hidden="true"
                      class={[dotBase, dotClass].join(" ")}
                    >
                      {dotInner}
                    </span>
                    {!isLast && (
                      <span
                        aria-hidden="true"
                        class="mt-1.5 w-0.5 flex-1 bg-papel-line"
                      ></span>
                    )}
                  </div>
                  <div class="flex-1 pb-1">
                    <p class="text-[15px] font-semibold tracking-tight text-navy sm:text-[16px]">
                      {evento.descripcion}
                    </p>
                    <p class="mt-1 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-muted">
                      {formatDateTime(evento.timestamp)} · {evento.ubicacion}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <aside class="space-y-6 lg:col-span-2">
          {/* Repartidor */}
          <section
            aria-labelledby="repartidor-heading"
            class="rounded-[1.75rem] border border-gris bg-papel-soft p-5"
          >
            <h2
              id="repartidor-heading"
              class="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted"
            >
              Repartidor
            </h2>
            {pedidoActual.repartidor ? (
              <div class="mt-3">
                <div class="flex items-center gap-3">
                  <div
                    class="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-accent-soft ring-1 ring-gris"
                    aria-hidden="true"
                    // eslint-disable-next-line react/no-danger
                    dangerouslySetInnerHTML={{ __html: pedidoActual.repartidor.foto }}
                  />
                  <div class="flex-1">
                    <p class="text-[14px] font-semibold text-navy">
                      {pedidoActual.repartidor.nombre}
                    </p>
                    <a
                      href={`tel:${pedidoActual.repartidor.telefono}`}
                      class="mt-0.5 inline-flex items-center gap-1 font-mono text-[12px] tabular text-accent-deep hover:underline"
                    >
                      {pedidoActual.repartidor.telefono}
                      <span aria-hidden="true">↗</span>
                      <span class="sr-only">
                        Llamar al repartidor {pedidoActual.repartidor.nombre}
                      </span>
                    </a>
                  </div>
                </div>
                <div class="mt-4 flex flex-wrap gap-2">
                  <a
                    href={`tel:${pedidoActual.repartidor.telefono}`}
                    class="inline-flex h-10 items-center gap-2 rounded-full bg-papel px-4 text-[12px] font-semibold uppercase tracking-[0.14em] text-ink ring-1 ring-gris transition-colors hover:text-accent-deep hover:ring-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy"
                  >
                    <IconoTelefono className="h-3.5 w-3.5" />
                    Llamar
                  </a>
                  <a
                    href={`https://wa.me/${pedidoActual.repartidor.telefono.replace(/[^\d]/g, "")}?text=${encodeURIComponent(
                      `Hola, te escribo por mi pedido ${pedidoActual.codigo}`,
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex h-10 items-center gap-2 rounded-full bg-papel-soft px-4 text-[12px] font-semibold uppercase tracking-[0.14em] text-state-entregado-text ring-1 ring-state-entregado-ring transition-colors hover:bg-state-entregado-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy"
                  >
                    <IconoWhatsApp className="h-3.5 w-3.5" />
                    WhatsApp
                  </a>
                </div>
              </div>
            ) : (
              <p class="mt-3 text-[13px] text-ink-soft">
                Aún sin asignación. Te avisaremos cuando un repartidor tome el
                pedido.
              </p>
            )}
          </section>

          {/* Destinatario */}
          <section
            aria-labelledby="destino-heading"
            class="rounded-[1.75rem] border border-gris bg-papel-soft p-5"
          >
            <h2
              id="destino-heading"
              class="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted"
            >
              Destino
            </h2>
            <p class="mt-2 text-[15px] font-semibold text-navy">
              {pedidoActual.cliente}
            </p>
            <p class="mt-1 text-[13px] text-ink-soft">{pedidoActual.direccion}</p>
          </section>
        </aside>
      </div>
    </div>
  );
}

/* Small lookup so the JSX above stays flat. */
function estadoRecorridoLabel(estado: EstadoPedido): string {
  switch (estado) {
    case "en_camino":
      return "Repartidor en ruta";
    case "preparando":
      return "Aún en depósito";
    case "demorado":
      return "Recorrido en pausa";
    case "entregado":
      return "Recorrido completado";
  }
}