import type { Alerta } from "@/lib/audit-types";
import type { ParseResult, ParsedRow, PedidoLenteData } from "./types";
import {
  readSheet,
  resolveColumns,
  toNum,
  toDate,
  str,
  norm,
  isBlankRow,
  periodoFromDate,
} from "./utils";

/** Encabezados esperados por índice (orden de PROMPT.md). */
const HEADERS = [
  "ID",
  "ORDEN",
  "FECHA ENTREGA",
  "PRODUCTO",
  "LABORATORIO",
  "ORDEN DE LABORATORIO",
  "FACTURA",
  "FECHA ORDEN",
  "VALOR",
  "ESTADO",
] as const;

/** ¿Es la fila de totales "VALOR TOTAL"? */
function isTotalRow(row: unknown[]): boolean {
  return row.some((c) => norm(c).includes("valor total") || norm(c) === "total");
}

/** Extrae el ID antes de " - " en un PRODUCTO con formato "ID - Nombre". */
function productoId(producto: string | null): string | null {
  if (!producto) return null;
  const idx = producto.indexOf(" - ");
  if (idx < 0) return null;
  const id = producto.slice(0, idx).trim();
  return id === "" ? null : id;
}

/** ¿El PRODUCTO tiene formato "ID - Nombre" (ID numérico antes del guion)? */
function tieneFormatoProducto(producto: string | null): boolean {
  if (!producto) return false;
  const idx = producto.indexOf(" - ");
  if (idx < 0) return false;
  const id = producto.slice(0, idx).trim();
  const nombre = producto.slice(idx + 3).trim();
  return /^\d+$/.test(id) && nombre.length > 0;
}

export function parsePedidoLentes(buffer: Buffer): ParseResult<PedidoLenteData> {
  const { headers, rows: rawRows } = readSheet(buffer);
  // Columnas por NOMBRE (no por posición); aborta si falta alguna esperada.
  const col = resolveColumns(headers, HEADERS, "Pedido de Lentes");

  const rows: ParsedRow<PedidoLenteData>[] = [];
  const periodos = new Set<string>();

  rawRows.forEach((row, i) => {
    if (isBlankRow(row)) return;
    if (isTotalRow(row)) return;

    const pedidoId = str(row[col[0]]);
    const orden = str(row[col[1]]);
    // FECHA ENTREGA es un string (puede ser "NO"); no se parsea a fecha.
    const fechaEntrega = str(row[col[2]]);
    const producto = str(row[col[3]]);
    const laboratorio = str(row[col[4]]);
    const ordenLaboratorio = str(row[col[5]]);
    const factura = str(row[col[6]]);
    const fechaOrden = toDate(row[col[7]]);
    const valorRaw = row[col[8]];
    const valor = valorRaw == null || valorRaw === "" ? null : toNum(valorRaw);
    const estado = str(row[col[9]]);

    const data: PedidoLenteData = {
      pedidoId,
      orden,
      fechaEntrega,
      producto,
      productoId: productoId(producto),
      laboratorio,
      ordenLaboratorio,
      factura,
      fechaOrden,
      valor,
      estado,
    };

    const raw: Record<string, unknown> = {};
    HEADERS.forEach((h, idx) => {
      raw[h] = row[col[idx]] ?? null;
    });

    const alerts: Alerta[] = [];

    // ── Completitud (BAJA) ──
    if (!orden) {
      alerts.push({
        campo: "orden",
        severidad: "BAJA",
        tipo: "orden_vacia",
        mensaje: "ORDEN vacía.",
      });
    }
    if (!producto) {
      alerts.push({
        campo: "producto",
        severidad: "BAJA",
        tipo: "producto_vacio",
        mensaje: "PRODUCTO vacío.",
      });
    }
    if (!laboratorio) {
      alerts.push({
        campo: "laboratorio",
        severidad: "BAJA",
        tipo: "laboratorio_vacio",
        mensaje: "LABORATORIO vacío.",
      });
    }
    if (valor == null) {
      alerts.push({
        campo: "valor",
        severidad: "BAJA",
        tipo: "valor_vacio",
        mensaje: "VALOR vacío.",
      });
    }

    // ── Financiera (ALTA) ──
    if (valor != null && valor <= 0) {
      alerts.push({
        campo: "valor",
        severidad: "ALTA",
        tipo: "valor_no_positivo",
        mensaje: "VALOR menor o igual a cero (costo de lente inválido).",
      });
    }

    // ── Consistencia (MEDIA): formato de PRODUCTO ──
    if (producto && !tieneFormatoProducto(producto)) {
      alerts.push({
        campo: "producto",
        severidad: "MEDIA",
        tipo: "producto_formato_invalido",
        mensaje: 'PRODUCTO sin formato "ID - Nombre".',
      });
    }

    if (fechaOrden) {
      const p = periodoFromDate(fechaOrden);
      if (p) periodos.add(p);
    }

    rows.push({ rowIndex: i, data, raw, alerts });
  });

  return {
    tipoReporte: "PEDIDO_LENTES",
    rows,
    periodos: [...periodos].sort(),
    opticas: [],
  };
}
