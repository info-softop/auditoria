"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Pencil, Plus } from "lucide-react";
import { upsertGasto } from "../actions";
import { cn } from "@/lib/utils";

const SELECT_CLASS =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export interface GastoValores {
  id?: string;
  fechaVence: string;
  fechaPago: string;
  concepto: string;
  categoria: string;
  subcategoria: string;
  monto: string;
  estado: string;
  tercero: string;
  terceroId: string;
  empleadoId: string;
  opticaId: string;
  notas: string;
}

export function GastoDialog({
  empleados,
  opticas,
  categorias,
  valores,
  modo,
}: {
  empleados: { id: string; nombre: string }[];
  opticas: { id: string; nombre: string }[];
  categorias: string[];
  valores?: GastoValores;
  modo: "nuevo" | "editar";
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const v = valores;

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const res = await upsertGasto(formData);
      if (res.ok) {
        toast.success("Gasto guardado");
        setOpen(false);
      } else {
        toast.error(res.error ?? "No se pudo guardar");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          modo === "nuevo" ? (
            <Button>
              <Plus className="size-4" /> Nuevo gasto
            </Button>
          ) : (
            <Button variant="outline" size="sm">
              <Pencil className="size-3.5" /> Editar
            </Button>
          )
        }
      />
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{modo === "nuevo" ? "Nuevo gasto" : "Editar gasto"}</DialogTitle>
        </DialogHeader>
        <form action={onSubmit} className="grid grid-cols-2 gap-3">
          {v?.id && <input type="hidden" name="id" value={v.id} />}

          <div className="col-span-2 grid gap-1.5">
            <Label htmlFor="concepto">Concepto</Label>
            <Input id="concepto" name="concepto" required defaultValue={v?.concepto} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="categoria">Categoría</Label>
            <Input id="categoria" name="categoria" list="cat-list" required defaultValue={v?.categoria} placeholder="ARRIENDO, SERVICIOS…" />
            <datalist id="cat-list">
              {categorias.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="subcategoria">Subcategoría</Label>
            <Input id="subcategoria" name="subcategoria" defaultValue={v?.subcategoria} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="monto">Monto (COP)</Label>
            <Input id="monto" name="monto" type="number" min={1} step="1000" required defaultValue={v?.monto} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="fechaVence">Fecha de vencimiento</Label>
            <Input id="fechaVence" name="fechaVence" type="date" defaultValue={v?.fechaVence} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="tercero">Tercero (beneficiario)</Label>
            <Input id="tercero" name="tercero" defaultValue={v?.tercero} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="terceroId">CC / NIT</Label>
            <Input id="terceroId" name="terceroId" defaultValue={v?.terceroId} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="empleadoId">Empleado</Label>
            <select id="empleadoId" name="empleadoId" defaultValue={v?.empleadoId ?? ""} className={cn(SELECT_CLASS)}>
              <option value="">—</option>
              {empleados.map((e) => (
                <option key={e.id} value={e.id}>{e.nombre}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="opticaId">Óptica</Label>
            <select id="opticaId" name="opticaId" defaultValue={v?.opticaId ?? ""} className={cn(SELECT_CLASS)}>
              <option value="">General</option>
              {opticas.map((o) => (
                <option key={o.id} value={o.id}>{o.nombre}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="estado">Estado</Label>
            <select id="estado" name="estado" defaultValue={v?.estado ?? "pendiente"} className={cn(SELECT_CLASS)}>
              <option value="pendiente">Pendiente</option>
              <option value="pagado">Pagado</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="fechaPago">Fecha de pago</Label>
            <Input id="fechaPago" name="fechaPago" type="date" defaultValue={v?.fechaPago} />
          </div>
          <div className="col-span-2 grid gap-1.5">
            <Label htmlFor="notas">Notas</Label>
            <Input id="notas" name="notas" defaultValue={v?.notas} />
          </div>

          <DialogFooter className="col-span-2">
            <DialogClose render={<Button type="button" variant="ghost" />}>Cancelar</DialogClose>
            <Button type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
