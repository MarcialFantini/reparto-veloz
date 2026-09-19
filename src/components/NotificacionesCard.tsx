import { useEffect, useId, useState } from "preact/hooks";

/* ------------------------------------------------------------------ */
/* localStorage namespace — keeps the toggle state for the home page.  */
/* ------------------------------------------------------------------ */

const STORAGE_NOTIF = "repartoveloz:notifications";

interface NotifPrefs {
  whatsapp: boolean;
  sms: boolean;
  updatedAt: string;
}

function loadPrefs(): NotifPrefs {
  const empty: NotifPrefs = {
    whatsapp: false,
    sms: false,
    updatedAt: new Date().toISOString(),
  };
  if (typeof window === "undefined") return empty;
  try {
    const raw = window.localStorage.getItem(STORAGE_NOTIF);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<NotifPrefs>;
    return {
      whatsapp: Boolean(parsed.whatsapp),
      sms: Boolean(parsed.sms),
      updatedAt: parsed.updatedAt ?? empty.updatedAt,
    };
  } catch {
    return empty;
  }
}

function savePrefs(prefs: NotifPrefs): NotifPrefs {
  if (typeof window === "undefined") return prefs;
  try {
    window.localStorage.setItem(STORAGE_NOTIF, JSON.stringify(prefs));
  } catch {
    /* quota exceeded — keep in-memory state */
  }
  return prefs;
}

/* ------------------------------------------------------------------ */
/* Inline icons                                                       */
/* ------------------------------------------------------------------ */

function IconoWhatsApp({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      class={className ?? "h-5 w-5"}
    >
      <path d="M19.11 4.91A10 10 0 0 0 3.6 17.06L2 22l5.06-1.58a10 10 0 0 0 4.78 1.22h.01a10 10 0 0 0 7.26-16.73zm-7.26 15.36h-.01a8.34 8.34 0 0 1-4.25-1.16l-.3-.18-3 .94.96-2.92-.2-.31a8.36 8.36 0 1 1 6.8 3.63zm4.58-6.27c-.25-.13-1.48-.73-1.71-.81-.23-.08-.4-.13-.56.13-.17.25-.65.81-.79.98-.15.17-.29.19-.54.06-.25-.13-1.06-.39-2.02-1.24-.75-.66-1.25-1.48-1.4-1.73-.15-.25-.02-.39.11-.51.11-.11.25-.29.38-.44.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.34-.77-1.84-.2-.48-.4-.42-.56-.43h-.48c-.17 0-.44.06-.67.31s-.88.86-.88 2.1.9 2.43 1.03 2.6c.13.17 1.77 2.7 4.29 3.79.6.26 1.07.42 1.43.53.6.19 1.15.16 1.58.1.48-.07 1.48-.61 1.69-1.2.21-.59.21-1.1.15-1.2-.06-.1-.23-.16-.48-.29z"></path>
    </svg>
  );
}

function IconoSms({ className }: { className?: string }) {
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
      class={className ?? "h-5 w-5"}
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      <line x1="8" y1="10" x2="8.01" y2="10"></line>
      <line x1="12" y1="10" x2="12.01" y2="10"></line>
      <line x1="16" y1="10" x2="16.01" y2="10"></line>
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
      class={className ?? "h-3.5 w-3.5"}
    >
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

export default function NotificacionesCard() {
  const switchId = useId();
  const [hydrated, setHydrated] = useState(false);
  const [whatsapp, setWhatsapp] = useState(false);
  const [sms, setSms] = useState(false);

  useEffect(() => {
    const prefs = loadPrefs();
    setWhatsapp(prefs.whatsapp);
    setSms(prefs.sms);
    setHydrated(true);
  }, []);

  const handleToggle = (canal: "whatsapp" | "sms") => {
    const next: NotifPrefs = {
      whatsapp: canal === "whatsapp" ? !whatsapp : whatsapp,
      sms: canal === "sms" ? !sms : sms,
      updatedAt: new Date().toISOString(),
    };
    setWhatsapp(next.whatsapp);
    setSms(next.sms);
    savePrefs(next);
  };

  const activo = whatsapp || sms;

  return (
    <div class="rounded-2xl border border-gris bg-papel p-5 sm:p-6">
      <div class="flex items-start gap-3">
        <span
          aria-hidden="true"
          class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-deep ring-1 ring-accent"
        >
          <IconoWhatsApp className="h-5 w-5" />
        </span>
        <div class="flex-1">
          <p class="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted">
            Notificaciones
          </p>
          <h3 class="mt-1 text-[17px] font-semibold tracking-tight text-navy sm:text-[18px]">
            Recibí avisos por WhatsApp o SMS
          </h3>
          <p class="mt-1 text-[13px] leading-relaxed text-ink-soft">
            Te avisamos cuando tu pedido cambie de estado. Podés activar uno o
            los dos canales.
          </p>
        </div>
      </div>

      <div class="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <ToggleChip
          id={`${switchId}-wa`}
          checked={hydrated && whatsapp}
          onChange={() => handleToggle("whatsapp")}
          label="WhatsApp"
          icon={<IconoWhatsApp className="h-4 w-4" />}
        />
        <ToggleChip
          id={`${switchId}-sms`}
          checked={hydrated && sms}
          onChange={() => handleToggle("sms")}
          label="SMS"
          icon={<IconoSms className="h-4 w-4" />}
        />
      </div>

      <p
        class={[
          "mt-4 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em]",
          activo ? "text-state-entregado-text" : "text-ink-muted",
        ].join(" ")}
        aria-live="polite"
      >
        {activo ? (
          <>
            <IconoCheck className="h-3.5 w-3.5" />
            Activo · te avisamos al cambiar de estado
          </>
        ) : (
          <>Sin canales activos · no te vamos a escribir</>
        )}
      </p>
    </div>
  );
}

function ToggleChip({
  id,
  checked,
  onChange,
  label,
  icon,
}: {
  id: string;
  checked: boolean;
  onChange: () => void;
  label: string;
  icon: preact.ComponentChild;
}) {
  return (
    <label
      class={[
        "flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors",
        checked
          ? "border-accent bg-accent-soft ring-2 ring-accent"
          : "border-gris bg-papel-soft hover:border-accent",
      ].join(" ")}
      for={id}
    >
      <span class="flex items-center gap-2 text-[13px] font-semibold text-navy">
        <span
          aria-hidden="true"
          class={[
            "grid h-7 w-7 place-items-center rounded-lg",
            checked
              ? "bg-white text-accent-deep ring-1 ring-accent"
              : "bg-papel text-ink-soft ring-1 ring-gris",
          ].join(" ")}
        >
          {icon}
        </span>
        {label}
      </span>
      <span class="relative">
        <input
          id={id}
          type="checkbox"
          role="switch"
          aria-checked={checked}
          checked={checked}
          onChange={onChange}
          class="peer sr-only"
        />
        <span
          aria-hidden="true"
          class="block h-6 w-11 rounded-full bg-gris transition-colors peer-checked:bg-accent"
        ></span>
        <span
          aria-hidden="true"
          class="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5"
        ></span>
      </span>
    </label>
  );
}
