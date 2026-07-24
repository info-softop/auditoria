import { PageHeader } from "@/components/page-header";
import { FilterBar } from "@/components/filter-bar";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { resolveFilters } from "@/lib/filters";
import { formatCOP, formatNumber, formatPeriodo } from "@/lib/format";
import { agrupar } from "@/lib/agrupar";
import { Desglose } from "@/components/informe/desglose";
import { TendenciaChart } from "@/components/informe/tendencia-chart";
import { DonaChart } from "@/components/informe/dona-chart";
import { Receipt, Layers, Users, Hash } from "lucide-react";

export const dynamic = "force-dynamic";

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
function labelMes(p: string): string {
  const [y, m] = p.split("-").map(Number);
  return `${MESES[(m ?? 1) - 1] ?? "?"} ${String(y ?? "").slice(2)}`;
}

export default async function ReporteGastosPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  await requireRole(["ADMIN", "AUDITOR"]);
  const sp = await searchParams;
  const { periodo, periodos } = await resolveFilters(sp);

  // Gasto real = filas D (partida doble). Todos los períodos (para la tendencia).
  const rows = await db.gastoRow.findMany({
    where: {
      importacion: { tipoReporte: "GASTOS" },
      dc: { equals: "D", mode: "insensitive" },
    },
    select: {
      valor: true,
      descripcion: true,
      tercero: true,
      importacion: { select: { periodo: true, optica: { select: { nombre: true } } } },
    },
  });

  // Tendencia: total por mes (todos los meses).
  const mesMap = new Map<string, number>();
  for (const r of rows) {
    mesMap.set(r.importacion.periodo, (mesMap.get(r.importacion.periodo) ?? 0) + (r.valor ?? 0));
  }
  const tendencia = [...mesMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([p, monto]) => ({ mes: labelMes(p), monto }));

  // KPIs y desgloses del MES SELECCIONADO.
  const rowsMes = rows.filter((r) => r.importacion.periodo === periodo);
  const total = rowsMes.reduce((s, r) => s + (r.valor ?? 0), 0);
  const porCategoria = agrupar(rowsMes, (r) => r.descripcion, (r) => r.valor ?? 0);
  const porProveedor = agrupar(rowsMes, (r) => r.tercero, (r) => r.valor ?? 0);
  const porOptica = agrupar(rowsMes, (r) => r.importacion.optica?.nombre, (r) => r.valor ?? 0);

  return (
    <>
      <PageHeader
        title="Informe de Gastos"
        description="Gastos operativos del mes seleccionado (suma la fila de débito de cada gasto). La tendencia muestra todos los meses."
      >
        <FilterBar
          periodos={periodos}
          opticas={[]}
          activePeriodo={periodo}
          activeOptica={null}
          showOptica={false}
        />
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label={`Total ${periodo ? formatPeriodo(periodo) : "del mes"}`} value={formatCOP(total)} icon={Receipt} />
        <KpiCard label="Nº de gastos" value={formatNumber(rowsMes.length)} icon={Hash} />
        <KpiCard label="Categorías" value={formatNumber(porCategoria.length)} icon={Layers} />
        <KpiCard label="Proveedores" value={formatNumber(porProveedor.length)} icon={Users} />
      </div>

      {rows.length === 0 ? (
        <Card className="mt-8">
          <CardContent className="pt-6">
            <p className="py-12 text-center text-sm text-muted-foreground">
              Sin gastos cargados. Súbelos en “Cargar reportes” (reporte de Gastos).
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 space-y-6">
          <Card>
            <CardContent className="pt-6">
              <h3 className="mb-4 font-heading text-sm font-medium">Tendencia mensual (todos los meses)</h3>
              <TendenciaChart data={tendencia} />
            </CardContent>
          </Card>

          {rowsMes.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Sin gastos en {periodo ? formatPeriodo(periodo) : "este mes"}. Elige otro mes arriba.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 lg:grid-cols-2">
                <Desglose titulo="Por categoría (cuenta de gasto)" items={porCategoria} total={total} />
                <Desglose titulo="Por proveedor / tercero" items={porProveedor} total={total} />
              </div>
              <Card>
                <CardContent className="pt-6">
                  <h3 className="mb-4 font-heading text-sm font-medium">Distribución por óptica</h3>
                  <DonaChart data={porOptica.map((o) => ({ label: o.label, monto: o.monto }))} />
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}
    </>
  );
}
