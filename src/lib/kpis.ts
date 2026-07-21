import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma";

export interface VentaKpis {
  ventas: number; // suma de VENTAS TOTALES (por orden)
  recaudo: number; // suma de TOTAL RECAUDO (incluye abonos)
  ordenes: number; // órdenes distintas (consecutivo)
  ticketPromedio: number;
  margenBruto: number; // sum(precioVenta - costoCompra) — solo líneas de VENTA
  margenPct: number;
  carteraPendiente: number; // ventas − recaudo (lo que falta por cobrar)
  unidades: number; // suma de cantidad — solo líneas de VENTA
}

/**
 * KPIs de ventas para un período (opcional óptica).
 *
 * Modelo de movimientos: cada orden puede tener una fila "Venta" y filas
 * "Abono" (pagos posteriores que REPITEN los productos). Por eso:
 * - Totales de orden (VENTAS TOTALES) → solo en la fila Venta (Abono trae 0): SUM correcto.
 * - TOTAL RECAUDO → se reparte entre movimientos (pago inicial + abonos): SUM correcto.
 * - Campos de LÍNEA (precioVenta, costoCompra, cantidad) → se repiten en las filas
 *   Abono, así que para no duplicar SOLO se suman las filas tipoMovimiento = "Venta".
 * - Cartera = ventas − recaudo (evita doble conteo del saldo corriente por movimiento).
 */
export async function ventaKpis(
  periodo: string,
  opticaId?: string | null
): Promise<VentaKpis> {
  const base = { periodo, tipoReporte: "VENTA_DETALLADA" as const, ...(opticaId ? { opticaId } : {}) };
  const whereTodas: Prisma.VentaDetalladaRowWhereInput = { importacion: base };
  const whereVenta: Prisma.VentaDetalladaRowWhereInput = {
    importacion: base,
    // Insensible a mayúsculas: Softop puede exportar "VENTA"/"venta" (P-2).
    tipoMovimiento: { equals: "Venta", mode: "insensitive" },
  };

  const [aggOrden, lineasAgg, porOrden] = await Promise.all([
    // Totales de orden: sobre todas las filas (Abono aporta 0 a ventasTotales).
    db.ventaDetalladaRow.aggregate({
      where: whereTodas,
      _sum: { ventasTotales: true, totalRecaudo: true },
    }),
    // Campos de línea: SOLO filas de Venta (evita el eco de los Abonos).
    db.ventaDetalladaRow.aggregate({
      where: whereVenta,
      _sum: { cantidad: true, precioVenta: true, costoCompra: true },
    }),
    // Por orden: total vendido y total recaudado, para # órdenes y cartera real.
    db.ventaDetalladaRow.groupBy({
      by: ["consecutivo"],
      where: whereTodas,
      _sum: { ventasTotales: true, totalRecaudo: true },
    }),
  ]);

  const ventas = aggOrden._sum.ventasTotales ?? 0;
  const recaudo = aggOrden._sum.totalRecaudo ?? 0;
  const ingresoLineas = lineasAgg._sum.precioVenta ?? 0;
  const margenBruto = ingresoLineas - (lineasAgg._sum.costoCompra ?? 0);

  const ordenesValidas = porOrden.filter((o) => o.consecutivo);
  const nOrdenes = ordenesValidas.length;
  // Cartera = Σ por orden de (vendido − recaudado), solo saldos positivos.
  const carteraPendiente = ordenesValidas.reduce((acc, o) => {
    const saldo = (o._sum.ventasTotales ?? 0) - (o._sum.totalRecaudo ?? 0);
    return acc + (saldo > 0 ? saldo : 0);
  }, 0);

  return {
    ventas,
    recaudo,
    ordenes: nOrdenes,
    ticketPromedio: nOrdenes > 0 ? ventas / nOrdenes : 0,
    margenBruto,
    margenPct: ingresoLineas > 0 ? (margenBruto / ingresoLineas) * 100 : 0,
    carteraPendiente,
    unidades: lineasAgg._sum.cantidad ?? 0,
  };
}

export interface AsesoraRecaudo {
  asesora: string;
  recaudo: number; // suma de TOTAL RECAUDO atendido por ella
  ordenes: number; // órdenes distintas (consecutivo)
}

/**
 * Recaudo por asesora (ATENDIDO POR) de un período + óptica, ordenado de mayor
 * a menor. TOTAL RECAUDO se reparte entre movimientos, así que sumar todas las
 * filas de la asesora es correcto; las órdenes se cuentan por consecutivo único.
 */
export async function recaudoPorAsesora(
  periodo: string,
  opticaId: string
): Promise<AsesoraRecaudo[]> {
  const rows = await db.ventaDetalladaRow.findMany({
    where: { importacion: { periodo, tipoReporte: "VENTA_DETALLADA", opticaId } },
    select: { atendidoPor: true, consecutivo: true, totalRecaudo: true },
  });

  const acc = new Map<string, { recaudo: number; ordenes: Set<string> }>();
  for (const r of rows) {
    const nombre = (r.atendidoPor ?? "").trim() || "Sin asignar";
    const cur = acc.get(nombre) ?? { recaudo: 0, ordenes: new Set<string>() };
    cur.recaudo += r.totalRecaudo ?? 0;
    if (r.consecutivo) cur.ordenes.add(r.consecutivo);
    acc.set(nombre, cur);
  }

  return [...acc.entries()]
    .map(([asesora, v]) => ({ asesora, recaudo: v.recaudo, ordenes: v.ordenes.size }))
    .sort((a, b) => b.recaudo - a.recaudo);
}
