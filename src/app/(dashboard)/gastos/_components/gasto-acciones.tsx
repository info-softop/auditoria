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
import { Check, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { marcarPagado, eliminarGasto } from "../actions";

const SELECT_CLASS =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function PagarGasto({
  id,
  cuentas,
}: {
  id: string;
  cuentas: { id: string; nombre: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const res = await marcarPagado(formData);
      if (res.ok) {
        toast.success("Gasto pagado");
        setOpen(false);
      } else {
        toast.error(res.error ?? "No se pudo registrar el pago");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <Check className="size-3.5" /> Pagar
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar pago</DialogTitle>
          <DialogDescription>
            Si eliges una cuenta, se genera el egreso en el ledger de Bancos.
          </DialogDescription>
        </DialogHeader>
        <form action={onSubmit} className="grid gap-3">
          <input type="hidden" name="id" value={id} />
          <div className="grid gap-1.5">
            <Label htmlFor="cuentaBancariaId">Cuenta de origen</Label>
            <select id="cuentaBancariaId" name="cuentaBancariaId" defaultValue="" className={cn(SELECT_CLASS)}>
              <option value="">Sin afectar bancos</option>
              {cuentas.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="fechaPago">Fecha de pago</Label>
            <Input id="fechaPago" name="fechaPago" type="date" />
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="ghost" />}>Cancelar</DialogClose>
            <Button type="submit" disabled={pending}>{pending ? "Registrando…" : "Confirmar pago"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function BorrarGasto({ id, concepto }: { id: string; concepto: string }) {
  const [pending, startTransition] = useTransition();
  function onClick() {
    if (!confirm(`¿Eliminar el gasto "${concepto}"?`)) return;
    const fd = new FormData();
    fd.set("id", id);
    startTransition(async () => {
      await eliminarGasto(fd);
      toast.success("Gasto eliminado");
    });
  }
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={pending}
      className="text-destructive hover:text-destructive"
      aria-label="Eliminar gasto"
    >
      <Trash2 className="size-3.5" />
    </Button>
  );
}
