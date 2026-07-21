"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  TIPO_REPORTE_ORDEN,
  TIPO_REPORTE_LABEL,
  TIPO_REPORTE_ORIGEN,
  type TipoReporte,
} from "@/lib/audit-types";
import { formatPeriodo } from "@/lib/format";

interface Optica {
  id: string;
  nombre: string;
}

export function ReportChecklist({
  periodos,
  opticas,
  cargados,
  ultimaFecha,
}: {
  periodos: string[];
  opticas: Optica[];
  // clave `${periodo}|${opticaId}` -> tipos cargados
  cargados: Record<string, TipoReporte[]>;
  // clave `${periodo}|${tipo}` -> última fecha de dato (YYYY-MM-DD)
  ultimaFecha: Record<string, string>;
}) {
  const [periodo, setPeriodo] = useState(periodos[0] ?? "");

  // ¿La óptica O tiene cargado el reporte T en el período activo?
  const tiene = (opticaId: string, tipo: TipoReporte) =>
    (cargados[`${periodo}|${opticaId}`] ?? []).includes(tipo);

  // Conteo por óptica (cuántos de los 6 reportes tiene en el período).
  const conteoOptica = (opticaId: string) =>
    TIPO_REPORTE_ORDEN.filter((t) => tiene(opticaId, t)).length;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Reportes del período</CardTitle>
        {periodos.length > 0 && (
          <Select value={periodo} onValueChange={(v) => setPeriodo(v ?? "")}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Período">
                {(v: string | null) => (v ? formatPeriodo(v) : "Período")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {periodos.map((p) => (
                <SelectItem key={p} value={p}>
                  {formatPeriodo(p)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Resumen por óptica */}
        <div className="flex flex-wrap gap-2">
          {opticas.map((o) => {
            const n = conteoOptica(o.id);
            const completo = n === TIPO_REPORTE_ORDEN.length;
            return (
              <span
                key={o.id}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                  completo
                    ? "border-success/30 bg-success/12 text-success"
                    : "border-border bg-muted text-muted-foreground"
                )}
              >
                {o.nombre} · {n}/{TIPO_REPORTE_ORDEN.length}
              </span>
            );
          })}
        </div>

        {/* Detalle: cada reporte con su estado por óptica */}
        <div className="space-y-2">
          {TIPO_REPORTE_ORDEN.map((tipo) => {
            const ult = ultimaFecha[`${periodo}|${tipo}`];
            return (
            <div key={tipo} className="rounded-lg border p-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-medium">{TIPO_REPORTE_LABEL[tipo]}</p>
                {ult && (
                  <span className="whitespace-nowrap text-xs text-muted-foreground">
                    hasta {ult.split("-").reverse().join("/")}
                  </span>
                )}
              </div>
              <p className="mb-2 text-xs text-muted-foreground">
                {TIPO_REPORTE_ORIGEN[tipo]}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {opticas.map((o) => {
                  const ok = tiene(o.id, tipo);
                  return (
                    <span
                      key={o.id}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs",
                        ok
                          ? "bg-success/12 text-success"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {ok ? (
                        <CheckCircle2 className="size-3" />
                      ) : (
                        <Circle className="size-3 opacity-40" />
                      )}
                      {o.nombre}
                    </span>
                  );
                })}
              </div>
            </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
