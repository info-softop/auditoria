import { test } from "node:test";
import assert from "node:assert";
import * as XLSX from "xlsx";
import { parseVentaDetallada } from "./venta-detallada";
import { detectReportType } from "./detect";

/**
 * P-1: los parsers deben resolver columnas por NOMBRE de encabezado, no por
 * posición fija. Estos tests construyen una hoja con columnas REORDENADAS y una
 * columna EXTRA insertada: con el parser posicional viejo los campos quedaban
 * desplazados (fallaba); con el mapeo por nombre quedan correctos (pasa).
 */

/** Valores conocidos de una fila de Venta Detallada, indexados por encabezado. */
const VALUES: Record<string, unknown> = {
  "ÓPTICA": "Óptica Test",
  "GRUPO": "Cali",
  "FECHA": new Date(Date.UTC(2026, 5, 15)),
  "HORA": "10:00:00",
  "TIPO DOCUMENTO": "ORDEN DE VENTA",
  "CONSECUTIVO": "99001",
  "TIPO MOVIMIENTO": "Venta",
  "ATENDIDO POR": "Ana",
  "OPTOMETRA": "Dr X",
  "ESTADO": "Pagado",
  "CODIGO DE SUCURSAL": "001",
  "DOCUMENTO": "123",
  "NOMBRES Y APELLIDOS": "Cliente Test",
  "TELEFONO": "300",
  "MOTIVO DE VISITA": "Control",
  "ID PRODUCTO": "555",
  "TIPO PRODUCTO": "Monturas",
  "CATEGORIA": "Cat",
  "REFERENCIA": "Ref",
  "MARCA": "Marca",
  "CANTIDAD": 3,
  "PRECIO DE LISTA": 100000,
  "COSTO DE COMPRA PRODUCTO": 40000,
  "DESCUENTO": 0,
  "PRECIO DE VENTA PRODUCTO": 90000,
  "METODO DE PAGO": "EFECTIVO",
  "AUTORIZACION": "A1",
  "FACTURA": "F1",
  "VENTAS TOTALES": 270000,
  "SALDO ANTERIOR": 0,
  "ABONO": 270000,
  "ABONO RECIBO DE CAJA": 0,
  "ABONO RECIBO DE CAJA EMPRESARIAL": 0,
  "TOTAL RECAUDO": 270000,
  "VALOR CANJE RECIBO DE CAJA": 0,
  "SALDO ACTUAL": 0,
};

const CANONICAL = Object.keys(VALUES);

/** Construye un buffer XLSX a partir de un orden de encabezados y filas alineadas. */
function makeXlsx(headerOrder: string[], rows: unknown[][]): Buffer {
  const aoa = [headerOrder, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/** Fila de datos alineada a un orden de encabezados (la columna extra va vacía). */
function rowFor(headerOrder: string[]): unknown[] {
  return headerOrder.map((h) => (h in VALUES ? VALUES[h] : "IGNORAR"));
}

test("P-1: mapea por nombre con columnas reordenadas + columna extra", () => {
  // Orden invertido y una columna EXTRA insertada en medio.
  const reordered = [...CANONICAL].reverse();
  reordered.splice(5, 0, "COLUMNA EXTRA SOFTOP");

  const buffer = makeXlsx(reordered, [rowFor(reordered)]);

  // La detección por presencia debe seguir reconociéndolo como Venta Detallada.
  assert.strictEqual(detectReportType(reordered), "VENTA_DETALLADA");

  const result = parseVentaDetallada(buffer);
  assert.strictEqual(result.rows.length, 1);
  const d = result.rows[0].data;

  // Campos repartidos por TODA la fila: si se mapeara por posición, estarían cruzados.
  assert.strictEqual(d.optica, "Óptica Test");
  assert.strictEqual(d.consecutivo, "99001");
  assert.strictEqual(d.tipoMovimiento, "Venta");
  assert.strictEqual(d.tipoProducto, "Monturas");
  assert.strictEqual(d.cantidad, 3);
  assert.strictEqual(d.precioLista, 100000);
  assert.strictEqual(d.costoCompra, 40000);
  assert.strictEqual(d.precioVenta, 90000);
  assert.strictEqual(d.ventasTotales, 270000);
  assert.strictEqual(d.totalRecaudo, 270000);
  assert.strictEqual(d.saldoActual, 0);
  assert.strictEqual(d.metodoPago, "EFECTIVO");
  assert.ok(d.fecha instanceof Date);
  assert.strictEqual(d.fecha?.getUTCMonth(), 5); // junio
  assert.strictEqual(result.periodos[0], "2026-06");
});

test("P-1: aborta (fail-loud) si falta una columna esperada", () => {
  // Quita una columna requerida (PRECIO DE VENTA PRODUCTO) — no debe cargar
  // datos desplazados, debe lanzar con un mensaje claro.
  const sinColumna = CANONICAL.filter((h) => h !== "PRECIO DE VENTA PRODUCTO");
  const buffer = makeXlsx(sinColumna, [rowFor(sinColumna)]);

  assert.throws(
    () => parseVentaDetallada(buffer),
    /faltan columnas esperadas.*PRECIO DE VENTA PRODUCTO/,
    "debe abortar nombrando la columna faltante"
  );
});
