import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { parseVentaDetallada } from "./venta-detallada";

const SAMPLE = path.resolve(
  process.cwd(),
  "samples/venta-detallada.xlsx",
);

test("parseVentaDetallada parsea el sample real", () => {
  const buffer = fs.readFileSync(SAMPLE);
  const result = parseVentaDetallada(buffer);

  // tipoReporte correcto
  assert.strictEqual(result.tipoReporte, "VENTA_DETALLADA");

  // número de filas (~274 filas de datos, sin encabezado)
  assert.strictEqual(result.rows.length, 274);

  // mapeo correcto de campos clave en la primera fila
  const first = result.rows[0].data;
  assert.strictEqual(first.optica, "Óptica Medica");
  assert.strictEqual(first.consecutivo, "28995");
  assert.strictEqual(first.cantidad, 2);
  assert.strictEqual(first.precioVenta, 280000);
  assert.strictEqual(first.tipoProducto, "Lentes Oftalmicos");
  assert.ok(first.fecha instanceof Date);

  // períodos y ópticas
  assert.ok(result.periodos.length >= 1);
  assert.ok(result.periodos.every((p) => /^\d{4}-\d{2}$/.test(p)));
  assert.ok(result.opticas.length >= 1);
});

test("dispara reglas de auditoría", () => {
  const buffer = fs.readFileSync(SAMPLE);
  const result = parseVentaDetallada(buffer);

  const allAlerts = result.rows.flatMap((r) => r.alerts);
  assert.ok(allAlerts.length > 0, "debe haber al menos una alerta");

  // costo_cero_lente: primera fila es Lentes Oftalmicos con costoCompra 0
  const firstAlerts = result.rows[0].alerts;
  assert.ok(
    firstAlerts.some((a) => a.tipo === "costo_cero_lente"),
    "primera fila debe disparar costo_cero_lente",
  );

  // cartera_pendiente: primera fila Por Cancelar con saldoActual 180000
  assert.ok(
    firstAlerts.some(
      (a) => a.tipo === "cartera_pendiente" && a.severidad === "ALTA",
    ),
    "primera fila debe disparar cartera_pendiente ALTA",
  );

  // descuento_excesivo: existe al menos una fila con descuento > 30%
  assert.ok(
    allAlerts.some((a) => a.tipo === "descuento_excesivo"),
    "debe existir al menos una alerta descuento_excesivo",
  );
});
