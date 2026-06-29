import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { FilterBar } from "@/components/filter-bar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireUser } from "@/lib/auth-helpers";
import { resolveFilters } from "@/lib/filters";
import { ventaKpis } from "@/lib/kpis";
import { analisisComercial, periodoAnterior } from "@/lib/analisis";
import { formatCOP, formatNumber, formatPct, formatPeriodo } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  Banknote,
  Receipt,
  Percent,
  TrendingDown,
  ShoppingCart,
  Wallet,
  BarChart3,
} from "lucide-react";

export const dynamic = "force-dynamic";

/** Formatea un delta porcentual con signo y color (verde sube / rojo baja). */
function Delta({ valor, suffix = "%" }: { valor: number | null; suffix?: string }) {
  if (valor == null || !Number.isFinite(valor)) return null;
  const signo = valor >= 0 ? "+" : "";
  return (
    <span className={cn(valor >= 0 ? "text-success" : "text-sev-alta")}>
      {signo}
      {valor.toFixed(1)}
      {suffix}
    </span>
  );
}

function nombreMes(periodo: string): string {
  return formatPeriodo(periodo).split(" ")[0].toLowerCase();
}

export default async function AnalisisPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; optica?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;
  const { periodo, opticaId, periodos, opticas } = await resolveFilters(sp);

  return (
    <>
      <PageHeader title="Análisis">
        <FilterBar
          periodos={periodos}
          opticas={opticas}
          activePeriodo={periodo}
          activeOptica={opticaId}
          showOptica
        />
      </PageHeader>

      {!periodo ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <BarChart3 className="mx-auto mb-3 size-10 opacity-40" />
            <p className="font-medium text-foreground">Elige un período</p>
            <p className="mt-1 text-sm">
              Selecciona el mes para ver la inteligencia comercial.
            </p>
          </CardContent>
        </Card>
      ) : (
        <AnalisisContenido periodo={periodo} opticaId={opticaId} />
      )}
    </>
  );
}

async function AnalisisContenido({
  periodo,
  opticaId,
}: {
  periodo: string;
  opticaId: string | null;
}) {
  const prev = periodoAnterior(periodo);
  const [kpis, kpisPrev, com] = await Promise.all([
    ventaKpis(periodo, opticaId),
    ventaKpis(prev, opticaId),
    analisisComercial(periodo, opticaId),
  ]);

  const deltaVentasPct =
    kpisPrev.ventas > 0 ? ((kpis.ventas - kpisPrev.ventas) / kpisPrev.ventas) * 100 : null;
  const deltaMargenPp = kpisPrev.ventas > 0 ? kpis.margenPct - kpisPrev.margenPct : null;
  const deltaTicketPct =
    kpisPrev.ticketPromedio > 0
      ? ((kpis.ticketPromedio - kpisPrev.ticketPromedio) / kpisPrev.ticketPromedio) * 100
      : null;
  const carteraPct = kpis.ventas > 0 ? (kpis.carteraPendiente / kpis.ventas) * 100 : 0;
  const mesPrev = nombreMes(prev);

  if (kpis.ventas === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No hay ventas registradas para {formatPeriodo(periodo)}.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="Ventas"
          value={formatCOP(kpis.ventas)}
          icon={Banknote}
          hint={
            deltaVentasPct != null ? (
              <>
                <Delta valor={deltaVentasPct} /> vs {mesPrev}
              </>
            ) : (
              `${formatNumber(kpis.unidades)} unidades`
            )
          }
        />
        <KpiCard
          label="Ticket promedio"
          value={formatCOP(kpis.ticketPromedio)}
          icon={Receipt}
          hint={
            deltaTicketPct != null ? (
              <>
                <Delta valor={deltaTicketPct} /> vs {mesPrev}
              </>
            ) : (
              `${formatNumber(kpis.ordenes)} órdenes`
            )
          }
        />
        <KpiCard
          label="Margen bruto"
          value={formatPct(kpis.margenPct)}
          icon={Percent}
          tone="success"
          hint={
            deltaMargenPp != null ? (
              <>
                <Delta valor={deltaMargenPp} suffix=" pp" /> vs {mesPrev}
              </>
            ) : (
              formatCOP(kpis.margenBruto)
            )
          }
        />
        <KpiCard
          label="Descuento promedio"
          value={formatPct(com.descuentoPct)}
          icon={TrendingDown}
          tone="alta"
          hint={`${formatCOP(com.descuentoTotal)} cedidos`}
        />
        <KpiCard
          label="Unidades por orden"
          value={com.upt.toFixed(2)}
          icon={ShoppingCart}
          hint="venta cruzada (UPT)"
        />
        <KpiCard
          label="Cartera pendiente"
          value={formatPct(carteraPct)}
          icon={Wallet}
          tone={carteraPct > 25 ? "alta" : "default"}
          hint={formatCOP(kpis.carteraPendiente)}
        />
      </div>

      {/* Ranking de asesoras */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ranking de asesoras</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asesora</TableHead>
                  <TableHead className="text-right">Ventas</TableHead>
                  <TableHead className="text-right">Órdenes</TableHead>
                  <TableHead className="text-right">Ticket</TableHead>
                  <TableHead className="text-right">UPT</TableHead>
                  <TableHead className="text-right">Margen %</TableHead>
                  <TableHead className="text-right">Desc.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {com.asesoras.map((a) => (
                  <TableRow key={a.asesora}>
                    <TableCell className="font-medium capitalize">
                      {a.asesora.toLowerCase()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums-fin">
                      {formatCOP(a.ventas)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums-fin">
                      {formatNumber(a.ordenes)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums-fin">
                      {formatCOP(a.ticket)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums-fin">
                      {(a.ordenes > 0 ? a.unidades / a.ordenes : 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums-fin">
                      {formatPct(a.margenPct)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums-fin">
                      {formatCOP(a.descuento)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Mix por categoría */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mix por categoría</CardTitle>
          </CardHeader>
          <CardContent>
            <MixTabla items={com.categorias.slice(0, 8)} totalVentas={kpis.ventas} />
          </CardContent>
        </Card>

        {/* Mix por marca */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mix por marca</CardTitle>
          </CardHeader>
          <CardContent>
            <MixTabla items={com.marcas.slice(0, 8)} totalVentas={kpis.ventas} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top productos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top productos por ventas</CardTitle>
          </CardHeader>
          <CardContent>
            <ProductoTabla items={com.topProductos} />
          </CardContent>
        </Card>

        {/* Bajo margen */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Productos de menor margen</CardTitle>
          </CardHeader>
          <CardContent>
            <ProductoTabla items={com.bajoMargen} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MixTabla({
  items,
  totalVentas,
}: {
  items: { nombre: string; ventas: number; margenPct: number }[];
  totalVentas: number;
}) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Sin datos.</p>;
  }
  return (
    <div className="flex flex-col gap-2.5">
      {items.map((m) => {
        const peso = totalVentas > 0 ? (m.ventas / totalVentas) * 100 : 0;
        return (
          <div key={m.nombre}>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate font-medium">{m.nombre}</span>
              <span className="shrink-0 tabular-nums-fin text-muted-foreground">
                {formatCOP(m.ventas)} · {formatPct(m.margenPct)} mg
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.min(100, peso)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ProductoTabla({
  items,
}: {
  items: { producto: string; ventas: number; margenPct: number; unidades: number }[];
}) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Sin datos.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Producto</TableHead>
            <TableHead className="text-right">Uds</TableHead>
            <TableHead className="text-right">Ventas</TableHead>
            <TableHead className="text-right">Margen %</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((p) => (
            <TableRow key={p.producto}>
              <TableCell className="max-w-[180px] truncate font-medium">
                {p.producto}
              </TableCell>
              <TableCell className="text-right tabular-nums-fin">
                {formatNumber(p.unidades)}
              </TableCell>
              <TableCell className="text-right tabular-nums-fin">
                {formatCOP(p.ventas)}
              </TableCell>
              <TableCell className="text-right tabular-nums-fin">
                {formatPct(p.margenPct)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
