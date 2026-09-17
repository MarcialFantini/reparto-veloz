import { useEffect, useId, useState } from "preact/hooks";

/* ------------------------------------------------------------------ */
/* localStorage namespace — symetric with the reschedule namespace.   */
/* ------------------------------------------------------------------ */

const STORAGE_RATINGS = "repartoveloz:ratings";

interface RatingReview {
  /** 1–5 stars. */
  rating: number;
  /** Free-form comment, may be empty. */
  comentario: string;
  /** ISO timestamp of the most recent save. */
  updatedAt: string;
}

type RatingMap = Record<string, RatingReview>;

function loadAllRatings(): RatingMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_RATINGS);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as RatingMap;
    }
    return {};
  } catch {
    return {};
  }
}

function loadRating(codigo: string): RatingReview | null {
  return loadAllRatings()[codigo] ?? null;
}

function saveRating(codigo: string, review: RatingReview): RatingReview {
  const all = loadAllRatings();
  all[codigo] = review;
  try {
    window.localStorage.setItem(STORAGE_RATINGS, JSON.stringify(all));
  } catch {
    /* quota exceeded / disabled storage — keep in-memory state, the
     * user still sees their selection for this session. */
  }
  return review;
}

/* ------------------------------------------------------------------ */
/* Inline icons                                                       */
/* ------------------------------------------------------------------ */

function IconoEstrella({
  filled,
  className,
}: {
  filled: boolean;
  className?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={className ?? "h-7 w-7"}
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
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

function IconoLapiz({ className }: { className?: string }) {
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
      <path d="M12 20h9"></path>
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

const RATING_LABELS: Record<number, string> = {
  1: "Muy mala",
  2: "Mala",
  3: "Aceptable",
  4: "Buena",
  5: "Excelente",
};

const COMENTARIO_MAX = 280;

function formatRelative(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("es-AR", {
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

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

interface Props {
  codigo: string;
  estado: string;
}

export default function RatingForm({ codigo, estado }: Props) {
  const ratingId = useId();
  const commentId = useId();
  const statusId = useId();

  /* Solo visible cuando el pedido está entregado. Lo gateamos acá
   * adentro para que la página pueda montar el island sin condición. */
  if (estado !== "entregado") return null;

  const [hydrated, setHydrated] = useState(false);
  const [saved, setSaved] = useState<RatingReview | null>(null);
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState<number>(0);
  const [hover, setHover] = useState<number>(0);
  const [comentario, setComentario] = useState("");
  const [showThanks, setShowThanks] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Hydrate from localStorage on mount. */
  useEffect(() => {
    const existing = loadRating(codigo);
    setSaved(existing);
    setHydrated(true);
  }, [codigo]);

  const ratingActual = hover || rating;
  const labelActual = ratingActual > 0 ? RATING_LABELS[ratingActual] : "";

  const handleGuardar = () => {
    if (rating < 1) {
      setError("Elegí al menos una estrella para enviar tu calificación.");
      return;
    }
    setError(null);
    const review: RatingReview = {
      rating,
      comentario: comentario.trim(),
      updatedAt: new Date().toISOString(),
    };
    const stored = saveRating(codigo, review);
    setSaved(stored);
    setEditing(false);
    setShowThanks(true);
  };

  const handleEmpezarEdicion = () => {
    if (!saved) return;
    setRating(saved.rating);
    setComentario(saved.comentario);
    setEditing(true);
    setShowThanks(false);
    setError(null);
  };

  const handleCancelarEdicion = () => {
    if (saved) {
      setRating(saved.rating);
      setComentario(saved.comentario);
    } else {
      setRating(0);
      setComentario("");
    }
    setEditing(false);
    setError(null);
  };

  const comentarioRestante = COMENTARIO_MAX - comentario.length;

  /* ------------------------------------------------------- */
  /* Confirmed view (saved && !editing)                      */
  /* ------------------------------------------------------- */
  if (saved && !editing) {
    return (
      <section
        aria-labelledby="calificacion-heading"
        class="rounded-[1.75rem] border border-gris bg-papel-soft p-5 sm:p-6"
      >
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p class="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted">
              Calificá tu experiencia
            </p>
            <h2
              id="calificacion-heading"
              class="mt-1 text-[19px] font-semibold tracking-tight text-navy sm:text-[22px]"
            >
              {showThanks ? "¡Gracias por tu calificación!" : "Tu calificación"}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleEmpezarEdicion}
            class="inline-flex h-10 items-center gap-2 rounded-full bg-papel px-4 text-[12px] font-semibold uppercase tracking-[0.14em] text-ink ring-1 ring-gris transition-colors hover:text-accent-deep hover:ring-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy"
          >
            <IconoLapiz className="h-3.5 w-3.5" />
            Editar
          </button>
        </div>

        <div
          class="mt-4 rounded-2xl border border-state-entregado-ring bg-state-entregado-bg p-4 sm:p-5"
          aria-live="polite"
        >
          <div class="flex items-center gap-3">
            <span
              class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-state-entregado-text ring-2 ring-state-entregado-ring"
              aria-hidden="true"
            >
              <IconoCheck className="h-4 w-4" />
            </span>
            <div>
              <p class="font-mono text-[10px] uppercase tracking-[0.18em] text-state-entregado-text">
                {saved.rating} de 5 estrellas · {RATING_LABELS[saved.rating]}
              </p>
              <div
                class="mt-1 flex items-center gap-0.5 text-state-entregado-text"
                aria-label={`${saved.rating} de 5 estrellas`}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <IconoEstrella
                    key={n}
                    filled={n <= saved.rating}
                    className="h-4 w-4"
                  />
                ))}
              </div>
            </div>
          </div>
          {saved.comentario && (
            <p class="mt-3 whitespace-pre-line text-[14px] text-state-entregado-text">
              “{saved.comentario}”
            </p>
          )}
          <p class="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-state-entregado-text/70">
            Guardada el {formatRelative(saved.updatedAt)}
          </p>
        </div>
      </section>
    );
  }

  /* ------------------------------------------------------- */
  /* Editor view (no saved || editing)                       */
  /* ------------------------------------------------------- */
  return (
    <section
      aria-labelledby="calificacion-heading"
      class="rounded-[1.75rem] border border-gris bg-papel-soft p-5 sm:p-6"
    >
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted">
            Calificá tu experiencia
          </p>
          <h2
            id="calificacion-heading"
            class="mt-1 text-[19px] font-semibold tracking-tight text-navy sm:text-[22px]"
          >
            {saved ? "Editar calificación" : "¿Cómo fue tu entrega?"}
          </h2>
          <p class="mt-1 text-[13px] text-ink-soft">
            Pedido <span class="font-mono">{codigo}</span>. Tu opinión nos ayuda a
            mejorar.
          </p>
        </div>
        {saved && (
          <button
            type="button"
            onClick={handleCancelarEdicion}
            class="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-soft underline-offset-4 hover:text-accent-deep hover:underline"
          >
            Cancelar
          </button>
        )}
      </div>

      <div class="mt-5">
        <label
          id={ratingId}
          class="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted"
        >
          Tu calificación
        </label>
        <div
          role="radiogroup"
          aria-labelledby={ratingId}
          aria-describedby={statusId}
          class="mt-2 flex items-center gap-1.5 sm:gap-2"
          onMouseLeave={() => setHover(0)}
        >
          {[1, 2, 3, 4, 5].map((n) => {
            const isFilled = n <= ratingActual;
            return (
              <button
                type="button"
                key={n}
                role="radio"
                aria-checked={rating === n}
                aria-label={`${n} estrella${n === 1 ? "" : "s"} · ${RATING_LABELS[n]}`}
                onClick={() => {
                  setRating(n);
                  setError(null);
                }}
                onMouseEnter={() => setHover(n)}
                onFocus={() => setHover(n)}
                onBlur={() => setHover(0)}
                class={[
                  "grid h-11 w-11 shrink-0 place-items-center rounded-xl ring-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy sm:h-12 sm:w-12",
                  isFilled
                    ? "bg-accent-soft text-accent-deep ring-accent"
                    : "bg-papel text-ink-muted ring-gris hover:text-accent-deep hover:ring-accent",
                ].join(" ")}
              >
                <IconoEstrella filled={isFilled} className="h-6 w-6 sm:h-7 sm:w-7" />
              </button>
            );
          })}
          <span
            id={statusId}
            aria-live="polite"
            class="ml-2 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-muted"
          >
            {labelActual || "Sin calificar"}
          </span>
        </div>
      </div>

      <div class="mt-5">
        <label
          for={commentId}
          class="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted"
        >
          Comentario (opcional)
        </label>
        <textarea
          id={commentId}
          name="comentario"
          rows={3}
          maxLength={COMENTARIO_MAX}
          placeholder="Contanos qué te pareció la entrega…"
          value={comentario}
          onInput={(e) =>
            setComentario((e.currentTarget as HTMLTextAreaElement).value)
          }
          class="mt-2 block w-full resize-none rounded-xl border-0 bg-papel px-4 py-3 text-[14px] leading-relaxed text-navy placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-navy"
        />
        <p class="mt-1 text-right font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted">
          {comentarioRestante} caracteres
        </p>
      </div>

      {error && (
        <p
          role="alert"
          class="mt-3 flex items-start gap-2 rounded-xl border border-state-demorado-ring bg-state-demorado-bg px-3 py-2 text-[12px] text-state-demorado-text"
        >
          <span aria-hidden="true" class="mt-0.5">
            ⚠
          </span>
          <span>{error}</span>
        </p>
      )}

      <div class="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
        {saved && (
          <button
            type="button"
            onClick={handleCancelarEdicion}
            class="inline-flex h-11 items-center justify-center rounded-xl px-5 text-[13px] font-semibold uppercase tracking-[0.16em] text-ink-soft ring-1 ring-gris transition-colors hover:text-accent-deep hover:ring-accent"
          >
            Cancelar
          </button>
        )}
        <button
          type="button"
          onClick={handleGuardar}
          class="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-delivery px-5 text-[13px] font-bold uppercase tracking-[0.16em] text-white ring-1 ring-delivery transition-colors hover:bg-accent-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!hydrated}
        >
          Enviar calificación
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </section>
  );
}
