import { test, after } from "node:test";
import assert from "node:assert";
import { db } from "@/lib/db";
import { ventaKpis } from "@/lib/kpis";

/**
 * P-2: los KPIs de línea (unidades, margenBruto) se filtran por
 * tipoMovimiento = "Venta". Softop puede exportar "VENTA"/"venta"; con igualdad
 * exacta caían a 0 EN SILENCIO. El filtro ahora es insensible a mayúsculas.
 *
 * Test de integración: usa la BD local (Postgres; `mode:"insensitive"` lo evalúa
 * el motor). Crea datos en un período/óptica de prueba y limpia siempre al final.
 */
const PERIODO = "2099-12";
const OPTICA = "__TEST_P2_KPIS__";
const EMAIL = "__test_p2_kpis@local.test";

after(() => db.$disconnect());

test("P-2: ventaKpis cuenta filas Venta sin importar mayúsculas (VENTA/venta)", async () => {
  const user = await db.user.upsert({
    where: { email: EMAIL },
    update: {},
    create: { email: EMAIL, name: "Test P2", password: "x", role: "ADMIN" },
  });
  const optica = await db.optica.upsert({
    where: { nombre: OPTICA },
    update: {},
    create: { nombre: OPTICA, grupo: "test" },
  });
  const imp = await db.importacion.create({
    data: {
      opticaId: optica.id,
      periodo: PERIODO,
      tipoReporte: "VENTA_DETALLADA",
      fileName: "test-p2.xlsx",
      uploadedById: user.id,
      totalFilas: 3,
    },
  });

  try {
    await db.ventaDetalladaRow.createMany({
      data: [
        // Casing distinto de "Venta": el filtro exacto viejo NO las contaba.
        {
          importacionId: imp.id, rowIndex: 0, optica: OPTICA, raw: {},
          consecutivo: "T1", tipoMovimiento: "VENTA",
          cantidad: 2, precioVenta: 100000, costoCompra: 60000,
          ventasTotales: 100000, totalRecaudo: 100000,
        },
        {
          importacionId: imp.id, rowIndex: 1, optica: OPTICA, raw: {},
          consecutivo: "T2", tipoMovimiento: "venta",
          cantidad: 3, precioVenta: 50000, costoCompra: 20000,
          ventasTotales: 50000, totalRecaudo: 50000,
        },
        // Fila Abono: NO cuenta en unidades/margen, pero SÍ suma en recaudo.
        {
          importacionId: imp.id, rowIndex: 2, optica: OPTICA, raw: {},
          consecutivo: "T1", tipoMovimiento: "Abono",
          cantidad: 99, precioVenta: 99999, costoCompra: 0,
          ventasTotales: 0, totalRecaudo: 70000,
        },
        // Venta ANULADA: NO debe contar en ningún KPI (estado "Anulada").
        {
          importacionId: imp.id, rowIndex: 3, optica: OPTICA, raw: {},
          consecutivo: "T9", tipoMovimiento: "Venta", estado: "Anulada",
          cantidad: 7, precioVenta: 999999, costoCompra: 1,
          ventasTotales: 999999, totalRecaudo: 999999,
        },
      ],
    });

    const k = await ventaKpis(PERIODO, optica.id);

    // Campos de LÍNEA: cuentan ambas filas Venta (insensible) → no caen a 0.
    assert.strictEqual(k.unidades, 5, "unidades = 2 + 3 (VENTA + venta)");
    assert.strictEqual(k.margenBruto, 70000, "margen = (100k-60k) + (50k-20k)");
    assert.ok(k.unidades > 0 && k.margenBruto > 0, "no deben ser 0");

    // Semántica de negocio intacta: ventas/recaudo suman TODAS las filas.
    assert.strictEqual(k.ventas, 150000, "ventas = Σ ventasTotales");
    assert.strictEqual(k.recaudo, 220000, "recaudo = Σ totalRecaudo (incl. abono)");
  } finally {
    await db.importacion.delete({ where: { id: imp.id } }); // cascade borra filas
    await db.optica.delete({ where: { id: optica.id } });
    await db.user.delete({ where: { id: user.id } });
  }
});
