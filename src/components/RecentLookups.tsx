import { useCallback, useEffect, useId, useState } from "preact/hooks";

/* ------------------------------------------------------------------ */
/* localStorage namespace — symmetric with the other RV islands.      */
/* ------------------------------------------------------------------ */

const STORAGE_LOOKUPS = "repartoveloz:recent-lookups";

interface RecentEntry {
  codigo: string;
  estado: string;
  /** ISO timestamp of the last lookup. */
  lookedAt: string;
}

const MAX_ENTRIES = 6;

function loadRecent(): RecentEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_LOOKUPS);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed
        .filter((entry): entry is RecentEntry => {
          if (!entry || typeof entry !== "object") return false;
          const e = entry as Record<string, unknown>;
          return (
            typeof e.codigo === "string" &&
            typeof e.estado === "string" &&
            typeof e.lookedAt === "string"
          );
        })
        .slice(0, MAX_ENTRIES);
    }
    return [];
  } catch {
    return [];
  }
}

export function pushRecent(codigo: string, estado: string): void {
  if (typeof window === "undefined") return;
  try {
    const current = loadRecent();
    const without = current.filter((e) => e.codigo !== codigo);
    const next: RecentEntry[] = [
      { codigo, estado, lookedAt: new Date().toISOString() },
      ...without,
    ].slice(0, MAX_ENTRIES);
    window.localStorage.setItem(STORAGE_LOOKUPS, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("rv:recent-lookups-changed"));
  } catch {
    /* quota exceeded — ignore */
  }
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatRelative(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const min = Math.round(diff / 60000);
    if (min < 1) return "hace instantes";
    if (min < 60) return `hace ${min} min`;
    const h = Math.round(min / 60);
    if (h < 24) return `hace ${h} h`;
    const d = Math.round(h / 24);
    if (d < 7) return `hace ${d} d`;
    return new Date(iso).toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "short",
    });
  } catch {
    return iso;
  }
}

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

export default function RecentLookups() {
  const headingId = useId();
  const [hydrated, setHydrated] = useState(false);
  const [entries, setEntries] = useState<RecentEntry[]>([]);

  const refresh = useCallback(() => {
    setEntries(loadRecent());
  }, []);

  useEffect(() => {
    setHydrated(true);
    refresh();
    const onChange = () => refresh();
    window.addEventListener("rv:recent-lookups-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("rv:recent-lookups-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [refresh]);

  const handleClear = () => {
    try {
      window.localStorage.removeItem(STORAGE_LOOKUPS);
      window.dispatchEvent(new CustomEvent("rv:recent-lookups-changed"));
    } catch {
      /* ignore */
    }
  };

  if (!hydrated) return null;
  if (entries.length === 0) {
    return (
      <div class="rounded-2xl border border-dashed border-gris bg-papel-soft p-5">
        <p
          id={headingId}
          class="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted"
        >
          Búsquedas recientes
        </p>
        <p class="mt-2 text-[13px] text-ink-soft">
          Tus últimas consultas aparecerán acá. Sólo se guardan en este
          dispositivo y las podés borrar cuando quieras.
        </p>
      </div>
    );
  }

  return (
    <div class="rounded-2xl border border-gris bg-papel-soft p-5">
      <div class="flex items-center justify-between gap-3">
        <p
          id={headingId}
          class="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted"
        >
          Búsquedas recientes
        </p>
        <button
          type="button"
          onClick={handleClear}
          class="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft underline-offset-4 hover:text-accent-deep hover:underline"
        >
          Borrar
        </button>
      </div>
      <ul class="mt-3 divide-y divide-gris">
        {entries.map((e) => (
          <li class="flex items-center justify-between gap-3 py-2.5">
            <a
              href={`/rastrear/${encodeURIComponent(e.codigo)}`}
              class="flex flex-1 items-center gap-3 hover:text-accent-deep"
            >
              <span class="font-mono text-[13px] tracking-[0.12em] text-navy">
                {e.codigo}
              </span>
              <span class="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
                {e.estado.replace("_", " ")}
              </span>
            </a>
            <span class="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
              {formatRelative(e.lookedAt)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
