/**
 * Shared types for the Reparto Veloz tracker.
 * Imported by data files, helpers, and Preact components.
 */

export type EstadoPedido = "preparando" | "en_camino" | "entregado" | "demorado";

export interface HistorialEvento {
  /** ISO timestamp. */
  timestamp: string;
  /** Short, user-facing description, e.g. "Salió del depósito central". */
  descripcion: string;
  /** Free-form location string, e.g. "Depósito Once, CABA". */
  ubicacion: string;
}

export interface Repartidor {
  nombre: string;
  /** Inline SVG <svg> markup string. Used as placeholder avatar. */
  foto: string;
  /** Phone number as E.164-ish string, e.g. "+5491141234567". */
  telefono: string;
}

export interface Pedido {
  /** Code formatted as RV-XXXXXX (6 alphanumerics). */
  codigo: string;
  cliente: string;
  direccion: string;
  estado: EstadoPedido;
  historial: HistorialEvento[];
  repartidor: Repartidor | null;
  /** Estimated minutes until delivery. null when status === "entregado". */
  etaMinutos: number | null;
}

/** Helpful UI metadata for each estado. Kept here so the same
 * labels/colors are reused in the tracker and the form. */
export interface EstadoMeta {
  label: string;
  /** Short helper line under the badge. */
  descripcion: string;
  bgClass: string;
  textClass: string;
  ringClass: string;
  dotClass: string;
}

export const ESTADO_META: Record<EstadoPedido, EstadoMeta> = {
  preparando: {
    label: "Preparando",
    descripcion: "Estamos armando tu paquete en el depósito.",
    bgClass: "bg-state-preparando-bg",
    textClass: "text-state-preparando-text",
    ringClass: "ring-state-preparando-ring",
    dotClass: "bg-state-preparando-dot",
  },
  en_camino: {
    label: "En camino",
    descripcion: "El repartidor ya va rumbo a tu dirección.",
    bgClass: "bg-state-en-camino-bg",
    textClass: "text-state-en-camino-text",
    ringClass: "ring-state-en-camino-ring",
    dotClass: "bg-state-en-camino-dot",
  },
  entregado: {
    label: "Entregado",
    descripcion: "Entrega completada con firma del destinatario.",
    bgClass: "bg-state-entregado-bg",
    textClass: "text-state-entregado-text",
    ringClass: "ring-state-entregado-ring",
    dotClass: "bg-state-entregado-dot",
  },
  demorado: {
    label: "Demorado",
    descripcion: "El envío tuvo una demora. Te explicamos abajo qué pasó.",
    bgClass: "bg-state-demorado-bg",
    textClass: "text-state-demorado-text",
    ringClass: "ring-state-demorado-ring",
    dotClass: "bg-state-demorado-dot",
  },
};
