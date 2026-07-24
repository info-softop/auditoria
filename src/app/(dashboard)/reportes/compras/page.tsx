import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { formatCOP, formatNumber } from "@/lib/format";
import { agrupar } from "@/lib/agrupar";
import { Desglose } from "@/components/informe/desglose";
import { TendenciaChart } from "@/components/informe/tendencia-chart";
import { DonaChart } from "@/components/informe/dona-chart";
import { ShoppingCart, Layers, Users } from "lucide-react";

export const dynamic = "force-dynamic";

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
function labelMes(p: string): string {
  const [y, m] = p.split("-").map(Number);
  return `${MESES[(m ?? 1) - 1] ?? "?"} ${String(y ?? "").slice(2)}`;
}

export default async function ReporteComprasPage() {
  await requireRole(["ADMIN", "AUDITOR"]);

  // Compras = Cuentas por Pagar (Cuánto Debo). Todos los períodos.
  const rows = await db.cuentaPorPagarRow.findMany({
    select: {
      total: true,
      proveedor: true,
      importacion: { select: { periodo: true, optica: { select: { nombre: true } } } },
    },
  });

  const total = rows.reduce((s, r) => s + (r.total ?? 0), 0);
  const porProveedor = agrupar(rows, (r) => r.proveedor, (r) => r.total ?? 0);
  const porOptica = agrupar(rows, (r) => r.importacion.optica?.nombre, (r) => r.total ?? 0);

  const mesMap = new Map<string, number>();
  for (const r of rows) {
    mesMap.set(r.importacion.periodo, (mesMap.get(r.importacion.periodo) ?? 0) + (r.total ?? 0));
  }
  const tendencia = [...mesMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([p, monto]) => ({ mes: labelMes(p), monto }));

  return (
    <>
      <PageHeader
        title="Informe de Compras"
        description="Análisis de las compras registradas (reporte Cuentas por Pagar / Cuánto Debo), en todos los períodos. Mayormente compras a laboratorios."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard label="Total comprado" value={formatCOP(total)} icon={ShoppingCart} />
        <KpiCard label="Nº de compras" value={formatNumber(rows.length)} icon={Layers} />
        <KpiCard label="Proveedores" value={formatNumber(porProveedor.length)} icon={Users} />
      </div>

      {rows.length === 0 ? (
        <Card className="mt-8">
          <CardContent className="pt-6">
            <p className="py-12 text-center text-sm text-muted-foreground">
              Sin compras cargadas. Súbelas en “Cargar reportes” (Cuentas por Pagar / Cuánto Debo).
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
            <Desglose titulo="Compras por proveedor" items={porProveedor} total={total} />
            <Card>
              <CardContent className="pt-6">
                <h3 className="mb-4 font-heading text-sm font-medium">Distribución por óptica</h3>
                <DonaChart data={porOptica.map((o) => ({ label: o.label, monto: o.monto }))} />
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
