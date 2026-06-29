import type { Alerta, TipoReporte } from "@/lib/audit-types";

/** Resultado de parsear un reporte. T = forma de fila tipada (camelCase, ~ Prisma). */
export interface ParseResult<T> {
  tipoReporte: TipoReporte;
  rows: ParsedRow<T>[];
  /** Períodos YYYY-MM detectados en el archivo (normalmente 1). */
  periodos: string[];
  /** Ópticas detectadas (vacío si el reporte no trae óptica, ej. Gastos). */
  opticas: string[];
}

export interface ParsedRow<T> {
  rowIndex: number;
  data: T;
  raw: Record<string, unknown>;
  alerts: Alerta[];
}

// ── Formas tipadas por reporte (coinciden con los modelos Prisma) ──

export interface VentaDetalladaData {
  optica: string;
  grupo: string | null;
  fecha: Date | null;
  hora: string | null;
  tipoDocumento: string | null;
  consecutivo: string | null;
  tipoMovimiento: string | null;
  atendidoPor: string | null;
  optometra: string | null;
  estado: string | null;
  codigoSucursal: string | null;
  documento: string | null;
  nombres: string | null;
  telefono: string | null;
  motivoVisita: string | null;
  idProducto: string | null;
  tipoProducto: string | null;
  categoria: string | null;
  referencia: string | null;
  marca: string | null;
  cantidad: number | null;
  precioLista: number | null;
  costoCompra: number | null;
  descuento: number | null;
  precioVenta: number | null;
  metodoPago: string | null;
  autorizacion: string | null;
  factura: string | null;
  ventasTotales: number | null;
  saldoAnterior: number | null;
  abono: number | null;
  abonoReciboCaja: number | null;
  abonoReciboCajaEmp: number | null;
  totalRecaudo: number | null;
  valorCanje: number | null;
  saldoActual: number | null;
}

export interface PedidoLenteData {
  pedidoId: string | null;
  orden: string | null;
  fechaEntrega: string | null;
  producto: string | null;
  productoId: string | null;
  laboratorio: string | null;
  ordenLaboratorio: string | null;
  factura: string | null;
  fechaOrden: Date | null;
  valor: number | null;
  estado: string | null;
}

export interface GastoData {
  noGastos: string | null;
  factura: string | null;
  fecha: Date | null;
  estado: string | null;
  cuenta: string | null;
  descripcion: string | null;
  descripcionCuenta: string | null;
  tercero: string | null;
  valor: number | null;
  dc: string | null;
  total: number | null;
  abono: number | null;
  saldo: number | null;
}

export interface ComprobanteData {
  noComprobante: string | null;
  factura: string | null;
  fecha: Date | null;
  tipoComprobante: string | null;
  formaPago: string | null;
  cuenta: string | null;
  descripcion: string | null;
  suc: string | null;
  tercero: string | null;
  debito: number | null;
  credito: number | null;
  total: number | null;
}

export interface PagoProveedorData {
  pago: string | null;
  fecha: Date | null;
  observaciones: string | null;
  comprobante: string | null;
  noFactura: string | null;
  proveedor: string | null;
  cuenta: string | null;
  descripcion: string | null;
  debito: number | null;
  credito: number | null;
  usuario: string | null;
}

export interface CuentaPorPagarData {
  comprobante: string | null;
  comprobanteNum: string | null;
  fecha: Date | null;
  noFactura: string | null;
  proveedor: string | null;
  cuenta: string | null;
  descripcion: string | null;
  total: number | null;
}
