import { db } from "@/lib/db";
import { cuentaDeMetodo, type CuentaDestino } from "@/lib/payment-accounts";

export interface IngresosCuenta {
  // Total por cuenta destino (todas las ópticas del filtro).
  porCuenta: Record<CuentaDestino, number>;
  // Por óptica × cuenta: { opticaNombre: { CAJA_MENOR, BANCO_BOGOTA, BANCOLOMBIA } }
  porOptica: { optica: string; cuentas: Record<CuentaDestino, number> }[];
  // Métodos de pago sin cuenta asignada (para revisar el mapeo).
  sinCuenta: { metodo: string; monto: number }[];
  totalAddi: number; // ingresos vía Addi (desfase 30 días)
}

const CERO: Record<CuentaDestino, number> = {
  CAJA_MENOR: 0,
  BANCO_BOGOTA: 0,
  BANCOLOMBIA: 0,
};

/**
 * Ingresos esperados por cuenta destino, según el método de pago de cada
 * línea de Venta Detallada (suma de PRECIO DE VENTA por método → cuenta).
 * Es una estimación de lo que debería llegar a cada cuenta bancaria; el
 * extracto bancario es la verdad para conciliar.
 */
export async function ingresosPorCuenta(
  periodo: string,
  opticaId?: string | null
): Promise<IngresosCuenta> {
  const grupos = await db.ventaDetalladaRow.groupBy({
    by: ["optica", "metodoPago"],
    where: {
      importacion: {
        periodo,
        tipoReporte: "VENTA_DETALLADA",
        ...(opticaId ? { opticaId } : {}),
      },
      // Solo líneas de venta (las filas "Abono" repiten los productos).
      // Insensible a mayúsculas ("VENTA"/"venta") — P-2.
      tipoMovimiento: { equals: "Venta", mode: "insensitive" },
    },
    _sum: { precioVenta: true },
  });

  const porCuenta: Record<CuentaDestino, number> = { ...CERO };
  const porOpticaMap = new Map<string, Record<CuentaDestino, number>>();
  const sinCuentaMap = new Map<string, number>();
  let totalAddi = 0;

  for (const g of grupos) {
    const monto = g._sum.precioVenta ?? 0;
    if (monto === 0) continue;
    const cuenta = cuentaDeMetodo(g.metodoPago);
    const optica = g.optica?.trim() || "Sin óptica";

    if (/addi/i.test(g.metodoPago ?? "")) totalAddi += monto;

    if (!cuenta) {
      sinCuentaMap.set(
        g.metodoPago ?? "(vacío)",
        (sinCuentaMap.get(g.metodoPago ?? "(vacío)") ?? 0) + monto
      );
      continue;
    }
    porCuenta[cuenta] += monto;
    if (!porOpticaMap.has(optica)) porOpticaMap.set(optica, { ...CERO });
    porOpticaMap.get(optica)![cuenta] += monto;
  }

  return {
    porCuenta,
    porOptica: [...porOpticaMap.entries()]
      .map(([optica, cuentas]) => ({ optica, cuentas }))
      .sort((a, b) => a.optica.localeCompare(b.optica)),
    sinCuenta: [...sinCuentaMap.entries()]
      .map(([metodo, monto]) => ({ metodo, monto }))
      .sort((a, b) => b.monto - a.monto),
    totalAddi,
  };
}
