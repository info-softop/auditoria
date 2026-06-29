import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { parseCuantoDebo } from "./cuanto-debo";

/**
 * NOTA SOBRE EL SAMPLE:
 * samples/cuanto-debo.xlsx que vino en el repo NO corresponde al layout de 7
 * columnas "Compra - N" descrito en PROMPT.md sección 6: su contenido es idéntico
 * a samples/pagos-proveedores.xlsx (11 columnas: PAGO, FECHA, OBSERVACIONES,
 * COMPROBANTE, NO.FACTURA, PROVEEDOR, CUENTA, DESCRIPCION, Debito, Credito, Usuario).
 *
 * Por eso construimos un fixture en memoria con el layout REAL especificado para
 * verificar el mapeo por índice y las reglas, y además hacemos un smoke-test sobre
 * el archivo del repo para garantizar que el parser no se rompe.
 */

function buildFixtureBuffer(): Buffer {
  const aoa = [
    ["COMPROBANTE", "FECHA", "NO.FACTURA", "PROVEEDOR", "CUENTA", "DESCRIPCION", "TOTAL"],
    // Fila válida
    ["Compra - 2864", "2026-06-01", "106", "HILDER BERNAL", "23359502", "CUENTAS POR PAGAR", 25000],
    // Otra válida
    ["Compra - 10497", "2026-06-02", "177318", "GRUPO OPTICAL", "22050501", "PROVEEDORES NAC", 92000],
    // TOTAL <= 0  -> ALTA
    ["Compra - 9999", "2026-06-03", "555", "QARZO OPTICAL", "22050501", "PROVEEDORES NAC", 0],
    // COMPROBANTE sin formato "Compra - N" -> MEDIA
    ["2864", "2026-06-04", "777", "INNOVLAB", "22050501", "PROVEEDORES NAC", 15000],
    // Faltantes (comprobante, noFactura, proveedor, total) -> BAJA x4
    [null, "2026-06-05", null, null, "11050500", "CAJA MENOR", null],
    // Fila de totales -> se ignora
    [null, null, null, null, null, "VALOR TOTAL", 132000],
    // Fila vacía -> se ignora
    [null, null, null, null, null, null, null],
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "ReportePagos");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

test("parseCuantoDebo: filas, mapeo y reglas (fixture spec 7 columnas)", () => {
  const res = parseCuantoDebo(buildFixtureBuffer());

  assert.strictEqual(res.tipoReporte, "CUENTAS_POR_PAGAR");

  // 5 filas de datos (se ignoran la de totales y la vacía)
  assert.strictEqual(res.rows.length, 5);

  // Mapeo de campos clave en la primera fila
  const r0 = res.rows[0].data;
  assert.strictEqual(r0.comprobante, "Compra - 2864");
  assert.strictEqual(r0.comprobanteNum, "2864"); // prefijo removido
  assert.strictEqual(r0.noFactura, "106");
  assert.strictEqual(r0.proveedor, "HILDER BERNAL");
  assert.strictEqual(r0.total, 25000);
  assert.strictEqual(res.rows[0].alerts.length, 0);

  // Período derivado de la fecha
  assert.ok(res.periodos.includes("2026-06"));
  assert.deepStrictEqual(res.opticas, []);

  // ALTA: TOTAL <= 0 (fila índice 2)
  const altaRow = res.rows[2];
  assert.strictEqual(altaRow.data.total, 0);
  assert.ok(
    altaRow.alerts.some((a) => a.severidad === "ALTA" && a.tipo === "total_no_positivo"),
    "debe disparar ALTA por total <= 0"
  );

  // MEDIA: comprobante sin formato "Compra - N" (fila índice 3)
  const mediaRow = res.rows[3];
  assert.strictEqual(mediaRow.data.comprobante, "2864");
  assert.strictEqual(mediaRow.data.comprobanteNum, "2864");
  assert.ok(
    mediaRow.alerts.some(
      (a) => a.severidad === "MEDIA" && a.tipo === "comprobante_sin_formato_compra"
    ),
    "debe disparar MEDIA por comprobante sin formato"
  );

  // BAJA: completitud (fila índice 4) -> comprobante, noFactura, proveedor, total
  const bajaRow = res.rows[4];
  const bajas = bajaRow.alerts.filter((a) => a.severidad === "BAJA").map((a) => a.tipo);
  assert.ok(bajas.includes("comprobante_vacio"));
  assert.ok(bajas.includes("no_factura_vacio"));
  assert.ok(bajas.includes("proveedor_vacio"));
  assert.ok(bajas.includes("total_vacio"));
});

test("parseCuantoDebo: smoke-test sobre el sample del repo (no debe romperse)", () => {
  const p = path.resolve(process.cwd(), "samples/cuanto-debo.xlsx");
  const buf = fs.readFileSync(p);
  const res = parseCuantoDebo(buf);
  assert.strictEqual(res.tipoReporte, "CUENTAS_POR_PAGAR");
  assert.ok(Array.isArray(res.rows));
  // El sample del repo trae ~40 filas de datos (mislabeled como PAGOS); el parser
  // debe procesarlas todas ignorando la fila de totales final ($2.971.392).
  assert.ok(res.rows.length > 0);
});
