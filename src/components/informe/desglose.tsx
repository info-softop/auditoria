import { Card, CardContent } from "@/components/ui/card";
import { formatCOP } from "@/lib/format";
import type { GrupoAgg } from "@/lib/agrupar";

/** Tarjeta de desglose: ranking con barra proporcional, monto, % del total y conteo. */
export function Desglose({
  titulo,
  items,
  total,
  top = 10,
}: {
  titulo: string;
  items: GrupoAgg[];
  total: number;
  top?: number;
}) {
  const max = items[0]?.monto ?? 0;
  const vis = items.slice(0, top);
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="mb-4 flex items-baseline justify-between gap-2">
          <h3 className="font-heading text-sm font-medium">{titulo}</h3>
          {items.length > top && (
            <span className="text-xs text-muted-foreground">top {top} de {items.length}</span>
          )}
        </div>
        {vis.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Sin datos.</p>
        ) : (
          <ul className="space-y-3">
            {vis.map((it, i) => (
              <li key={i}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate" title={it.label}>
                    {it.label}
                  </span>
                  <span className="whitespace-nowrap font-medium tabular-nums-fin">
                    {formatCOP(it.monto)}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary/70"
                      style={{ width: `${max > 0 ? (it.monto / max) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="w-20 shrink-0 text-right text-[11px] text-muted-foreground tabular-nums-fin">
                    {total > 0 ? ((it.monto / total) * 100).toFixed(1) : "0"}% · {it.n}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
