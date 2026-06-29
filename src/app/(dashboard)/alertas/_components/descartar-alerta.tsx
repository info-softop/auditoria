"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EyeOff, RotateCcw, Loader2, SlidersHorizontal } from "lucide-react";
import {
  descartarAlerta,
  restaurarAlerta,
  cambiarSeveridad,
  type AlertaSnapshot,
} from "../actions";

export function CambiarSeveridadButton({ alerta }: { alerta: AlertaSnapshot }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const cambiar = (sev: "ALTA" | "MEDIA" | "BAJA") =>
    start(async () => {
      const res = await cambiarSeveridad(alerta, sev);
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo cambiar");
        return;
      }
      toast.success(`Severidad cambiada a ${sev}`);
      router.refresh();
    });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <SlidersHorizontal className="size-4" />}
        Severidad
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {(["ALTA", "MEDIA", "BAJA"] as const).map((s) => (
          <DropdownMenuItem key={s} className="cursor-pointer" onClick={() => cambiar(s)}>
            {s === "ALTA" ? "Alta" : s === "MEDIA" ? "Media" : "Baja"}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DescartarButton({ alerta }: { alerta: AlertaSnapshot }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [pending, start] = useTransition();

  const confirmar = () => {
    start(async () => {
      const res = await descartarAlerta(alerta, motivo);
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo descartar");
        return;
      }
      toast.success("Alerta descartada");
      setOpen(false);
      setMotivo("");
      router.refresh();
    });
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <EyeOff className="size-4" /> Descartar
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Descartar alerta</DialogTitle>
            <DialogDescription>
              La alerta se ocultará de la lista activa y quedará registrado quién
              la descartó. Indica el motivo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo</Label>
            <textarea
              id="motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              placeholder="Ej. Revisado con el contador, es correcto."
              className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            {alerta.mensaje && (
              <p className="text-xs text-muted-foreground">{alerta.mensaje}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={confirmar} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <EyeOff className="size-4" />}
              Descartar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function RestaurarButton({ alertaKey }: { alertaKey: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-muted-foreground"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await restaurarAlerta(alertaKey);
          if (!res.ok) {
            toast.error(res.error ?? "No se pudo restaurar");
            return;
          }
          toast.success("Alerta restaurada");
          router.refresh();
        })
      }
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
      Restaurar
    </Button>
  );
}
