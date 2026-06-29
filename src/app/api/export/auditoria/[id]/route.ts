import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { TIPO_REPORTE_LABEL } from "@/lib/audit-types";
import type { Severidad } from "@/lib/audit-types";

interface RowLike {
  raw: unknown;
  alerts: unknown;
}

const TABLE = {
  VENTA_DETALLADA: (id: string) => db.ventaDetalladaRow.findMany({ where: { importacionId: id }, orderBy: { rowIndex: "asc" } }),
  PEDIDO_LENTES: (id: string) => db.pedidoLenteRow.findMany({ where: { importacionId: id }, orderBy: { rowIndex: "asc" } }),
  GASTOS: (id: string) => db.gastoRow.findMany({ where: { importacionId: id }, orderBy: { rowIndex: "asc" } }),
  COMPROBANTES: (id: string) => db.comprobanteRow.findMany({ where: { importacionId: id }, orderBy: { rowIndex: "asc" } }),
  PAGOS_PROVEEDORES: (id: string) => db.pagoProveedorRow.findMany({ where: { importacionId: id }, orderBy: { rowIndex: "asc" } }),
  CUENTAS_POR_PAGAR: (id: string) => db.cuentaPorPagarRow.findMany({ where: { importacionId: id }, orderBy: { rowIndex: "asc" } }),
} as const;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;

  const imp = await db.importacion.findUnique({
    where: { id },
    include: { optica: true },
  });
  if (!imp) return NextResponse.json({ error: "No existe" }, { status: 404 });

  const rows = (await TABLE[imp.tipoReporte](id)) as RowLike[];

  // Construye la hoja a partir del raw (columnas originales) + columna de alertas.
  const data = rows.map((r) => {
    const raw = (r.raw ?? {}) as Record<string, unknown>;
    const alerts = (r.alerts ?? []) as { severidad: Severidad; mensaje: string }[];
    const alertasTxt = alerts
      .map((a) => `[${a.severidad}] ${a.mensaje}`)
      .join(" | ");
    return { ...raw, "ALERTAS DE AUDITORÍA": alertasTxt };
  });

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, TIPO_REPORTE_LABEL[imp.tipoReporte].slice(0, 31));
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  const nombre = `auditoria-${imp.optica.nombre}-${imp.periodo}-${imp.tipoReporte}.xlsx`
    .replace(/[^a-zA-Z0-9.\-_]/g, "_");

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombre}"`,
    },
  });
}
