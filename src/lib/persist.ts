import { createHash } from "crypto";
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
  imp: { id: string } | null; // null si no había filas nuevas que agregar
  insertadas: number;
  duplicadas: number;
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
 * Huella estable del CONTENIDO de una fila (su `raw` original del Excel). No
 * incluye rowIndex (la posición cambia entre archivos). Dos filas idénticas del
 * reporte producen la misma huella → permite detectar duplicados entre cargas.
 */
function rowHash(raw: Record<string, unknown>): string {
  const norm = Object.keys(raw)
    .sort()
    .map((k) => `${k}=${raw[k] == null ? "" : String(raw[k])}`)
    .join("|");
  return createHash("sha1").update(norm).digest("hex");
}

/** Huellas de las filas YA cargadas para (óptica, período, tipo). */
async function huellasExistentes(
  tipoReporte: TipoReporte,
  opticaId: string,
  periodo: string
): Promise<Set<string>> {
  const where = { importacion: { opticaId, periodo, tipoReporte } };
  const select = { raw: true } as const;
  let filas: { raw: unknown }[] = [];
  switch (tipoReporte) {
    case "VENTA_DETALLADA":
      filas = await db.ventaDetalladaRow.findMany({ where, select });
      break;
    case "PEDIDO_LENTES":
      filas = await db.pedidoLenteRow.findMany({ where, select });
      break;
    case "GASTOS":
      filas = await db.gastoRow.findMany({ where, select });
      break;
    case "COMPROBANTES":
      filas = await db.comprobanteRow.findMany({ where, select });
      break;
    case "PAGOS_PROVEEDORES":
      filas = await db.pagoProveedorRow.findMany({ where, select });
      break;
    case "CUENTAS_POR_PAGAR":
      filas = await db.cuentaPorPagarRow.findMany({ where, select });
      break;
  }
  return new Set(filas.map((f) => rowHash((f.raw ?? {}) as Record<string, unknown>)));
}

/**
 * Persiste un reporte parseado SUMÁNDOLO a lo ya cargado del mismo (óptica,
 * período, tipo). NO borra lo existente: solo inserta las filas nuevas, omitiendo
 * las que ya estaban (duplicado exacto por contenido) y las repetidas dentro del
 * propio archivo. Así, subir rangos de días que se solapan no pierde datos.
 */
export async function persistReport({
  opticaId,
  periodo,
  tipoReporte,
  fileName,
  userId,
  result,
}: PersistArgs): Promise<PersistResult> {
  const vistas = await huellasExistentes(tipoReporte, opticaId, periodo);

  // Filtra a filas nuevas (no existentes y no repetidas dentro del archivo).
  const nuevas: ParsedRow<Record<string, unknown>>[] = [];
  let duplicadas = 0;
  for (const r of result.rows as ParsedRow<Record<string, unknown>>[]) {
    const h = rowHash(r.raw);
    if (vistas.has(h)) {
      duplicadas++;
      continue;
    }
    vistas.add(h);
    nuevas.push(r);
  }

  if (nuevas.length === 0) {
    return { imp: null, insertadas: 0, duplicadas };
  }

  const filasConAlerta = nuevas.filter((r) => r.alerts.length > 0).length;

  const imp = await db.$transaction(async (tx) => {
    const importacion = await tx.importacion.create({
      data: {
        opticaId,
        periodo,
        tipoReporte,
        fileName,
        uploadedById: userId,
        totalFilas: nuevas.length,
        filasConAlerta,
      },
    });

    const mapData = <T>(r: ParsedRow<Record<string, unknown>>) =>
      ({ importacionId: importacion.id, ...r.data, ...common(r) }) as unknown as T;

    switch (tipoReporte) {
      case "VENTA_DETALLADA":
        await tx.ventaDetalladaRow.createMany({
          data: nuevas.map((r) => mapData<Prisma.VentaDetalladaRowCreateManyInput>(r)),
        });
        break;
      case "PEDIDO_LENTES":
        await tx.pedidoLenteRow.createMany({
          data: nuevas.map((r) => mapData<Prisma.PedidoLenteRowCreateManyInput>(r)),
        });
        break;
      case "GASTOS":
        await tx.gastoRow.createMany({
          data: nuevas.map((r) => mapData<Prisma.GastoRowCreateManyInput>(r)),
        });
        break;
      case "COMPROBANTES":
        await tx.comprobanteRow.createMany({
          data: nuevas.map((r) => mapData<Prisma.ComprobanteRowCreateManyInput>(r)),
        });
        break;
      case "PAGOS_PROVEEDORES":
        await tx.pagoProveedorRow.createMany({
          data: nuevas.map((r) => mapData<Prisma.PagoProveedorRowCreateManyInput>(r)),
        });
        break;
      case "CUENTAS_POR_PAGAR":
        await tx.cuentaPorPagarRow.createMany({
          data: nuevas.map((r) => mapData<Prisma.CuentaPorPagarRowCreateManyInput>(r)),
        });
        break;
    }

    return importacion;
  });

  return { imp, insertadas: nuevas.length, duplicadas };
}
