"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loader2, Power, PowerOff } from "lucide-react";
import { toggleOptica } from "../actions";

export function ToggleOptica({ id, activa }: { id: string; activa: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      const res = await toggleOptica(id, !activa);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(activa ? "Óptica desactivada" : "Óptica activada");
      router.refresh();
    });
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={handleToggle}
      disabled={pending}
      aria-label={activa ? "Desactivar óptica" : "Activar óptica"}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : activa ? (
        <PowerOff className="size-4 text-muted-foreground" />
      ) : (
        <Power className="size-4 text-emerald-600" />
      )}
    </Button>
  );
}
