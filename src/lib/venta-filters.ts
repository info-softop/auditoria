import type { Prisma } from "@/generated/prisma";

/**
 * Excluye las ventas ANULADAS (estado "Anulada") de los reportes, KPIs y cruces.
 * Softop marca la anulación en la columna ESTADO; esas filas no son ventas reales
 * y no deben sumar en ventas/recaudo/márgenes ni generar alertas.
 *
 * OJO: en Prisma `{ estado: { not: "Anulada" } }` también descarta los `estado
 * = null` (NULL != 'Anulada' es NULL, no true). Por eso se usa un OR explícito:
 * conserva los nulos y todo lo que no sea "Anulada" (insensible a mayúsculas).
 */
export const VENTA_NO_ANULADA: Prisma.VentaDetalladaRowWhereInput = {
  OR: [{ estado: null }, { estado: { not: "Anulada", mode: "insensitive" } }],
};
