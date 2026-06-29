import type { TipoReporte } from "@/lib/audit-types";
import type {
  ParseResult,
  VentaDetalladaData,
  PedidoLenteData,
  GastoData,
  ComprobanteData,
  PagoProveedorData,
  CuentaPorPagarData,
} from "@/lib/parsers/types";
import { readSheet } from "@/lib/parsers/utils";

// Los 6 parsers viven cada uno en su propio archivo dentro de src/lib/parsers/.
// Se importan por nombre; los archivos los crean otros agentes en paralelo.
import { parseVentaDetallada } from "@/lib/parsers/venta-detallada";
import { parsePedidoLentes } from "@/lib/parsers/pedido-lentes";
import { parseGastos } from "@/lib/parsers/gastos";
import { parseComprobantes } from "@/lib/parsers/comprobantes";
import { parsePagosProveedores } from "@/lib/parsers/pagos-proveedores";
import { parseCuantoDebo } from "@/lib/parsers/cuanto-debo";

/** Normaliza un encabezado para comparación: mayúsculas, sin espacios extra. */
function normHeader(h: string): string {
  return String(h ?? "")
    .toUpperCase()
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Identifica el tipo de reporte a partir de las firmas de encabezados.
 *
 * Varios archivos comparten el nombre de hoja "ReportePagos", por lo que la
 * detección se hace SOLO por encabezados, nunca por el nombre de la hoja.
 *
 * Firmas (encabezados únicos por reporte):
 *  - VENTA_DETALLADA:    CONSECUTIVO + VENTAS TOTALES
 *  - PEDIDO_LENTES:      ORDEN + LABORATORIO + VALOR
 *  - GASTOS:             NO GASTOS + D/C
 *  - COMPROBANTES:       NO COMPROBANTE + DEBITO + CREDITO
 *  - PAGOS_PROVEEDORES:  PAGO + COMPROBANTE + NO.FACTURA + PROVEEDOR  (tiene PAGO / Debito)
 *  - CUENTAS_POR_PAGAR:  COMPROBANTE + NO.FACTURA + PROVEEDOR + TOTAL, SIN PAGO ni D/C
 *
 * Para distinguir PagosProveedores de CuantoDebo (ambos hoja "ReportePagos"):
 * la presencia de la columna PAGO (y Debito) indica PagosProveedores.
 */
export function detectReportType(headers: string[]): TipoReporte | null {
  const set = new Set(headers.map(normHeader));
  const has = (...cols: string[]) => cols.every((c) => set.has(normHeader(c)));

  // VENTA_DETALLADA: CONSECUTIVO + VENTAS TOTALES (firma claramente única)
  if (has("CONSECUTIVO", "VENTAS TOTALES")) {
    return "VENTA_DETALLADA";
  }

  // GASTOS: NO GASTOS + D/C (partida doble con columna D/C)
  if (has("NO GASTOS", "D/C")) {
    return "GASTOS";
  }

  // COMPROBANTES: NO COMPROBANTE + DEBITO + CREDITO
  if (has("NO COMPROBANTE", "DEBITO", "CREDITO")) {
    return "COMPROBANTES";
  }

  // PEDIDO_LENTES: ORDEN + LABORATORIO + VALOR
  if (has("ORDEN", "LABORATORIO", "VALOR")) {
    return "PEDIDO_LENTES";
  }

  // PAGOS_PROVEEDORES vs CUENTAS_POR_PAGAR: ambos comparten COMPROBANTE +
  // NO.FACTURA + PROVEEDOR. La columna PAGO (o Debito) distingue PagosProveedores.
  if (has("COMPROBANTE", "NO.FACTURA", "PROVEEDOR")) {
    if (set.has(normHeader("PAGO")) || set.has(normHeader("DEBITO"))) {
      return "PAGOS_PROVEEDORES";
    }
    if (set.has(normHeader("TOTAL"))) {
      return "CUENTAS_POR_PAGAR";
    }
  }

  return null;
}

/** Lee los encabezados de la primera hoja de un buffer Excel. */
export function detectReportTypeFromBuffer(
  buffer: Buffer | ArrayBuffer
): TipoReporte | null {
  const { headers } = readSheet(buffer);
  return detectReportType(headers);
}

// Mapa de tipos de retorno por reporte (para tipado del dispatcher).
export type ParseResultByTipo = {
  VENTA_DETALLADA: ParseResult<VentaDetalladaData>;
  PEDIDO_LENTES: ParseResult<PedidoLenteData>;
  GASTOS: ParseResult<GastoData>;
  COMPROBANTES: ParseResult<ComprobanteData>;
  PAGOS_PROVEEDORES: ParseResult<PagoProveedorData>;
  CUENTAS_POR_PAGAR: ParseResult<CuentaPorPagarData>;
};

/**
 * Despacha al parser correcto según el tipo de reporte.
 * El tipo de retorno se estrecha según `tipo`.
 */
export function parseReport<T extends TipoReporte>(
  tipo: T,
  buffer: Buffer
): ParseResultByTipo[T];
export function parseReport(
  tipo: TipoReporte,
  buffer: Buffer
): ParseResult<unknown> {
  switch (tipo) {
    case "VENTA_DETALLADA":
      return parseVentaDetallada(buffer);
    case "PEDIDO_LENTES":
      return parsePedidoLentes(buffer);
    case "GASTOS":
      return parseGastos(buffer);
    case "COMPROBANTES":
      return parseComprobantes(buffer);
    case "PAGOS_PROVEEDORES":
      return parsePagosProveedores(buffer);
    case "CUENTAS_POR_PAGAR":
      return parseCuantoDebo(buffer);
    default: {
      const _exhaustive: never = tipo;
      throw new Error(`Tipo de reporte no soportado: ${String(_exhaustive)}`);
    }
  }
}
