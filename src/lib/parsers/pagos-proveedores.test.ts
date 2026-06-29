import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { parsePagosProveedores } from "./pagos-proveedores";

const SAMPLE = path.resolve(
  process.cwd(),
  "samples/pagos-proveedores.xlsx",
);

test("parsea el sample real de pagos a proveedores", () => {
  const buf = fs.readFileSync(SAMPLE);
  const res = parsePagosProveedores(buf);

  assert.equal(res.tipoReporte, "PAGOS_PROVEEDORES");
  // 41 filas de datos (la fila de totales con "$..." se descarta).
  assert.equal(res.rows.length, 40);

  // Mapeo por índice de la primera fila (PAGO 7212, débito 25000).
  const first = res.rows[0].data;
  assert.equal(first.pago, "7212");
  assert.equal(first.proveedor, "HILDER BERNAL");
  assert.equal(first.debito, 25000);
  assert.equal(first.credito, 0);
  assert.equal(first.usuario, "JENNIFER TORRES");
  assert.ok(first.fecha instanceof Date);

  // Período derivado de las fechas (junio 2026).
  assert.ok(res.periodos.includes("2026-06"));
  // No trae óptica.
  assert.deepEqual(res.opticas, []);

  // La fila de crédito del PAGO 7212 tiene NO.FACTURA vacío.
  const credito7212 = res.rows.find(
    (r) => r.data.pago === "7212" && (r.data.credito ?? 0) > 0,
  );
  assert.ok(credito7212);
  assert.equal(credito7212!.data.noFactura, null);

  // El sample real está cuadrado: ninguna fila debe disparar descuadre.
  const descuadres = res.rows.flatMap((r) =>
    r.alerts.filter((a) => a.tipo === "descuadre_partida_doble"),
  );
  assert.equal(descuadres.length, 0);
});

test("dispara la regla de descuadre de partida doble (ALTA)", () => {
  // Construye un libro con un PAGO descuadrado: débito 100, crédito 80.
  const aoa = [
    [
      "PAGO",
      "FECHA",
      "OBSERVACIONES",
      "COMPROBANTE",
      "NO.FACTURA",
      "PROVEEDOR",
      "CUENTA",
      "DESCRIPCION",
      "Debito",
      "Credito",
      "Usuario",
    ],
    [9001, "2026-06-01", "x", 555, 10, "PROV X", 22050501, "PROVEEDORES", 100, 0, "ANA"],
    [9001, "2026-06-01", "x", 9001, null, "PROV X", 11050500, "CAJA MENOR", 0, 80, "ANA"],
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "ReportePagos");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  const res = parsePagosProveedores(buf as Buffer);
  const descuadre = res.rows
    .flatMap((r) => r.alerts)
    .find((a) => a.tipo === "descuadre_partida_doble");

  assert.ok(descuadre, "debe existir una alerta de descuadre");
  assert.equal(descuadre!.severidad, "ALTA");
});
