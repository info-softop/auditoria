// Tipos compartidos del sistema de auditoría.

export type Severidad = "ALTA" | "MEDIA" | "BAJA";

export interface Alerta {
  campo: string; // campo o regla afectada
  severidad: Severidad;
  tipo: string; // identificador corto, ej. "costo_cero_lente"
  mensaje: string; // descripción legible en español
}

export type TipoReporte =
  | "VENTA_DETALLADA"
  | "PEDIDO_LENTES"
  | "GASTOS"
  | "COMPROBANTES"
  | "PAGOS_PROVEEDORES"
  | "CUENTAS_POR_PAGAR";

export const TIPO_REPORTE_LABEL: Record<TipoReporte, string> = {
  VENTA_DETALLADA: "Venta Detallada",
  PEDIDO_LENTES: "Pedido de Lentes",
  GASTOS: "Gastos Operativos",
  COMPROBANTES: "Comprobantes / Traslados",
  PAGOS_PROVEEDORES: "Pagos a Proveedores",
  CUENTAS_POR_PAGAR: "Cuentas por Pagar",
};

export const SEVERIDAD_ORDER: Record<Severidad, number> = {
  ALTA: 0,
  MEDIA: 1,
  BAJA: 2,
};

// Orden recomendado de carga.
export const TIPO_REPORTE_ORDEN: TipoReporte[] = [
  "VENTA_DETALLADA",
  "PEDIDO_LENTES",
  "GASTOS",
  "COMPROBANTES",
  "PAGOS_PROVEEDORES",
  "CUENTAS_POR_PAGAR",
];

// Dónde encontrar cada reporte dentro de Softop (ruta de navegación).
export const TIPO_REPORTE_ORIGEN: Record<TipoReporte, string> = {
  VENTA_DETALLADA: "Multisede › Venta detallada (todas las ópticas)",
  PEDIDO_LENTES: "Laboratorios › Pedido de lentes › Reporte",
  GASTOS: "Finanzas › Reportes › Gasto",
  COMPROBANTES: "Finanzas › Reporte › Comprobante de ajuste / Traslado",
  PAGOS_PROVEEDORES: "Finanzas › Reporte de pagos",
  CUENTAS_POR_PAGAR: "Finanzas › Cuánto debo",
};
