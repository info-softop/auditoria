import Link from "next/link";
import { Inbox } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { FilterBar } from "@/components/filter-bar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { resolveFilters } from "@/lib/filters";
import { formatNumber, formatPeriodo } from "@/lib/format";
import { TIPO_REPORTE_LABEL, type TipoReporte } from "@/lib/audit-types";
import { AuditoriasTable, type ImportacionItem } from "./_components/auditorias-table";

export default async function AuditoriasPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; optica?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;
  const { periodo, opticaId, periodos, opticas } = await resolveFilters(sp);

  const importaciones = periodo
    ? await db.importacion.findMany({
        where: { periodo, ...(opticaId ? { opticaId } : {}) },
        include: { optica: { select: { nombre: true } } },
        orderBy: [{ uploadedAt: "desc" }],
      })
    : [];

  const totalAlertas = importaciones.reduce(
    (acc, i) => acc + i.filasConAlerta,
    0,
  );

  const items: ImportacionItem[] = importaciones.map((imp) => ({
    id: imp.id,
    optica: imp.optica.nombre,
    tipoReporte: imp.tipoReporte,
    tipoLabel: TIPO_REPORTE_LABEL[imp.tipoReporte as TipoReporte],
    uploadedAt: imp.uploadedAt.toISOString(),
    totalFilas: imp.totalFilas,
    filasConAlerta: imp.filasConAlerta,
  }));

  return (
    <>
      <PageHeader
        title="Auditorías"
        description="Reportes importados por período y óptica. Revisa el detalle de cada importación y las filas con alerta."
      >
        <FilterBar
          periodos={periodos}
          opticas={opticas}
          activePeriodo={periodo}
          activeOptica={opticaId}
          showOptica
        />
      </PageHeader>

      {importaciones.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <Inbox className="size-6 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="font-medium">Sin importaciones</p>
              <p className="text-sm text-muted-foreground">
                {periodo
                  ? `No hay reportes cargados para ${formatPeriodo(periodo)}${
                      opticaId ? " en esta óptica" : ""
                    }.`
                  : "Aún no hay reportes cargados."}
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/cargar">Cargar un reporte</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="mb-4 text-sm text-muted-foreground">
            {formatNumber(importaciones.length)}{" "}
            {importaciones.length === 1 ? "importación" : "importaciones"}
            {totalAlertas > 0 && (
              <>
                {" · "}
                <span className="font-medium text-sev-alta">
                  {formatNumber(totalAlertas)} filas con alerta
                </span>
              </>
            )}
          </p>

          <Card>
            <CardContent className="pt-6">
              <AuditoriasTable items={items} />
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}
