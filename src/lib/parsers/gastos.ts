import type { Alerta } from "@/lib/audit-types";
import type { GastoData, ParseResult, ParsedRow } from "./types";
import {
  isBlankRow,
  norm,
  periodoFromDate,
  readSheet,
  str,
  toDate,
  toNum,
} from "./utils";

/**
 * Parser del reporte de GASTOS OPERATIVOS (hoja "ReportePagos", 13 columnas).
 *
 * PARTIDA DOBLE: cada NO GASTOS genera exactamente 2 filas:
 *   - una fila D (Débito): cuenta de gasto real.
 *   - una fila C (Crédito): CUENTAS POR PAGAR.
 *
 * GASTO REAL = suma de las filas con D/C = 'D'. NO se debe sumar toda la
 * columna VALOR (eso duplicaría el monto, porque cada gasto aparece dos veces:
 * una en la fila D y otra en la fila C). El total económico real del reporte
 * es por tanto sum(valor donde dc === 'D').
 *
 * El reporte NO trae columna de óptica → opticas = [] (se pide al cargar).
 *
 * Mapeo de columnas por ÍNDICE (0..12):
 *   0 NO GASTOS, 1 FACTURA, 2 FECHA, 3 ESTADO, 4 CUENTA, 5 DESCRIPCION,
 *   6 DESCRIPCION DE LA CUENTA, 7 TERCERO, 8 VALOR, 9 D/C, 10 TOTAL,
 *   11 ABONO, 12 SALDO.
 */
export function parseGastos(buffer: Buffer): ParseResult<GastoData> {
  const { headers, rows } = readSheet(buffer);

  const rawHeaders = [
    "NO GASTOS",
    "FACTURA",
    "FECHA",
    "ESTADO",
    "CUENTA",
    "DESCRIPCION",
    "DESCRIPCION DE LA CUENTA",
    "TERCERO",
    "VALOR",
    "D/C",
    "TOTAL",
    "ABONO",
    "SALDO",
  ];

  const parsed: ParsedRow<GastoData>[] = [];
  const periodos = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (isBlankRow(row)) continue;

    // Saltar filas de totales (ej. "VALOR TOTAL", "TOTAL").
    const joined = norm(row.join(" "));
    const noGastosRaw = str(row[0]);
    if (
      (noGastosRaw == null && joined.includes("total")) ||
      joined.includes("valor total")
    ) {
      continue;
    }

    const fecha = toDate(row[2]);
    const dc = str(row[9]);
    const valor = toNum(row[8]);
    const saldo = toNum(row[12]);

    const data: GastoData = {
      noGastos: noGastosRaw,
      factura: str(row[1]),
      fecha,
      estado: str(row[3]),
      cuenta: str(row[4]),
      descripcion: str(row[5]),
      descripcionCuenta: str(row[6]),
      tercero: str(row[7]),
      valor,
      dc,
      total: row[10] == null ? null : toNum(row[10]),
      abono: row[11] == null ? null : toNum(row[11]),
      saldo: row[12] == null ? null : saldo,
    };

    const raw: Record<string, unknown> = {};
    for (let c = 0; c < rawHeaders.length; c++) {
      raw[rawHeaders[c] ?? headers[c] ?? `col${c}`] = row[c] ?? null;
    }

    const alerts: Alerta[] = [];

    // Completitud (BAJA): tercero / descripcion / fecha / valor vacíos.
    if (str(row[7]) == null) {
      alerts.push({
        campo: "tercero",
        severidad: "BAJA",
        tipo: "campo_vacio",
        mensaje: "El campo TERCERO está vacío.",
      });
    }
    if (str(row[5]) == null) {
      alerts.push({
        campo: "descripcion",
        severidad: "BAJA",
        tipo: "campo_vacio",
        mensaje: "El campo DESCRIPCION está vacío.",
      });
    }
    if (fecha == null) {
      alerts.push({
        campo: "fecha",
        severidad: "BAJA",
        tipo: "campo_vacio",
        mensaje: "El campo FECHA está vacío o es inválido.",
      });
    }
    if (row[8] == null || String(row[8]).trim() === "") {
      alerts.push({
        campo: "valor",
        severidad: "BAJA",
        tipo: "campo_vacio",
        mensaje: "El campo VALOR está vacío.",
      });
    }

    // Financiera (ALTA): VALOR <= 0.
    if (valor <= 0) {
      alerts.push({
        campo: "valor",
        severidad: "ALTA",
        tipo: "valor_no_positivo",
        mensaje: `El VALOR debe ser mayor que cero (encontrado: ${valor}).`,
      });
    }

    // Financiera (MEDIA): SALDO != 0 en la fila C (gasto no saldado).
    if (dc != null && dc.toUpperCase() === "C" && saldo !== 0) {
      alerts.push({
        campo: "saldo",
        severidad: "MEDIA",
        tipo: "gasto_no_saldado",
        mensaje: `Gasto no saldado: la fila C tiene SALDO ${saldo} (debería ser 0).`,
      });
    }

    if (fecha) {
      const p = periodoFromDate(fecha);
      if (p) periodos.add(p);
    }

    parsed.push({ rowIndex: i, data, raw, alerts });
  }

  // NOTA: en el reporte de Gastos la columna VALOR trae el TOTAL del gasto
  // repetido en cada fila (no el monto por línea: el desglose base+IVA solo está
  // en el documento impreso). Por eso NO se valida partida doble aquí — sumar D
  // vs C daría falsos descuadres en gastos con varias líneas. La verificación de
  // partida doble sí aplica en Comprobantes y Pagos (que traen Débito/Crédito).

  return {
    tipoReporte: "GASTOS",
    rows: parsed,
    periodos: Array.from(periodos).sort(),
    opticas: [], // El reporte de Gastos NO trae columna de óptica.
  };
}
