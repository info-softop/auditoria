import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { formatCOP } from "@/lib/format";
import { agrupar } from "@/lib/agrupar";
import { Desglose } from "@/components/informe/desglose";
import { TendenciaChart } from "@/components/informe/tendencia-chart";
import { DonaChart } from "@/components/informe/dona-chart";
import { Receipt, Calculator, Layers, Users } from "lucide-react";

export const dynamic = "force-dynamic";

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
function labelMes(p: string): string {
  const [y, m] = p.split("-").map(Number);
  return `${MESES[(m ?? 1) - 1] ?? "?"} ${String(y ?? "").slice(2)}`;
}

export default async function ReporteGastosPage() {
  await requireRole(["ADMIN", "AUDITOR"]);

  // Gasto real = filas D (partida doble). Todos los períodos.
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

  const total = rows.reduce((s, r) => s + (r.valor ?? 0), 0);
  const totalSinIVA = rows
    .filter((r) => !/iva/i.test(r.descripcion ?? ""))
    .reduce((s, r) => s + (r.valor ?? 0), 0);

  const porCategoria = agrupar(rows, (r) => r.descripcion, (r) => r.valor ?? 0);
  const porProveedor = agrupar(rows, (r) => r.tercero, (r) => r.valor ?? 0);
  const porOptica = agrupar(rows, (r) => r.importacion.optica?.nombre, (r) => r.valor ?? 0);

  const mesMap = new Map<string, number>();
  for (const r of rows) {
    mesMap.set(r.importacion.periodo, (mesMap.get(r.importacion.periodo) ?? 0) + (r.valor ?? 0));
  }
  const tendencia = [...mesMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([p, monto]) => ({ mes: labelMes(p), monto }));

  return (
    <>
      <PageHeader
        title="Informe de Gastos"
        description="Análisis de los gastos operativos cargados (reporte de Softop). Suma solo la fila de débito de cada gasto (partida doble), en todos los períodos."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total operativo" value={formatCOP(total)} icon={Receipt} />
        <KpiCard
          label="Gasto sin IVA"
          value={formatCOP(totalSinIVA)}
          icon={Calculator}
          hint="Excluye IVA descontable (recuperable)"
        />
        <KpiCard label="Categorías" value={porCategoria.length} icon={Layers} />
        <KpiCard label="Proveedores" value={porProveedor.length} icon={Users} />
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
              <h3 className="mb-4 font-heading text-sm font-medium">Tendencia mensual</h3>
              <TendenciaChart data={tendencia} />
            </CardContent>
          </Card>

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
        </div>
      )}
    </>
  );
}
