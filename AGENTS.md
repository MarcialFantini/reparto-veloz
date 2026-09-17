# 05-tracker-pedidos · Reparto Veloz

Cliente ficticio: **Reparto Veloz SRL** (delivery en CABA). Paleta naranja
`#E76F2C` sobre papel `#F8F6F2`, fuentes Plus Jakarta Sans + JetBrains Mono.

Stack: Astro 7 (static) + Preact + Tailwind v4 + TypeScript. Sin backend.
Datos mock en `src/data/pedidos.json`. Códigos con formato `RV-XXXXXX`.

Dos únicas islas Preact: `ConsultaForm.tsx` y `PedidoTracker.tsx`. Toda la
estética vive en `@theme` dentro de `src/styles/global.css`.

Build: `pnpm build` · Check: `pnpm astro check` · Demo entry: `RV-AB12CD`.
