"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SeverityBadge } from "@/components/severity-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatPeriodo, formatNumber, formatFecha } from "@/lib/format";
import { SEVERIDAD_ORDER, type Severidad } from "@/lib/audit-types";
import type { AlertaItem } from "@/lib/alerts-feed";
import {
  DescartarButton,
  RestaurarButton,
  CambiarSeveridadButton,
} from "./descartar-alerta";
import {
  Store,
  X,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  GitCompareArrows,
  FileText,
  Hash,
  Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";

const PAGE_SIZE = 15;
const SEVS: Severidad[] = ["ALTA", "MEDIA", "BAJA"];
const SEV_LABEL: Record<Severidad, string> = { ALTA: "Alta", MEDIA: "Media", BAJA: "Baja" };

export function AlertasExplorer({
  items,
  opticas,
  periodos,
}: {
  items: AlertaItem[];
  opticas: string[];
  periodos: string[];
}) {
  const [periodo, setPeriodo] = useState("all");
  const [origen, setOrigen] = useState<"all" | "cruce" | "reporte">("all");
  const [tipo, setTipo] = useState("all");
  const [severidad, setSeveridad] = useState<Severidad | null>(null);
  const [optica, setOptica] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [vista, setVista] = useState<"activas" | "descartadas">("activas");
  const [page, setPage] = useState(1);

  const totalDescartadas = useMemo(
    () => items.filter((i) => i.descarte).length,
    [items]
  );

  // Tipos por ETIQUETA (lo que ve el usuario): unifica códigos internos
  // distintos que comparten el mismo nombre (ej. costo cero de fila y de cruce).
  const tipos = useMemo(
    () => [...new Set(items.map((i) => i.tipoLabel))].sort((a, b) => a.localeCompare(b)),
    [items]
  );

  // Filtros "de base" (período, origen, tipo) — los pills de óptica/severidad se
  // cuentan sobre esta base para que sus números reflejen el contexto.
  const base = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return items.filter(
      (i) =>
        (vista === "descartadas" ? !!i.descarte : !i.descarte) &&
        (periodo === "all" || i.periodo === periodo) &&
        (origen === "all" || i.origen === origen) &&
        (tipo === "all" || i.tipoLabel === tipo) &&
        (q === "" ||
          (i.orden ?? "").toLowerCase().includes(q) ||
          i.mensaje.toLowerCase().includes(q))
    );
  }, [items, periodo, origen, tipo, busqueda, vista]);

  const conteoOptica = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of base) {
      if (severidad && i.severidad !== severidad) continue;
      m.set(i.optica, (m.get(i.optica) ?? 0) + 1);
    }
    return m;
  }, [base, severidad]);

  const conteoSev = useMemo(() => {
    const m: Record<Severidad, number> = { ALTA: 0, MEDIA: 0, BAJA: 0 };
    for (const i of base) {
      if (optica && i.optica !== optica) continue;
      m[i.severidad]++;
    }
    return m;
  }, [base, optica]);

  const filtrados = useMemo(() => {
    const f = base.filter(
      (i) =>
        (!severidad || i.severidad === severidad) &&
        (!optica || i.optica === optica)
    );
    return f.sort(
      (a, b) =>
        SEVERIDAD_ORDER[a.severidad] - SEVERIDAD_ORDER[b.severidad] ||
        a.optica.localeCompare(b.optica)
    );
  }, [base, severidad, optica]);

  const totalPages = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const visibles = filtrados.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  // Envuelve un handler para volver a la página 1 al cambiar un filtro.
  // Conserva los argumentos (los Select pasan el valor seleccionado).
  const reset =
    <A extends unknown[]>(fn: (...args: A) => void) =>
    (...args: A) => {
      fn(...args);
      setPage(1);
    };

  const hayFiltros =
    severidad ||
    optica ||
    periodo !== "all" ||
    origen !== "all" ||
    tipo !== "all" ||
    busqueda.trim() !== "";

  return (
    <div className="space-y-5">
      {/* Vista: activas vs descartadas */}
      <div className="inline-flex overflow-hidden rounded-lg border">
        {(["activas", "descartadas"] as const).map((v) => (
          <button
            key={v}
            onClick={reset(() => setVista(v))}
            className={cn(
              "px-3 py-1.5 text-sm transition-colors",
              vista === v ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            )}
          >
            {v === "activas" ? "Activas" : "Descartadas"}
            {v === "descartadas" && totalDescartadas > 0 && (
              <span className="ml-1.5 rounded-full bg-foreground/10 px-1.5 text-xs tabular-nums-fin">
                {totalDescartadas}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tarjetas de severidad (clic = filtrar) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <button
          onClick={reset(() => setSeveridad(null))}
          className={cn(
            "rounded-xl border p-4 text-left transition-colors",
            !severidad ? "border-primary bg-accent/40" : "hover:bg-muted/40"
          )}
        >
          <p className="text-sm text-muted-foreground">Total</p>
          <p className="font-heading text-2xl tabular-nums-fin">
            {formatNumber(conteoSev.ALTA + conteoSev.MEDIA + conteoSev.BAJA)}
          </p>
        </button>
        {SEVS.map((s) => (
          <button
            key={s}
            onClick={reset(() => setSeveridad(severidad === s ? null : s))}
            className={cn(
              "rounded-xl border p-4 text-left transition-colors",
              severidad === s ? "border-primary bg-accent/40" : "hover:bg-muted/40"
            )}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{SEV_LABEL[s]}</p>
              <SeverityBadge severidad={s} />
            </div>
            <p
              className={cn(
                "font-heading text-2xl tabular-nums-fin",
                s === "ALTA" && conteoSev[s] > 0 && "text-sev-alta"
              )}
            >
              {formatNumber(conteoSev[s])}
            </p>
          </button>
        ))}
      </div>

      {/* Botones por óptica (clic = filtrar) */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Store className="size-4" /> Óptica:
        </span>
        <Button
          variant={!optica ? "default" : "outline"}
          size="sm"
          onClick={reset(() => setOptica(null))}
        >
          Todas
        </Button>
        {opticas.map((o) => (
          <Button
            key={o}
            variant={optica === o ? "default" : "outline"}
            size="sm"
            onClick={reset(() => setOptica(optica === o ? null : o))}
          >
            {o}
            <span className="ml-1.5 rounded-full bg-foreground/10 px-1.5 text-xs tabular-nums-fin">
              {formatNumber(conteoOptica.get(o) ?? 0)}
            </span>
          </Button>
        ))}
      </div>

      {/* Filtros secundarios */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar orden o texto…"
            className="h-9 w-56 pl-8"
          />
        </div>
        <Select value={periodo} onValueChange={reset((v?: string | null) => setPeriodo(v ?? "all"))}>
          <SelectTrigger className="w-44">
            <SelectValue>
              {(v: string | null) =>
                !v || v === "all" ? "Todos los períodos" : formatPeriodo(v)
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los períodos</SelectItem>
            {periodos.map((p) => (
              <SelectItem key={p} value={p}>
                {formatPeriodo(p)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={tipo} onValueChange={reset((v?: string | null) => setTipo(v ?? "all"))}>
          <SelectTrigger className="w-56">
            <SelectValue>
              {(v: string | null) => (!v || v === "all" ? "Todos los tipos" : v)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {tipos.map((label) => (
              <SelectItem key={label} value={label}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="inline-flex overflow-hidden rounded-lg border">
          {(["all", "cruce", "reporte"] as const).map((o) => (
            <button
              key={o}
              onClick={reset(() => setOrigen(o))}
              className={cn(
                "px-3 py-1.5 text-sm transition-colors",
                origen === o
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              )}
            >
              {o === "all" ? "Todas" : o === "cruce" ? "Cruces" : "Por reporte"}
            </button>
          ))}
        </div>

        {hayFiltros && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSeveridad(null);
              setOptica(null);
              setPeriodo("all");
              setOrigen("all");
              setTipo("all");
              setBusqueda("");
              setPage(1);
            }}
          >
            <X className="size-4" /> Limpiar filtros
          </Button>
        )}
      </div>

      {/* Resultados */}
      <p className="text-sm text-muted-foreground">
        {formatNumber(filtrados.length)} alerta{filtrados.length === 1 ? "" : "s"}
        {hayFiltros ? " (filtradas)" : ""}
      </p>

      {visibles.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <ShieldCheck className="mx-auto mb-3 size-10 opacity-40" />
            <p className="font-medium text-foreground">Sin alertas</p>
            <p className="mt-1 text-sm">No hay alertas para los filtros seleccionados.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {visibles.map((a, i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-lg border bg-card p-3"
            >
              <SeverityBadge severidad={a.severidad} className="mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  <span className="font-medium">{a.optica}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">{formatPeriodo(a.periodo)}</span>
                  {a.orden && (
                    <span className="inline-flex items-center gap-1 rounded-md border bg-muted px-1.5 py-0.5 font-mono text-xs">
                      <Hash className="size-3" />
                      {a.orden}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 rounded-md bg-accent/60 px-1.5 py-0.5 text-xs text-accent-foreground">
                    {a.origen === "cruce" ? (
                      <GitCompareArrows className="size-3" />
                    ) : (
                      <FileText className="size-3" />
                    )}
                    {a.tipoLabel}
                  </span>
                  {a.reporteLabel && (
                    <span className="text-xs text-muted-foreground">
                      {a.reporteLabel}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{a.mensaje}</p>
                {a.descarte && (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Descartada</span> por{" "}
                    {a.descarte.usuario} · {formatFecha(a.descarte.fecha)}
                    {a.descarte.motivo ? ` · ${a.descarte.motivo}` : ""}
                  </p>
                )}
                {a.severidadAjustada && !a.descarte && (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Severidad ajustada por {a.severidadAjustada.usuario}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {a.descarte ? (
                  <RestaurarButton alertaKey={a.key} />
                ) : (
                  <>
                    <CambiarSeveridadButton
                      alerta={{
                        key: a.key,
                        optica: a.optica,
                        periodo: a.periodo,
                        orden: a.orden,
                        tipo: a.tipoLabel,
                      }}
                    />
                    <DescartarButton
                      alerta={{
                        key: a.key,
                        optica: a.optica,
                        periodo: a.periodo,
                        orden: a.orden,
                        tipo: a.tipoLabel,
                        mensaje: a.mensaje,
                      }}
                    />
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            Página {pageSafe} de {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pageSafe <= 1}
              onClick={() => setPage(pageSafe - 1)}
            >
              <ChevronLeft className="size-4" /> Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pageSafe >= totalPages}
              onClick={() => setPage(pageSafe + 1)}
            >
              Siguiente <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
