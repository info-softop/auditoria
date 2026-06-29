"use client";

import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { agregarVacacion } from "../actions";

const SELECT_CLASS =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function VacacionForm({ empleadoId }: { empleadoId: string }) {
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const res = await agregarVacacion(formData);
      if (res.ok) {
        toast.success("Movimiento registrado");
        formRef.current?.reset();
      } else {
        toast.error(res.error ?? "No se pudo registrar");
      }
    });
  }

  return (
    <form
      ref={formRef}
      action={onSubmit}
      className="flex flex-wrap items-end gap-3 border-t pt-4"
    >
      <input type="hidden" name="empleadoId" value={empleadoId} />
      <div className="grid gap-1.5">
        <Label htmlFor="tipo">Tipo</Label>
        <select id="tipo" name="tipo" defaultValue="tomada" className={cn(SELECT_CLASS, "w-52")}>
          <optgroup label="Vacaciones">
            <option value="tomada">Vacaciones tomadas</option>
            <option value="pagada">Vacaciones pagadas</option>
            <option value="ajuste">Ajuste (±)</option>
          </optgroup>
          <optgroup label="Permisos">
            <option value="permiso_remunerado">Permiso remunerado</option>
            <option value="permiso_no_remunerado">Permiso no remunerado</option>
            <option value="incapacidad">Incapacidad</option>
            <option value="licencia">Licencia</option>
          </optgroup>
        </select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="dias">Días</Label>
        <Input id="dias" name="dias" type="number" step="0.5" required className="h-8 w-24" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="fechaInicio">Desde</Label>
        <Input id="fechaInicio" name="fechaInicio" type="date" className="h-8 w-40" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="fechaFin">Hasta</Label>
        <Input id="fechaFin" name="fechaFin" type="date" className="h-8 w-40" />
      </div>
      <div className="grid flex-1 gap-1.5">
        <Label htmlFor="nota">Nota</Label>
        <Input id="nota" name="nota" placeholder="Opcional" className="h-8" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Guardando…" : "Agregar"}
      </Button>
    </form>
  );
}
