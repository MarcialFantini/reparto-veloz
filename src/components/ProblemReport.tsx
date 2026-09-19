import { useCallback, useEffect, useId, useState } from "preact/hooks";

/* ------------------------------------------------------------------ */
/* localStorage namespace — symmetric with RatingForm / PedidoTracker. */
/* ------------------------------------------------------------------ */

const STORAGE_REPORTS = "repartoveloz:reports";

type TipoProblema =
  | "destinatario_ausente"
  | "direccion_incorrecta"
  | "producto_danado"
  | "otro";

interface Reporte {
  codigo: string;
  nombre: string;
  telefono: string;
  tipo: TipoProblema;
  /** Free-form additional notes, may be empty. */
  detalle: string;
  /** ISO timestamp. */
  createdAt: string;
}

type ReporteMap = Record<string, Reporte>;

const TIPOS: ReadonlyArray<{ id: TipoProblema; label: string; detail: string }> = [
  {
    id: "destinatario_ausente",
    label: "Destinatario ausente",
    detail: "No había nadie para recibir el paquete en la dirección.",
  },
  {
    id: "direccion_incorrecta",
    label: "Dirección incorrecta",
    detail: "La dirección que tengo registrada no coincide.",
  },
  {
    id: "producto_danado",
    label: "Producto dañado",
    detail: "El paquete o el contenido llegó en mal estado.",
  },
  {
    id: "otro",
    label: "Otro motivo",
    detail: "Contanos qué pasó en el campo de detalle.",
  },
];

function loadAllReports(): ReporteMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_REPORTS);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as ReporteMap;
    }
    return {};
  } catch {
    return {};
  }
}

function loadReport(codigo: string): Reporte | null {
  return loadAllReports()[codigo] ?? null;
}

function saveReport(codigo: string, reporte: Reporte): Reporte {
  const all = loadAllReports();
  all[codigo] = reporte;
  try {
    window.localStorage.setItem(STORAGE_REPORTS, JSON.stringify(all));
  } catch {
    /* quota exceeded — keep in-memory state */
  }
  return reporte;
}

/* ------------------------------------------------------------------ */
/* Inline icons                                                       */
/* ------------------------------------------------------------------ */

function IconoAlerta({ className }: { className?: string }) {
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
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
      <line x1="12" y1="9" x2="12" y2="13"></line>
      <line x1="12" y1="17" x2="12.01" y2="17"></line>
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
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

const TELEFONO_REGEX = /^[\d\s+()-]{8,20}$/;
const DETALLE_MAX = 400;

function formatRelative(iso: string): string {
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

function tipoLabel(id: TipoProblema): string {
  return TIPOS.find((t) => t.id === id)?.label ?? id;
}

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

interface Props {
  codigo: string;
}

export default function ProblemReport({ codigo }: Props) {
  const nombreId = useId();
  const telefonoId = useId();
  const detalleId = useId();
  const statusId = useId();

  const [hydrated, setHydrated] = useState(false);
  const [saved, setSaved] = useState<Reporte | null>(null);
  const [open, setOpen] = useState(false);

  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [tipo, setTipo] = useState<TipoProblema>("destinatario_ausente");
  const [detalle, setDetalle] = useState("");

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const existing = loadReport(codigo);
    setSaved(existing);
    setHydrated(true);
    if (!existing) {
      setOpen(true);
    }
  }, [codigo]);

  const handleEmpezar = useCallback(() => {
    setError(null);
    setOpen(true);
  }, []);

  const handleCancelar = useCallback(() => {
    setError(null);
    setOpen(false);
  }, []);

  const handleEnviar = useCallback(() => {
    if (nombre.trim().length < 2) {
      setError("Ingresá tu nombre y apellido para que podamos llamarte.");
      return;
    }
    if (!TELEFONO_REGEX.test(telefono.trim())) {
      setError("Ingresá un teléfono válido (sólo números, espacios, + y guiones).");
      return;
    }
    if (tipo === "otro" && detalle.trim().length < 5) {
      setError("Contanos brevemente qué pasó en el campo de detalle.");
      return;
    }
    setError(null);
    const reporte: Reporte = {
      codigo,
      nombre: nombre.trim(),
      telefono: telefono.trim(),
      tipo,
      detalle: detalle.trim(),
      createdAt: new Date().toISOString(),
    };
    const stored = saveReport(codigo, reporte);
    setSaved(stored);
    setOpen(false);
  }, [codigo, detalle, nombre, telefono, tipo]);

  const detalleRestante = DETALLE_MAX - detalle.length;

  /* ------------------------------------------------------- */
  /* Saved confirmation                                      */
  /* ------------------------------------------------------- */
  if (saved && !open) {
    return (
      <section
        aria-labelledby="problema-heading"
        class="rounded-[1.75rem] border border-state-demorado-ring bg-state-demorado-bg p-5 sm:p-6"
      >
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="flex items-start gap-3">
            <span
              aria-hidden="true"
              class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-state-demorado-text ring-2 ring-state-demorado-ring"
            >
              <IconoAlerta className="h-4 w-4" />
            </span>
            <div>
              <p class="font-mono text-[10px] uppercase tracking-[0.18em] text-state-demorado-text">
                Reporte registrado
              </p>
              <h2
                id="problema-heading"
                class="mt-1 text-[18px] font-semibold tracking-tight text-state-demorado-text sm:text-[20px]"
              >
                Gracias por avisarnos
              </h2>
              <p class="mt-2 max-w-[52ch] text-[13px] leading-relaxed text-state-demorado-text/90">
                Reportaste <strong>{tipoLabel(saved.tipo)}</strong>{" "}
                {saved.detalle ? (
                  <>
                    con el siguiente detalle: <em>“{saved.detalle}”</em>
                  </>
                ) : null}
                . Te vamos a llamar al{" "}
                <span class="font-mono">{saved.telefono}</span> a la brevedad.
              </p>
              <p class="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-state-demorado-text/70">
                Reportado el {formatRelative(saved.createdAt)} · pedido{" "}
                <span class="font-mono">{saved.codigo}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleEmpezar}
            class="inline-flex h-10 items-center gap-2 rounded-full bg-papel px-4 text-[12px] font-semibold uppercase tracking-[0.14em] text-ink ring-1 ring-gris transition-colors hover:text-accent-deep hover:ring-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy"
          >
            Editar reporte
          </button>
        </div>
      </section>
    );
  }

  /* ------------------------------------------------------- */
  /* Form                                                    */
  /* ------------------------------------------------------- */
  return (
    <section
      aria-labelledby="problema-heading"
      class="rounded-[1.75rem] border border-state-demorado-ring bg-papel-soft p-5 sm:p-6"
    >
      <div class="flex items-start gap-3">
        <span
          aria-hidden="true"
          class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-state-demorado-bg text-state-demorado-text ring-2 ring-state-demorado-ring"
        >
          <IconoAlerta className="h-4 w-4" />
        </span>
        <div class="flex-1">
          <p class="font-mono text-[10px] uppercase tracking-[0.18em] text-state-demorado-text">
            ¿Algo no salió bien?
          </p>
          <h2
            id="problema-heading"
            class="mt-1 text-[18px] font-semibold tracking-tight text-navy sm:text-[20px]"
          >
            Reportar un problema
          </h2>
          <p class="mt-1 text-[13px] text-ink-soft">
            Contanos qué pasó con el pedido{" "}
            <span class="font-mono">{codigo}</span> y te llamamos a la brevedad.
          </p>
        </div>
      </div>

      <fieldset class="mt-5">
        <legend class="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted">
          Tipo de problema
        </legend>
        <div class="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {TIPOS.map((t) => {
            const selected = t.id === tipo;
            return (
              <label
                key={t.id}
                class={[
                  "flex cursor-pointer gap-3 rounded-xl border px-4 py-3 transition-colors",
                  selected
                    ? "border-accent bg-accent-soft ring-2 ring-accent"
                    : "border-gris bg-papel hover:border-accent",
                ].join(" ")}
              >
                <input
                  type="radio"
                  name="tipo"
                  value={t.id}
                  checked={selected}
                  onChange={() => setTipo(t.id)}
                  class="mt-0.5 h-4 w-4 accent-delivery"
                />
                <span>
                  <span class="block text-[14px] font-semibold text-navy">
                    {t.label}
                  </span>
                  <span class="block text-[12px] text-ink-soft">
                    {t.detail}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div class="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label
            for={nombreId}
            class="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted"
          >
            Nombre y apellido
          </label>
          <input
            id={nombreId}
            name="nombre"
            type="text"
            autoComplete="name"
            maxLength={80}
            value={nombre}
            onInput={(e) =>
              setNombre((e.currentTarget as HTMLInputElement).value)
            }
            placeholder="Juan Pérez"
            class="mt-2 block h-11 w-full rounded-xl border-0 bg-papel px-3 text-[14px] text-navy placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-navy"
          />
        </div>
        <div>
          <label
            for={telefonoId}
            class="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted"
          >
            Teléfono de contacto
          </label>
          <input
            id={telefonoId}
            name="telefono"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            maxLength={20}
            value={telefono}
            onInput={(e) =>
              setTelefono((e.currentTarget as HTMLInputElement).value)
            }
            placeholder="+54 11 5555-5555"
            class="mt-2 block h-11 w-full rounded-xl border-0 bg-papel px-3 font-mono text-[14px] tabular text-navy placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-navy"
          />
        </div>
      </div>

      <div class="mt-5">
        <label
          for={detalleId}
          class="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted"
        >
          Detalle (opcional, salvo para “Otro motivo”)
        </label>
        <textarea
          id={detalleId}
          name="detalle"
          rows={3}
          maxLength={DETALLE_MAX}
          value={detalle}
          onInput={(e) =>
            setDetalle((e.currentTarget as HTMLTextAreaElement).value)
          }
          placeholder="Contanos qué pasó…"
          class="mt-2 block w-full resize-none rounded-xl border-0 bg-papel px-3 py-2.5 text-[14px] leading-relaxed text-navy placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-navy"
        />
        <p class="mt-1 text-right font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted">
          {detalleRestante} caracteres
        </p>
      </div>

      {error && (
        <p
          id={statusId}
          role="alert"
          aria-live="polite"
          class="mt-3 flex items-start gap-2 rounded-xl border border-state-demorado-ring bg-state-demorado-bg px-3 py-2 text-[12px] text-state-demorado-text"
        >
          <span aria-hidden="true" class="mt-0.5">
            <IconoAlerta className="h-3.5 w-3.5" />
          </span>
          <span>{error}</span>
        </p>
      )}

      <div class="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
        <button
          type="button"
          onClick={handleCancelar}
          class="inline-flex h-11 items-center justify-center rounded-xl px-5 text-[13px] font-semibold uppercase tracking-[0.16em] text-ink-soft ring-1 ring-gris transition-colors hover:text-accent-deep hover:ring-accent"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleEnviar}
          disabled={!hydrated}
          class="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-delivery px-5 text-[13px] font-bold uppercase tracking-[0.16em] text-white ring-1 ring-delivery transition-colors hover:bg-accent-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy disabled:cursor-not-allowed disabled:opacity-60"
        >
          <IconoCheck className="h-3.5 w-3.5" />
          Enviar reporte
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </section>
  );
}
