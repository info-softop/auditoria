import { PageHeader } from "@/components/page-header";
import { FilterBar } from "@/components/filter-bar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { requireUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { resolveFilters } from "@/lib/filters";
import { ventaKpis, recaudoPorAsesora, type AsesoraRecaudo } from "@/lib/kpis";
import {
  calcularSeguimiento,
  sumarNiveles,
  periodosFuturos,
  type MetaNiveles,
  type SeguimientoMeta,
} from "@/lib/metas";
import { formatCOP, formatPct, formatPeriodo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MetaDialog } from "./_components/meta-dialog";
import { AsesorasPanel } from "./_components/asesoras-panel";
import { Target } from "lucide-react";

export const dynamic = "force-dynamic";

const CERO: MetaNiveles = { recaudoNivel1: 0, recaudoNivel2: 0, recaudoNivel3: 0 };

/** Color del relleno según el ritmo proyectado hacia el nivel principal (1.5%). */
function fillPaceClass(seg: SeguimientoMeta): string {
  const objetivo = seg.niveles[1]?.metaMes ?? seg.niveles[0]?.metaMes ?? 0;
  if (objetivo <= 0) return "bg-muted-foreground/40";
  const r = (seg.enCurso ? seg.proyeccionFinMes : seg.recaudoReal) / objetivo;
  if (r >= 1) return "bg-success";
  if (r >= 0.8) return "bg-sev-media";
  return "bg-sev-alta";
}

/** Barra única de recaudo (0 → nivel 2.0%) con líneas de corte en cada nivel. */
function BarraNiveles({ seg }: { seg: SeguimientoMeta }) {
  const tope = seg.niveles[2]?.metaMes || seg.niveles[1]?.metaMes || seg.niveles[0]?.metaMes || 0;
  if (tope <= 0) return null;
  const fill = Math.min(100, (seg.recaudoReal / tope) * 100);
  // Posición de cada corte (relativa al tope = nivel 2.0%).
  const pos = (m: number) => Math.min(100, (m / tope) * 100);

  return (
    <div className="my-1">
      {/* Etiquetas de cada corte, encima de la barra. */}
      <div className="relative mb-1 h-3.5 text-[10px] font-medium text-muted-foreground">
        {seg.niveles.map((n, i) => (
          <span
            key={n.pct}
            className="absolute tabular-nums-fin"
            style={
              i === 2
                ? { right: 0 }
                : { left: `${pos(n.metaMes)}%`, transform: "translateX(-50%)" }
            }
          >
            {n.pct.toFixed(1)}%
          </span>
        ))}
      </div>
      <div className="relative h-4 w-full overflow-hidden rounded-md bg-muted">
        <div
          className={cn("h-full rounded-md transition-all", fillPaceClass(seg))}
          style={{ width: `${fill}%` }}
        />
        {/* Líneas de corte de 1.0% y 1.5% (el 2.0% es el borde derecho). */}
        {seg.niveles.map((n, i) =>
          i < 2 && n.metaMes > 0 ? (
            <div
              key={n.pct}
              className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-foreground/50"
              style={{ left: `${pos(n.metaMes)}%` }}
            />
          ) : null
        )}
      </div>
    </div>
  );
}

function MetaCard({
  titulo,
  seg,
  asesoras,
  totalOptica,
  meta,
  editar,
}: {
  titulo: string;
  seg: SeguimientoMeta;
  asesoras?: AsesoraRecaudo[];
  totalOptica?: number;
  meta?: MetaNiveles;
  editar?: React.ReactNode;
}) {
  const nivelProy = seg.nivelProyectadoPct;
  // El objetivo principal del seguimiento es el nivel 1.5% (meta esperada).
  const objetivo = seg.niveles[1] ?? seg.niveles[0];
  const futuro = seg.estado === "futuro";

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold">{titulo}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {futuro
              ? `Mes futuro · ${seg.diasTotales} días laborables`
              : seg.enCurso
                ? `Día laborable ${seg.diasTranscurridos} de ${seg.diasTotales}`
                : `Mes cerrado · ${seg.diasTotales} días laborables`}
          </p>
        </div>
        {futuro ? (
          <Badge variant="secondary" className="shrink-0">
            Planeación
          </Badge>
        ) : nivelProy != null ? (
          <Badge className="shrink-0 bg-success text-success-foreground">
            {seg.enCurso ? "Proyecta " : "Alcanzó "}
            {nivelProy.toFixed(1)}%
          </Badge>
        ) : (
          <Badge variant="outline" className="shrink-0">
            Bajo meta
          </Badge>
        )}
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/40 p-3">
          {futuro ? (
            <>
              <div>
                <p className="text-xs text-muted-foreground">
                  Meta nivel {objetivo?.pct.toFixed(1)}%
                </p>
                <p className="text-lg font-semibold tabular-nums-fin">
                  {formatCOP(objetivo?.metaMes ?? 0)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Días hábiles</p>
                <p className="text-lg font-semibold tabular-nums-fin">
                  {seg.diasTotales}
                </p>
              </div>
            </>
          ) : (
            <>
              <div>
                <p className="text-xs text-muted-foreground">
                  Recaudo {seg.enCurso ? "a la fecha" : "del mes"}
                </p>
                <p className="text-lg font-semibold tabular-nums-fin">
                  {formatCOP(seg.recaudoReal)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {seg.enCurso ? "Proyección fin de mes" : "Ritmo diario"}
                </p>
                <p className="text-lg font-semibold tabular-nums-fin">
                  {seg.enCurso
                    ? formatCOP(seg.proyeccionFinMes)
                    : `${formatCOP(seg.ritmoRealDiario)}/día`}
                </p>
              </div>
            </>
          )}
        </div>

        {!seg.tieneMeta ? (
          <p className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
            Sin meta cargada para este período.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <BarraNiveles seg={seg} />

            {/* Tres niveles de comisión, con su % de recaudo ya alcanzado. */}
            <div>
              <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">
                Recaudado de cada meta
              </p>
              <div className="grid grid-cols-3 gap-2">
                {seg.niveles.map((n) => {
                  const activo = nivelProy != null && n.pct <= nivelProy;
                  const avance = Math.min(100, Math.max(0, n.cumplimientoPct ?? 0));
                  return (
                    <div
                      key={n.pct}
                      className={cn(
                        "rounded-md px-2.5 py-2",
                        activo
                          ? "bg-success/12 text-success"
                          : "bg-muted/50 text-muted-foreground"
                      )}
                    >
                      <p className="text-xs font-medium">{n.pct.toFixed(1)}%</p>
                      <p className="mt-0.5 tabular-nums-fin text-[13px]">
                        {formatCOP(n.metaMes)}
                      </p>
                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-foreground/10">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            activo ? "bg-success" : "bg-primary"
                          )}
                          style={{ width: `${avance}%` }}
                        />
                      </div>
                      <p className="mt-1 tabular-nums-fin text-[11px] opacity-80">
                        {n.cumplimientoPct == null ? "—" : formatPct(n.cumplimientoPct)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Lo que falta por día para llegar al nivel principal (1.5%). */}
            {objetivo &&
              (objetivo.alcanzado && seg.enCurso ? (
                <div className="rounded-lg bg-success/12 px-4 py-3 text-center text-sm font-medium text-success">
                  ✓ Meta {objetivo.pct.toFixed(1)}% alcanzada
                </div>
              ) : futuro || (seg.enCurso && objetivo.faltaPorDia != null) ? (
                <div className="rounded-lg bg-primary/10 px-4 py-3 text-center">
                  <p className="text-xs text-muted-foreground">
                    Para el {objetivo.pct.toFixed(1)}% debe vender
                  </p>
                  <p className="my-0.5 text-2xl font-bold tabular-nums-fin text-primary">
                    {formatCOP(futuro ? objetivo.metaDiaria : objetivo.faltaPorDia ?? 0)}
                    <span className="text-sm font-medium text-muted-foreground">
                      /día
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {futuro ? seg.diasTotales : seg.diasRestantes} días hábiles
                    {futuro ? "" : " restantes"}
                  </p>
                </div>
              ) : null)}
          </div>
        )}

        {asesoras && totalOptica != null && (
          <AsesorasPanel
            asesoras={asesoras}
            totalOptica={totalOptica}
            diasTranscurridos={seg.diasTranscurridos}
            diasRestantes={seg.diasRestantes}
            enCurso={seg.enCurso}
            meta={meta ?? CERO}
          />
        )}

        {editar && <div className={cn(!asesoras && "mt-auto", "pt-1")}>{editar}</div>}
      </CardContent>
    </Card>
  );
}

export default async function MetasPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; optica?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const { periodo, opticaId, periodos, opticas } = await resolveFilters(sp);
  const esAdmin = user.role === "ADMIN";
  const hoy = new Date();

  // Permite seleccionar meses futuros (mes actual + 6 adelante) para planear
  // metas por anticipado, además de los meses ya importados.
  const periodosUI = [
    ...new Set([...periodosFuturos(hoy, 6), ...periodos]),
  ].sort().reverse();

  const opticasMostrar = opticaId
    ? opticas.filter((o) => o.id === opticaId)
    : opticas;

  const filas = periodo
    ? await Promise.all(
        opticasMostrar.map(async (optica) => {
          const [meta, kpis, asesoras] = await Promise.all([
            db.meta.findUnique({
              where: { opticaId_periodo: { opticaId: optica.id, periodo } },
            }),
            ventaKpis(periodo, optica.id),
            recaudoPorAsesora(periodo, optica.id),
          ]);
          const niveles: MetaNiveles = meta
            ? {
                recaudoNivel1: meta.recaudoNivel1,
                recaudoNivel2: meta.recaudoNivel2,
                recaudoNivel3: meta.recaudoNivel3,
              }
            : CERO;
          return {
            optica,
            niveles,
            asesoras,
            seg: calcularSeguimiento(periodo, niveles, kpis.recaudo, hoy),
          };
        })
      )
    : [];

  const globalNiveles = filas.reduce<MetaNiveles>(
    (acc, f) => sumarNiveles(acc, f.niveles),
    CERO
  );
  const globalRecaudo = filas.reduce((a, f) => a + f.seg.recaudoReal, 0);
  const globalSeg = periodo
    ? calcularSeguimiento(periodo, globalNiveles, globalRecaudo, hoy)
    : null;

  return (
    <>
      <PageHeader title="Metas y rendimiento">
        <FilterBar
          periodos={periodosUI}
          opticas={opticas}
          activePeriodo={periodo}
          activeOptica={opticaId}
          showOptica={false}
        />
      </PageHeader>

      {!periodo ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Target className="mx-auto mb-3 size-10 opacity-40" />
            <p className="font-medium text-foreground">Elige un período</p>
            <p className="mt-1 text-sm">
              Selecciona el mes para ver el avance de recaudo contra la meta.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filas.map(({ optica, niveles, asesoras, seg }) => (
            <MetaCard
              key={optica.id}
              titulo={optica.nombre}
              seg={seg}
              asesoras={asesoras}
              totalOptica={seg.recaudoReal}
              meta={niveles}
              editar={
                esAdmin ? (
                  <MetaDialog
                    opticaId={optica.id}
                    opticaNombre={optica.nombre}
                    periodo={periodo}
                    valores={niveles}
                  />
                ) : undefined
              }
            />
          ))}

          {globalSeg && filas.length > 1 && (
            <MetaCard titulo={`GLOBAL · ${formatPeriodo(periodo)}`} seg={globalSeg} />
          )}

          {filas.length === 0 && (
            <Card className="md:col-span-2 xl:col-span-3">
              <CardContent className="py-10 text-center text-muted-foreground">
                No hay ópticas para mostrar.
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
