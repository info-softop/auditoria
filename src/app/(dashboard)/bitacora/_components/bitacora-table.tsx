"use client";

import { useMemo, useState } from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface RegistroItem {
  id: string;
  accion: string;
  accionLabel: string;
  detalle: string | null;
  usuario: string;
  fecha: string; // ya formateada
}

const PAGE_SIZE = 20;

const ACCION_COLOR: Record<string, string> = {
  descartar_alerta: "bg-sev-alta/12 text-sev-alta",
  restaurar_alerta: "bg-success/12 text-success",
  cambiar_severidad: "bg-sev-baja/12 text-sev-baja",
};

export function BitacoraTable({ registros }: { registros: RegistroItem[] }) {
  const [accion, setAccion] = useState<string>("all");
  const [page, setPage] = useState(1);

  const acciones = useMemo(
    () => [...new Map(registros.map((r) => [r.accion, r.accionLabel])).entries()],
    [registros]
  );

  const filtrados = useMemo(
    () => (accion === "all" ? registros : registros.filter((r) => r.accion === accion)),
    [registros, accion]
  );
  const totalPages = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const visibles = filtrados.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  if (registros.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        Aún no hay acciones registradas.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        <Button
          variant={accion === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => {
            setAccion("all");
            setPage(1);
          }}
        >
          Todas
        </Button>
        {acciones.map(([a, label]) => (
          <Button
            key={a}
            variant={accion === a ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setAccion(a);
              setPage(1);
            }}
          >
            {label}
          </Button>
        ))}
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>Acción</TableHead>
              <TableHead>Detalle</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibles.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {r.fecha}
                </TableCell>
                <TableCell className="font-medium">{r.usuario}</TableCell>
                <TableCell>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      ACCION_COLOR[r.accion] ?? "bg-muted text-muted-foreground"
                    )}
                  >
                    {r.accionLabel}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">{r.detalle}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Página {pageSafe} de {totalPages} · {filtrados.length} registros
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={pageSafe <= 1} onClick={() => setPage(pageSafe - 1)}>
              <ChevronLeft className="size-4" /> Anterior
            </Button>
            <Button variant="outline" size="sm" disabled={pageSafe >= totalPages} onClick={() => setPage(pageSafe + 1)}>
              Siguiente <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
