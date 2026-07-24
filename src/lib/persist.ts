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

  // Rango de fechas del archivo (primer y último día), por el campo de fecha del
  // tipo de reporte. Se reemplaza TODO ese rango — no solo los días sueltos — para
  // que, si un registro cambia de fecha entre exportaciones o el archivo cubre el
  // mes completo, NO queden copias viejas duplicadas.
  const dateField = DATE_FIELD[tipoReporte];
  let minT = Number.POSITIVE_INFINITY;
  let maxT = Number.NEGATIVE_INFINITY;
  let hayFechaNula = false;
  for (const r of rows) {
    const v = r.data[dateField];
    if (v instanceof Date && !Number.isNaN(v.getTime())) {
      const t = diaUTC(v);
      if (t < minT) minT = t;
      if (t > maxT) maxT = t;
    } else {
      hayFechaNula = true;
    }
  }
  const hayFechas = maxT >= minT;
  const desde = hayFechas ? new Date(minT) : null;
  const hasta = hayFechas ? new Date(maxT) : null;

  const { imp, reemplazadas } = await db.$transaction(async (tx) => {
    // 1) Reemplazar el RANGO de fechas del archivo: borra las filas existentes
    //    entre el primer y último día del archivo (y las de fecha nula si el
    //    archivo trae filas sin fecha). Evita duplicados por cambios de fecha.
    let reemplazadas = 0;
    const relImp = { importacion: { opticaId, periodo, tipoReporte } };
    const orFecha = (campo: "fecha" | "fechaOrden") => [
      ...(hayFechas ? [{ [campo]: { gte: desde, lte: hasta } }] : []),
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

    // 4) Recalcular totalFilas de las importaciones que quedaron: al borrar por día,
    //    las viejas pueden tener menos filas de las que declaraban.
    const impsPeriodo = await tx.importacion.findMany({
      where: { opticaId, periodo, tipoReporte },
      select: { id: true },
    });
    for (const im of impsPeriodo) {
      const w = { importacionId: im.id };
      let n = 0;
      switch (tipoReporte) {
        case "VENTA_DETALLADA": n = await tx.ventaDetalladaRow.count({ where: w }); break;
        case "PEDIDO_LENTES": n = await tx.pedidoLenteRow.count({ where: w }); break;
        case "GASTOS": n = await tx.gastoRow.count({ where: w }); break;
        case "COMPROBANTES": n = await tx.comprobanteRow.count({ where: w }); break;
        case "PAGOS_PROVEEDORES": n = await tx.pagoProveedorRow.count({ where: w }); break;
        case "CUENTAS_POR_PAGAR": n = await tx.cuentaPorPagarRow.count({ where: w }); break;
      }
      await tx.importacion.update({ where: { id: im.id }, data: { totalFilas: n } });
    }

    return { imp: importacion, reemplazadas };
  });

  return { imp, insertadas: rows.length, reemplazadas };
}
