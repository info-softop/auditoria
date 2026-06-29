"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { formatPeriodo } from "@/lib/format";

export function FilterBar({
  periodos,
  opticas,
  activePeriodo,
  activeOptica,
  showOptica = true,
}: {
  periodos: string[];
  opticas: { id: string; nombre: string }[];
  activePeriodo: string | null;
  activeOptica: string | null;
  showOptica?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);
    router.push(`${pathname}?${next.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={activePeriodo ?? undefined}
        onValueChange={(v) => setParam("periodo", v)}
      >
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Período">
            {(v: string | null) => (v ? formatPeriodo(v) : "Período")}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {periodos.length === 0 && (
            <SelectItem value="none" disabled>
              Sin datos
            </SelectItem>
          )}
          {periodos.map((p) => (
            <SelectItem key={p} value={p}>
              {formatPeriodo(p)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {showOptica && opticas.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            variant={!activeOptica ? "default" : "outline"}
            size="sm"
            onClick={() => setParam("optica", null)}
          >
            Todas
          </Button>
          {opticas.map((o) => (
            <Button
              key={o.id}
              variant={activeOptica === o.id ? "default" : "outline"}
              size="sm"
              onClick={() =>
                setParam("optica", activeOptica === o.id ? null : o.id)
              }
            >
              {o.nombre}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
