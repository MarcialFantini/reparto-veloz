import { useCallback, useId, useMemo, useState } from "preact/hooks";
import { CODIGO_REGEX, getTodosLosCodigos, normalizarCodigo } from "../lib/pedidos";

type Estado =
  | { tipo: "idle" }
  | { tipo: "cargando" }
  | { tipo: "error"; mensaje: string; codigo?: string };

const CODIGOS_VALIDOS = new Set(getTodosLosCodigos());

interface Props {
  /** Initial code, useful when arriving from a not-found page. */
  initial?: string;
}

export default function ConsultaForm({ initial = "" }: Props) {
  const inputId = useId();
  const errorId = useId();
  const helpId = useId();
  const statusId = useId();

  const [valor, setValor] = useState(initial);
  const [estado, setEstado] = useState<Estado>({ tipo: "idle" });

  const previewNormalizado = useMemo(() => normalizarCodigo(valor), [valor]);

  const handleChange = useCallback((raw: string) => {
    const limpio = raw.toUpperCase();
    setValor(limpio);
    setEstado({ tipo: "idle" });
  }, []);

  const handleSubmit = useCallback(
    (e: Event) => {
      e.preventDefault();
      const codigo = normalizarCodigo(valor);

      if (!codigo) {
        setEstado({
          tipo: "error",
          mensaje: "Ingresá un código de pedido para continuar.",
        });
        return;
      }
      if (!CODIGO_REGEX.test(codigo)) {
        setEstado({
          tipo: "error",
          codigo,
          mensaje:
            "Formato inválido. Debe ser RV- seguido de 6 caracteres alfanuméricos.",
        });
        return;
      }

      // Loading simulado — la consulta es local y resuelve en ms,
      // pero mostramos el spinner un instante para que el feedback
      // sea visible.
      setEstado({ tipo: "cargando" });
      window.setTimeout(() => {
        if (CODIGOS_VALIDOS.has(codigo)) {
          window.location.href = `/rastrear/${encodeURIComponent(codigo)}`;
        } else {
          setEstado({
            tipo: "error",
            codigo,
            mensaje: `No encontramos ningún pedido con el código ${codigo}. Verificá que esté bien escrito.`,
          });
        }
      }, 350);
    },
    [valor],
  );

  const error = estado.tipo === "error";
  const cargando = estado.tipo === "cargando";

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-describedby={`${helpId} ${statusId}`}
      class="w-full"
    >
      <label
        for={inputId}
        class="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted"
      >
        Código de pedido
      </label>

      <div class="mt-2 flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <input
          id={inputId}
          name="code"
          type="tel"
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellcheck={false}
          maxLength={9}
          placeholder="RV-AB12CD"
          aria-invalid={error || undefined}
          aria-describedby={`${helpId} ${error ? errorId : ""}`.trim()}
          value={valor}
          onInput={(e) =>
            handleChange((e.currentTarget as HTMLInputElement).value)
          }
          class={[
            "block h-14 w-full rounded-xl border-0 bg-papel px-4 font-mono text-[20px] uppercase tracking-[0.18em] text-navy placeholder:text-ink-muted placeholder:tracking-[0.18em] focus:outline-none focus:ring-2 focus:ring-navy sm:text-[22px]",
            error ? "ring-2 ring-state-demorado-dot" : "ring-1 ring-gris",
          ].join(" ")}
        />

        <button
          type="submit"
          disabled={cargando}
          aria-busy={cargando || undefined}
          class="inline-flex h-14 shrink-0 items-center justify-center gap-2 self-stretch rounded-xl bg-delivery px-5 text-[13px] font-bold uppercase tracking-[0.16em] text-white ring-1 ring-delivery transition-colors hover:bg-accent-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy disabled:opacity-60 sm:px-7"
        >
          {cargando ? (
            <>
              <svg
                class="h-4 w-4 animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="3"
                  stroke-opacity="0.3"
                ></circle>
                <path
                  fill="currentColor"
                  d="M4 12a8 8 0 0 1 8-8v3a5 5 0 0 0-5 5H4z"
                ></path>
              </svg>
              Buscando
            </>
          ) : (
            <>
              Rastrear
              <span aria-hidden="true">→</span>
            </>
          )}
        </button>
      </div>

      <p id={helpId} class="mt-2 text-[12px] text-ink-soft">
        Formato <span class="font-mono">RV-XXXXXX</span>: dos letras, guión y seis
        caracteres alfanuméricos.
      </p>

      <div id={statusId} aria-live="polite" class="sr-only">
        {estado.tipo === "cargando"
          ? "Buscando pedido"
          : error
            ? estado.mensaje
            : ""}
      </div>

      {error && (
        <p
          id={errorId}
          role="alert"
          class="mt-3 flex items-start gap-2 rounded-xl border border-state-demorado-ring bg-state-demorado-bg px-3 py-2 text-[12px] text-state-demorado-text"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="mt-0.5 h-3.5 w-3.5 shrink-0"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span>
            {estado.mensaje}{" "}
            {estado.codigo && (
              <a
                href={`https://wa.me/5491147771100?text=${encodeURIComponent(`Hola, no encuentro mi pedido ${estado.codigo}.`)}`}
                target="_blank"
                rel="noopener noreferrer"
                class="font-medium underline hover:no-underline"
              >
                Pedir ayuda por WhatsApp
              </a>
            )}
          </span>
        </p>
      )}

      {valor && !error && (
        <p class="mt-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-muted">
          Visto: {previewNormalizado || "—"}
        </p>
      )}
    </form>
  );
}