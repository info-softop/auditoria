import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { parseComprobantes } from "@/lib/parsers/comprobantes";

const SAMPLE = path.resolve(process.cwd(), "samples/comprobantes.xlsx");

test("parseComprobantes: mapea el sample real (8 filas = 4 traslados)", () => {
  const buf = fs.readFileSync(SAMPLE);
  const result = parseComprobantes(buf);

  assert.strictEqual(result.tipoReporte, "COMPROBANTES");
  // 8 filas de datos (4 traslados x 2 filas de partida doble).
  assert.strictEqual(result.rows.length, 8);
  assert.deepStrictEqual(result.opticas, []);
  assert.ok(result.periodos.includes("2026-06"));

  // Mapeo de campos clave: fila 0 = CAJA MENOR (crédito), fila 1 = banco (débito).
  const caja = result.rows[0].data;
  assert.strictEqual(caja.noComprobante, "10558");
  assert.strictEqual(caja.cuenta, "11050500");
  assert.strictEqual(caja.credito, 500000);
  assert.strictEqual(caja.debito, 0);

  const banco = result.rows[1].data;
  assert.strictEqual(banco.cuenta, "11100507");
  assert.strictEqual(banco.debito, 500000);
  assert.strictEqual(banco.total, 500000);

  // El sample real está cuadrado: ninguna alerta de descuadre ni partida incompleta.
  const todasAlertas = result.rows.flatMap((r) => r.alerts);
  assert.strictEqual(
    todasAlertas.filter((a) => a.tipo === "descuadre_partida_doble").length,
    0,
  );
  assert.strictEqual(
    todasAlertas.filter((a) => a.tipo === "partida_doble_incompleta").length,
    0,
  );
});

test("parseComprobantes: dispara descuadre cuando débito banco != crédito caja", () => {
  // Construye un libro con un traslado descuadrado: caja crédito 500000, banco débito 400000.
  const aoa = [
    [
      "NO COMPROBANTE",
      "FACTURA",
      "FECHA",
      "TIPO COMPROBANTE",
      "FORMA DE PAGO",
      "CUENTA",
      "DESCRIPCION",
      "SUC",
      "TERCERO",
      "DEBITO",
      "CREDITO",
      "TOTAL",
    ],
    [
      99001,
      2026060101,
      "2026-06-01 10:00:00",
      "Ajuste",
      null,
      11050500,
      "CAJA MENOR",
      "N/A",
      null,
      null,
      500000,
      null,
    ],
    [
      99001,
      2026060101,
      "2026-06-01 10:00:00",
      "Ajuste",
      null,
      11100507,
      "banco de Bogotá corriente",
      "N/A",
      null,
      400000,
      null,
      400000,
    ],
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "ReporteComprobantes");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  const result = parseComprobantes(buf);
  assert.strictEqual(result.rows.length, 2);

  const descuadres = result.rows
    .flatMap((r) => r.alerts)
    .filter((a) => a.tipo === "descuadre_partida_doble" && a.severidad === "ALTA");
  // Una alerta en la fila caja y otra en la fila banco.
  assert.strictEqual(descuadres.length, 2);
});
