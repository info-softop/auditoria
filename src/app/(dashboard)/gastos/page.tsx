import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { cuentasConSaldo } from "@/lib/tesoreria";
import { formatCOP, formatFecha } from "@/lib/format";
import { Receipt, Wallet, CircleCheck } from "lucide-react";
import { GastoDialog, type GastoValores } from "./_components/gasto-dialog";
import { PagarGasto, BorrarGasto } from "./_components/gasto-acciones";

export const dynamic = "force-dynamic";

const ESTADO: Record<string, { label: string; cls: string }> = {
  pendiente: { label: "Pendiente", cls: "bg-sev-media/15 text-sev-media" },
  pagado: { label: "Pagado", cls: "bg-success/15 text-success" },
  cancelado: { label: "Cancelado", cls: "bg-muted text-muted-foreground" },
};

function mesActual(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function iso(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

export default async function GastosPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; cat?: string }>;
}) {
  await requireRole(["ADMIN", "AUDITOR"]);
  const sp = await searchParams;
  const mes = /^\d{4}-\d{2}$/.test(sp.mes ?? "") ? sp.mes! : mesActual();
  const cat = sp.cat?.trim() || "";
  const [y, m] = mes.split("-").map(Number);
  const inicio = new Date(Date.UTC(y, m - 1, 1));
  const fin = new Date(Date.UTC(y, m, 1));

  const [gastos, empleados, opticas, cuentas, categoriasRaw] = await Promise.all([
    db.gasto.findMany({
      where: {
        fechaVence: { gte: inicio, lt: fin },
        ...(cat ? { categoria: cat } : {}),
      },
      orderBy: [{ fechaVence: "desc" }],
      include: {
        empleado: { select: { nombre: true, primerApellido: true } },
        optica: { select: { nombre: true } },
      },
    }),
    db.empleado.findMany({
      where: { estado: "activo" },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, primerApellido: true },
    }),
    db.optica.findMany({ where: { activa: true }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
    cuentasConSaldo(),
    db.gasto.findMany({ distinct: ["categoria"], select: { categoria: true }, orderBy: { categoria: "asc" } }),
  ]);

  const categorias = categoriasRaw.map((c) => c.categoria);
  const totalMes = gastos.reduce((s, g) => s + g.monto, 0);
  const pendiente = gastos.filter((g) => g.estado === "pendiente").reduce((s, g) => s + g.monto, 0);
  const pagado = gastos.filter((g) => g.estado === "pagado").reduce((s, g) => s + g.monto, 0);

  const empleadosOpts = empleados.map((e) => ({
    id: e.id,
    nombre: [e.nombre, e.primerApellido].filter(Boolean).join(" "),
  }));
  const cuentasOpts = cuentas.filter((c) => c.activa).map((c) => ({ id: c.id, nombre: c.nombre }));

  return (
    <>
      <PageHeader title="Gastos">
        <GastoDialog empleados={empleadosOpts} opticas={opticas} categorias={categorias} modo="nuevo" />
      </PageHeader>

      {/* Filtros (GET, sin JS) */}
      <form className="mb-4 flex flex-wrap items-end gap-2">
        <div className="grid gap-1">
          <label className="text-xs text-muted-foreground">Mes</label>
          <input
            type="month"
            name="mes"
            defaultValue={mes}
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
          />
        </div>
        <div className="grid gap-1">
          <label className="text-xs text-muted-foreground">Categoría</label>
          <select
            name="cat"
            defaultValue={cat}
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
          >
            <option value="">Todas</option>
            {categorias.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="outline" size="sm">Filtrar</Button>
      </form>

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Total del mes" value={formatCOP(totalMes)} icon={Receipt} />
        <KpiCard label="Pendiente" value={formatCOP(pendiente)} icon={Wallet} tone="alta" />
        <KpiCard label="Pagado" value={formatCOP(pagado)} icon={CircleCheck} tone="success" />
      </div>

      <Card className="mt-8">
        <CardContent className="pt-6">
          {gastos.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Sin gastos en el período. Crea uno con “Nuevo gasto”.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vence</TableHead>
                    <TableHead>Concepto</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Tercero / óptica</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gastos.map((g) => {
                    const est = ESTADO[g.estado] ?? ESTADO.pendiente;
                    const tercero =
                      g.tercero ||
                      (g.empleado
                        ? [g.empleado.nombre, g.empleado.primerApellido].filter(Boolean).join(" ")
                        : "");
                    const valores: GastoValores = {
                      id: g.id,
                      fechaVence: iso(g.fechaVence),
                      fechaPago: iso(g.fechaPago),
                      concepto: g.concepto,
                      categoria: g.categoria,
                      subcategoria: g.subcategoria ?? "",
                      monto: String(g.monto),
                      estado: g.estado,
                      tercero: g.tercero ?? "",
                      terceroId: g.terceroId ?? "",
                      empleadoId: g.empleadoId ?? "",
                      opticaId: g.opticaId ?? "",
                      notas: g.notas ?? "",
                    };
                    return (
                      <TableRow key={g.id}>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {formatFecha(g.fechaVence)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {g.concepto}
                          {g.origen === "nomina" && (
                            <Badge variant="outline" className="ml-2">nómina</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {g.categoria}
                          {g.subcategoria ? ` · ${g.subcategoria}` : ""}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {tercero || g.optica?.nombre || "—"}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums-fin">
                          {formatCOP(g.monto)}
                        </TableCell>
                        <TableCell>
                          <Badge className={est.cls}>{est.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            {g.estado === "pendiente" && (
                              <PagarGasto id={g.id} cuentas={cuentasOpts} />
                            )}
                            <GastoDialog
                              empleados={empleadosOpts}
                              opticas={opticas}
                              categorias={categorias}
                              modo="editar"
                              valores={valores}
                            />
                            <BorrarGasto id={g.id} concepto={g.concepto} />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
