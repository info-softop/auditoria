import { PageHeader } from "@/components/page-header";
import { FilterBar } from "@/components/filter-bar";
import { KpiCard } from "@/components/kpi-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { db } from "@/lib/db";
import { resolveFilters } from "@/lib/filters";
import { requireUser } from "@/lib/auth-helpers";
import { formatCOP, formatPeriodo } from "@/lib/format";
import { ingresosPorCuenta } from "@/lib/conciliacion";
import { cuentasConSaldo } from "@/lib/tesoreria";
import { CUENTA_LABEL, CUENTA_ORDEN } from "@/lib/payment-accounts";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowRightLeft,
  Banknote,
  Landmark,
  Wallet,
  Clock,
  TriangleAlert,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExtractoDropzone } from "./_components/extracto-dropzone";
import { TesoreriaAcciones } from "./_components/tesoreria-acciones";

export default async function ConciliacionPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; optica?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;
  const { periodo, opticaId, periodos, opticas } = await resolveFilters(sp);

  // Tesorería: cuentas bancarias gestionadas con su saldo del día.
  const cuentas = await cuentasConSaldo();
  const saldoTotal = cuentas
    .filter((c) => c.moneda === "COP")
    .reduce((s, c) => s + c.saldo, 0);

  const importacionWhere = periodo
    ? { periodo, ...(opticaId ? { opticaId } : {}) }
    : { periodo: "__none__" };

  // Ingresos por cuenta destino (según método de pago) + consignaciones + egresos.
  const [ingresos, consignacionesAgg, egresosAgg] = await Promise.all([
    periodo ? ingresosPorCuenta(periodo, opticaId) : null,
    db.comprobanteRow.aggregate({
      _sum: { total: true },
      where: { importacion: importacionWhere },
    }),
    db.pagoProveedorRow.aggregate({
      _sum: { credito: true },
      where: {
        importacion: importacionWhere,
        descripcion: { startsWith: "banco", mode: "insensitive" },
      },
    }),
  ]);

  const totalConsignaciones = consignacionesAgg._sum.total ?? 0;
  const totalEgresosBanco = egresosAgg._sum.credito ?? 0;
  const varias = !opticaId && (ingresos?.porOptica.length ?? 0) > 1;

  const periodoLabel = periodo ? formatPeriodo(periodo) : "el período";
  const opticaLabel = opticaId
    ? opticas.find((o) => o.id === opticaId)?.nombre ?? "la óptica"
    : "todas las ópticas";

  return (
    <>
      <PageHeader
        title="Bancos"
        description="Compara el flujo de caja estimado del sistema contra los movimientos reales del extracto bancario."
      >
        <FilterBar
          periodos={periodos}
          opticas={opticas}
          activePeriodo={periodo}
          activeOptica={opticaId}
          showOptica
        />
      </PageHeader>

      {/* Tesorería: cuentas bancarias con saldo del día */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Cuentas bancarias</CardTitle>
            <CardDescription>
              Saldo del día = saldo inicial + ingresos − egresos del ledger.
              {cuentas.length > 0 && (
                <>
                  {" "}Saldo total (COP):{" "}
                  <span className="font-medium text-foreground tabular-nums-fin">
                    {formatCOP(saldoTotal)}
                  </span>
                </>
              )}
            </CardDescription>
          </div>
          <TesoreriaAcciones
            opticas={opticas}
            cuentas={cuentas.filter((c) => c.activa).map((c) => ({ id: c.id, nombre: c.nombre }))}
          />
        </CardHeader>
        <CardContent>
          {cuentas.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
              <Landmark className="size-8 opacity-40" />
              <p className="text-sm">
                Sin cuentas. Crea la primera con “Nueva cuenta” para llevar saldos y
                movimientos.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cuenta</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Óptica</TableHead>
                    <TableHead className="text-right">Saldo del día</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cuentas.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <Link
                          href={`/conciliacion/cuenta/${c.id}`}
                          className="font-medium hover:text-primary hover:underline"
                        >
                          {c.nombre}
                        </Link>
                        {c.bankCode && (
                          <span className="ml-2 text-xs text-muted-foreground">{c.bankCode}</span>
                        )}
                        {!c.activa && (
                          <Badge variant="outline" className="ml-2">
                            Inactiva
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {c.tipoCuenta === "gateway" ? (
                          <Badge variant="secondary">Pasarela</Badge>
                        ) : (
                          <span className="text-muted-foreground">Cuenta</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {c.opticaNombre ?? "General"}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums-fin">
                        {formatCOP(c.saldo)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={`/conciliacion/cuenta/${c.id}`}
                          className="inline-flex text-muted-foreground hover:text-primary"
                          aria-label="Ver movimientos"
                        >
                          <ChevronRight className="size-4" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modelo conceptual */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-base">Cómo se concilia</CardTitle>
          <CardDescription>
            La conciliación enfrenta lo que el sistema esperaba mover por banco
            contra lo que el banco efectivamente registró.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <div className="flex items-center gap-2 text-success">
              <ArrowDownToLine className="size-4" />
              <span className="text-sm font-medium">Ingresos al banco</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Ventas cobradas con tarjeta o transferencia (Venta Detallada,
              método de pago distinto de efectivo) más los traslados y
              consignaciones registrados en Comprobantes.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <div className="flex items-center gap-2 text-sev-alta">
              <ArrowUpFromLine className="size-4" />
              <span className="text-sm font-medium">Egresos del banco</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Pagos a proveedores y gastos liquidados contra el banco (Pagos a
              Proveedores / Gastos cuya cuenta es bancaria).
            </p>
          </div>
          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <div className="flex items-center gap-2 text-foreground">
              <Landmark className="size-4" />
              <span className="text-sm font-medium">Extracto bancario</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              La verdad de referencia. Los movimientos reales del banco se
              cruzan contra el ingreso/egreso estimado para detectar diferencias.
            </p>
          </div>
        </CardContent>
      </Card>

      {!ingresos ? (
        <Card className="mt-8">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Selecciona un período con datos para ver el desglose.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Flujo del efectivo: Caja Menor → Banco de Bogotá (traslados) */}
          <section className="mt-8 space-y-3">
            <div>
              <h2 className="font-heading text-lg tracking-tight">
                Flujo del efectivo
              </h2>
              <p className="text-sm text-muted-foreground">
                {periodoLabel} · {opticaLabel} — el efectivo se recibe en caja y se
                consigna a Banco de Bogotá (reporte de traslados).
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <KpiCard
                label="Efectivo recibido"
                value={formatCOP(ingresos.porCuenta.CAJA_MENOR)}
                icon={Wallet}
                hint="Ventas en efectivo (entran a Caja Menor)"
              />
              <KpiCard
                label="Trasladado a banco"
                value={formatCOP(totalConsignaciones)}
                icon={ArrowRightLeft}
                hint="Consignaciones Caja Menor → Banco (Comprobantes)"
              />
              <KpiCard
                label="Pendiente de consignar"
                value={formatCOP(ingresos.porCuenta.CAJA_MENOR - totalConsignaciones)}
                icon={TriangleAlert}
                tone={
                  ingresos.porCuenta.CAJA_MENOR - totalConsignaciones > 1000
                    ? "alta"
                    : "default"
                }
                hint="Efectivo recibido − trasladado"
              />
            </div>
          </section>

          {/* Lo que debe llegar a cada banco */}
          <section className="mt-8 space-y-3">
            <div>
              <h2 className="font-heading text-lg tracking-tight">
                Lo que debe llegar a cada banco
              </h2>
              <p className="text-sm text-muted-foreground">
                Para conciliar contra el extracto de cada cuenta.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <KpiCard
                label="Banco de Bogotá Corriente"
                value={formatCOP(
                  ingresos.porCuenta.BANCO_BOGOTA + totalConsignaciones
                )}
                icon={Landmark}
                tone="success"
                hint={`Tarjetas/transferencias ${formatCOP(
                  ingresos.porCuenta.BANCO_BOGOTA
                )} + efectivo consignado ${formatCOP(totalConsignaciones)}`}
              />
              <KpiCard
                label="Bancolombia Ahorros"
                value={formatCOP(ingresos.porCuenta.BANCOLOMBIA)}
                icon={Banknote}
                tone="success"
                hint="Ventas pagadas vía Bancolombia"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <KpiCard
                label="Egresos banco"
                value={formatCOP(totalEgresosBanco)}
                icon={ArrowUpFromLine}
                hint="Pagos liquidados contra banco"
                tone="alta"
              />
              {ingresos.totalAddi > 0 && (
                <KpiCard
                  label="Crédito Addi (llega a ~30 días)"
                  value={formatCOP(ingresos.totalAddi)}
                  icon={Clock}
                  hint="Incluido en Banco de Bogotá, pero aparece el mes siguiente"
                />
              )}
            </div>

            {/* Desglose por óptica × cuenta (cuando hay varias ópticas) */}
            {varias && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Por óptica</CardTitle>
                  <CardDescription>
                    Cada óptica tiene su propia cuenta de Banco de Bogotá y de
                    Bancolombia.
                  </CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-muted-foreground">
                      <tr>
                        <th className="px-2 py-2 font-medium">Óptica</th>
                        {CUENTA_ORDEN.map((c) => (
                          <th key={c} className="px-2 py-2 text-right font-medium">
                            {CUENTA_LABEL[c]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ingresos.porOptica.map((row) => (
                        <tr key={row.optica} className="border-t">
                          <td className="px-2 py-2 font-medium">{row.optica}</td>
                          {CUENTA_ORDEN.map((c) => (
                            <td
                              key={c}
                              className="px-2 py-2 text-right tabular-nums-fin"
                            >
                              {formatCOP(row.cuentas[c])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}

            {/* Métodos sin cuenta asignada */}
            {ingresos.sinCuenta.length > 0 && (
              <div className="rounded-lg border border-sev-media/40 bg-sev-media/10 p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <TriangleAlert className="size-4 text-sev-media" />
                  Métodos de pago sin cuenta asignada (revisar mapeo):
                </div>
                <ul className="mt-1.5 text-sm text-muted-foreground">
                  {ingresos.sinCuenta.map((s) => (
                    <li key={s.metodo}>
                      {s.metodo} — {formatCOP(s.monto)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </>
      )}

      {/* Carga del extracto */}
      <section className="mt-8 space-y-3">
        <div>
          <h2 className="font-heading text-lg tracking-tight">
            Extracto bancario
          </h2>
          <p className="text-sm text-muted-foreground">
            Sube el extracto del banco del período para conciliarlo contra el
            flujo estimado.
          </p>
        </div>
        <ExtractoDropzone periodo={periodo} opticaId={opticaId} />
      </section>
    </>
  );
}
