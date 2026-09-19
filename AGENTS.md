# 05-tracker-pedidos · Reparto Veloz

Cliente ficticio: **Reparto Veloz SRL** (delivery en CABA). Paleta naranja
delivery `#E76F2C` + navy `#1B2845` sobre mist `#F4F4F4` y blanco. UI en
Plus Jakarta Sans, códigos/timestamps en JetBrains Mono.

Stack: Astro 7 (static) + Preact + Tailwind v4 + TypeScript. Sin backend.
Datos mock en `src/data/pedidos.json` — **25 pedidos** cubriendo los
**6 estados** (`preparando` / `en_camino` / `entregado` / `demorado` /
`cancelado` / `devuelto`). Códigos con formato `RV-XXXXXX`.

Seis islas Preact hidratadas: `ConsultaForm`, `PedidoTracker`, `RatingForm`,
`RecentLookups`, `NotificacionesCard`, `ProblemReport`. Toda la estética
vive en `@theme` dentro de `src/styles/global.css`.

Hub de rastreo: `src/pages/rastrear/index.astro`. Por cada pedido hay una
página estática en `src/pages/rastrear/[codigo].astro` generada vía
`getStaticPaths` desde `pedidos.json`.

Build: `pnpm build` · Check: `pnpm astro check` · Demo entry: `RV-AB12CD`.