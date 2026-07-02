import { db } from "@/lib/db";
import type { ParseResult, ParsedRow } from "@/lib/parsers/types";
import type { TipoReporte } from "@/lib/audit-types";
import type { Prisma } from "@/generated/prisma";

interface PersistArgs {
  opticaId: string;
  periodo: string;
  tipoReporte: TipoReporte;
  fileName: string;
  userId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result: ParseResult<any>;
}

export interface PersistResult {
  imp: { id: string } | null; // null si el archivo no traía filas para este grupo
  insertadas: number;
  reemplazadas: number; // filas del período que existían antes y fueron reemplazadas
}

function common(row: ParsedRow<unknown>) {
  return {
    rowIndex: row.rowIndex,
    raw: row.raw as Prisma.InputJsonValue,
    alerts: row.alerts as unknown as Prisma.InputJsonValue,
    hasAlert: row.alerts.length > 0,
  };
}

/** Campo de fecha por tipo de reporte (deriva el período y los días a reemplazar). */
export const DATE_FIELD: Record<TipoReporte, string> = {
  VENTA_DETALLADA: "fecha",
  PEDIDO_LENTES: "fechaOrden",
  GASTOS: "fecha",
  COMPROBANTES: "fecha",
  PAGOS_PROVEEDORES: "fecha",
  CUENTAS_POR_PAGAR: "fecha",
};

/** Relación de filas en Importacion por tipo (para limpiar importaciones vacías). */
const REL_FIELD: Record<TipoReporte, string> = {
  VENTA_DETALLADA: "ventas",
  PEDIDO_LENTES: "pedidos",
  GASTOS: "gastos",
  COMPROBANTES: "comprobantes",
  PAGOS_PROVEEDORES: "pagos",
  CUENTAS_POR_PAGAR: "cuentasPorPagar",
};

/** Medianoche UTC del día de una fecha (para agrupar por día calendario). */
function diaUTC(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Persiste un reporte parseado REEMPLAZANDO SOLO LOS DÍAS presentes en el archivo
 * (no todo el mes). Para el (óptica, período, tipo) dado: borra las filas
 * existentes cuyos días estén en el archivo y carga las nuevas. Así:
 *  - Subir un rango (ej. 29 jun–1 jul) actualiza solo esos días; el resto del mes
 *    se conserva (no se pierde lo no incluido).
 *  - Subir el mes completo reemplaza todo (todos sus días están en el archivo).
 *  - Softop reexporta con saldos/valores actualizados: dentro de los días subidos,
 *    el último archivo manda (no se duplica).
 */
export async function persistReport({
  opticaId,
  periodo,
  tipoReporte,
  fileName,
  userId,
  result,
}: PersistArgs): Promise<PersistResult> {
  const rows = result.rows as ParsedRow<Record<string, unknown>>[];

  // Archivo sin filas para este grupo: no tocar lo existente (no destruir datos).
  if (rows.length === 0) {
    return { imp: null, insertadas: 0, reemplazadas: 0 };
  }

  const filasConAlerta = rows.filter((r) => r.alerts.length > 0).length;

  // Días presentes en el archivo (por el campo de fecha del tipo de reporte).
  const dateField = DATE_FIELD[tipoReporte];
  const diasMap = new Map<number, Date>();
  let hayFechaNula = false;
  for (const r of rows) {
    const v = r.data[dateField];
    if (v instanceof Date && !Number.isNaN(v.getTime())) {
      const t = diaUTC(v);
      if (!diasMap.has(t)) diasMap.set(t, new Date(t));
    } else {
      hayFechaNula = true;
    }
  }
  const dias = [...diasMap.values()];

  const { imp, reemplazadas } = await db.$transaction(async (tx) => {
    // 1) Reemplazar SOLO los días del archivo: borra las filas existentes de esos
    //    días (y las de fecha nula si el archivo trae filas sin fecha).
    let reemplazadas = 0;
    const relImp = { importacion: { opticaId, periodo, tipoReporte } };
    const orFecha = (campo: "fecha" | "fechaOrden") => [
      { [campo]: { in: dias } },
      ...(hayFechaNula ? [{ [campo]: null }] : []),
    ];
    switch (tipoReporte) {
      case "VENTA_DETALLADA":
        reemplazadas = (await tx.ventaDetalladaRow.deleteMany({
          where: { ...relImp, OR: orFecha("fecha") },
        })).count;
        break;
      case "PEDIDO_LENTES":
        reemplazadas = (await tx.pedidoLenteRow.deleteMany({
          where: { ...relImp, OR: orFecha("fechaOrden") },
        })).count;
        break;
      case "GASTOS":
        reemplazadas = (await tx.gastoRow.deleteMany({
          where: { ...relImp, OR: orFecha("fecha") },
        })).count;
        break;
      case "COMPROBANTES":
        reemplazadas = (await tx.comprobanteRow.deleteMany({
          where: { ...relImp, OR: orFecha("fecha") },
        })).count;
        break;
      case "PAGOS_PROVEEDORES":
        reemplazadas = (await tx.pagoProveedorRow.deleteMany({
          where: { ...relImp, OR: orFecha("fecha") },
        })).count;
        break;
      case "CUENTAS_POR_PAGAR":
        reemplazadas = (await tx.cuentaPorPagarRow.deleteMany({
          where: { ...relImp, OR: orFecha("fecha") },
        })).count;
        break;
    }

    // 2) Crear la importación nueva e insertar las filas del archivo.
    const importacion = await tx.importacion.create({
      data: {
        opticaId,
        periodo,
        tipoReporte,
        fileName,
        uploadedById: userId,
        totalFilas: rows.length,
        filasConAlerta,
      },
    });

    const mapData = <T>(r: ParsedRow<Record<string, unknown>>) =>
      ({ importacionId: importacion.id, ...r.data, ...common(r) }) as unknown as T;

    switch (tipoReporte) {
      case "VENTA_DETALLADA":
        await tx.ventaDetalladaRow.createMany({
          data: rows.map((r) => mapData<Prisma.VentaDetalladaRowCreateManyInput>(r)),
        });
        break;
      case "PEDIDO_LENTES":
        await tx.pedidoLenteRow.createMany({
          data: rows.map((r) => mapData<Prisma.PedidoLenteRowCreateManyInput>(r)),
        });
        break;
      case "GASTOS":
        await tx.gastoRow.createMany({
          data: rows.map((r) => mapData<Prisma.GastoRowCreateManyInput>(r)),
        });
        break;
      case "COMPROBANTES":
        await tx.comprobanteRow.createMany({
          data: rows.map((r) => mapData<Prisma.ComprobanteRowCreateManyInput>(r)),
        });
        break;
      case "PAGOS_PROVEEDORES":
        await tx.pagoProveedorRow.createMany({
          data: rows.map((r) => mapData<Prisma.PagoProveedorRowCreateManyInput>(r)),
        });
        break;
      case "CUENTAS_POR_PAGAR":
        await tx.cuentaPorPagarRow.createMany({
          data: rows.map((r) => mapData<Prisma.CuentaPorPagarRowCreateManyInput>(r)),
        });
        break;
    }

    // 3) Limpiar importaciones del período que quedaron SIN filas (todos sus días
    //    fueron reemplazados). La recién creada tiene filas, no se borra.
    await tx.importacion.deleteMany({
      where: {
        opticaId,
        periodo,
        tipoReporte,
        [REL_FIELD[tipoReporte]]: { none: {} },
      } as Prisma.ImportacionWhereInput,
    });

    return { imp: importacion, reemplazadas };
  });

  return { imp, insertadas: rows.length, reemplazadas };
}
