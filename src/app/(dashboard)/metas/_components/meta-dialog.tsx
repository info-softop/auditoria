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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Pencil } from "lucide-react";
import { upsertMeta } from "../actions";
import { formatPeriodo } from "@/lib/format";
import { NIVELES_META, type MetaNiveles } from "@/lib/metas";

export function MetaDialog({
  opticaId,
  opticaNombre,
  periodo,
  valores,
}: {
  opticaId: string;
  opticaNombre: string;
  periodo: string;
  valores: MetaNiveles;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const res = await upsertMeta(formData);
      if (res.ok) {
        toast.success("Meta guardada correctamente");
        setOpen(false);
      } else {
        toast.error(res.error ?? "No se pudo guardar la meta");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <Pencil className="size-3.5" /> Editar
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Meta de recaudo</DialogTitle>
          <DialogDescription>
            {opticaNombre} · {formatPeriodo(periodo)} — montos de recaudo por nivel
            de comisión.
          </DialogDescription>
        </DialogHeader>

        <form action={onSubmit} className="grid gap-4">
          <input type="hidden" name="opticaId" value={opticaId} />
          <input type="hidden" name="periodo" value={periodo} />

          {NIVELES_META.map(({ key, pct }) => (
            <div key={key} className="grid gap-1.5">
              <Label htmlFor={`${opticaId}-${key}`}>
                Nivel {pct.toFixed(1)}% — recaudo objetivo (COP)
              </Label>
              <Input
                id={`${opticaId}-${key}`}
                name={key}
                type="number"
                inputMode="decimal"
                min={0}
                step="1000"
                defaultValue={valores[key] || ""}
                placeholder="0"
              />
            </div>
          ))}

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="ghost" />}>
              Cancelar
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : "Guardar meta"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
