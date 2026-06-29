import { PageHeader } from "@/components/page-header";
import { FilterBar } from "@/components/filter-bar";
import { KpiCard } from "@/components/kpi-card";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth-helpers";
import { resolveFilters } from "@/lib/filters";
import { db } from "@/lib/db";
import { formatCOP, formatNumber, formatFecha } from "@/lib/format";
import { Camera, Banknote, ShieldAlert, Inbox, ExternalLink, Check } from "lucide-react";
import Link from "next/link";
import { TrasladosTable, type TrasladoItem } from "./_components/traslados-table";
import { marcarTrasladoRevisado } from "./actions";

// Cuenta del banco que recibe el traslado (débito = monto consignado).
const CUENTA_BANCO = "11100507";

export default async function ConsignacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; optica?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;
  const { periodo, opticaId, periodos, opticas } = await resolveFilters(sp);

  // Cada NO COMPROBANTE es un traslado. Tomamos la fila del banco (cuenta
  // 11100507) que lleva el monto del traslado en `total`; si no existe esa
  // cuenta, caemos a cualquier fila con total > 0.
  const rows = periodo
    ? await db.comprobanteRow.findMany({
        where: {
          importacion: {
            tipoReporte: "COMPROBANTES",
            periodo,
            ...(opticaId ? { opticaId } : {}),
          },
          noComprobante: { not: null },
          OR: [{ cuenta: CUENTA_BANCO }, { total: { gt: 0 } }],
        },
        orderBy: [{ fecha: "asc" }, { noComprobante: "asc" }],
        select: {
          id: true,
          noComprobante: true,
          fecha: true,
          cuenta: true,
          total: true,
          descripcion: true,
          importacion: { select: { optica: { select: { nombre: true } } } },
          fotos: {
            orderBy: { uploadedAt: "desc" },
            take: 1,
            select: { fileUrl: true },
          },
        },
      })
    : [];

  // Agrupar por noComprobante: preferir la fila del banco; si no, la de mayor total.
  const porComprobante = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    const key = r.noComprobante!;
    const prev = porComprobante.get(key);
    if (!prev) {
      porComprobante.set(key, r);
      continue;
    }
    const rEsBanco = r.cuenta === CUENTA_BANCO;
    const prevEsBanco = prev.cuenta === CUENTA_BANCO;
    if (rEsBanco && !prevEsBanco) porComprobante.set(key, r);
    else if (rEsBanco === prevEsBanco && (r.total ?? 0) > (prev.total ?? 0))
      porComprobante.set(key, r);
  }

  const traslados = Array.from(porComprobante.values()).sort((a, b) => {
    const fa = a.fecha?.getTime() ?? 0;
    const fb = b.fecha?.getTime() ?? 0;
    if (fa !== fb) return fa - fb;
    return (a.noComprobante ?? "").localeCompare(b.noComprobante ?? "");
  });

  const totalTraslados = traslados.length;
  const montoTotal = traslados.reduce((sum, t) => sum + (t.total ?? 0), 0);
  const sinComprobante = traslados.filter((t) => t.fotos.length === 0).length;

  const items: TrasladoItem[] = traslados.map((t) => ({
    id: t.id,
    noComprobante: t.noComprobante ?? "—",
    fecha: t.fecha ? t.fecha.toISOString() : null,
    optica: t.importacion.optica.nombre,
    total: t.total ?? 0,
    fileUrl: t.fotos[0]?.fileUrl ?? null,
  }));

  // Consignaciones registradas por las asesoras desde el link público,
  // pendientes de revisión (independiente del período seleccionado).
  const pendientes = await db.trasladoPublico.findMany({
    where: { revisado: false },
    orderBy: { createdAt: "desc" },
    include: { optica: { select: { nombre: true } } },
  });

  return (
    <>
      <PageHeader
        title="Traslados"
        description="Verifica cada traslado bancario con la foto del comprobante de consignación."
      >
        <FilterBar
          periodos={periodos}
          opticas={opticas}
          activePeriodo={periodo}
          activeOptica={opticaId}
          showOptica
        />
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="Traslados"
          value={formatNumber(totalTraslados)}
          icon={Camera}
          hint="Comprobantes del período"
        />
        <KpiCard
          label="Monto consignado"
          value={formatCOP(montoTotal)}
          icon={Banknote}
          tone="success"
        />
        <KpiCard
          label="Sin comprobante"
          value={formatNumber(sinComprobante)}
          icon={ShieldAlert}
          tone="alta"
          hint="Traslados pendientes de foto"
        />
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Consignaciones registradas por las asesoras</CardTitle>
          <CardDescription>
            Enviadas desde el link público{" "}
            <Link
              href="/traslados/registrar"
              target="_blank"
              className="font-medium text-primary hover:underline"
            >
              /traslados/registrar
            </Link>
            . Comparte ese enlace con las asesoras para que suban valor, óptica y
            foto sin necesidad de cuenta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendientes.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
              <Inbox className="size-8 opacity-40" />
              <p className="text-sm">No hay consignaciones pendientes por revisar.</p>
            </div>
          ) : (
            <ul className="divide-y">
              {pendientes.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      {p.optica.nombre}
                      <span className="ml-2 tabular-nums-fin text-success">
                        {formatCOP(p.valor)}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {p.fecha ? `Consignado ${formatFecha(p.fecha)} · ` : ""}
                      Registrado {formatFecha(p.createdAt)}
                      {p.registradoPor ? ` por ${p.registradoPor}` : ""}
                      {p.observacion ? ` · ${p.observacion}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={p.fileUrl} target="_blank">
                        <ExternalLink className="size-3.5" /> Ver foto
                      </Link>
                    </Button>
                    <form action={marcarTrasladoRevisado}>
                      <input type="hidden" name="id" value={p.id} />
                      <Button type="submit" size="sm">
                        <Check className="size-3.5" /> Marcar revisado
                      </Button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Traslados del período</CardTitle>
          <CardDescription>
            Cada traslado corresponde a un comprobante. Sube la foto para
            marcarlo como verificado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TrasladosTable traslados={items} />
        </CardContent>
      </Card>
    </>
  );
}
