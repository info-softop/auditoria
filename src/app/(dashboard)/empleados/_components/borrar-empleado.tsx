"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { eliminarEmpleado } from "../actions";

export function BorrarEmpleado({ id, nombre }: { id: string; nombre: string }) {
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!confirm(`¿Eliminar a ${nombre}? Esta acción no se puede deshacer.`)) return;
    const fd = new FormData();
    fd.set("id", id);
    startTransition(async () => {
      await eliminarEmpleado(fd);
      toast.success("Empleado eliminado");
    });
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={pending}
      aria-label={`Eliminar ${nombre}`}
      className="text-destructive hover:text-destructive"
    >
      <Trash2 className="size-3.5" />
    </Button>
  );
}
