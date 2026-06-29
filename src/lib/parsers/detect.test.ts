import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { detectReportType, detectReportTypeFromBuffer } from "@/lib/parsers/detect";
import { readSheet } from "@/lib/parsers/utils";
import type { TipoReporte } from "@/lib/audit-types";

const SAMPLES_DIR = path.join(
  "/Users/diegovalencia/Dropbox/Claude Code/Auditoria-Opticas",
  "samples"
);

// Cada sample real con su tipo esperado.
const CASOS: Array<{ file: string; tipo: TipoReporte }> = [
  { file: "venta-detallada.xlsx", tipo: "VENTA_DETALLADA" },
  { file: "pedido-lentes.xlsx", tipo: "PEDIDO_LENTES" },
  { file: "gastos.xlsx", tipo: "GASTOS" },
  { file: "comprobantes.xlsx", tipo: "COMPROBANTES" },
  { file: "pagos-proveedores.xlsx", tipo: "PAGOS_PROVEEDORES" },
  { file: "cuanto-debo.xlsx", tipo: "CUENTAS_POR_PAGAR" },
];

for (const { file, tipo } of CASOS) {
  test(`detectReportType identifica ${file} como ${tipo}`, () => {
    const buf = fs.readFileSync(path.join(SAMPLES_DIR, file));
    const { headers } = readSheet(buf);
    assert.strictEqual(
      detectReportType(headers),
      tipo,
      `Encabezados: ${JSON.stringify(headers)}`
    );
    // También por el helper que lee el buffer directamente.
    assert.strictEqual(detectReportTypeFromBuffer(buf), tipo);
  });
}

test("PAGOS_PROVEEDORES y CUENTAS_POR_PAGAR (ambos hoja ReportePagos) se distinguen", () => {
  const pagos = readSheet(
    fs.readFileSync(path.join(SAMPLES_DIR, "pagos-proveedores.xlsx"))
  ).headers;
  const cuanto = readSheet(
    fs.readFileSync(path.join(SAMPLES_DIR, "cuanto-debo.xlsx"))
  ).headers;

  // PagosProveedores tiene la columna PAGO; CuantoDebo no.
  assert.ok(pagos.map((h) => h.toUpperCase()).includes("PAGO"));
  assert.ok(!cuanto.map((h) => h.toUpperCase()).includes("PAGO"));

  assert.strictEqual(detectReportType(pagos), "PAGOS_PROVEEDORES");
  assert.strictEqual(detectReportType(cuanto), "CUENTAS_POR_PAGAR");
});

test("detectReportType devuelve null para encabezados desconocidos", () => {
  assert.strictEqual(detectReportType(["FOO", "BAR", "BAZ"]), null);
  assert.strictEqual(detectReportType([]), null);
});
