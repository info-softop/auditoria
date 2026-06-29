"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { formatCOP } from "@/lib/format";
import { cn } from "@/lib/utils";
import { registrarNominaLote } from "../actions";

export interface NominaRow {
  id: string;
  nombre: string;
  cedula: string | null;
  salarioBase: number;
  subsidio: number;
  deducciones: number;
}

type Tipo = "mensual" | "q1" | "q2";
type Fila = { sel: boolean; salarioBase: string; subsidio: string; bonos: string; deducciones: string };

const todayISO = () => new Date().toISOString().slice(0, 10);
const SELECT_CLASS =
  "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const NUM_CLASS = "h-8 w-28 text-right tabular-nums-fin";

export function NominaBatchClient({ rows }: { rows: NominaRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [periodo, setPeriodo] = useState(todayISO().slice(0, 7));
  const [fechaPago, setFechaPago] = useState(todayISO());
  const [tipo, setTipo] = useState<Tipo>("mensual");

  const buildState = (factor: number): Record<string, Fila> =>
    Object.fromEntries(
      rows.map((r) => [
        r.id,
        {
          sel: true,
          salarioBase: String(Math.round(r.salarioBase * factor)),
          subsidio: String(Math.round(r.subsidio * factor)),
          bonos: "0",
          deducciones: String(Math.round(r.deducciones * factor)),
        },
      ])
    );

  const [state, setState] = useState<Record<string, Fila>>(() => buildState(1));

  const changeTipo = (t: Tipo) => {
    setTipo(t);
    setState(buildState(t === "mensual" ? 1 : 0.5));
  };

  const set = (id: string, k: keyof Omit<Fila, "sel">, v: string) =>
    setState((p) => ({ ...p, [id]: { ...p[id], [k]: v } }));
  const toggle = (id: string) =>
    setState((p) => ({ ...p, [id]: { ...p[id], sel: !p[id].sel } }));
  const allSel = rows.length > 0 && rows.every((r) => state[r.id]?.sel);
  const toggleAll = () =>
    setState((p) => {
      const next = { ...p };
      for (const r of rows) next[r.id] = { ...next[r.id], sel: !allSel };
      return next;
    });

  const netoOf = (id: string) => {
    const s = state[id];
    if (!s) return 0;
    return (
      (Number(s.salarioBase) || 0) +
      (Number(s.subsidio) || 0) +
      (Number(s.bonos) || 0) -
      (Number(s.deducciones) || 0)
    );
  };

  const seleccionados = rows.filter((r) => state[r.id]?.sel);
  const totalNeto = seleccionados.reduce((a, r) => a + netoOf(r.id), 0);

  const submit = () => {
    if (seleccionados.length === 0) {
      toast.error("Selecciona al menos un empleado.");
      return;
    }
    startTransition(async () => {
      const res = await registrarNominaLote({
        periodo,
        quincena: tipo === "q1" ? 1 : tipo === "q2" ? 2 : null,
        fechaPago,
        items: seleccionados.map((r) => ({
          empleadoId: r.id,
          salarioBase: Number(state[r.id].salarioBase) || 0,
          subsidioTransporte: Number(state[r.id].subsidio) || 0,
          bonos: Number(state[r.id].bonos) || 0,
          deducciones: Number(state[r.id].deducciones) || 0,
        })),
      });
      if (res.ok) {
        toast.success(`${res.creados} pagos de nómina registrados`);
        router.refresh();
      } else {
        toast.error(res.error ?? "No se pudo registrar");
      }
    });
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="mb-4 flex flex-wrap items-end gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="tipo">Tipo</Label>
            <select
              id="tipo"
              value={tipo}
              onChange={(e) => changeTipo(e.target.value as Tipo)}
              className={cn(SELECT_CLASS)}
            >
              <option value="mensual">Mensual</option>
              <option value="q1">1ra quincena (1-15)</option>
              <option value="q2">2da quincena (16-fin)</option>
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="periodo">Período</Label>
            <Input
              id="periodo"
              type="month"
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              className="h-8 w-40"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="fechaPago">Fecha de pago</Label>
            <Input
              id="fechaPago"
              type="date"
              value={fechaPago}
              onChange={(e) => setFechaPago(e.target.value)}
              className="h-8 w-40"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <input type="checkbox" checked={allSel} onChange={toggleAll} className="size-4" />
                </TableHead>
                <TableHead>Empleado</TableHead>
                <TableHead className="text-right">Salario base</TableHead>
                <TableHead className="text-right">Subsidio</TableHead>
                <TableHead className="text-right">Bonos</TableHead>
                <TableHead className="text-right">Deducciones</TableHead>
                <TableHead className="text-right">Neto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    No hay empleados de nómina (dependientes) activos.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r) => {
                const s = state[r.id];
                if (!s) return null;
                return (
                  <TableRow key={r.id} className={cn(!s.sel && "opacity-50")}>
                    <TableCell>
                      <input type="checkbox" checked={s.sel} onChange={() => toggle(r.id)} className="size-4" />
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{r.nombre}</p>
                      {r.cedula && <p className="text-xs text-muted-foreground">{r.cedula}</p>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Input type="number" className={NUM_CLASS} value={s.salarioBase} onChange={(e) => set(r.id, "salarioBase", e.target.value)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input type="number" className={NUM_CLASS} value={s.subsidio} onChange={(e) => set(r.id, "subsidio", e.target.value)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input type="number" className={NUM_CLASS} value={s.bonos} onChange={(e) => set(r.id, "bonos", e.target.value)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input type="number" className={NUM_CLASS} value={s.deducciones} onChange={(e) => set(r.id, "deducciones", e.target.value)} />
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums-fin">
                      {formatCOP(netoOf(r.id))}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <p className="text-sm text-muted-foreground">
            {seleccionados.length} seleccionados · Total neto{" "}
            <span className="font-semibold tabular-nums-fin text-foreground">
              {formatCOP(totalNeto)}
            </span>
          </p>
          <Button onClick={submit} disabled={pending || seleccionados.length === 0}>
            {pending ? "Registrando…" : "Registrar pago de nómina"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
