import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { calcularNominaCO, AUX_TRANSPORTE_2026 } from "@/lib/colombia-payroll";
import { formatCOP, formatFecha, formatPeriodo } from "@/lib/format";
import { ArrowLeft, Trash2 } from "lucide-react";
import { NominaBatchClient, type NominaRow } from "./_components/nomina-batch-client";
import { eliminarPagoNomina } from "./actions";

export const dynamic = "force-dynamic";

export default async function NominaPage() {
  await requireRole(["ADMIN"]);

  const [empleados, pagos] = await Promise.all([
    db.empleado.findMany({
      where: { estado: "activo", tipoEmpleado: "dependiente" },
      orderBy: { nombre: "asc" },
    }),
    db.pagoNomina.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { empleado: { select: { nombre: true, primerApellido: true } } },
    }),
  ]);

  const rows: NominaRow[] = empleados.map((e) => {
    const subsidio = e.subsidioTransporte
      ? e.subsidioTransporteValor ?? AUX_TRANSPORTE_2026
      : 0;
    const deducciones = calcularNominaCO({
      salario: e.salario ?? 0,
      auxilioTransporte: subsidio,
      salarioIntegral: e.salarioIntegral,
    }).empleado.total;
    return {
      id: e.id,
      nombre: [e.nombre, e.primerApellido].filter(Boolean).join(" "),
      cedula: e.numeroIdentificacion,
      salarioBase: e.salario ?? 0,
      subsidio,
      deducciones,
    };
  });

  return (
    <>
      <PageHeader
        title="Nómina"
        description="Pago en lote por período. Deducciones de empleado precargadas con la ley colombiana 2026."
      >
        <Button variant="outline" size="sm" asChild>
          <Link href="/empleados">
            <ArrowLeft className="size-3.5" /> Empleados
          </Link>
        </Button>
      </PageHeader>

      <NominaBatchClient rows={rows} />

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-base">Pagos registrados</CardTitle>
        </CardHeader>
        <CardContent>
          {pagos.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Aún no hay pagos de nómina registrados.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empleado</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead className="text-right">Base</TableHead>
                    <TableHead className="text-right">Deducciones</TableHead>
                    <TableHead className="text-right">Neto</TableHead>
                    <TableHead>Pagado</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagos.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        {[p.empleado.nombre, p.empleado.primerApellido].filter(Boolean).join(" ")}
                      </TableCell>
                      <TableCell>
                        {formatPeriodo(p.periodo)}
                        {p.quincena && (
                          <Badge variant="outline" className="ml-2">
                            Q{p.quincena}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums-fin">
                        {formatCOP(p.salarioBase + p.subsidioTransporte + p.bonos)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums-fin text-sev-alta">
                        {formatCOP(p.deducciones)}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums-fin">
                        {formatCOP(p.neto)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatFecha(p.fechaPago)}
                      </TableCell>
                      <TableCell className="text-right">
                        <form action={eliminarPagoNomina}>
                          <input type="hidden" name="id" value={p.id} />
                          <Button
                            type="submit"
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            aria-label="Eliminar pago"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </form>
                      </TableCell>
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
