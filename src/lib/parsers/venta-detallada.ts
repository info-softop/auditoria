import type { Alerta } from "@/lib/audit-types";
import type { ParseResult, ParsedRow, VentaDetalladaData } from "./types";
import {
  isBlankRow,
  norm,
  periodoFromDate,
  readSheet,
  resolveColumns,
  str,
  toDate,
  toNum,
} from "./utils";

/**
 * Período (YYYY-MM) desde el cual se monitorea el "descuento excesivo".
 * Enero–mayo 2026 ya fueron revisados por el cliente y se omiten; junio 2026
 * en adelante se deja la alerta para revisión. Es un corte histórico fijo
 * (no "mes actual"): no cambia con el tiempo.
 */
const DESCUENTO_EXCESIVO_DESDE = "2026-06";

/** Encabezados esperados por índice (orden exacto de PROMPT.md). */
const HEADERS = [
  "ÓPTICA",
  "GRUPO",
  "FECHA",
  "HORA",
  "TIPO DOCUMENTO",
  "CONSECUTIVO",
  "TIPO MOVIMIENTO",
  "ATENDIDO POR",
  "OPTOMETRA",
  "ESTADO",
  "CODIGO DE SUCURSAL",
  "DOCUMENTO",
  "NOMBRES Y APELLIDOS",
  "TELEFONO",
  "MOTIVO DE VISITA",
  "ID PRODUCTO",
  "TIPO PRODUCTO",
  "CATEGORIA",
  "REFERENCIA",
  "MARCA",
  "CANTIDAD",
  "PRECIO DE LISTA",
  "COSTO DE COMPRA PRODUCTO",
  "DESCUENTO",
  "PRECIO DE VENTA PRODUCTO",
  "METODO DE PAGO",
  "AUTORIZACION",
  "FACTURA",
  "VENTAS TOTALES",
  "SALDO ANTERIOR",
  "ABONO",
  "ABONO RECIBO DE CAJA",
  "ABONO RECIBO DE CAJA EMPRESARIAL",
  "TOTAL RECAUDO",
  "VALOR CANJE RECIBO DE CAJA",
  "SALDO ACTUAL",
];

/** Métodos de pago válidos (catálogo), normalizados con norm(). */
const METODOS_PAGO_VALIDOS = new Set(
  [
    "EFECTIVO",
    "TARJETA CREDITO",
    "TARJETA DEBITO",
    "TRANSFERENCIA AVAL",
    "TRANSFERENCIA BOGOTA",
    "BANCOLOMBIA",
    "BANCOLOMBIA 0457_OPTICA",
    "CREDITO ADDI",
  ].map(norm),
);

/** Tipos de producto que se consideran "lente" para la regla de costo cero. */
const TIPOS_LENTE = new Set(["lentes oftalmicos", "lentes de contacto"].map(norm));

/** Detecta filas de totales (ej. "VALOR TOTAL", "TOTAL"). */
function isTotalRow(row: unknown[]): boolean {
  const first = norm(row[0]);
  return first.includes("valor total") || first === "total" || first.startsWith("total ");
}

export function parseVentaDetallada(
  buffer: Buffer,
): ParseResult<VentaDetalladaData> {
  const { headers, rows } = readSheet(buffer);
  // Resuelve columnas por NOMBRE (no por posición): tolera reordenamientos/columnas
  // extra de Softop y aborta si falta alguna esperada. `col[k]` = posición real de
  // HEADERS[k] en la hoja.
  const col = resolveColumns(headers, HEADERS, "Venta Detallada");

  const parsedRows: ParsedRow<VentaDetalladaData>[] = [];
  const periodosSet = new Set<string>();
  const opticasSet = new Set<string>();

  rows.forEach((row, i) => {
    if (isBlankRow(row) || isTotalRow(row)) return;

    const fecha = toDate(row[col[2]]);
    const cantidad = toNum(row[col[20]]);
    const precioLista = toNum(row[col[21]]);
    const costoCompra = toNum(row[col[22]]);
    const descuento = toNum(row[col[23]]);
    const precioVenta = toNum(row[col[24]]);
    const saldoActual = toNum(row[col[35]]);

    const data: VentaDetalladaData = {
      optica: str(row[col[0]]) ?? "",
      grupo: str(row[col[1]]),
      fecha,
      hora: str(row[col[3]]),
      tipoDocumento: str(row[col[4]]),
      consecutivo: str(row[col[5]]),
      tipoMovimiento: str(row[col[6]]),
      atendidoPor: str(row[col[7]]),
      optometra: str(row[col[8]]),
      estado: str(row[col[9]]),
      codigoSucursal: str(row[col[10]]),
      documento: str(row[col[11]]),
      nombres: str(row[col[12]]),
      telefono: str(row[col[13]]),
      motivoVisita: str(row[col[14]]),
      idProducto: str(row[col[15]]),
      tipoProducto: str(row[col[16]]),
      categoria: str(row[col[17]]),
      referencia: str(row[col[18]]),
      marca: str(row[col[19]]),
      cantidad,
      precioLista,
      costoCompra,
      descuento,
      precioVenta,
      metodoPago: str(row[col[25]]),
      autorizacion: str(row[col[26]]),
      factura: str(row[col[27]]),
      ventasTotales: toNum(row[col[28]]),
      saldoAnterior: toNum(row[col[29]]),
      abono: toNum(row[col[30]]),
      abonoReciboCaja: toNum(row[col[31]]),
      abonoReciboCajaEmp: toNum(row[col[32]]),
      totalRecaudo: toNum(row[col[33]]),
      valorCanje: toNum(row[col[34]]),
      saldoActual,
    };

    const raw: Record<string, unknown> = {};
    HEADERS.forEach((h, idx) => {
      raw[h] = row[col[idx]] ?? null;
    });

    const alerts: Alerta[] = [];

    // ── Completitud ──
    if (!data.motivoVisita) {
      alerts.push({
        campo: "motivoVisita",
        severidad: "BAJA",
        tipo: "motivo_visita_vacio",
        mensaje: "Motivo de visita vacío.",
      });
    }

    // ── Cartera: Por Cancelar con saldo pendiente ──
    if (norm(data.estado) === norm("Por Cancelar") && saldoActual > 0) {
      alerts.push({
        campo: "saldoActual",
        severidad: "ALTA",
        tipo: "cartera_pendiente",
        mensaje: `Estado "Por Cancelar" con saldo actual ${saldoActual} > 0 (cartera pendiente).`,
      });
    }

    // ── Descuento ──
    const baseDescuento = precioLista * cantidad;
    if (descuento > baseDescuento && baseDescuento > 0) {
      alerts.push({
        campo: "descuento",
        severidad: "ALTA",
        tipo: "descuento_imposible",
        mensaje: `Descuento ${descuento} mayor que precio de lista × cantidad (${baseDescuento}).`,
      });
    } else if (
      descuento > 0.3 * baseDescuento &&
      baseDescuento > 0 &&
      // El descuento excesivo se monitorea desde junio 2026 en adelante
      // (los períodos anteriores ya fueron revisados — decisión del cliente).
      (periodoFromDate(fecha) ?? "") >= DESCUENTO_EXCESIVO_DESDE
    ) {
      alerts.push({
        campo: "descuento",
        severidad: "ALTA",
        tipo: "descuento_excesivo",
        mensaje: `Descuento ${descuento} supera el 30% de precio de lista × cantidad (${baseDescuento}).`,
      });
    }

    // ── Venta a pérdida ──
    if (precioVenta < costoCompra) {
      alerts.push({
        campo: "precioVenta",
        severidad: "ALTA",
        tipo: "venta_perdida",
        mensaje: `Precio de venta ${precioVenta} menor que costo de compra ${costoCompra} (venta a pérdida).`,
      });
    }

    // ── Costo cero en lentes ──
    if (costoCompra === 0 && TIPOS_LENTE.has(norm(data.tipoProducto))) {
      alerts.push({
        campo: "costoCompra",
        severidad: "ALTA",
        tipo: "costo_cero_lente",
        mensaje: `Costo de compra en 0 para ${data.tipoProducto} (lente sin costo registrado).`,
      });
    }

    // ── Cantidad ──
    if (cantidad <= 0) {
      alerts.push({
        campo: "cantidad",
        severidad: "ALTA",
        tipo: "cantidad_invalida",
        mensaje: `Cantidad ${cantidad} ≤ 0.`,
      });
    }

    // ── Método de pago fuera de catálogo ──
    if (data.metodoPago && !METODOS_PAGO_VALIDOS.has(norm(data.metodoPago))) {
      alerts.push({
        campo: "metodoPago",
        severidad: "MEDIA",
        tipo: "metodo_pago_invalido",
        mensaje: `Método de pago "${data.metodoPago}" fuera de catálogo.`,
      });
    }

    if (fecha) {
      const p = periodoFromDate(fecha);
      if (p) periodosSet.add(p);
    }
    if (data.optica) opticasSet.add(data.optica);

    parsedRows.push({ rowIndex: i, data, raw, alerts });
  });

  return {
    tipoReporte: "VENTA_DETALLADA",
    rows: parsedRows,
    periodos: [...periodosSet].sort(),
    opticas: [...opticasSet].sort(),
  };
}
