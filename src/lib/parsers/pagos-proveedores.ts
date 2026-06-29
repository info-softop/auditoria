import type { Alerta } from "@/lib/audit-types";
import type { ParseResult, ParsedRow, PagoProveedorData } from "./types";
import {
  readSheet,
  resolveColumns,
  toNum,
  toDate,
  str,
  isBlankRow,
  periodoFromDate,
} from "./utils";

/**
 * Parser de PAGOS A PROVEEDORES (reportePagos, hoja "ReportePagos", 11 columnas).
 *
 * OJO: comparte el nombre de hoja "ReportePagos" con el reporte de Gastos, pero
 * las columnas son distintas. El mapeo se hace POR ÍNDICE, según el orden exacto
 * de PROMPT.md:
 *   0 PAGO, 1 FECHA, 2 OBSERVACIONES, 3 COMPROBANTE, 4 NO.FACTURA, 5 PROVEEDOR,
 *   6 CUENTA, 7 DESCRIPCION, 8 Debito, 9 Credito, 10 Usuario.
 *
 * PARTIDA DOBLE: cada PAGO = N filas débito (facturas pagadas) + 1 fila crédito
 * (salida de caja/banco). Reglas:
 *   - por PAGO, suma débitos == suma créditos (ALTA si descuadra)
 *   - en filas débito: PROVEEDOR / COMPROBANTE vacíos (BAJA)
 *   - FECHA vacía (BAJA)
 */

const HEADERS = [
  "PAGO",
  "FECHA",
  "OBSERVACIONES",
  "COMPROBANTE",
  "NO.FACTURA",
  "PROVEEDOR",
  "CUENTA",
  "DESCRIPCION",
  "Debito",
  "Credito",
  "Usuario",
];

const EPSILON = 0.01;

/**
 * Detecta filas de totales al final (ej. "$2.971.392" en débito/crédito sin PAGO).
 * Recibe los índices resueltos de PAGO/Debito/Credito (no posiciones fijas).
 */
function isTotalRow(
  row: unknown[],
  idxPago: number,
  idxDebito: number,
  idxCredito: number
): boolean {
  const pago = row[idxPago];
  const hasPago = pago != null && String(pago).trim() !== "";
  if (hasPago) return false;
  // Sin PAGO pero con algún valor monetario => fila de totales.
  const deb = row[idxDebito];
  const cred = row[idxCredito];
  const looksMoney = (v: unknown) =>
    v != null && String(v).trim() !== "" && /[\d$]/.test(String(v));
  return looksMoney(deb) || looksMoney(cred);
}

export function parsePagosProveedores(
  buffer: Buffer,
): ParseResult<PagoProveedorData> {
  const { headers, rows: rawRows } = readSheet(buffer);
  // Columnas por NOMBRE (no por posición); aborta si falta alguna esperada.
  const col = resolveColumns(headers, HEADERS, "Pagos a Proveedores");

  const rows: ParsedRow<PagoProveedorData>[] = [];
  const periodosSet = new Set<string>();

  // Acumuladores por PAGO para validar partida doble.
  const sumByPago = new Map<string, { debito: number; credito: number; rowIdxs: number[] }>();

  rawRows.forEach((row, i) => {
    if (isBlankRow(row) || isTotalRow(row, col[0], col[8], col[9])) return;

    const fecha = toDate(row[col[1]]);
    const debito = toNum(row[col[8]]);
    const credito = toNum(row[col[9]]);
    const pago = str(row[col[0]]);
    const comprobante = str(row[col[3]]);
    const proveedor = str(row[col[5]]);

    const data: PagoProveedorData = {
      pago,
      fecha,
      observaciones: str(row[col[2]]),
      comprobante,
      noFactura: str(row[col[4]]),
      proveedor,
      cuenta: str(row[col[6]]),
      descripcion: str(row[col[7]]),
      debito,
      credito,
      usuario: str(row[col[10]]),
    };

    const raw: Record<string, unknown> = {};
    HEADERS.forEach((h, idx) => {
      raw[h] = row[col[idx]] ?? null;
    });

    const alerts: Alerta[] = [];
    const rowIndex = i;

    // Una fila es "débito" si tiene débito > 0 (factura pagada).
    const esDebito = debito > EPSILON;

    // ── Completitud ──
    if (!fecha) {
      alerts.push({
        campo: "fecha",
        severidad: "BAJA",
        tipo: "fecha_vacia",
        mensaje: "FECHA vacía o inválida.",
      });
    }

    if (esDebito && !proveedor) {
      alerts.push({
        campo: "proveedor",
        severidad: "BAJA",
        tipo: "proveedor_vacio",
        mensaje: "PROVEEDOR vacío en fila débito (factura pagada).",
      });
    }

    if (esDebito && !comprobante) {
      alerts.push({
        campo: "comprobante",
        severidad: "BAJA",
        tipo: "comprobante_vacio",
        mensaje: "COMPROBANTE vacío en fila débito (factura pagada).",
      });
    }

    if (!data.usuario) {
      alerts.push({
        campo: "usuario",
        severidad: "BAJA",
        tipo: "usuario_vacio",
        mensaje: "Usuario vacío.",
      });
    }

    // Acumular por PAGO para validar el cuadre después.
    if (pago) {
      const acc = sumByPago.get(pago) ?? { debito: 0, credito: 0, rowIdxs: [] };
      acc.debito += debito;
      acc.credito += credito;
      acc.rowIdxs.push(rows.length);
      sumByPago.set(pago, acc);
    }

    const periodo = periodoFromDate(fecha);
    if (periodo) periodosSet.add(periodo);

    rows.push({ rowIndex, data, raw, alerts });
  });

  // ── Partida doble por PAGO: suma débitos == suma créditos (ALTA si descuadra) ──
  for (const [pago, acc] of sumByPago) {
    if (Math.abs(acc.debito - acc.credito) > EPSILON) {
      const alerta: Alerta = {
        campo: "debito",
        severidad: "ALTA",
        tipo: "descuadre_partida_doble",
        mensaje: `PAGO ${pago}: débitos (${acc.debito}) != créditos (${acc.credito}).`,
      };
      // Adjuntar la alerta a todas las filas del pago descuadrado.
      for (const idx of acc.rowIdxs) {
        rows[idx].alerts.push(alerta);
      }
    }
  }

  return {
    tipoReporte: "PAGOS_PROVEEDORES",
    rows,
    periodos: Array.from(periodosSet).sort(),
    opticas: [],
  };
}
