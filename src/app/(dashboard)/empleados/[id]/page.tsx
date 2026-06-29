import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { resumenVacaciones, TIPO_AUSENCIA_LABEL } from "@/lib/vacaciones";
import { formatCOP, formatFecha } from "@/lib/format";
import { ArrowLeft, Trash2 } from "lucide-react";
import { VacacionForm } from "./_components/vacacion-form";
import { eliminarVacacion } from "./actions";

export const dynamic = "force-dynamic";

const CONTRATO_LABEL: Record<string, string> = {
  indefinido: "Término indefinido",
  fijo: "Término fijo",
  obra_labor: "Obra o labor",
  prestacion_servicios: "Prestación de servicios",
  aprendizaje: "Aprendizaje",
};
function Dato({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value || "—"}</p>
    </div>
  );
}

function VacCard({ label, value, tone }: { label: string; value: number; tone?: "success" }) {
  return (
    <div
      className={
        tone === "success"
          ? "rounded-lg border border-success/30 bg-success/10 p-3"
          : "rounded-lg border p-3"
      }
    >
      <p className={tone === "success" ? "text-xs text-success" : "text-xs text-muted-foreground"}>
        {label}
      </p>
      <p
        className={
          tone === "success"
            ? "font-heading text-2xl tabular-nums-fin text-success"
            : "font-heading text-2xl tabular-nums-fin"
        }
      >
        {value}
      </p>
    </div>
  );
}

export default async function EmpleadoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["ADMIN"]);
  const { id } = await params;

  const empleado = await db.empleado.findUnique({
    where: { id },
    include: {
      cargo: { select: { nombre: true } },
      optica: { select: { nombre: true } },
      vacaciones: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!empleado) notFound();

  const nombreCompleto = [empleado.nombre, empleado.primerApellido, empleado.segundoApellido]
    .filter(Boolean)
    .join(" ");
  const resumen = resumenVacaciones(empleado.fechaAdmision, empleado.vacaciones, new Date());

  return (
    <>
      <PageHeader title={nombreCompleto}>
        <Button variant="outline" size="sm" asChild>
          <Link href="/empleados">
            <ArrowLeft className="size-3.5" /> Empleados
          </Link>
        </Button>
      </PageHeader>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Ficha del empleado</CardTitle>
          {empleado.estado === "activo" ? (
            <Badge className="bg-success text-success-foreground">Activo</Badge>
          ) : (
            <Badge variant="outline">Inactivo</Badge>
          )}
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <Dato
            label="Identificación"
            value={
              empleado.numeroIdentificacion
                ? `${empleado.tipoIdentificacion} ${empleado.numeroIdentificacion}`
                : ""
            }
          />
          <Dato label="Cargo" value={empleado.cargo?.nombre ?? ""} />
          <Dato label="Óptica" value={empleado.optica?.nombre ?? ""} />
          <Dato
            label="Tipo / contrato"
            value={`${empleado.tipoEmpleado} · ${CONTRATO_LABEL[empleado.tipoContrato] ?? empleado.tipoContrato}`}
          />
          <Dato label="Teléfono" value={empleado.telefono ?? ""} />
          <Dato label="Correo" value={empleado.correo ?? ""} />
          <Dato
            label="Fecha de admisión"
            value={empleado.fechaAdmision ? formatFecha(empleado.fechaAdmision) : ""}
          />
          <Dato label="Salario" value={empleado.salario != null ? formatCOP(empleado.salario) : ""} />
          <Dato
            label="Pago"
            value={[empleado.metodoPago, empleado.bancoNombre, empleado.numeroCuenta]
              .filter(Boolean)
              .join(" · ")}
          />
          <Dato label="Municipio" value={empleado.municipalidad ?? ""} />
          <Dato label="Dirección" value={empleado.direccion ?? ""} />
          {empleado.estado === "inactivo" && (
            <Dato
              label="Retiro"
              value={[
                empleado.fechaRetiro ? formatFecha(empleado.fechaRetiro) : "",
                empleado.motivoRetiro ?? "",
              ]
                .filter(Boolean)
                .join(" · ")}
            />
          )}
        </CardContent>
      </Card>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-base">Vacaciones y permisos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <VacCard label="Causadas" value={resumen.causadas} />
            <VacCard label="Tomadas/pagadas" value={resumen.tomadas} />
            <VacCard label="Saldo" value={resumen.saldo} tone="success" />
            <VacCard label="Permisos (días)" value={resumen.permisos} />
          </div>

          <div className="mt-4">
            <VacacionForm empleadoId={empleado.id} />
          </div>

          <ul className="mt-4 divide-y">
            {empleado.vacaciones.length === 0 && (
              <li className="py-3 text-center text-sm text-muted-foreground">
                Sin movimientos de vacaciones.
              </li>
            )}
            {empleado.vacaciones.map((vac) => (
              <li key={vac.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {TIPO_AUSENCIA_LABEL[vac.tipo] ?? vac.tipo}
                    <span className="ml-2 tabular-nums-fin text-muted-foreground">
                      {vac.dias} días
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {vac.fechaInicio ? formatFecha(vac.fechaInicio) : ""}
                    {vac.fechaFin ? ` → ${formatFecha(vac.fechaFin)}` : ""}
                    {vac.nota ? ` · ${vac.nota}` : ""}
                  </p>
                </div>
                <form action={eliminarVacacion}>
                  <input type="hidden" name="id" value={vac.id} />
                  <input type="hidden" name="empleadoId" value={empleado.id} />
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
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </>
  );
}
