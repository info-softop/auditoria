"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatCOP } from "@/lib/format";

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

/** Distribución (dona) con leyenda. data: [{ label, monto }] */
export function DonaChart({ data }: { data: { label: string; monto: number }[] }) {
  const total = data.reduce((s, d) => s + d.monto, 0);
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="w-full sm:w-1/2">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data}
              dataKey="monto"
              nameKey="label"
              innerRadius={58}
              outerRadius={95}
              paddingAngle={2}
              strokeWidth={0}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v, n) => [formatCOP(Number(v)), String(n)]}
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--popover-foreground)",
                fontSize: 13,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="w-full space-y-2 sm:w-1/2">
        {data.map((d, i) => (
          <li key={i} className="flex items-center gap-2 text-sm">
            <span
              className="size-3 shrink-0 rounded-sm"
              style={{ background: COLORS[i % COLORS.length] }}
            />
            <span className="min-w-0 flex-1 truncate">{d.label}</span>
            <span className="whitespace-nowrap font-medium tabular-nums-fin">
              {formatCOP(d.monto)}
            </span>
            <span className="w-12 shrink-0 text-right text-xs text-muted-foreground">
              {total > 0 ? ((d.monto / total) * 100).toFixed(0) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
