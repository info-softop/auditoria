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

/**
 * Persiste un reporte parseado REEMPLAZANDO lo cargado del mismo (óptica,
 * período, tipo): borra las importaciones previas de ese grupo (cascade borra sus
 * filas) y carga el archivo nuevo completo. Es el modelo correcto para Softop,
 * que reexporta el mismo período con saldos/valores actualizados — así el último
 * archivo siempre manda y nunca se duplican datos. Subir el mes completo es la
 * forma esperada de actualizar un período.
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

  const { imp, reemplazadas } = await db.$transaction(async (tx) => {
    // REEMPLAZAR: borra lo cargado antes para este (óptica, período, tipo).
    // El onDelete:Cascade de cada *Row borra sus filas automáticamente.
    const previas = await tx.importacion.findMany({
      where: { opticaId, periodo, tipoReporte },
      select: { totalFilas: true },
    });
    const reemplazadas = previas.reduce((s, p) => s + p.totalFilas, 0);
    await tx.importacion.deleteMany({ where: { opticaId, periodo, tipoReporte } });

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

    return { imp: importacion, reemplazadas };
  });

  return { imp, insertadas: rows.length, reemplazadas };
}
