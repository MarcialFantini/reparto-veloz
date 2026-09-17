import { useState } from "preact/hooks";
import { ESTADO_META, type EstadoPedido, type Pedido } from "../types/pedido";
import * as preact from "preact";

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
/* Main island                                                        */
/* ------------------------------------------------------------------ */

interface Props {
  pedido: Pedido;
}

export default function PedidoTracker({ pedido }: Props) {
  const meta = ESTADO_META[pedido.estado];
  const ultimoEvento = pedido.historial[pedido.historial.length - 1];
  const [copiado, setCopiado] = useState(false);

  const handleCopiar = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(pedido.codigo);
      } else {
        // Fallback for older browsers / non-https previews.
        const ta = document.createElement("textarea");
        ta.value = pedido.codigo;
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
                {pedido.codigo}
              </h1>
              <button
                type="button"
                onClick={handleCopiar}
                aria-label={
                  copiado
                    ? `Código ${pedido.codigo} copiado al portapapeles`
                    : `Copiar código ${pedido.codigo} al portapapeles`
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

          <BadgeEstado estado={pedido.estado} />
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
            <IconoEstado estado={pedido.estado} className="h-7 w-7 sm:h-8 sm:w-8" />
          </div>
          <div class="flex-1">
            <p class="text-[19px] font-semibold tracking-tight text-navy sm:text-[22px]">
              {meta.descripcion}
            </p>
            <p class="mt-1 text-[14px] text-ink-soft">
              {pedido.estado === "entregado"
                ? `Entregado el ${formatDateTime(pedido.historial[pedido.historial.length - 1].timestamp)}`
                : `Última actualización: ${formatTimeOnly(ultimoEvento.timestamp)} · ${ultimoEvento.ubicacion}`}
            </p>
          </div>
          <div class="shrink-0 rounded-2xl border border-gris bg-papel px-4 py-3 text-left sm:text-right">
            <p class="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted">
              ETA
            </p>
            <p class="font-mono text-[18px] font-semibold tracking-tight text-navy tabular sm:text-[20px]">
              {formatEta(pedido.etaMinutos, pedido.estado)}
            </p>
            <p class="mt-0.5 text-[12px] text-ink-soft">
              {formatEtaLargo(pedido.etaMinutos, pedido.estado)}
            </p>
          </div>
        </div>
      </section>

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
        <MapaRuta pedido={pedido} />
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
            {pedido.estado === "entregado"
              ? "Recorrido completado"
              : pedido.estado === "en_camino"
                ? "Repartidor en ruta"
                : pedido.estado === "preparando"
                  ? "Aún en depósito"
                  : "Recorrido en pausa"}
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
            {pedido.historial.map((evento, i) => {
              const isLast = i === pedido.historial.length - 1;
              const isCurrent =
                pedido.estado !== "entregado" &&
                pedido.estado !== "demorado" &&
                i === pedido.historial.length - 1;
              const isCurrentDelayed =
                pedido.estado === "demorado" &&
                i === pedido.historial.length - 1;
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
                <IconoCheck className={`h-3 w-3 ${i === pedido.historial.length - 1 && pedido.estado === "entregado" ? "text-white" : "text-white"}`} />
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
            {pedido.repartidor ? (
              <div class="mt-3 flex items-center gap-3">
                <div
                  class="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-accent-soft ring-1 ring-gris"
                  aria-hidden="true"
                  // eslint-disable-next-line react/no-danger
                  dangerouslySetInnerHTML={{ __html: pedido.repartidor.foto }}
                />
                <div class="flex-1">
                  <p class="text-[14px] font-semibold text-navy">
                    {pedido.repartidor.nombre}
                  </p>
                  <a
                    href={`tel:${pedido.repartidor.telefono}`}
                    class="mt-0.5 inline-flex items-center gap-1 font-mono text-[12px] tabular text-accent-deep hover:underline"
                  >
                    {pedido.repartidor.telefono}
                    <span aria-hidden="true">↗</span>
                    <span class="sr-only">
                      Llamar al repartidor {pedido.repartidor.nombre}
                    </span>
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
              {pedido.cliente}
            </p>
            <p class="mt-1 text-[13px] text-ink-soft">{pedido.direccion}</p>
          </section>
        </aside>
      </div>
    </div>
  );
}