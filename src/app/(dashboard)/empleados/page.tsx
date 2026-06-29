import { PageHeader } from "@/components/page-header";
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
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { formatCOP } from "@/lib/format";
import { UserCog, Wallet } from "lucide-react";
import Link from "next/link";
import { EmpleadoDialog, type EmpleadoValores } from "./_components/empleado-dialog";
import { BorrarEmpleado } from "./_components/borrar-empleado";

export const dynamic = "force-dynamic";

const CONTRATO_LABEL: Record<string, string> = {
  indefinido: "Indefinido",
  fijo: "Término fijo",
  obra_labor: "Obra o labor",
  prestacion_servicios: "Prestación",
  aprendizaje: "Aprendizaje",
};

function isoDate(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

export default async function EmpleadosPage() {
  await requireRole(["ADMIN"]);

  const [empleados, opticas, cargosRaw] = await Promise.all([
    db.empleado.findMany({
      orderBy: [{ estado: "asc" }, { nombre: "asc" }],
      include: {
        optica: { select: { nombre: true } },
        cargo: { select: { nombre: true } },
      },
    }),
    db.optica.findMany({
      where: { activa: true },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true },
    }),
    db.cargo.findMany({ orderBy: { nombre: "asc" }, select: { nombre: true } }),
  ]);

  const cargos = cargosRaw.map((c) => c.nombre);
  const activos = empleados.filter((e) => e.estado === "activo").length;

  return (
    <>
      <PageHeader title="Empleados">
        <Button variant="outline" asChild>
          <Link href="/empleados/nomina">
            <Wallet className="size-4" /> Nómina
          </Link>
        </Button>
        <EmpleadoDialog opticas={opticas} cargos={cargos} modo="nuevo" />
      </PageHeader>

      <Card>
        <CardContent className="pt-6">
          {empleados.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
              <UserCog className="size-8 opacity-40" />
              <p className="text-sm">
                Aún no hay empleados. Crea el primero con “Nuevo empleado”.
              </p>
            </div>
          ) : (
            <>
              <p className="mb-3 text-sm text-muted-foreground">
                {empleados.length} empleados · {activos} activos
              </p>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empleado</TableHead>
                      <TableHead>Identificación</TableHead>
                      <TableHead>Cargo</TableHead>
                      <TableHead>Óptica</TableHead>
                      <TableHead>Contrato</TableHead>
                      <TableHead className="text-right">Salario</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {empleados.map((e) => {
                      const nombreCompleto = [e.nombre, e.primerApellido, e.segundoApellido]
                        .filter(Boolean)
                        .join(" ");
                      const valores: EmpleadoValores = {
                        id: e.id,
                        codigo: e.codigo ?? "",
                        tipoEmpleado: e.tipoEmpleado,
                        tipoIdentificacion: e.tipoIdentificacion,
                        numeroIdentificacion: e.numeroIdentificacion ?? "",
                        tipoContrato: e.tipoContrato,
                        nombre: e.nombre,
                        primerApellido: e.primerApellido ?? "",
                        segundoApellido: e.segundoApellido ?? "",
                        cargoNombre: e.cargo?.nombre ?? "",
                        opticaId: e.opticaId ?? "",
                        telefono: e.telefono ?? "",
                        correo: e.correo ?? "",
                        fechaAdmision: isoDate(e.fechaAdmision),
                        municipalidad: e.municipalidad ?? "",
                        direccion: e.direccion ?? "",
                        metodoPago: e.metodoPago,
                        bancoNombre: e.bancoNombre ?? "",
                        tipoCuenta: e.tipoCuenta ?? "",
                        numeroCuenta: e.numeroCuenta ?? "",
                        salario: e.salario != null ? String(e.salario) : "",
                        subsidioTransporte: e.subsidioTransporte,
                        subsidioTransporteValor:
                          e.subsidioTransporteValor != null ? String(e.subsidioTransporteValor) : "",
                        pensionAltoRiesgo: e.pensionAltoRiesgo,
                        salarioIntegral: e.salarioIntegral,
                        estado: e.estado,
                        fechaRetiro: isoDate(e.fechaRetiro),
                        motivoRetiro: e.motivoRetiro ?? "",
                        notas: e.notas ?? "",
                      };
                      return (
                        <TableRow key={e.id}>
                          <TableCell className="font-medium">
                            <Link href={`/empleados/${e.id}`} className="hover:text-primary hover:underline">
                              {nombreCompleto}
                            </Link>
                          </TableCell>
                          <TableCell className="tabular-nums-fin text-muted-foreground">
                            {e.numeroIdentificacion
                              ? `${e.tipoIdentificacion} ${e.numeroIdentificacion}`
                              : "—"}
                          </TableCell>
                          <TableCell>{e.cargo?.nombre ?? "—"}</TableCell>
                          <TableCell>{e.optica?.nombre ?? "—"}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {CONTRATO_LABEL[e.tipoContrato] ?? e.tipoContrato}
                          </TableCell>
                          <TableCell className="text-right tabular-nums-fin">
                            {e.salario != null ? formatCOP(e.salario) : "—"}
                          </TableCell>
                          <TableCell>
                            {e.estado === "activo" ? (
                              <Badge className="bg-success text-success-foreground">Activo</Badge>
                            ) : (
                              <Badge variant="outline">Inactivo</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              <EmpleadoDialog
                                opticas={opticas}
                                cargos={cargos}
                                modo="editar"
                                valores={valores}
                              />
                              <BorrarEmpleado id={e.id} nombre={nombreCompleto} />
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
