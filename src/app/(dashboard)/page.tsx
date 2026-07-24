import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { FilterBar } from "@/components/filter-bar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import { resolveFilters } from "@/lib/filters";
import { ventaKpis } from "@/lib/kpis";
import { formatCOP, formatNumber, formatPct, formatPeriodo } from "@/lib/format";
import { VENTA_NO_ANULADA } from "@/lib/venta-filters";
import type { Prisma } from "@/generated/prisma";
import {
  Banknote,
  Wallet,
  Percent,
  Receipt,
  ShoppingCart,
  TrendingUp,
  TriangleAlert,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { VentasPorOpticaChart } from "./_components/ventas-por-optica-chart";
import { DistribucionTipoChart } from "./_components/distribucion-tipo-chart";
import { TendenciaDiariaChart } from "./_components/tendencia-diaria-chart";

export default async function ResumenPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; optica?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;
  const { periodo, opticaId, periodos, opticas } = await resolveFilters(sp);

  if (!periodo) {
    return <EmptyDashboard periodos={periodos} opticas={opticas} />;
  }

  const ventaWhere: Prisma.VentaDetalladaRowWhereInput = {
    importacion: {
      periodo,
      tipoReporte: "VENTA_DETALLADA",
      ...(opticaId ? { opticaId } : {}),
    },
    ...VENTA_NO_ANULADA,
  };

  const [kpis, alertasCruce, filasConAlerta, filas] = await Promise.all([
    ventaKpis(periodo, opticaId),
    db.alertaCruce.count({
      where: { periodo, ...(opticaId ? { opticaId } : {}) },
    }),
    db.ventaDetalladaRow.count({ where: { ...ventaWhere, hasAlert: true } }),
    db.ventaDetalladaRow.findMany({
      // Solo líneas de venta: las filas "Abono" repiten productos/precios.
      // Insensible a mayúsculas ("VENTA"/"venta") — P-2.
      where: { ...ventaWhere, tipoMovimiento: { equals: "Venta", mode: "insensitive" } },
      select: {
        optica: true,
        fecha: true,
        tipoProducto: true,
        precioVenta: true,
        ventasTotales: true,
      },
    }),
  ]);

  const totalAlertas = alertasCruce + filasConAlerta;

  // (a) Ventas por óptica
  const ventasPorOptica = new Map<string, number>();
  for (const f of filas) {
    const key = f.optica?.trim() || "Sin óptica";
    ventasPorOptica.set(
      key,
      (ventasPorOptica.get(key) ?? 0) + (f.ventasTotales ?? 0)
    );
  }
  const ventasOpticaData = [...ventasPorOptica.entries()]
    .map(([nombre, ventas]) => ({ nombre, ventas }))
    .filter((d) => d.ventas > 0)
    .sort((a, b) => b.ventas - a.ventas);

  // (b) Distribución por tipo de producto
  const porTipo = new Map<string, number>();
  for (const f of filas) {
    const key = f.tipoProducto?.trim() || "Sin tipo";
    porTipo.set(key, (porTipo.get(key) ?? 0) + (f.precioVenta ?? 0));
  }
  const distribucionData = [...porTipo.entries()]
    .map(([tipo, valor]) => ({ tipo, valor }))
    .filter((d) => d.valor > 0)
    .sort((a, b) => b.valor - a.valor);

  // (c) Tendencia diaria de ventas
  const porDia = new Map<string, number>();
  for (const f of filas) {
    if (!f.fecha) continue;
    const key = f.fecha.toISOString().slice(0, 10); // YYYY-MM-DD
    porDia.set(key, (porDia.get(key) ?? 0) + (f.ventasTotales ?? 0));
  }
  const tendenciaData = [...porDia.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([iso, ventas]) => ({
      dia: iso.slice(8, 10) + "/" + iso.slice(5, 7),
      ventas,
    }));

  const hayDatos = filas.length > 0;

  return (
    <>
      <PageHeader
        title="Resumen"
        description={`Visión general de la auditoría — ${formatPeriodo(periodo)}.`}
      >
        <FilterBar
          periodos={periodos}
          opticas={opticas}
          activePeriodo={periodo}
          activeOptica={opticaId}
          showOptica
        />
      </PageHeader>

      {!hayDatos ? (
        <NoData />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <KpiCard
              label="Ventas totales"
              value={formatCOP(kpis.ventas)}
              icon={Banknote}
              hint={`${formatNumber(kpis.unidades)} unidades`}
            />
            <KpiCard
              label="Total recaudo"
              value={formatCOP(kpis.recaudo)}
              icon={Wallet}
              tone="success"
            />
            <KpiCard
              label="Cartera pendiente"
              value={formatCOP(kpis.carteraPendiente)}
              icon={Receipt}
              tone={kpis.carteraPendiente > 0 ? "alta" : "default"}
              hint="Saldo por cancelar"
            />
            <KpiCard
              label="Margen bruto"
              value={formatPct(kpis.margenPct)}
              icon={Percent}
              hint={formatCOP(kpis.margenBruto)}
            />
            <KpiCard
              label="Órdenes"
              value={formatNumber(kpis.ordenes)}
              icon={ShoppingCart}
            />
            <KpiCard
              label="Ticket promedio"
              value={formatCOP(kpis.ticketPromedio)}
              icon={TrendingUp}
            />
            <KpiCard
              label="Alertas"
              value={formatNumber(totalAlertas)}
              icon={TriangleAlert}
              tone="alta"
              hint={`${formatNumber(alertasCruce)} de cruce · ${formatNumber(filasConAlerta)} en filas`}
            />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ventas por óptica</CardTitle>
              </CardHeader>
              <CardContent>
                {ventasOpticaData.length > 0 ? (
                  <VentasPorOpticaChart data={ventasOpticaData} />
                ) : (
                  <EmptyChart />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Distribución por tipo de producto
                </CardTitle>
              </CardHeader>
              <CardContent>
                {distribucionData.length > 0 ? (
                  <DistribucionTipoChart data={distribucionData} />
                ) : (
                  <EmptyChart />
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">
                  Tendencia diaria de ventas
                </CardTitle>
              </CardHeader>
              <CardContent>
                {tendenciaData.length > 0 ? (
                  <TendenciaDiariaChart data={tendenciaData} />
                ) : (
                  <EmptyChart />
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
      Sin datos para graficar.
    </div>
  );
}

function NoData() {
  return (
    <Card>
      <CardContent className="py-16 text-center text-muted-foreground">
        <Upload className="mx-auto mb-3 size-10 opacity-40" />
        <p className="font-medium text-foreground">
          No hay datos de ventas en este período
        </p>
        <p className="mt-1 text-sm">
          Carga los reportes de Softop para ver KPIs, alertas y gráficas.
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/cargar">Cargar reportes</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function EmptyDashboard({
  periodos,
  opticas,
}: {
  periodos: string[];
  opticas: { id: string; nombre: string }[];
}) {
  return (
    <>
      <PageHeader
        title="Resumen"
        description="Visión general de la auditoría por óptica y período."
      >
        <FilterBar
          periodos={periodos}
          opticas={opticas}
          activePeriodo={null}
          activeOptica={null}
          showOptica
        />
      </PageHeader>
      <NoData />
    </>
  );
}
