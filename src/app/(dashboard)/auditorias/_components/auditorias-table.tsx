"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatNumber, formatFecha } from "@/lib/format";
import { FileSearch, ChevronLeft, ChevronRight } from "lucide-react";

export interface ImportacionItem {
  id: string;
  optica: string;
  tipoReporte: string;
  tipoLabel: string;
  uploadedAt: string;
  totalFilas: number;
  filasConAlerta: number;
}

const PAGE_SIZE = 15;

export function AuditoriasTable({ items }: { items: ImportacionItem[] }) {
  const [tipo, setTipo] = useState<string>("all");
  const [page, setPage] = useState(1);

  const tipos = useMemo(
    () => [...new Map(items.map((i) => [i.tipoReporte, i.tipoLabel])).entries()],
    [items]
  );

  const filtrados = useMemo(
    () => (tipo === "all" ? items : items.filter((i) => i.tipoReporte === tipo)),
    [items, tipo]
  );

  const totalPages = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const visibles = filtrados.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  return (
    <div className="space-y-4">
      {tipos.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <Button
            variant={tipo === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setTipo("all");
              setPage(1);
            }}
          >
            Todos
          </Button>
          {tipos.map(([t, label]) => (
            <Button
              key={t}
              variant={tipo === t ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setTipo(t);
                setPage(1);
              }}
            >
              {label}
            </Button>
          ))}
        </div>
      )}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Óptica</TableHead>
              <TableHead>Tipo de reporte</TableHead>
              <TableHead>Cargado</TableHead>
              <TableHead className="text-right">Filas</TableHead>
              <TableHead className="text-right">Con alerta</TableHead>
              <TableHead className="text-right">Detalle</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibles.map((imp) => {
              const conAlerta = imp.filasConAlerta > 0;
              return (
                <TableRow key={imp.id}>
                  <TableCell className="font-medium">{imp.optica}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{imp.tipoLabel}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatFecha(imp.uploadedAt)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums-fin">
                    {formatNumber(imp.totalFilas)}
                  </TableCell>
                  <TableCell
                    className={
                      conAlerta
                        ? "text-right font-semibold text-sev-alta tabular-nums-fin"
                        : "text-right text-muted-foreground tabular-nums-fin"
                    }
                  >
                    {conAlerta ? formatNumber(imp.filasConAlerta) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/auditorias/${imp.id}`}>
                        <FileSearch className="size-4" />
                        Ver
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Página {pageSafe} de {totalPages}
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
