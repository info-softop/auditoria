import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { parseGastos } from "./gastos";

const SAMPLE = path.resolve(process.cwd(), "samples/gastos.xlsx");

test("parseGastos: parsea el sample real", () => {
  const buffer = fs.readFileSync(SAMPLE);
  const res = parseGastos(buffer);

  // tipoReporte y opticas vacío (no trae columna óptica).
  assert.strictEqual(res.tipoReporte, "GASTOS");
  assert.deepStrictEqual(res.opticas, []);

  // Número de filas de datos (18 filas: 9 gastos x 2 = D + C).
  assert.strictEqual(res.rows.length, 18);

  // Mapeo correcto de campos clave en la primera fila (D).
  const first = res.rows[0].data;
  assert.strictEqual(first.noGastos, "2864");
  assert.strictEqual(first.dc, "D");
  assert.strictEqual(first.valor, 25000);
  assert.strictEqual(first.tercero, "HILDER BERNAL");
  assert.ok(first.fecha instanceof Date);

  // Período derivado de las fechas (junio 2026).
  assert.ok(res.periodos.includes("2026-06"));
});

test("parseGastos: partida doble cuadrada no genera alerta partida_doble", () => {
  const buffer = fs.readFileSync(SAMPLE);
  const res = parseGastos(buffer);
  const partidaDoble = res.rows.flatMap((r) =>
    r.alerts.filter((a) => a.tipo === "partida_doble"),
  );
  // El sample real está cuadrado, así que no debería disparar.
  assert.strictEqual(partidaDoble.length, 0);
});

test("parseGastos: dispara al menos una regla de auditoría (valor<=0)", () => {
  // Construimos un caso sintético con VALOR negativo manipulando el buffer no
  // es trivial; en su lugar verificamos la lógica con datos del sample alterados.
  // Reusamos la función sobre el sample y forzamos una regla conocida:
  // verificamos que la maquinaria de alertas funciona inyectando un grupo roto.
  const buffer = fs.readFileSync(SAMPLE);
  const res = parseGastos(buffer);

  // Al menos debe existir el mecanismo de alertas (array presente en cada fila).
  assert.ok(res.rows.every((r) => Array.isArray(r.alerts)));

  // Verificamos la regla valor<=0 de forma determinista con un XLSX sintético.
  const aoa = [
    [
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
    ],
    // Gasto 9001: fila D con valor 0 (dispara valor_no_positivo ALTA),
    // y fila C con saldo != 0 (dispara gasto_no_saldado MEDIA).
    [9001, "F1", "2026-06-01", "Pagado", 5300, "GASTO", "CTA", "PROVEEDOR X", 0, "D", null, null, null],
    [9001, "F1", "2026-06-01", "Pagado", 2335, "CUENTAS POR PAGAR", "CTA", "PROVEEDOR X", 0, "C", 0, 0, 500],
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "ReportePagos");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  const res2 = parseGastos(buf);
  const tipos = res2.rows.flatMap((r) => r.alerts.map((a) => a.tipo));
  assert.ok(tipos.includes("valor_no_positivo"), "debe disparar valor_no_positivo");
  assert.ok(tipos.includes("gasto_no_saldado"), "debe disparar gasto_no_saldado");
});
