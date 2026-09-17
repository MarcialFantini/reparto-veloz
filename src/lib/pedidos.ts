import pedidosData from "../data/pedidos.json";
import type { Pedido } from "../types/pedido";

/**
 * Codigo format: RV-XXXXXX where XXXXXX is 6 alphanumerics.
 * Exposed for form-side validation.
 */
export const CODIGO_REGEX = /^RV-[A-Z0-9]{6}$/;

interface PedidosFile {
  pedidos: Pedido[];
}

const data = pedidosData as PedidosFile;

/**
 * Returns every pedido in the dataset. The order matches the JSON file.
 */
export function getTodosLosPedidos(): Pedido[] {
  return data.pedidos;
}

/**
 * Returns just the codigos — used by getStaticPaths.
 */
export function getTodosLosCodigos(): string[] {
  return data.pedidos.map((p) => p.codigo);
}

/**
 * Normalises user input: trims whitespace, removes internal spaces,
 * uppercases. Non-letter/digit/hyphen chars are dropped.
 */
export function normalizarCodigo(input: string): string {
  return input
    .trim()
    .replace(/\s+/g, "")
    .replace(/[^A-Za-z0-9-]/g, "")
    .toUpperCase();
}

/**
 * Returns true if the input matches the codigo format RV-XXXXXX.
 * Always normalises first.
 */
export function esFormatoValido(input: string): boolean {
  return CODIGO_REGEX.test(normalizarCodigo(input));
}

/**
 * Finds a pedido by its codigo. Normalises the input so
 * "rv-ab12cd", " RV-AB12CD " and "RV AB12CD" all resolve.
 * Returns null when the codigo does not exist in the dataset.
 */
export function buscarPorCodigo(codigo: string): Pedido | null {
  const normalised = normalizarCodigo(codigo);
  if (!normalised) return null;
  return data.pedidos.find((p) => p.codigo === normalised) ?? null;
}
