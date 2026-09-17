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

function IconoEstado({ estado }: { estado: EstadoPedido }) {
  // Each path uses currentColor — visual contrast handled by the
  // surrounding coloured pill, not the stroke.
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
          class="h-7 w-7"
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
          class="h-7 w-7"
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
          stroke-width="1.7"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
          class="h-7 w-7"
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
          class="h-7 w-7"
        >
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
      );
  }
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
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#E5E2DB" stroke-width="0.6"></path>
        </pattern>
        <pattern id="blocks" width="40" height="40" patternUnits="userSpaceOnUse">
          <rect width="36" height="36" x="2" y="2" fill="#FBFAF6"></rect>
          <rect width="36" height="36" x="2" y="2" fill="url(#grid)"></rect>
        </pattern>
      </defs>

      <rect width="360" height="240" fill="url(#blocks)"></rect>

      {/* Roads */}
      <g stroke="#D6CFBE" stroke-width="2" fill="none" opacity="0.7">
        <line x1="0" y1="60" x2="360" y2="60"></line>
        <line x1="0" y1="180" x2="360" y2="180"></line>
        <line x1="80" y1="0" x2="80" y2="240"></line>
        <line x1="260" y1="0" x2="260" y2="240"></line>
      </g>
      <g stroke="#C5BBA2" stroke-width="0.5" stroke-dasharray="2 4">
        <line x1="0" y1="120" x2="360" y2="120"></line>
        <line x1="180" y1="0" x2="180" y2="240"></line>
      </g>

      {/* River */}
      <path
        d="M-10 200 Q80 170 160 200 T360 200 L360 240 L-10 240 Z"
        fill="#EAF1ED"
        opacity="0.8"
      ></path>

      {/* Route */}
      {showRoute && (
        <g>
          <path
            d={pathD}
            stroke="#0F1112"
            stroke-width="2.5"
            fill="none"
            stroke-linecap="round"
            stroke-dasharray={pedido.estado === "preparando" ? "4 4" : "0"}
            opacity="0.85"
          ></path>
          <circle cx={startX} cy={startY} r="6" fill="#0F1112"></circle>
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
        font-family="ui-sans-serif, system-ui, sans-serif"
        font-size="9"
        fill="#0F1112"
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
/* Main island                                                        */
/* ------------------------------------------------------------------ */

interface Props {
  pedido: Pedido;
}

export default function PedidoTracker({ pedido }: Props) {
  const meta = ESTADO_META[pedido.estado];
  const ultimoEvento = pedido.historial[pedido.historial.length - 1];

  return (
    <div class="space-y-8">
      {/* Hero — badge + ETA ----------------------------------------- */}
      <section
        aria-labelledby="estado-heading"
        class="rounded-[1.75rem] border border-gris bg-papel-soft p-5 sm:p-7"
      >
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="space-y-1">
            <p class="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted">
              Pedido
            </p>
            <h1
              id="estado-heading"
              class="font-mono text-[26px] font-semibold tracking-[0.12em] text-ink sm:text-[32px]"
            >
              {pedido.codigo}
            </h1>
          </div>

          <span
            class={[
              "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] ring-1",
              meta.bgClass,
              meta.textClass,
              meta.ringClass,
            ].join(" ")}
          >
            <span
              aria-hidden="true"
              class={[
                "h-1.5 w-1.5 rounded-full",
                meta.dotClass,
                pedido.estado === "en_camino" || pedido.estado === "demorado"
                  ? "animate-pulse"
                  : "",
              ].join(" ")}
            ></span>
            {meta.label}
          </span>
        </div>

        <div class="mt-6 flex flex-col gap-5 sm:flex-row sm:items-center">
          <div
            class={[
              "grid h-14 w-14 shrink-0 place-items-center rounded-2xl ring-1",
              meta.bgClass,
              meta.textClass,
              meta.ringClass,
            ].join(" ")}
            aria-hidden="true"
          >
            <IconoEstado estado={pedido.estado} />
          </div>
          <div class="flex-1">
            <p class="text-[19px] font-semibold tracking-tight text-ink sm:text-[22px]">
              {meta.descripcion}
            </p>
            <p class="mt-1 text-[14px] text-ink-soft">
              {pedido.estado === "entregado"
                ? `Entregado el ${formatDateTime(pedido.historial[pedido.historial.length - 1].timestamp)}`
                : `Última actualización: ${formatTimeOnly(ultimoEvento.timestamp)} · ${ultimoEvento.ubicacion}`}
            </p>
          </div>
          <div class="shrink-0 rounded-2xl border border-gris bg-papel px-4 py-3 text-right">
            <p class="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted">
              ETA
            </p>
            <p class="font-mono text-[20px] font-semibold tracking-tight text-ink">
              {formatEta(pedido.etaMinutos, pedido.estado)}
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
              <span class="h-2 w-2 rounded-full bg-ink"></span>
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
              const dotClass = isCurrent
                ? `${meta.dotClass} ring-4 ring-state-en-camino-ring animate-pulse`
                : "bg-ink ring-4 ring-gris";
              return (
                <li class="relative flex gap-4 pb-5 last:pb-0">
                  <div class="relative flex flex-col items-center pt-1">
                    <span
                      aria-hidden="true"
                      class={[
                        "z-10 h-4 w-4 rounded-full ring-4",
                        dotClass,
                      ].join(" ")}
                    ></span>
                    {!isLast && (
                      <span
                        aria-hidden="true"
                        class="mt-1 w-px flex-1 bg-gris"
                      ></span>
                    )}
                  </div>
                  <div class="flex-1 pb-1">
                    <p class="text-[14px] font-medium text-ink">
                      {evento.descripcion}
                    </p>
                    <p class="mt-1 font-mono text-[11px] text-ink-muted">
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
                  <p class="text-[14px] font-semibold text-ink">
                    {pedido.repartidor.nombre}
                  </p>
                  <a
                    href={`tel:${pedido.repartidor.telefono}`}
                    class="mt-0.5 inline-flex items-center gap-1 font-mono text-[12px] text-accent-deep hover:underline"
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
            <p class="mt-2 text-[15px] font-semibold text-ink">
              {pedido.cliente}
            </p>
            <p class="mt-1 text-[13px] text-ink-soft">{pedido.direccion}</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
