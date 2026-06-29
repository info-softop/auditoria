import {
  readSheet,
  resolveColumns,
  toNum,
  toDate,
  str,
  isBlankRow,
  periodoFromDate,
} from "./utils";
import type { ParseResult, ParsedRow } from "./types";
import type { CuentaPorPagarData } from "./types";
import type { Alerta } from "@/lib/audit-types";

/**
 * Parser del reporte "Cuánto Debo / Cuentas por Pagar"
 * (archivo reporteCuantoDebo, hoja "ReportePagos", 7 columnas).
 *
 * Mapeo por ÍNDICE (orden de PROMPT.md sección 6):
 *   0 COMPROBANTE ("Compra - N")
 *   1 FECHA
 *   2 NO.FACTURA
 *   3 PROVEEDOR
 *   4 CUENTA
 *   5 DESCRIPCION
 *   6 TOTAL
 *
 * comprobanteNum = COMPROBANTE sin el prefijo "Compra - " (trim).
 *
 * Reglas de auditoría por fila:
 *   - BAJA: COMPROBANTE / NO.FACTURA / PROVEEDOR / TOTAL vacíos (completitud).
 *   - ALTA: TOTAL <= 0 (financiera).
 *   - MEDIA: COMPROBANTE sin formato "Compra - N" (consistencia).
 * El cruce con Pagos a Proveedores se resuelve en cross-checks (no aquí).
 */

const COMPRA_PREFIX_RE = /^compra\s*-\s*(\d+)\s*$/i;

/** Quita el prefijo "Compra - " y devuelve solo el número (trim). */
function extraerComprobanteNum(comprobante: string | null): string | null {
  if (!comprobante) return null;
  const m = comprobante.match(COMPRA_PREFIX_RE);
  if (m) return m[1].trim();
  return comprobante.trim() || null;
}

/** ¿Es una fila de totales? (ej. "TOTAL:", "VALOR TOTAL" en alguna celda). */
function isTotalRow(row: unknown[]): boolean {
  return row.some((c) => {
    if (c == null) return false;
    const s = String(c).toUpperCase().trim();
    return s === "TOTAL" || s.startsWith("TOTAL:") || s.startsWith("VALOR TOTAL");
  });
}

export function parseCuantoDebo(
  buffer: Buffer | ArrayBuffer
): ParseResult<CuentaPorPagarData> {
  const { headers, rows } = readSheet(buffer);

  const HEAD = [
    "COMPROBANTE",
    "FECHA",
    "NO.FACTURA",
    "PROVEEDOR",
    "CUENTA",
    "DESCRIPCION",
    "TOTAL",
  ] as const;
  // Columnas por NOMBRE (no por posición); aborta si falta alguna esperada.
  const col = resolveColumns(headers, HEAD, "Cuentas por Pagar");

  const parsedRows: ParsedRow<CuentaPorPagarData>[] = [];
  const periodosSet = new Set<string>();

  rows.forEach((row, i) => {
    if (isBlankRow(row) || isTotalRow(row)) return;

    const comprobante = str(row[col[0]]);
    const fecha = toDate(row[col[1]]);
    const noFactura = str(row[col[2]]);
    const proveedor = str(row[col[3]]);
    const cuenta = str(row[col[4]]);
    const descripcion = str(row[col[5]]);
    const total = row[col[6]] == null || row[col[6]] === "" ? null : toNum(row[col[6]]);

    const comprobanteNum = extraerComprobanteNum(comprobante);

    const data: CuentaPorPagarData = {
      comprobante,
      comprobanteNum,
      fecha,
      noFactura,
      proveedor,
      cuenta,
      descripcion,
      total,
    };

    const raw: Record<string, unknown> = {};
    HEAD.forEach((h, idx) => {
      raw[h] = row[col[idx]] ?? null;
    });

    const alerts: Alerta[] = [];

    // Completitud (BAJA)
    if (!comprobante) {
      alerts.push({
        campo: "comprobante",
        severidad: "BAJA",
        tipo: "comprobante_vacio",
        mensaje: "COMPROBANTE vacío.",
      });
    }
    if (!noFactura) {
      alerts.push({
        campo: "noFactura",
        severidad: "BAJA",
        tipo: "no_factura_vacio",
        mensaje: "NO.FACTURA vacío.",
      });
    }
    if (!proveedor) {
      alerts.push({
        campo: "proveedor",
        severidad: "BAJA",
        tipo: "proveedor_vacio",
        mensaje: "PROVEEDOR vacío.",
      });
    }
    if (total == null) {
      alerts.push({
        campo: "total",
        severidad: "BAJA",
        tipo: "total_vacio",
        mensaje: "TOTAL vacío.",
      });
    }

    // Financiera (ALTA)
    if (total != null && total <= 0) {
      alerts.push({
        campo: "total",
        severidad: "ALTA",
        tipo: "total_no_positivo",
        mensaje: `TOTAL menor o igual a cero (${total}).`,
      });
    }

    // Consistencia (MEDIA): COMPROBANTE sin formato "Compra - N"
    if (comprobante && !COMPRA_PREFIX_RE.test(comprobante)) {
      alerts.push({
        campo: "comprobante",
        severidad: "MEDIA",
        tipo: "comprobante_sin_formato_compra",
        mensaje: `COMPROBANTE sin formato "Compra - N": "${comprobante}".`,
      });
    }

    const periodo = periodoFromDate(fecha);
    if (periodo) periodosSet.add(periodo);

    parsedRows.push({ rowIndex: i, data, raw, alerts });
  });

  return {
    tipoReporte: "CUENTAS_POR_PAGAR",
    rows: parsedRows,
    periodos: Array.from(periodosSet).sort(),
    opticas: [],
  };
}
