import type { Alerta } from "@/lib/audit-types";
import type { ComprobanteData, ParseResult, ParsedRow } from "@/lib/parsers/types";
import {
  isBlankRow,
  norm,
  periodoFromDate,
  readSheet,
  str,
  toDate,
  toNum,
} from "@/lib/parsers/utils";

/**
 * Parser del reporte COMPROBANTES / TRASLADOS (hoja "ReporteComprobantes", 12 columnas).
 *
 * Cada traslado CAJA MENOR -> banco es PARTIDA DOBLE:
 *   - 1 fila CRÉDITO a CAJA MENOR (cuenta 11050500)
 *   - 1 fila DÉBITO a "banco de Bogotá corriente" (cuenta 11100507)
 * El MONTO del traslado = columna TOTAL en la fila del banco. No se suman ambas filas.
 *
 * Orden exacto de columnas (índice 0..11):
 *   0 NO COMPROBANTE, 1 FACTURA, 2 FECHA, 3 TIPO COMPROBANTE, 4 FORMA DE PAGO,
 *   5 CUENTA, 6 DESCRIPCION, 7 SUC, 8 TERCERO, 9 DEBITO, 10 CREDITO, 11 TOTAL.
 */
export function parseComprobantes(buffer: Buffer): ParseResult<ComprobanteData> {
  const { headers, rows } = readSheet(buffer);

  const parsed: ParsedRow<ComprobanteData>[] = [];
  const periodosSet = new Set<string>();

  // Agrupa por noComprobante para validar la partida doble.
  const grupos = new Map<string, ParsedRow<ComprobanteData>[]>();

  rows.forEach((row, i) => {
    if (isBlankRow(row)) return;

    // Ignora filas de totales (ej. "VALOR TOTAL" / "TOTAL").
    const joined = norm(row.join(" "));
    if (/\b(valor\s+total|total\s+general)\b/.test(joined)) return;

    const data: ComprobanteData = {
      noComprobante: str(row[0]),
      factura: str(row[1]),
      fecha: toDate(row[2]),
      tipoComprobante: str(row[3]),
      formaPago: str(row[4]),
      cuenta: str(row[5]),
      descripcion: str(row[6]),
      suc: str(row[7]),
      tercero: str(row[8]),
      debito: toNum(row[9]),
      credito: toNum(row[10]),
      total: toNum(row[11]),
    };

    const raw: Record<string, unknown> = {};
    headers.forEach((h, idx) => {
      if (h) raw[h] = row[idx] ?? null;
    });

    const periodo = periodoFromDate(data.fecha);
    if (periodo) periodosSet.add(periodo);

    const alerts: Alerta[] = [];

    // Completitud: FECHA vacía (BAJA = calidad de datos).
    if (!data.fecha) {
      alerts.push({
        campo: "fecha",
        severidad: "BAJA",
        tipo: "fecha_vacia",
        mensaje: "FECHA vacía o inválida.",
      });
    }

    // NOTA: no se valida "TOTAL <= 0" por fila. En un traslado, la fila CAJA
    // MENOR lleva su valor en la columna CRÉDITO y su TOTAL es 0 (el monto del
    // traslado está en la fila del banco). La validez se verifica con el cuadre
    // débito = crédito por comprobante (más abajo), no fila por fila.

    const pr: ParsedRow<ComprobanteData> = { rowIndex: i, data, raw, alerts };
    parsed.push(pr);

    const key = data.noComprobante ?? `__sin_comprobante_${i}`;
    const arr = grupos.get(key);
    if (arr) arr.push(pr);
    else grupos.set(key, [pr]);
  });

  // Validación de partida doble por NO COMPROBANTE: el total DÉBITO (banco) debe
  // igualar el total CRÉDITO (caja menor). Puede haber varias filas a cada lado;
  // lo que importa es que los totales cuadren. Solo alerta si NO cuadran.
  for (const [, filas] of grupos) {
    const totalDebito = filas.reduce((s, f) => s + (f.data.debito ?? 0), 0);
    const totalCredito = filas.reduce((s, f) => s + (f.data.credito ?? 0), 0);

    if (totalDebito > 0 && totalCredito > 0 && Math.abs(totalDebito - totalCredito) > 1) {
      const msg = `Descuadre de traslado: total débito $${totalDebito.toLocaleString("es-CO")} ≠ total crédito $${totalCredito.toLocaleString("es-CO")}.`;
      for (const f of filas) {
        f.alerts.push({
          campo: "total",
          severidad: "ALTA",
          tipo: "descuadre_partida_doble",
          mensaje: msg,
        });
      }
    }
  }

  return {
    tipoReporte: "COMPROBANTES",
    rows: parsed,
    periodos: [...periodosSet].sort(),
    opticas: [],
  };
}
