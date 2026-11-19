/** Every view of the product, used by the nav, the command palette and the shortcuts. */
export type ViewId = 'cliente' | 'deposito' | 'flota' | 'pedidos' | 'repartidores' | 'metricas' | 'incidencias';

export interface ViewDef {
  id: ViewId;
  label: string;
  href: string;
  /** Second key after "g" (go to). */
  key: string;
  icon: string;
  hint: string;
}

export const VIEWS: readonly ViewDef[] = [
  { id: 'cliente', label: 'Cliente', href: '/', key: 'c', hint: 'Seguimiento para el cliente', icon: 'M10 2a5 5 0 0 1 5 5c0 3.5-5 11-5 11S5 10.5 5 7a5 5 0 0 1 5-5Zm0 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z' },
  { id: 'flota', label: 'Flota', href: '/flota', key: 'f', hint: 'Mapa con todos los camiones', icon: 'M2 5h10v8H2zM12 8h3l3 3v2h-6zM5 16a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm10 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z' },
  { id: 'pedidos', label: 'Pedidos', href: '/pedidos', key: 'p', hint: 'Tabla, filtros y exportación', icon: 'M4 3h12v14H4zM7 7h6M7 10h6M7 13h4' },
  { id: 'deposito', label: 'Depósito', href: '/deposito', key: 'd', hint: 'Kanban por estado', icon: 'M2 8l8-5 8 5v9H2zM6 17v-5h8v5' },
  { id: 'repartidores', label: 'Repartidores', href: '/repartidores', key: 'r', hint: 'Choferes y desempeño', icon: 'M10 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-7 8c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5' },
  { id: 'metricas', label: 'Métricas', href: '/metricas', key: 'm', hint: 'Indicadores en vivo', icon: 'M3 17V9M8 17V4M13 17v-6M18 17V7' },
  { id: 'incidencias', label: 'Incidencias', href: '/incidencias', key: 'i', hint: 'Demoras y entregas fallidas', icon: 'M10 2 1.5 17h17L10 2Zm0 6v4m0 2.5v.5' },
];
