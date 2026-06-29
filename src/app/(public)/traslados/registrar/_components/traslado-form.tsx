"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const SELECT_CLASS =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm";

export function TrasladoForm({
  opticas,
}: {
  opticas: { id: string; nombre: string }[];
}) {
  const [enviando, setEnviando] = useState(false);
  const [ok, setOk] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setEnviando(true);
    try {
      const res = await fetch("/api/public/traslados", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.ok) {
        setOk(true);
        form.reset();
      } else {
        toast.error(data.error ?? "No se pudo registrar");
      }
    } catch {
      toast.error("Error de conexión. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  if (ok) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <CheckCircle2 className="size-12 text-success" />
          <p className="font-medium">¡Consignación registrada!</p>
          <p className="text-sm text-muted-foreground">
            El auditor la revisará. Gracias.
          </p>
          <Button variant="outline" onClick={() => setOk(false)}>
            Registrar otra
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="optica">Óptica</Label>
            <select id="optica" name="opticaId" required defaultValue="" className={cn(SELECT_CLASS)}>
              <option value="" disabled>
                Selecciona la óptica…
              </option>
              {opticas.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="valor">Valor consignado (COP)</Label>
            <Input
              id="valor"
              name="valor"
              type="number"
              inputMode="numeric"
              min={1}
              step="1000"
              required
              placeholder="0"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="fecha">Fecha de consignación (opcional)</Label>
            <Input id="fecha" name="fecha" type="date" />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="registradoPor">Tu nombre (opcional)</Label>
            <Input id="registradoPor" name="registradoPor" placeholder="Asesora" />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="file">Foto del comprobante</Label>
            <Input
              id="file"
              name="file"
              type="file"
              accept="image/*,application/pdf"
              required
            />
            <p className="text-xs text-muted-foreground">
              Imagen o PDF, máximo 10 MB.
            </p>
          </div>

          <Button type="submit" disabled={enviando}>
            {enviando ? "Enviando…" : "Registrar consignación"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
