"use client";

import { useMemo, useState } from "react";
import {
  type ColumnDef,
  type FilterFn,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronLeft, ChevronRight, Search, TriangleAlert } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SeverityBadge } from "@/components/severity-badge";
import { cn } from "@/lib/utils";
import { formatCOP, formatNumber, formatFecha } from "@/lib/format";
import {
  SEVERIDAD_ORDER,
  type Severidad,
  type TipoReporte,
} from "@/lib/audit-types";

export type RowAlert = {
  campo: string;
  severidad: Severidad;
  tipo: string;
  mensaje: string;
};

export type SerializedRow = {
  id: string;
  hasAlert: boolean;
  alerts: RowAlert[];
  [key: string]: unknown;
};

type ColumnSpec = {
  key: string;
  header: string;
  align?: "left" | "right";
  format?: "cop" | "number" | "fecha" | "text";
  accessor?: (row: SerializedRow) => unknown;
};

// ── Columnas por tipo de reporte ──────────────────────────────
function columnsForTipo(tipo: TipoReporte): ColumnSpec[] {
  switch (tipo) {
    case "VENTA_DETALLADA":
      return [
        { key: "fecha", header: "Fecha", format: "fecha" },
        { key: "consecutivo", header: "Consecutivo" },
        {
          key: "nombres",
          header: "Nombres",
          accessor: (r) => {
            const raw = r.raw as Record<string, unknown> | null | undefined;
            return (
              r.nombres ??
              raw?.["Nombres"] ??
              raw?.["NOMBRES"] ??
              r.atendidoPor ??
              null
            );
          },
        },
        { key: "tipoProducto", header: "Tipo producto" },
        { key: "referencia", header: "Referencia" },
        { key: "cantidad", header: "Cantidad", align: "right", format: "number" },
        {
          key: "precioVenta",
          header: "Precio venta",
          align: "right",
          format: "cop",
        },
        { key: "descuento", header: "Descuento", align: "right", format: "cop" },
        { key: "estado", header: "Estado" },
      ];
    case "PEDIDO_LENTES":
      return [
        { key: "orden", header: "Orden" },
        { key: "producto", header: "Producto" },
        { key: "laboratorio", header: "Laboratorio" },
        { key: "valor", header: "Valor", align: "right", format: "cop" },
        { key: "fechaEntrega", header: "Entrega" },
        { key: "estado", header: "Estado" },
      ];
    case "GASTOS":
      return [
        { key: "noGastos", header: "No. gasto" },
        { key: "fecha", header: "Fecha", format: "fecha" },
        { key: "descripcion", header: "Descripción" },
        { key: "tercero", header: "Tercero" },
        { key: "valor", header: "Valor", align: "right", format: "cop" },
        { key: "dc", header: "D/C" },
      ];
    case "COMPROBANTES":
      return [
        { key: "noComprobante", header: "No. comprobante" },
        { key: "fecha", header: "Fecha", format: "fecha" },
        { key: "cuenta", header: "Cuenta" },
        { key: "descripcion", header: "Descripción" },
        { key: "debito", header: "Débito", align: "right", format: "cop" },
        { key: "credito", header: "Crédito", align: "right", format: "cop" },
        { key: "total", header: "Total", align: "right", format: "cop" },
      ];
    case "PAGOS_PROVEEDORES":
      return [
        { key: "pago", header: "Pago" },
        { key: "fecha", header: "Fecha", format: "fecha" },
        { key: "comprobante", header: "Comprobante" },
        { key: "noFactura", header: "No. factura" },
        { key: "proveedor", header: "Proveedor" },
        { key: "debito", header: "Débito", align: "right", format: "cop" },
        { key: "credito", header: "Crédito", align: "right", format: "cop" },
      ];
    case "CUENTAS_POR_PAGAR":
      return [
        { key: "comprobante", header: "Comprobante" },
        { key: "fecha", header: "Fecha", format: "fecha" },
        { key: "noFactura", header: "No. factura" },
        { key: "proveedor", header: "Proveedor" },
        { key: "total", header: "Total", align: "right", format: "cop" },
      ];
    default:
      return [];
  }
}

function formatValue(value: unknown, format?: ColumnSpec["format"]): string {
  if (value == null || value === "") return "—";
  switch (format) {
    case "cop":
      return formatCOP(typeof value === "number" ? value : Number(value));
    case "number":
      return formatNumber(typeof value === "number" ? value : Number(value));
    case "fecha":
      return formatFecha(value as string);
    default:
      return String(value);
  }
}

function maxSeveridad(alerts: RowAlert[]): Severidad | null {
  if (!alerts.length) return null;
  return alerts
    .map((a) => a.severidad)
    .sort((a, b) => SEVERIDAD_ORDER[a] - SEVERIDAD_ORDER[b])[0];
}

// Filtro global: busca texto en todos los valores serializados de la fila.
const globalTextFilter: FilterFn<SerializedRow> = (row, _columnId, value) => {
  const needle = String(value).toLowerCase().trim();
  if (!needle) return true;
  const r = row.original;
  for (const [k, v] of Object.entries(r)) {
    if (k === "alerts" || k === "raw" || v == null) continue;
    if (String(v).toLowerCase().includes(needle)) return true;
  }
  // también busca en mensajes de alerta
  return r.alerts.some(
    (a) =>
      a.mensaje.toLowerCase().includes(needle) ||
      a.campo.toLowerCase().includes(needle),
  );
};

export function RowsTable({
  rows,
  tipo,
}: {
  rows: SerializedRow[];
  tipo: TipoReporte;
}) {
  const [search, setSearch] = useState("");
  const [soloAlerta, setSoloAlerta] = useState(false);
  const [severidad, setSeveridad] = useState<string>("all");

  const specs = useMemo(() => columnsForTipo(tipo), [tipo]);

  const columns = useMemo<ColumnDef<SerializedRow>[]>(() => {
    const cols: ColumnDef<SerializedRow>[] = [
      {
        id: "_alerta",
        header: "",
        enableGlobalFilter: false,
        cell: ({ row }) => {
          const alerts = row.original.alerts;
          if (!alerts.length) return null;
          const sev = maxSeveridad(alerts);
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      className="inline-flex items-center text-sev-alta"
                      aria-label="Ver alertas"
                    />
                  }
                >
                  <TriangleAlert className="size-4" />
                </TooltipTrigger>
                <TooltipContent className="max-w-sm flex-col items-start gap-2 py-2 text-left">
                  {sev && <SeverityBadge severidad={sev} />}
                  <ul className="space-y-1">
                    {alerts.map((a, i) => (
                      <li key={i} className="text-xs leading-snug">
                        <span className="font-medium">{a.campo}:</span>{" "}
                        {a.mensaje}
                      </li>
                    ))}
                  </ul>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        },
      },
    ];

    for (const spec of specs) {
      cols.push({
        id: spec.key,
        accessorFn: (r) => (spec.accessor ? spec.accessor(r) : r[spec.key]),
        header: spec.header,
        cell: ({ getValue }) => (
          <span
            className={cn(
              spec.align === "right" && "block text-right tabular-nums-fin",
            )}
          >
            {formatValue(getValue(), spec.format)}
          </span>
        ),
      });
    }
    return cols;
  }, [specs]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (soloAlerta && !r.hasAlert) return false;
      if (severidad !== "all") {
        if (!r.alerts.some((a) => a.severidad === severidad)) return false;
      }
      return true;
    });
  }, [rows, soloAlerta, severidad]);

  const table = useReactTable({
    data: filtered,
    columns,
    state: { globalFilter: search },
    onGlobalFilterChange: setSearch,
    globalFilterFn: globalTextFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 50 } },
  });

  const totalVisible = table.getFilteredRowModel().rows.length;
  const pageIndex = table.getState().pagination.pageIndex;
  const pageCount = table.getPageCount();

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar en las filas…"
              className="pl-8"
            />
          </div>

          <Select
            value={severidad}
            onValueChange={(v) => setSeveridad(v ?? "all")}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Severidad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toda severidad</SelectItem>
              <SelectItem value="ALTA">Alta</SelectItem>
              <SelectItem value="MEDIA">Media</SelectItem>
              <SelectItem value="BAJA">Baja</SelectItem>
            </SelectContent>
          </Select>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={soloAlerta}
              onCheckedChange={(c) => setSoloAlerta(c === true)}
            />
            Solo con alerta
          </label>
        </div>

        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  No hay filas que coincidan con los filtros.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={cn(row.original.hasAlert && "bg-sev-alta/5")}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <p className="text-sm text-muted-foreground">
            {formatNumber(totalVisible)}{" "}
            {totalVisible === 1 ? "fila" : "filas"}
            {(soloAlerta || severidad !== "all" || search) &&
              ` · de ${formatNumber(rows.length)} totales`}
          </p>
          {pageCount > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Página {pageIndex + 1} de {pageCount}
              </span>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                aria-label="Página anterior"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                aria-label="Página siguiente"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
