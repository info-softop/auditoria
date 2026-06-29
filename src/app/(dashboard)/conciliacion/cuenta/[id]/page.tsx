import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireUser } from "@/lib/auth-helpers";
import { detalleCuenta } from "@/lib/tesoreria";
import { formatCOP, formatFecha } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ArrowLeft, Trash2 } from "lucide-react";
import { eliminarMovimiento } from "../../tesoreria-actions";

export const dynamic = "force-dynamic";

export default async function CuentaDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const data = await detalleCuenta(id);
  if (!data || !data.cuenta) notFound();

  const { cuenta, movimientos, saldo } = data;
  const puedeEditar = user.role === "ADMIN" || user.role === "AUDITOR";

  return (
    <>
      <PageHeader title={cuenta.nombre}>
        <Button variant="outline" size="sm" asChild>
          <Link href="/conciliacion">
            <ArrowLeft className="size-3.5" /> Volver a Bancos
          </Link>
        </Button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Saldo del día</p>
            <p className="mt-1 font-heading text-3xl tabular-nums-fin">{formatCOP(saldo)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Saldo inicial</p>
            <p className="mt-1 font-heading text-3xl tabular-nums-fin">
              {formatCOP(cuenta.saldoInicial)}
            </p>
            {cuenta.saldoInicialFecha && (
              <p className="mt-1 text-xs text-muted-foreground">
                desde {formatFecha(cuenta.saldoInicialFecha)}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Tipo / banco</p>
            <p className="mt-1 text-lg font-medium">
              {cuenta.tipoCuenta === "gateway" ? "Pasarela" : "Cuenta bancaria"}
            </p>
            <p className="text-xs text-muted-foreground">
              {cuenta.bankCode ?? "—"}
              {cuenta.numeroCuenta ? ` · ${cuenta.numeroCuenta}` : ""}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-8">
        <CardContent className="pt-6">
          <p className="mb-3 text-sm text-muted-foreground">
            {movimientos.length} movimientos
          </p>
          {movimientos.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Sin movimientos. Regístralos desde Bancos → “Movimiento”.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Concepto</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead className="text-right">Ingreso</TableHead>
                    <TableHead className="text-right">Egreso</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    {puedeEditar && <TableHead></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movimientos.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatFecha(m.fecha)}
                      </TableCell>
                      <TableCell>
                        {m.concepto}
                        {m.origen !== "manual" && (
                          <Badge variant="outline" className="ml-2">
                            {m.origen}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{m.categoria ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums-fin text-success">
                        {m.direccion === "in" ? formatCOP(m.monto) : ""}
                      </TableCell>
                      <TableCell className="text-right tabular-nums-fin text-sev-alta">
                        {m.direccion === "out" ? formatCOP(m.monto) : ""}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-medium tabular-nums-fin",
                          m.saldoCorrido < 0 && "text-sev-alta"
                        )}
                      >
                        {formatCOP(m.saldoCorrido)}
                      </TableCell>
                      {puedeEditar && (
                        <TableCell className="text-right">
                          <form action={eliminarMovimiento}>
                            <input type="hidden" name="id" value={m.id} />
                            <Button
                              type="submit"
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              aria-label="Eliminar movimiento"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </form>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
