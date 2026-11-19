# tracker-pedidos · Logística Andina (demo)

Demo de portfolio: un sistema de gestión de transporte (TMS) para **Logística Andina**, un mayorista ficticio de Córdoba, Argentina. Tiene una vista para el cliente, que sigue su pedido desde el celular, y un centro de control con flota en vivo, pedidos, depósito, repartidores, métricas e incidencias. Todo se mueve con un único reloj simulado.

> Marca, pedidos, clientes y choferes son ficticios. La interfaz muestra siempre la marca "Demo".

## Stack

- Astro 7 (salida 100 % estática) + TypeScript estricto
- CSS con variables, sin framework de UI
- GSAP 3 con Flip, MotionPathPlugin y ScrollToPlugin; View Transitions de Astro (`ClientRouter`); SVG, CSS 3D y canvas
- Sin backend, sin APIs, sin mapas de terceros. Todo corre en el navegador.

## Cómo correrlo

Requiere Node 22.12 o superior y pnpm.

```bash
pnpm install
pnpm dev        # http://localhost:4321
pnpm build      # genera dist/
pnpm preview    # sirve dist/
pnpm check      # astro check (tipos)
```

## Vistas

| Ruta | Qué hace |
| --- | --- |
| `/` | **Cliente**: escribís un número de pedido y el número viaja a la ficha con una View Transition. Mobile first. |
| `/pedido/LA-xxxx` | **Ficha del pedido**: etapas con microilustraciones, mapa en vivo con el camión sobre la ruta, empaque en una caja 3D, firma con el dedo y calificación. |
| `/flota` | **Flota**: todos los camiones en ruta moviéndose a la vez sobre el mapa. Al tocar uno ves chofer, carga y próximas paradas; podés reasignarlo o resolver su incidencia. |
| `/pedidos` | **Pedidos**: tabla con búsqueda, filtros por estado, barrio y chofer, orden por columna, exportación a CSV, detalle en un panel lateral y alta de pedidos nuevos. |
| `/deposito` | **Depósito**: kanban que se reordena solo con Flip, con contadores por estado. |
| `/repartidores` | **Repartidores**: estado de cada chofer, entregas del día, puntualidad, bultos, calificación y próximos pedidos. |
| `/metricas` | **Métricas**: puntualidad, tiempo promedio, entregas por hora y puntualidad acumulada, con gráficos en vivo (tooltip, teclado y vista de tabla). |
| `/incidencias` | **Incidencias**: demoras, fallas de vehículo y clientes ausentes con contador en vivo. Se resuelven, se reprograman o se reasignan a otro chofer. |
| `/poster` | Composición de 1600x900 usada para generar el póster. |

## En vivo

- Un solo reloj simulado mueve todo: indicador **EN VIVO**, pausa, velocidades **1x / 4x / 10x** y **+1 h**.
- Los pedidos avanzan solos, entran pedidos nuevos simulados y aparecen incidencias. Mientras una incidencia está abierta, el camión se detiene y la hora de llegada se corre. Si nadie actúa, el centro de control la cierra a los 40 minutos.
- Feed de **actividad en vivo**, **centro de notificaciones** con contador de no leídas y avisos que se deslizan dentro de la interfaz.
- Cada acción (crear un pedido, reasignar, resolver, firmar, calificar, empacar) cambia el estado compartido y se ve en todas las vistas. Se guarda en `localStorage`; **Reiniciar demo** borra todo.

## Teclado

| Atajo | Acción |
| --- | --- |
| `Ctrl/Cmd + K` o `/` | Paleta de comandos: pedidos, choferes, vistas y acciones |
| `P` | Pausar o reanudar |
| `1` `2` `3` | Velocidad 1x, 4x, 10x |
| `H` | Adelantar 1 hora |
| `N` | Nuevo pedido |
| `G` y luego `C` `F` `P` `D` `R` `M` `I` | Ir a Cliente, Flota, Pedidos, Depósito, Repartidores, Métricas o Incidencias |
| `?` | Ayuda de atajos |

## Datos y modelo

- `src/data/random.ts`: generador pseudoaleatorio determinista (mulberry32) con semilla fija.
- `src/data/orders.ts`: 30 pedidos base más pedidos simulados que llegan con el reloj, cada uno con historial, productos, ruta, chofer y, algunos, una incidencia sembrada.
- `src/data/map.ts`: el mapa de Córdoba dibujado a mano como grafo. El mismo grafo dibuja el mapa y arma las rutas.
- `src/lib/status.ts`: el modelo. Todo es una función pura del minuto simulado más las acciones del usuario (pedidos creados, reasignaciones, incidencias resueltas), así que todas las vistas derivan la misma verdad.
- `src/lib/sim.ts`: el reloj compartido y las acciones, con persistencia en `localStorage`.

## Modo vitrina (para grabar el video)

Abrí `http://localhost:4321/?showcase`. Recorre solo, sin cursor y en un loop de unos 30 segundos: ingreso con View Transition, ficha con el camión en el mapa y el empaque, flota con un camión seleccionado, búsqueda y detalle en Pedidos, métricas a 10x, una incidencia resuelta, el depósito con la paleta de comandos, y vuelta al inicio. No escribe nada en `localStorage`.

Para grabar:

1. `pnpm build && pnpm preview`.
2. Abrí `http://localhost:4321/?showcase` en una ventana de 1600x900 (o de 390 px de ancho para la versión mobile).
3. Grabá con cualquier capturador (OBS, la herramienta de recortes de Windows, QuickTime). Para un clip de 10 segundos, cortá el tramo de la ficha o el de la flota.

## Póster

`public/poster.jpg` (1600x900) se captura de la página real `/poster` con Playwright:

```bash
pnpm exec playwright install chromium   # una sola vez
pnpm build
pnpm poster
```

## Calidad

- Animaciones con `transform` y `opacity` (más SVG y canvas).
- `prefers-reduced-motion`: versión estática completa (sin loops, sin vuelos, sin transiciones).
- Mobile first, con composición propia a 390 px en todas las vistas.
- Navegable con teclado, con foco visible, diálogos nativos y alternativas a cada gesto (por ejemplo, "Firmar por mí").
