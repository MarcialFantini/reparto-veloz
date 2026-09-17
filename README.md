# 05 — Tracker de pedidos · Reparto Veloz

> Demo de portfolio: sistema de seguimiento de pedidos para un cliente ficticio
> de delivery en CABA. Construido 100% estático (sin backend) con Preact, Tailwind
> v4 y Astro 7.

---

## Problema

En el sector de delivery urbano, la consulta por WhatsApp sigue siendo el canal
principal para "¿dónde está mi pedido?". Eso sobrecarga al equipo de soporte y
frena la operación. Los clientes necesitan **una vista directa del estado del
envío** — con código de pedido, sin login, accesible desde el celular — y los
repartidores necesitan que las incidencias se reporten sin llamadas.

## Solución

Una web minimalista con dos flujos:

1. **Búsqueda por código** (`RV-XXXXXX`) — el cliente tipea el código, valida
   formato, ve el estado actual, el timeline, el repartidor asignado y la ETA.
2. **Página directa por código** (`/rastrear/RV-AB12CD`) — la misma vista, lista
   para abrir desde un email o un SMS.

Cuatro estados bien diferenciados visualmente, con su propio color e icono SVG
inline (sin librería externa):

| Estado        | Color              | Significado                                      |
|---------------|--------------------|--------------------------------------------------|
| `preparando`  | gris azulado       | En el depósito, armando el paquete               |
| `en_camino`   | naranja (accent)   | Repartidor en ruta con ETA                       |
| `entregado`   | verde              | Entrega completada con firma del destinatario    |
| `demorado`    | rojo               | Requiere atención (destinatario ausente, etc.)   |

## Stack

- **Astro 7.3** (output: `static`, `getStaticPaths` por cada pedido en `pedidos.json`)
- **Preact 10** vía `@astrojs/preact` — solo dos islas hidratadas
- **Tailwind CSS 4** vía `@tailwindcss/vite` (sin `tailwind.config.js`,
  todo declarado con `@theme` en `src/styles/global.css`)
- **TypeScript** estricto (`@astrojs/check` para el typecheck)
- **Sin backend** — los datos son mocks en `src/data/pedidos.json`
- **Sin librería de iconos** — todos los SVG son inline

## Cómo correrlo

```bash
pnpm install        # 1 sola vez
pnpm dev            # dev server en http://localhost:4321
pnpm build          # genera dist/ estático
pnpm preview        # sirve dist/ para verificar
pnpm astro check    # type-check + diagnóstico Astro → 0 errores esperado
```

Para probar, tirá el código `RV-AB12CD` en el formulario del home — abre
directamente la vista de seguimiento.

## Estructura

```
src/
├── components/
│   ├── Header.astro          # Logo + nav (Inicio, Rastrear)
│   ├── Footer.astro          # Teléfono, email, horario, demo disclaimer
│   ├── PedidoTracker.tsx     # isla Preact — badge + timeline + mapa + repartidor + ETA
│   └── ConsultaForm.tsx      # isla Preact — input + 4 estados (idle/cargando/error/encontrado)
├── data/
│   └── pedidos.json          # 8 pedidos mock, 4 estados representados
├── layouts/
│   └── Layout.astro          # SEO base, OG, fonts, header, footer, skip-link
├── lib/
│   └── pedidos.ts            # buscarPorCodigo + getTodosLosPedidos + helpers
├── pages/
│   ├── index.astro           # Hero + instrucciones + form + "Cómo funciona"
│   ├── 404.astro             # Friendly not-found + form + WhatsApp
│   └── rastrear/
│       └── [codigo].astro    # getStaticPaths → 1 página estática por pedido
├── styles/
│   └── global.css            # @theme con paleta y tipografía
└── types/
    └── pedido.ts             # Tipos compartidos + ESTADO_META
```

## Decisiones técnicas

- **Preact en vez de React.** El proyecto sigue la convención del resto del
  portfolio: ~10KB de runtime Preact vs ~45KB de React, mismo modelo mental.
  `@astrojs/preact` configura `tsconfig.json` con `jsxImportSource: "preact"`.
- **`output: 'static'` con `getStaticPaths`.** Una página estática por cada
  pedido conocido → deploy trivial a cualquier CDN. El "no encontrado" se
  cubre con `src/pages/404.astro` para URLs desconocidas, y con validación
  inline en el formulario para evitar navegar a códigos inexistentes.
- **SVG inline en vez de librería de iconos.** El paquete prohíbe dependencias
  extra de iconos. Los 4 SVGs de estado, el mapa esquemático y la marca son
  inline — cero requests adicionales y se tiñen con `currentColor`.
- **Sin `@fontsource`.** Tipografías declaradas en `@theme` con fallback
  `system-ui` para no fethear fonts externos en el primer paint (decisión
  consciente para la demo: respeta `prefers-reduced-motion` y no bloquea
  LCP).
- **Estado tipado discriminado.** `ConsultaForm` maneja 4 estados
  (`idle | cargando | error`) con `useState` y TS discriminado. La validación
  inline distingue formato inválido de código inexistente — son dos errores
  con copy distinto.
- **`pnpm-workspace.yaml` con `minimumReleaseAgeExclude`.** El proyecto vive en
  un directorio donde pnpm global aplica una política de release age que
  bloquea versiones recientes de astro/preact. El workspace local lista las
  excepciones puntuales — workaround documentado y no invasivo.

## Accesibilidad

- Skip-link al `<main>` desde cualquier punto.
- `<label>` real asociada al input (no `placeholder`-as-label).
- `aria-live="polite"` anuncia "Buscando pedido" al hacer submit.
- Errores de validación con `role="alert"` y borde rojo de alto contraste.
- Cada estado tiene par fg/bg verificado ≥4.5:1 (AA).
- `prefers-reduced-motion: reduce` honrado: se desactivan animaciones de
  pulse y `animateMotion` del mapa.
- Foco visible con outline naranja (no se oculta).
- Formato del código anunciado con texto, no solo placeholder.

## Performance

- 2 islas Preact total: `ConsultaForm` (~10 KB) + `PedidoTracker` (~11 KB).
- Runtime Preact compartido (~10 KB), chunks cacheables.
- Sin fonts externas bloqueantes.
- CSS único (`pedidos.CGlxgmSF.css`, ~25 KB) con purge automático de Tailwind.
- Páginas de tracking prerenderizadas a HTML estático: cero JS si el usuario
  no interactúa con el form o el badge.

## Disclaimer

Esta demo **no tiene backend**. Los pedidos, repartidores e historial viven
en `src/data/pedidos.json` y se compilan al HTML en build time. Para conectar
a una API real, reemplazar las llamadas en `src/lib/pedidos.ts` por `fetch()`
y cambiar `output: 'static'` por `output: 'server'` (o `'hybrid'` si sólo la
ruta `/rastrear/[codigo]` necesita SSR).
