import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { parsePedidoLentes } from "./pedido-lentes";

const SAMPLE = path.resolve(
  process.cwd(),
  "samples/pedido-lentes.xlsx",
);

test("parsePedidoLentes - estructura y conteo de filas", () => {
  const buffer = fs.readFileSync(SAMPLE);
  const result = parsePedidoLentes(buffer);

  assert.strictEqual(result.tipoReporte, "PEDIDO_LENTES");
  // readSheet quita el encabezado: quedan 18 filas, de las cuales 1 es "VALOR TOTAL"
  // (ignorada) → 17 pedidos.
  assert.strictEqual(result.rows.length, 17);
  assert.deepStrictEqual(result.opticas, []);
});

test("parsePedidoLentes - ignora la fila VALOR TOTAL", () => {
  const result = parsePedidoLentes(fs.readFileSync(SAMPLE));
  const tieneTotal = result.rows.some((r) =>
    Object.values(r.raw).some(
      (v) => String(v ?? "").toLowerCase().includes("valor total"),
    ),
  );
  assert.strictEqual(tieneTotal, false);
});

test("parsePedidoLentes - mapeo de campos clave y productoId", () => {
  const result = parsePedidoLentes(fs.readFileSync(SAMPLE));
  const first = result.rows[0];

  assert.strictEqual(first.data.orden, "28991");
  assert.strictEqual(first.data.producto, "21 - Bifocal invisible Delgado Especial");
  assert.strictEqual(first.data.productoId, "21");
  assert.strictEqual(first.data.fechaEntrega, "NO");
  assert.strictEqual(first.data.valor, 32500);
  assert.ok(first.data.fechaOrden instanceof Date);
});

test("parsePedidoLentes - periodos derivados de FECHA ORDEN", () => {
  const result = parsePedidoLentes(fs.readFileSync(SAMPLE));
  assert.ok(result.periodos.length >= 1);
  assert.ok(result.periodos.every((p) => /^\d{4}-\d{2}$/.test(p)));
});
