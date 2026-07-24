import { PageHeader } from "@/components/page-header";
import { FilterBar } from "@/components/filter-bar";
import { KpiCard } from "@/components/kpi-card";
import { SeverityBadge } from "@/components/severity-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { resolveFilters } from "@/lib/filters";
import { requireUser } from "@/lib/auth-helpers";
import { formatCOP, formatNumber } from "@/lib/format";
import { Wallet, Users, HandCoins, TriangleAlert, FileSearch, ShoppingCart, Layers } from "lucide-react";
import { agrupar } from "@/lib/agrupar";
import { Desglose } from "@/components/informe/desglose";
import {
  SaldoProveedoresTable,
  type SaldoProveedor,
} from "./_components/saldo-proveedores-table";
import type { Severidad } from "@/lib/audit-types";

/** Normaliza nombre de proveedor para unir comprado vs pagado. */
function normKey(nombre: string | null | undefined): string {
  return (nombre ?? "").trim().toLowerCase();
}

export default async function ProveedoresPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; optica?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;
  const { periodo, opticaId, periodos, opticas } = await resolveFilters(sp);

  const importacionWhere = {
    periodo: periodo ?? undefined,
    ...(opticaId ? { opticaId } : {}),
  };

  const [comprasGrouped, pagosGrouped, comprasRows, alertas] = await Promise.all([
    db.cuentaPorPagarRow.groupBy({
      by: ["proveedor"],
      where: { importacion: importacionWhere },
      _sum: { total: true },
    }),
    db.pagoProveedorRow.groupBy({
      by: ["proveedor"],
      where: { importacion: importacionWhere },
      _sum: { debito: true },
    }),
    // Filas de compras (Cuánto Debo) para el informe: agrupamos normalizado.
    db.cuentaPorPagarRow.findMany({
      where: { importacion: importacionWhere },
      select: {
        proveedor: true,
        total: true,
        importacion: { select: { optica: { select: { nombre: true } } } },
      },
    }),
    db.alertaCruce.findMany({
      where: {
        tipoCruce: "C_CUENTAS_PAGAR",
        periodo: periodo ?? undefined,
        ...(opticaId ? { opticaId } : {}),
      },
      include: { optica: { select: { nombre: true } } },
      orderBy: [{ severidad: "asc" }, { id: "asc" }],
    }),
  ]);

  // Unir por nombre normalizado, conservando una etiqueta legible.
  const mapa = new Map<string, SaldoProveedor>();

  for (const c of comprasGrouped) {
    const key = normKey(c.proveedor);
    if (!key) continue;
    const comprado = c._sum.total ?? 0;
    const prev = mapa.get(key);
    if (prev) {
      prev.comprado += comprado;
    } else {
      mapa.set(key, {
        proveedor: (c.proveedor ?? "").trim() || "(sin nombre)",
        comprado,
        pagado: 0,
        saldo: 0,
      });
    }
  }

  for (const p of pagosGrouped) {
    const key = normKey(p.proveedor);
    if (!key) continue;
    const pagado = p._sum.debito ?? 0;
    const prev = mapa.get(key);
    if (prev) {
      prev.pagado += pagado;
    } else {
      mapa.set(key, {
        proveedor: (p.proveedor ?? "").trim() || "(sin nombre)",
        comprado: 0,
        pagado,
        saldo: 0,
      });
    }
  }

  const filas: SaldoProveedor[] = [...mapa.values()]
    .map((f) => ({ ...f, saldo: f.comprado - f.pagado }))
    .sort((a, b) => b.saldo - a.saldo);

  const deudaTotal = filas.reduce((s, f) => s + Math.max(f.saldo, 0), 0);
  const proveedoresConSaldo = filas.filter((f) => f.saldo > 0).length;
  const totalPagado = filas.reduce((s, f) => s + f.pagado, 0);

  // Informe de compras (Cuánto Debo), agrupado normalizado (case/espacios).
  const totalComprado = comprasRows.reduce((s, c) => s + (c.total ?? 0), 0);
  const comprasPorProveedor = agrupar(comprasRows, (c) => c.proveedor, (c) => c.total ?? 0);
  const comprasPorOptica = agrupar(comprasRows, (c) => c.importacion.optica?.nombre, (c) => c.total ?? 0);

  return (
    <>
      <PageHeader
        title="Proveedores"
        description="Cuentas por pagar: saldo pendiente por proveedor del período."
      >
        <FilterBar
          periodos={periodos}
          opticas={opticas}
          activePeriodo={periodo}
          activeOptica={opticaId}
          showOptica
        />
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          label="Deuda total"
          value={formatCOP(deudaTotal)}
          icon={Wallet}
          tone={deudaTotal > 0 ? "alta" : "default"}
          hint="Saldo pendiente de pago"
        />
        <KpiCard
          label="Proveedores con saldo"
          value={formatNumber(proveedoresConSaldo)}
          icon={Users}
          hint="Con saldo pendiente > 0"
        />
        <KpiCard
          label="Total pagado en el período"
          value={formatCOP(totalPagado)}
          icon={HandCoins}
          tone="success"
        />
      </div>

      {/* ───────── Informe de compras (Cuánto Debo) ───────── */}
      <div className="mt-10 space-y-4">
        <h2 className="font-heading text-lg font-medium">Informe de compras</h2>
        {comprasRows.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="py-8 text-center text-sm text-muted-foreground">
                Sin compras cargadas para el período. Súbelas en “Cargar reportes” (Cuentas por Pagar / Cuánto Debo).
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <KpiCard label="Total comprado" value={formatCOP(totalComprado)} icon={ShoppingCart} />
              <KpiCard label="Nº de compras" value={formatNumber(comprasRows.length)} icon={Layers} />
              <KpiCard label="Proveedores" value={formatNumber(comprasPorProveedor.length)} icon={Users} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Desglose titulo="Compras por proveedor" items={comprasPorProveedor} total={totalComprado} />
              <Desglose titulo="Compras por óptica" items={comprasPorOptica} total={totalComprado} top={6} />
            </div>
          </>
        )}
      </div>

      {alertas.length > 0 && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TriangleAlert className="size-4 text-sev-alta" />
              Alertas de cruce C — Cuentas por pagar
              <span className="text-sm font-normal text-muted-foreground">
                ({alertas.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alertas.map((a) => (
              <div
                key={a.id}
                className="flex items-start justify-between gap-4 rounded-lg border border-foreground/10 px-3 py-2.5"
              >
                <div className="space-y-0.5">
                  <p className="text-sm">{a.mensaje}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.optica?.nombre ?? "—"}
                  </p>
                </div>
                <SeverityBadge severidad={a.severidad as Severidad} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-base">Saldo por proveedor</CardTitle>
        </CardHeader>
        <CardContent>
          {filas.length > 0 ? (
            <SaldoProveedoresTable filas={filas} />
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              <FileSearch className="mx-auto mb-3 size-9 opacity-40" />
              <p className="font-medium text-foreground">
                Sin movimientos de proveedores
              </p>
              <p className="mt-1 text-sm">
                No hay cuentas por pagar ni pagos para el período seleccionado.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
