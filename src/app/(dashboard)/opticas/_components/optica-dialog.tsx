"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Plus, Pencil } from "lucide-react";
import { createOptica, updateOptica } from "../actions";

interface OpticaData {
  id: string;
  nombre: string;
  grupo: string;
  codigoInterno: string | null;
  activa: boolean;
}

export function OpticaDialog({ optica }: { optica?: OpticaData }) {
  const router = useRouter();
  const isEdit = Boolean(optica);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [nombre, setNombre] = useState(optica?.nombre ?? "");
  const [grupo, setGrupo] = useState(optica?.grupo ?? "");
  const [codigoInterno, setCodigoInterno] = useState(optica?.codigoInterno ?? "");
  const [activa, setActiva] = useState(optica?.activa ?? true);

  function reset() {
    setNombre(optica?.nombre ?? "");
    setGrupo(optica?.grupo ?? "");
    setCodigoInterno(optica?.codigoInterno ?? "");
    setActiva(optica?.activa ?? true);
  }

  function handleSubmit() {
    startTransition(async () => {
      const res = isEdit
        ? await updateOptica(optica!.id, {
            nombre,
            grupo,
            codigoInterno: codigoInterno || undefined,
          })
        : await createOptica({
            nombre,
            grupo,
            codigoInterno: codigoInterno || undefined,
            activa,
          });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(isEdit ? "Óptica actualizada" : "Óptica creada");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) reset();
      }}
    >
      <DialogTrigger
        render={
          isEdit ? (
            <Button variant="ghost" size="icon-sm" aria-label="Editar óptica" />
          ) : (
            <Button />
          )
        }
      >
        {isEdit ? (
          <Pencil className="size-4" />
        ) : (
          <>
            <Plus className="size-4" /> Nueva óptica
          </>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar óptica" : "Nueva óptica"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Actualiza los datos de la óptica."
              : "Registra una nueva óptica en el sistema."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input
              id="nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Óptica Centro"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="grupo">Grupo</Label>
            <Input
              id="grupo"
              value={grupo}
              onChange={(e) => setGrupo(e.target.value)}
              placeholder="Grupo Norte"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="codigoInterno">Código interno (opcional)</Label>
            <Input
              id="codigoInterno"
              value={codigoInterno}
              onChange={(e) => setCodigoInterno(e.target.value)}
              placeholder="OPT-001"
            />
          </div>
          {!isEdit && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="activa"
                checked={activa}
                onCheckedChange={(v) => setActiva(v === true)}
              />
              <Label htmlFor="activa" className="font-normal">
                Activa
              </Label>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {isEdit ? "Guardar cambios" : "Crear óptica"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
