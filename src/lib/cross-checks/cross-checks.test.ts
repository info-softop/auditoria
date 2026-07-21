import { test, after } from "node:test";
import assert from "node:assert";
import { db } from "@/lib/db";
import { runCrossChecks } from "@/lib/cross-checks";

/**
 * FASE 4 (B-2): el cruce B (costo de lente) fusiona el costo real del pedido en
 * las líneas de venta. Antes hacía un update por lente en bucle; ahora los
 * agrupa en una transacción. Este test verifica que el RESULTADO no cambia:
 * las ventas quedan con el costo del pedido y sin alerta de costo cero.
 */
const PERIODO = "2099-06";
const OPTICA = "__TEST_CROSS_B__";
const EMAIL = "__test_cross_b@local.test";

after(() => db.$disconnect());

test("FASE 4: cruce B fusiona el costo del pedido en la venta (updates en lote)", async () => {
  const user = await db.user.upsert({
    where: { email: EMAIL }, update: {},
    create: { email: EMAIL, name: "Test Cross", password: "x", role: "ADMIN" },
  });
  const optica = await db.optica.upsert({
    where: { nombre: OPTICA }, update: {}, create: { nombre: OPTICA, grupo: "test" },
  });
  const impV = await db.importacion.create({
    data: { opticaId: optica.id, periodo: PERIODO, tipoReporte: "VENTA_DETALLADA", fileName: "v.xlsx", uploadedById: user.id, totalFilas: 2 },
  });
  const impP = await db.importacion.create({
    data: { opticaId: optica.id, periodo: PERIODO, tipoReporte: "PEDIDO_LENTES", fileName: "p.xlsx", uploadedById: user.id, totalFilas: 2 },
  });

  try {
    // 2 lentes en 2 órdenes distintas, costo 0 (sin costo al parsear).
    await db.ventaDetalladaRow.createMany({
      data: [
        { importacionId: impV.id, rowIndex: 0, optica: OPTICA, raw: {}, fecha: new Date(Date.UTC(2099, 5, 1)),
          consecutivo: "O1", idProducto: "P1", tipoProducto: "Lentes Oftalmicos", tipoMovimiento: "Venta",
          cantidad: 1, precioVenta: 100000, costoCompra: 0, ventasTotales: 100000, totalRecaudo: 100000, hasAlert: true,
          alerts: [{ campo: "costoCompra", severidad: "ALTA", tipo: "costo_cero_lente", mensaje: "x" }] },
        { importacionId: impV.id, rowIndex: 1, optica: OPTICA, raw: {}, fecha: new Date(Date.UTC(2099, 5, 2)),
          consecutivo: "O2", idProducto: "P2", tipoProducto: "Lentes Oftalmicos", tipoMovimiento: "Venta",
          cantidad: 1, precioVenta: 100000, costoCompra: 0, ventasTotales: 100000, totalRecaudo: 100000, hasAlert: true,
          alerts: [{ campo: "costoCompra", severidad: "ALTA", tipo: "costo_cero_lente", mensaje: "x" }] },
      ],
    });
    // Pedido con el costo real de cada orden/producto.
    await db.pedidoLenteRow.createMany({
      data: [
        { importacionId: impP.id, rowIndex: 0, raw: {}, orden: "O1", productoId: "P1", valor: 40000 },
        { importacionId: impP.id, rowIndex: 1, raw: {}, orden: "O2", productoId: "P2", valor: 30000 },
      ],
    });

    await runCrossChecks(optica.id, PERIODO);

    const filas = await db.ventaDetalladaRow.findMany({
      where: { importacionId: impV.id },
      select: { consecutivo: true, costoCompra: true, hasAlert: true, alerts: true },
    });
    const o1 = filas.find((f) => f.consecutivo === "O1")!;
    const o2 = filas.find((f) => f.consecutivo === "O2")!;

    // El costo del pedido se fusionó en la venta (updates en lote).
    assert.strictEqual(o1.costoCompra, 40000, "O1 toma el costo del pedido");
    assert.strictEqual(o2.costoCompra, 30000, "O2 toma el costo del pedido");
    // La alerta de costo cero se limpió (ya hay costo real).
    assert.strictEqual(o1.hasAlert, false, "O1 sin alerta de costo cero");
    assert.strictEqual(o2.hasAlert, false, "O2 sin alerta de costo cero");
  } finally {
    await db.importacion.deleteMany({ where: { opticaId: optica.id } });
    await db.optica.delete({ where: { id: optica.id } });
    await db.user.delete({ where: { id: user.id } });
  }
});
