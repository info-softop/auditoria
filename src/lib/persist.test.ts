import { test, after } from "node:test";
import assert from "node:assert";
import { db } from "@/lib/db";
import { persistReport } from "@/lib/persist";
import type { ParsedRow, VentaDetalladaData } from "@/lib/parsers/types";
import type { ParseResult } from "@/lib/parsers/types";

/**
 * Hotfix: subir un reporte reemplaza SOLO los días presentes en el archivo, no el
 * mes completo. Subir un rango parcial (ej. fin de mes) NO debe borrar el resto
 * del mes ya cargado; y un día re-subido debe quedar con el último valor.
 *
 * Test de integración (BD local). Crea datos en un período de prueba y limpia.
 */
const PERIODO = "2099-06";
const OPTICA = "__TEST_PERSIST_DIAS__";
const EMAIL = "__test_persist_dias@local.test";

after(() => db.$disconnect());

function fila(i: number, dia: number, cons: string, vt: number): ParsedRow<VentaDetalladaData> {
  return {
    rowIndex: i,
    raw: {},
    alerts: [],
    // Solo los campos que usan persistReport/consultas; el resto queda null.
    data: {
      optica: OPTICA,
      fecha: new Date(Date.UTC(2099, 5, dia)),
      consecutivo: cons,
      tipoMovimiento: "Venta",
      cantidad: 1,
      precioVenta: vt,
      costoCompra: 0,
      ventasTotales: vt,
      totalRecaudo: vt,
    } as unknown as VentaDetalladaData,
  };
}

function paquete(rows: ParsedRow<VentaDetalladaData>[]): ParseResult<VentaDetalladaData> {
  return { tipoReporte: "VENTA_DETALLADA", rows, periodos: [PERIODO], opticas: [OPTICA] };
}

test("hotfix: re-subir un rango parcial reemplaza solo esos días, conserva el resto", async () => {
  const user = await db.user.upsert({
    where: { email: EMAIL },
    update: {},
    create: { email: EMAIL, name: "Test Persist", password: "x", role: "ADMIN" },
  });
  const optica = await db.optica.upsert({
    where: { nombre: OPTICA },
    update: {},
    create: { nombre: OPTICA, grupo: "test" },
  });

  const base = {
    opticaId: optica.id,
    periodo: PERIODO,
    tipoReporte: "VENTA_DETALLADA" as const,
    userId: user.id,
  };

  try {
    // Carga 1: días 1, 2, 3 (valor de día 3 = 300).
    await persistReport({
      ...base,
      fileName: "u1.xlsx",
      result: paquete([fila(0, 1, "A1", 100), fila(1, 2, "A2", 200), fila(2, 3, "A3", 300)]),
    });

    // Carga 2: días 3 (restatement → 999) y 4 (nuevo). NO incluye 1 ni 2.
    const r2 = await persistReport({
      ...base,
      fileName: "u2.xlsx",
      result: paquete([fila(0, 3, "A3", 999), fila(1, 4, "A4", 400)]),
    });
    assert.strictEqual(r2.reemplazadas, 1, "solo se reemplaza el día 3 (1 fila previa)");
    assert.strictEqual(r2.insertadas, 2);

    // Estado final del período.
    const filas = await db.ventaDetalladaRow.findMany({
      where: { importacion: { opticaId: optica.id, periodo: PERIODO, tipoReporte: "VENTA_DETALLADA" } },
      select: { fecha: true, consecutivo: true, ventasTotales: true },
    });

    const dias = filas.map((f) => f.fecha!.getUTCDate()).sort((a, b) => a - b);
    assert.deepStrictEqual(dias, [1, 2, 3, 4], "días 1 y 2 se conservan; 3 y 4 presentes");

    const dia3 = filas.filter((f) => f.consecutivo === "A3");
    assert.strictEqual(dia3.length, 1, "el día 3 no se duplica");
    assert.strictEqual(dia3[0].ventasTotales, 999, "el día 3 quedó con el último valor (999)");

    // totalFilas de cada importación coincide con sus filas reales (bug B).
    const imps = await db.importacion.findMany({
      where: { opticaId: optica.id, periodo: PERIODO, tipoReporte: "VENTA_DETALLADA" },
      select: { totalFilas: true, _count: { select: { ventas: true } } },
    });
    for (const im of imps) {
      assert.strictEqual(im.totalFilas, im._count.ventas, "totalFilas sincronizado con filas reales");
    }
    assert.strictEqual(imps.reduce((s, i) => s + i.totalFilas, 0), 4, "total = 4 filas");
  } finally {
    await db.importacion.deleteMany({ where: { opticaId: optica.id } });
    await db.optica.delete({ where: { id: optica.id } });
    await db.user.delete({ where: { id: user.id } });
  }
});
