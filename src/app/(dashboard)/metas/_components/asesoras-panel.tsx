"use client";

import { useState } from "react";
import { ChevronDown, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCOP, formatNumber, formatPct } from "@/lib/format";
import { NIVELES_META, type MetaNiveles } from "@/lib/metas";
import type { AsesoraRecaudo } from "@/lib/kpis";

function iniciales(nombre: string): string {
  const partes = nombre.split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}

// Nivel principal del seguimiento: 1.5% (la meta esperada).
const NIVEL_PRINCIPAL = NIVELES_META[1];

/** Proyección de la asesora hacia su parte (reparto equitativo) del nivel 1.5%. */
function proyeccionAsesora(
  recaudo: number,
  meta: MetaNiveles,
  nAsesoras: number,
  diasRestantes: number,
  enCurso: boolean
): { texto: string; alcanzado: boolean } | null {
  if (nAsesoras <= 0) return null;
  const target = (meta[NIVEL_PRINCIPAL.key] ?? 0) / nAsesoras;
  if (target <= 0) return null;

  const pct = NIVEL_PRINCIPAL.pct.toFixed(1);
  if (recaudo >= target) return { texto: `Alcanzó su ${pct}%`, alcanzado: true };
  if (!enCurso) return null; // cerrado/futuro: sin proyección diaria
  const falta = target - recaudo;
  const porDia = diasRestantes > 0 ? falta / diasRestantes : falta;
  return {
    texto: `Vender ${formatCOP(porDia)}/día → ${pct}%`,
    alcanzado: false,
  };
}

export function AsesorasPanel({
  asesoras,
  totalOptica,
  diasTranscurridos,
  diasRestantes,
  enCurso,
  meta,
}: {
  asesoras: AsesoraRecaudo[];
  totalOptica: number;
  diasTranscurridos: number;
  diasRestantes: number;
  enCurso: boolean;
  meta: MetaNiveles;
}) {
  const [abierto, setAbierto] = useState(false);

  if (asesoras.length === 0) return null;
  const n = asesoras.length;

  return (
    <div className="mt-auto border-t pt-3">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center justify-between text-sm font-medium text-foreground transition-colors hover:text-primary"
        aria-expanded={abierto}
      >
        <span className="flex items-center gap-2">
          <Users className="size-4" />
          Por asesora
          <span className="text-xs font-normal text-muted-foreground">({n})</span>
        </span>
        <ChevronDown
          className={cn("size-4 transition-transform", abierto && "rotate-180")}
        />
      </button>

      {abierto && (
        <>
          {enCurso && (
            <p className="mt-2 text-xs text-muted-foreground">
              Meta repartida en partes iguales entre {n} asesora{n > 1 ? "s" : ""}.
            </p>
          )}
          <ul className="mt-3 flex flex-col gap-3">
            {asesoras.map((a) => {
              const aportePct = totalOptica > 0 ? (a.recaudo / totalOptica) * 100 : 0;
              const ritmo = diasTranscurridos > 0 ? a.recaudo / diasTranscurridos : 0;
              const proy = proyeccionAsesora(a.recaudo, meta, n, diasRestantes, enCurso);
              return (
                <li key={a.asesora} className="flex items-center gap-2.5">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent/15 text-[11px] font-medium text-accent">
                    {iniciales(a.asesora)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate font-medium capitalize">
                        {a.asesora.toLowerCase()}
                      </span>
                      <span className="shrink-0 tabular-nums-fin text-muted-foreground">
                        {formatCOP(a.recaudo)}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.min(100, aportePct)}%` }}
                      />
                    </div>
                    <div className="mt-1 flex justify-between gap-2 text-xs text-muted-foreground">
                      <span className="tabular-nums-fin">
                        {formatPct(aportePct)} del total · {formatNumber(a.ordenes)} órd.
                      </span>
                      {proy && (
                        <span
                          className={cn(
                            "shrink-0 tabular-nums-fin font-medium",
                            proy.alcanzado ? "text-success" : "text-foreground"
                          )}
                        >
                          {proy.alcanzado ? "✓ " : ""}
                          {proy.texto}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
