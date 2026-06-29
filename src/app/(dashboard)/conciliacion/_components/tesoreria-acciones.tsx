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
import { Plus, ArrowLeftRight, Landmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { crearCuenta, registrarMovimiento, transferir, type ActionResult } from "../tesoreria-actions";

const SELECT_CLASS =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm";

type Cuenta = { id: string; nombre: string };
type Optica = { id: string; nombre: string };

function useDialogAction(action: (fd: FormData) => Promise<ActionResult>, onDone: () => void) {
  const [pending, startTransition] = useTransition();
  const submit = (formData: FormData) =>
    startTransition(async () => {
      const res = await action(formData);
      if (res.ok) {
        toast.success("Guardado");
        onDone();
      } else {
        toast.error(res.error ?? "No se pudo guardar");
      }
    });
  return { pending, submit };
}

function NuevaCuenta({ opticas }: { opticas: Optica[] }) {
  const [open, setOpen] = useState(false);
  const { pending, submit } = useDialogAction(crearCuenta, () => setOpen(false));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <Plus className="size-3.5" /> Nueva cuenta
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva cuenta bancaria</DialogTitle>
          <DialogDescription>Cuenta real o pasarela, con su saldo inicial.</DialogDescription>
        </DialogHeader>
        <form action={submit} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" name="nombre" required placeholder="Banco de Bogotá Corriente" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="bankCode">Código / banco</Label>
              <Input id="bankCode" name="bankCode" placeholder="BANCO_BOGOTA" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="tipoCuenta">Tipo</Label>
              <select id="tipoCuenta" name="tipoCuenta" defaultValue="bank" className={cn(SELECT_CLASS)}>
                <option value="bank">Cuenta bancaria</option>
                <option value="gateway">Pasarela</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="numeroCuenta">N° de cuenta</Label>
              <Input id="numeroCuenta" name="numeroCuenta" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="opticaId">Óptica</Label>
              <select id="opticaId" name="opticaId" defaultValue="" className={cn(SELECT_CLASS)}>
                <option value="">General</option>
                {opticas.map((o) => (
                  <option key={o.id} value={o.id}>{o.nombre}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="saldoInicial">Saldo inicial</Label>
              <Input id="saldoInicial" name="saldoInicial" type="number" step="1000" defaultValue={0} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="saldoInicialFecha">Fecha saldo inicial</Label>
              <Input id="saldoInicialFecha" name="saldoInicialFecha" type="date" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="ghost" />}>Cancelar</DialogClose>
            <Button type="submit" disabled={pending}>{pending ? "Guardando…" : "Crear cuenta"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Movimiento({ cuentas }: { cuentas: Cuenta[] }) {
  const [open, setOpen] = useState(false);
  const { pending, submit } = useDialogAction(registrarMovimiento, () => setOpen(false));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" disabled={cuentas.length === 0}>
            <Landmark className="size-3.5" /> Movimiento
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar movimiento</DialogTitle>
          <DialogDescription>Ingreso o egreso manual en una cuenta.</DialogDescription>
        </DialogHeader>
        <form action={submit} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="cuentaId">Cuenta</Label>
            <select id="cuentaId" name="cuentaId" required defaultValue="" className={cn(SELECT_CLASS)}>
              <option value="" disabled>Selecciona…</option>
              {cuentas.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="direccion">Tipo</Label>
              <select id="direccion" name="direccion" defaultValue="in" className={cn(SELECT_CLASS)}>
                <option value="in">Ingreso</option>
                <option value="out">Egreso</option>
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="monto">Monto</Label>
              <Input id="monto" name="monto" type="number" min={1} step="1000" required />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="concepto">Concepto</Label>
            <Input id="concepto" name="concepto" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="categoria">Categoría</Label>
              <Input id="categoria" name="categoria" placeholder="Opcional" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="fecha">Fecha</Label>
              <Input id="fecha" name="fecha" type="date" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="ghost" />}>Cancelar</DialogClose>
            <Button type="submit" disabled={pending}>{pending ? "Guardando…" : "Registrar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Transferencia({ cuentas }: { cuentas: Cuenta[] }) {
  const [open, setOpen] = useState(false);
  const { pending, submit } = useDialogAction(transferir, () => setOpen(false));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" disabled={cuentas.length < 2}>
            <ArrowLeftRight className="size-3.5" /> Transferencia
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transferencia entre cuentas</DialogTitle>
          <DialogDescription>Crea un egreso en origen y un ingreso en destino.</DialogDescription>
        </DialogHeader>
        <form action={submit} className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="origenId">Origen</Label>
              <select id="origenId" name="origenId" required defaultValue="" className={cn(SELECT_CLASS)}>
                <option value="" disabled>Desde…</option>
                {cuentas.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="destinoId">Destino</Label>
              <select id="destinoId" name="destinoId" required defaultValue="" className={cn(SELECT_CLASS)}>
                <option value="" disabled>Hacia…</option>
                {cuentas.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="monto-t">Monto</Label>
              <Input id="monto-t" name="monto" type="number" min={1} step="1000" required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="fecha-t">Fecha</Label>
              <Input id="fecha-t" name="fecha" type="date" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="ghost" />}>Cancelar</DialogClose>
            <Button type="submit" disabled={pending}>{pending ? "Guardando…" : "Transferir"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TesoreriaAcciones({
  opticas,
  cuentas,
}: {
  opticas: Optica[];
  cuentas: Cuenta[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <NuevaCuenta opticas={opticas} />
      <Movimiento cuentas={cuentas} />
      <Transferencia cuentas={cuentas} />
    </div>
  );
}
