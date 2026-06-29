import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { TIPO_REPORTE_LABEL } from "@/lib/audit-types";
import type { Severidad, TipoReporte } from "@/lib/audit-types";
import type { Prisma } from "@/generated/prisma";

const CRUCE_LABEL: Record<string, string> = {
  A_CUADRE_ORDEN: "Cuadre de orden / duplicados",
  B_COSTO_LENTE: "Costo cero en lente",
  C_CUENTAS_PAGAR: "Cuentas por pagar",
  D_PAGO_LABORATORIO: "Pago a laboratorio",
};

interface RowAlertRecord {
  rowIndex: number;
  alerts: unknown;
  importacion: { tipoReporte: TipoReporte; optica: { nombre: string } };
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const periodo = searchParams.get("periodo");
  const opticaId = searchParams.get("optica");
  if (!periodo) {
    return NextResponse.json({ error: "Falta período" }, { status: 400 });
  }

  const impWhere = { periodo, ...(opticaId ? { opticaId } : {}) };
  const rowWhere = {
    hasAlert: true,
    importacion: impWhere,
  };
  const sel = {
    rowIndex: true,
    alerts: true,
    importacion: { select: { tipoReporte: true, optica: { select: { nombre: true } } } },
  } satisfies Prisma.VentaDetalladaRowSelect;

  const [venta, pedido, gasto, comprobante, pago, cxp, cruces] = await Promise.all([
    db.ventaDetalladaRow.findMany({ where: rowWhere, select: sel }),
    db.pedidoLenteRow.findMany({ where: rowWhere, select: sel }),
    db.gastoRow.findMany({ where: rowWhere, select: sel }),
    db.comprobanteRow.findMany({ where: rowWhere, select: sel }),
    db.pagoProveedorRow.findMany({ where: rowWhere, select: sel }),
    db.cuentaPorPagarRow.findMany({ where: rowWhere, select: sel }),
    db.alertaCruce.findMany({
      where: impWhere,
      include: { optica: { select: { nombre: true } } },
    }),
  ]);

  const rowAlertas = (
    [venta, pedido, gasto, comprobante, pago, cxp].flat() as RowAlertRecord[]
  ).flatMap((r) =>
    ((r.alerts ?? []) as { campo: string; severidad: Severidad; tipo: string; mensaje: string }[]).map(
      (a) => ({
        Óptica: r.importacion.optica.nombre,
        Reporte: TIPO_REPORTE_LABEL[r.importacion.tipoReporte],
        Fila: r.rowIndex,
        Campo: a.campo,
        Severidad: a.severidad,
        Tipo: a.tipo,
        Mensaje: a.mensaje,
      })
    )
  );

  const cruceAlertas = cruces.map((c) => ({
    Óptica: c.optica.nombre,
    Cruce: CRUCE_LABEL[c.tipoCruce] ?? c.tipoCruce,
    Severidad: c.severidad,
    Mensaje: c.mensaje,
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(cruceAlertas.length ? cruceAlertas : [{ info: "Sin alertas de cruce" }]),
    "Cruces"
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(rowAlertas.length ? rowAlertas : [{ info: "Sin alertas de campo" }]),
    "Por reporte"
  );
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="alertas-${periodo}.xlsx"`,
    },
  });
}
