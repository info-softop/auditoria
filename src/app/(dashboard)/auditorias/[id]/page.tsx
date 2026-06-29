import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, Rows3, TriangleAlert, Download } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { formatNumber, formatFecha, formatPeriodo } from "@/lib/format";
import { TIPO_REPORTE_LABEL, type TipoReporte } from "@/lib/audit-types";
import { RowsTable, type SerializedRow } from "./_components/rows-table";

type AnyRow = {
  id: string;
  alerts: unknown;
  hasAlert: boolean;
  [key: string]: unknown;
};

function serializeRows(rows: AnyRow[]): SerializedRow[] {
  return rows.map((r) => {
    const out: SerializedRow = {
      id: r.id,
      hasAlert: r.hasAlert,
      alerts: Array.isArray(r.alerts)
        ? (r.alerts as SerializedRow["alerts"])
        : [],
    };
    for (const [k, v] of Object.entries(r)) {
      if (k === "id" || k === "alerts" || k === "hasAlert") continue;
      if (k === "importacion") continue;
      if (v instanceof Date) {
        out[k] = v.toISOString();
      } else {
        out[k] = v as SerializedRow[string];
      }
    }
    return out;
  });
}

export default async function AuditoriaDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;

  const importacion = await db.importacion.findUnique({
    where: { id },
    include: { optica: { select: { nombre: true } } },
  });

  if (!importacion) notFound();

  const tipo = importacion.tipoReporte as TipoReporte;

  let rows: AnyRow[] = [];
  switch (tipo) {
    case "VENTA_DETALLADA":
      rows = (await db.ventaDetalladaRow.findMany({
        where: { importacionId: id },
        orderBy: { rowIndex: "asc" },
      })) as unknown as AnyRow[];
      break;
    case "PEDIDO_LENTES":
      rows = (await db.pedidoLenteRow.findMany({
        where: { importacionId: id },
        orderBy: { rowIndex: "asc" },
      })) as unknown as AnyRow[];
      break;
    case "GASTOS":
      rows = (await db.gastoRow.findMany({
        where: { importacionId: id },
        orderBy: { rowIndex: "asc" },
      })) as unknown as AnyRow[];
      break;
    case "COMPROBANTES":
      rows = (await db.comprobanteRow.findMany({
        where: { importacionId: id },
        orderBy: { rowIndex: "asc" },
      })) as unknown as AnyRow[];
      break;
    case "PAGOS_PROVEEDORES":
      rows = (await db.pagoProveedorRow.findMany({
        where: { importacionId: id },
        orderBy: { rowIndex: "asc" },
      })) as unknown as AnyRow[];
      break;
    case "CUENTAS_POR_PAGAR":
      rows = (await db.cuentaPorPagarRow.findMany({
        where: { importacionId: id },
        orderBy: { rowIndex: "asc" },
      })) as unknown as AnyRow[];
      break;
  }

  const serialized = serializeRows(rows);
  const conAlerta = serialized.filter((r) => r.hasAlert).length;

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link href="/auditorias">
          <ArrowLeft className="size-4" />
          Auditorías
        </Link>
      </Button>

      <PageHeader
        title={importacion.optica.nombre}
        description={`${TIPO_REPORTE_LABEL[tipo]} · ${formatPeriodo(
          importacion.periodo,
        )}`}
      >
        <Badge variant="secondary">{TIPO_REPORTE_LABEL[tipo]}</Badge>
        <Button asChild variant="outline">
          <a href={`/api/export/auditoria/${importacion.id}`}>
            <Download className="size-4" /> Exportar a Excel
          </a>
        </Button>
      </PageHeader>

      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-2 pt-6 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <FileText className="size-4" />
            <span className="font-medium text-foreground">
              {importacion.fileName}
            </span>
          </div>
          <div className="text-muted-foreground">
            Período:{" "}
            <span className="text-foreground">
              {formatPeriodo(importacion.periodo)}
            </span>
          </div>
          <div className="text-muted-foreground">
            Cargado:{" "}
            <span className="text-foreground">
              {formatFecha(importacion.uploadedAt)}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <KpiCard
          label="Total de filas"
          value={formatNumber(serialized.length)}
          icon={Rows3}
        />
        <KpiCard
          label="Filas con alerta"
          value={formatNumber(conAlerta)}
          icon={TriangleAlert}
          tone={conAlerta > 0 ? "alta" : "default"}
          hint={
            conAlerta > 0
              ? `${((conAlerta / Math.max(serialized.length, 1)) * 100).toFixed(
                  1,
                )}% del total`
              : "Sin alertas detectadas"
          }
        />
      </div>

      <RowsTable rows={serialized} tipo={tipo} />
    </>
  );
}
