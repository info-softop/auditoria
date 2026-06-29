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
import { formatCOP, formatFecha } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Camera, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import { SubirFotoButton } from "./subir-foto-button";
import { VerFotoButton } from "./ver-foto-button";

export interface TrasladoItem {
  id: string;
  noComprobante: string;
  fecha: string | null;
  optica: string;
  total: number;
  fileUrl: string | null;
}

const PAGE_SIZE = 15;
type Filtro = "todos" | "verificado" | "sin";

export function TrasladosTable({ traslados }: { traslados: TrasladoItem[] }) {
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [page, setPage] = useState(1);

  const verificados = traslados.filter((t) => t.fileUrl).length;
  const sin = traslados.length - verificados;

  const filtrados = useMemo(() => {
    if (filtro === "verificado") return traslados.filter((t) => t.fileUrl);
    if (filtro === "sin") return traslados.filter((t) => !t.fileUrl);
    return traslados;
  }, [traslados, filtro]);

  const totalPages = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const visibles = filtrados.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  const chip = (f: Filtro, label: string, n: number) => (
    <Button
      variant={filtro === f ? "default" : "outline"}
      size="sm"
      onClick={() => {
        setFiltro(f);
        setPage(1);
      }}
    >
      {label}
      <span className="ml-1.5 rounded-full bg-foreground/10 px-1.5 text-xs tabular-nums-fin">
        {n}
      </span>
    </Button>
  );

  if (traslados.length === 0) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        <Camera className="mx-auto mb-3 size-10 opacity-40" />
        <p className="font-medium text-foreground">No hay traslados en este período</p>
        <p className="mt-1 text-sm">
          Carga el reporte de Comprobantes para ver las consignaciones.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {chip("todos", "Todos", traslados.length)}
        {chip("verificado", "Verificados", verificados)}
        {chip("sin", "Sin comprobante", sin)}
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>No. comprobante</TableHead>
              <TableHead>Óptica</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibles.map((t) => (
              <TableRow key={t.id} className={cn(!t.fileUrl && "bg-sev-alta/5")}>
                <TableCell className="text-muted-foreground">
                  {formatFecha(t.fecha)}
                </TableCell>
                <TableCell className="font-medium">{t.noComprobante}</TableCell>
                <TableCell className="text-muted-foreground">{t.optica}</TableCell>
                <TableCell className="text-right tabular-nums-fin">
                  {formatCOP(t.total)}
                </TableCell>
                <TableCell>
                  {t.fileUrl ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-success/25 bg-success/12 px-2 py-0.5 text-xs font-medium text-success">
                      <CheckCircle2 className="size-3.5" />
                      Verificado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-sev-alta/25 bg-sev-alta/12 px-2 py-0.5 text-xs font-medium text-sev-alta">
                      <span className="size-1.5 rounded-full bg-sev-alta" />
                      Sin comprobante
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {t.fileUrl ? (
                    <VerFotoButton fileUrl={t.fileUrl} noComprobante={t.noComprobante} />
                  ) : (
                    <SubirFotoButton comprobanteId={t.id} noComprobante={t.noComprobante} />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Página {pageSafe} de {totalPages} · {filtrados.length} traslados
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pageSafe <= 1}
              onClick={() => setPage(pageSafe - 1)}
            >
              <ChevronLeft className="size-4" /> Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pageSafe >= totalPages}
              onClick={() => setPage(pageSafe + 1)}
            >
              Siguiente <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
