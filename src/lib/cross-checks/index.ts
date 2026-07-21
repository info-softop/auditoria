import { db } from "@/lib/db";
import type { Alerta, Severidad, TipoReporte } from "@/lib/audit-types";
import type { Prisma } from "@/generated/prisma";

type TipoCruce =
  | "A_CUADRE_ORDEN"
  | "B_COSTO_LENTE"
  | "C_CUENTAS_PAGAR"
  | "D_PAGO_LABORATORIO";

interface CruceResult {
  tipoCruce: TipoCruce;
  severidad: Severidad;
  mensaje: string;
  refs: Record<string, unknown>;
}

const LENTES = new Set(["lentes oftalmicos", "lentes de contacto"]);

function norm(s: string | null | undefined): string {
  return String(s ?? "").trim().toLowerCase();
}

/** Devuelve las filas de la última importación de un tipo para óptica+período. */
async function rowsOf(opticaId: string, periodo: string, tipo: TipoReporte) {
  const imp = await db.importacion.findFirst({
    where: { opticaId, periodo, tipoReporte: tipo },
    orderBy: { uploadedAt: "desc" },
  });
  return imp?.id ?? null;
}

/**
 * Ejecuta los cruces B, C, D + cuadre de órdenes para una óptica y período.
 * Reemplaza las AlertaCruce previas de ese óptica+período.
 */
export async function runCrossChecks(opticaId: string, periodo: string) {
  const results: CruceResult[] = [];

  const ventaImpId = await rowsOf(opticaId, periodo, "VENTA_DETALLADA");
  const pedidoImpId = await rowsOf(opticaId, periodo, "PEDIDO_LENTES");
  const cxpImpId = await rowsOf(opticaId, periodo, "CUENTAS_POR_PAGAR");
  const pagosImpId = await rowsOf(opticaId, periodo, "PAGOS_PROVEEDORES");

  // ── A: cuadre por orden / líneas duplicadas (intra Venta Detallada) ──
  if (ventaImpId) {
    const filas = await db.ventaDetalladaRow.findMany({
      where: { importacionId: ventaImpId },
      select: { consecutivo: true, precioVenta: true, ventasTotales: true, tipoMovimiento: true },
    });
    // Agrupar por orden (consecutivo). Solo cuentan las líneas de VENTA: las
    // filas "Abono" repiten los productos (eco de pago) y duplicarían la suma.
    const porOrden = new Map<
      string,
      { sumLineas: number; ventasTotales: number; nLineas: number }
    >();
    for (const f of filas) {
      const key = String(f.consecutivo ?? "").trim();
      if (!key) continue;
      const g = porOrden.get(key) ?? { sumLineas: 0, ventasTotales: 0, nLineas: 0 };
      if (norm(f.tipoMovimiento) === "venta") {
        g.sumLineas += f.precioVenta ?? 0;
        g.nLineas += 1;
      }
      g.ventasTotales = Math.max(g.ventasTotales, f.ventasTotales ?? 0);
      porOrden.set(key, g);
    }

    for (const [orden, g] of porOrden) {
      if (g.ventasTotales <= 0 || g.nLineas === 0) continue;
      const tol = Math.max(1, g.ventasTotales * 0.01);
      const diff = g.sumLineas - g.ventasTotales;
      if (Math.abs(diff) <= tol) continue; // cuadra

      const k = Math.round(g.sumLineas / g.ventasTotales);
      if (k >= 2 && Math.abs(g.sumLineas - k * g.ventasTotales) <= tol * k) {
        results.push({
          tipoCruce: "A_CUADRE_ORDEN",
          severidad: "ALTA",
          mensaje: `Orden ${orden}: las líneas suman ${k}× el total de la venta ($${g.sumLineas.toLocaleString("es-CO")} vs $${g.ventasTotales.toLocaleString("es-CO")}). Posibles líneas DUPLICADAS (${g.nLineas} líneas).`,
          refs: { consecutivo: orden, sumLineas: g.sumLineas, ventasTotales: g.ventasTotales, factor: k, nLineas: g.nLineas },
        });
      } else {
        results.push({
          tipoCruce: "A_CUADRE_ORDEN",
          severidad: "MEDIA",
          mensaje: `Orden ${orden}: la suma de líneas ($${g.sumLineas.toLocaleString("es-CO")}) no cuadra con VENTAS TOTALES ($${g.ventasTotales.toLocaleString("es-CO")}); diferencia $${diff.toLocaleString("es-CO")}.`,
          refs: { consecutivo: orden, sumLineas: g.sumLineas, ventasTotales: g.ventasTotales, diferencia: diff },
        });
      }
    }
  }

  // ── B: costo cero en lentes (Venta Detallada ↔ Pedido de Lentes) ──
  if (ventaImpId) {
    // Las filas "Abono" repiten los productos (eco de pago); no son líneas de
    // venta auditables → limpiar sus alertas para no inflar conteos ni la tabla.
    await db.ventaDetalladaRow.updateMany({
      where: {
        importacionId: ventaImpId,
        // Insensible a mayúsculas ("VENTA"/"venta") — P-2.
        tipoMovimiento: { not: "Venta", mode: "insensitive" },
        hasAlert: true,
      },
      data: { alerts: [], hasAlert: false },
    });

    const ventas = await db.ventaDetalladaRow.findMany({
      where: {
        importacionId: ventaImpId,
        tipoMovimiento: { equals: "Venta", mode: "insensitive" },
      },
      select: {
        id: true,
        consecutivo: true,
        idProducto: true,
        tipoProducto: true,
        costoCompra: true,
        precioVenta: true,
        referencia: true,
        marca: true,
        alerts: true,
      },
    });
    // El pedido de lentes se vincula por ORDEN, que liga la venta con su orden
    // de laboratorio SIN importar el mes: el lente puede venderse en un mes y su
    // pedido registrarse en otro. Por eso buscamos en TODOS los pedidos de la
    // óptica (todos los períodos), no solo los del período en curso.
    const pedidos = await db.pedidoLenteRow.findMany({
      where: {
        importacion: { opticaId, tipoReporte: "PEDIDO_LENTES" },
        valor: { gt: 0 },
      },
      select: { orden: true, productoId: true, valor: true, laboratorio: true },
    });
    // Agregados de pedido (óptica-wide), SUMANDO TODAS las filas (un par izq/der
    // aparece 2 veces → su costo es la suma de ambas).
    const pedidoPorProducto = new Map<string, number>(); // orden|producto → suma valor
    const pedidoPorOrden = new Map<string, number>(); //    orden → suma valor total
    for (const p of pedidos) {
      const kp = `${norm(p.orden)}|${norm(p.productoId)}`;
      pedidoPorProducto.set(kp, (pedidoPorProducto.get(kp) ?? 0) + (p.valor ?? 0));
      const ko = norm(p.orden);
      pedidoPorOrden.set(ko, (pedidoPorOrden.get(ko) ?? 0) + (p.valor ?? 0));
    }

    // Líneas de lente de esta importación, agrupadas por orden.
    const lentesPorOrden = new Map<string, typeof ventas>();
    for (const v of ventas) {
      if (!LENTES.has(norm(v.tipoProducto))) continue;
      const o = norm(v.consecutivo);
      const arr = lentesPorOrden.get(o);
      if (arr) arr.push(v);
      else lentesPorOrden.set(o, [v]);
    }

    // B-2: acumular los updates de costo y escribirlos EN LOTE (una transacción)
    // en vez de un await por lente en el bucle (N round-trips secuenciales).
    const updatesVenta: Prisma.PrismaPromise<unknown>[] = [];
    const fusionar = (v: (typeof ventas)[number], costo: number) => {
      // Al fijar el costo real del pedido, las alertas de costo calculadas al
      // parsear (costo cero, venta a pérdida) quedan obsoletas → recalcular.
      const alerts = ((v.alerts as unknown as Alerta[]) ?? []).filter(
        (a) => a.tipo !== "costo_cero_lente" && a.tipo !== "venta_perdida"
      );
      const pv = v.precioVenta ?? 0;
      // Tolerancia 1% para no marcar pérdida por redondeo (ej. $45.000 vs $45.050).
      if (pv > 0 && pv < costo * 0.99) {
        alerts.push({
          campo: "precioVenta",
          severidad: "ALTA",
          tipo: "venta_perdida",
          mensaje: `Precio de venta $${pv.toLocaleString("es-CO")} menor que el costo real $${costo.toLocaleString("es-CO")} (venta a pérdida).`,
        });
      }
      updatesVenta.push(
        db.ventaDetalladaRow.update({
          where: { id: v.id },
          data: {
            costoCompra: costo,
            alerts: alerts as unknown as object,
            hasAlert: alerts.length > 0,
          },
        })
      );
    };

    const alertaSinCosto = (
      v: (typeof ventas)[number],
      ordenTienePedido: boolean
    ) => {
      if ((v.costoCompra ?? 0) !== 0) return;
      // Nombre legible del lente: MARCA trae la descripción; REFERENCIA es un número.
      const nombre = (v.marca ?? "").trim() || (v.tipoProducto ?? "").trim() || "Lente";
      results.push({
        tipoCruce: "B_COSTO_LENTE",
        severidad: "ALTA",
        mensaje: ordenTienePedido
          ? `Lente "${nombre}" (orden ${v.consecutivo}) sin costo. La orden tiene pedido pero el costo no coincide por producto — revisar.`
          : `Lente "${nombre}" (orden ${v.consecutivo}) sin costo y sin pedido de laboratorio asociado.`,
        refs: { consecutivo: v.consecutivo, idProducto: v.idProducto, ordenTienePedido },
      });
    };

    for (const [orden, lentes] of lentesPorOrden) {
      const totalOrden = pedidoPorOrden.get(orden) ?? 0;

      // Orden sin pedido → los lentes en cero son alerta "sin pedido".
      if (totalOrden <= 0) {
        for (const v of lentes) alertaSinCosto(v, false);
        continue;
      }

      // La orden TIENE pedido (fuente autoritativa del costo del lente).
      // 1) Match exacto por producto → costo = suma de todas sus filas (par).
      const sinExacto: typeof ventas = [];
      let asignadoExacto = 0;
      for (const v of lentes) {
        const sumProd = pedidoPorProducto.get(`${orden}|${norm(v.idProducto)}`) ?? 0;
        if (sumProd > 0) {
          fusionar(v, sumProd);
          asignadoExacto += sumProd;
        } else {
          sinExacto.push(v);
        }
      }
      // 2) Resto del costo de la orden → repartir entre los lentes sin match exacto
      //    (SKU vendido ≠ SKU fabricado). Regla del usuario: costo por orden.
      const restante = totalOrden - asignadoExacto;
      if (sinExacto.length > 0) {
        if (restante > 0) {
          const porLente = restante / sinExacto.length;
          for (const v of sinExacto) fusionar(v, porLente);
        } else {
          for (const v of sinExacto) alertaSinCosto(v, true);
        }
      }
    }

    // Escribir todas las fusiones de costo en una sola transacción (B-2).
    if (updatesVenta.length > 0) await db.$transaction(updatesVenta);

    // Recalcular el conteo de filas con alerta (siempre: limpieza Abono + fusiones).
    {
      const conAlerta = await db.ventaDetalladaRow.count({
        where: { importacionId: ventaImpId, hasAlert: true },
      });
      await db.importacion.update({
        where: { id: ventaImpId },
        data: { filasConAlerta: conAlerta },
      });
    }
  }

  // ── Rellenar TERCERO de Gastos desde Pagos (cruce por comprobante/factura) ──
  // El gasto se vincula al pago por comprobante (= NO GASTOS) o por factura.
  // Solo rellena si el proveedor es inequívoco (un único proveedor no vacío).
  const gastoImpId = await rowsOf(opticaId, periodo, "GASTOS");
  if (gastoImpId) {
    const gastosVacios = await db.gastoRow.findMany({
      where: {
        importacionId: gastoImpId,
        OR: [{ tercero: null }, { tercero: "" }],
      },
      select: { id: true, noGastos: true, factura: true, alerts: true },
    });
    if (gastosVacios.length > 0) {
      const pagosOptica = await db.pagoProveedorRow.findMany({
        where: {
          importacion: { opticaId, tipoReporte: "PAGOS_PROVEEDORES" },
          proveedor: { not: null },
        },
        select: { comprobante: true, noFactura: true, proveedor: true },
      });
      const porComp = new Map<string, Set<string>>();
      const porFact = new Map<string, Set<string>>();
      const add = (m: Map<string, Set<string>>, k: string, v: string) => {
        const s = m.get(k) ?? new Set<string>();
        s.add(v);
        m.set(k, s);
      };
      for (const p of pagosOptica) {
        const prov = (p.proveedor ?? "").trim();
        if (!prov) continue;
        if (p.comprobante) add(porComp, norm(p.comprobante), prov);
        if (p.noFactura) add(porFact, norm(p.noFactura), prov);
      }
      const unico = (s?: Set<string>) => (s && s.size === 1 ? [...s][0] : null);

      const updatesGasto: Prisma.PrismaPromise<unknown>[] = [];
      for (const g of gastosVacios) {
        const prov =
          unico(porComp.get(norm(g.noGastos ?? ""))) ??
          unico(porFact.get(norm(g.factura ?? "")));
        if (!prov) continue;
        const alerts = ((g.alerts as unknown as Alerta[]) ?? []).filter(
          (a) => !(a.tipo === "campo_vacio" && a.campo === "tercero")
        );
        updatesGasto.push(
          db.gastoRow.update({
            where: { id: g.id },
            data: { tercero: prov, alerts: alerts as unknown as object, hasAlert: alerts.length > 0 },
          })
        );
      }
      if (updatesGasto.length > 0) {
        await db.$transaction(updatesGasto); // escritura en lote (B-2)
        const conAlerta = await db.gastoRow.count({
          where: { importacionId: gastoImpId, hasAlert: true },
        });
        await db.importacion.update({
          where: { id: gastoImpId },
          data: { filasConAlerta: conAlerta },
        });
      }
    }
  }

  // ── C: cuentas por pagar (Cuánto Debo ↔ Pagos a Proveedores) ──
  if (cxpImpId) {
    const cxp = await db.cuentaPorPagarRow.findMany({
      where: { importacionId: cxpImpId },
      select: { comprobanteNum: true, noFactura: true, proveedor: true, total: true },
    });
    const pagos = pagosImpId
      ? await db.pagoProveedorRow.findMany({
          where: { importacionId: pagosImpId, debito: { gt: 0 } },
          select: { comprobante: true, noFactura: true, proveedor: true, debito: true },
        })
      : [];
    const pagoKey = (c: string, f: string, p: string) => `${norm(c)}|${norm(f)}|${norm(p)}`;
    const pagoMap = new Map(
      pagos.map((p) => [pagoKey(p.comprobante ?? "", p.noFactura ?? "", p.proveedor ?? ""), p])
    );

    for (const c of cxp) {
      const key = pagoKey(c.comprobanteNum ?? "", c.noFactura ?? "", c.proveedor ?? "");
      const pago = pagoMap.get(key);
      if (pago) {
        // Aparece como pendiente Y ya pagada → posible doble registro.
        results.push({
          tipoCruce: "C_CUENTAS_PAGAR",
          severidad: "ALTA",
          mensaje: `Compra ${c.comprobanteNum} (factura ${c.noFactura}, ${c.proveedor}) figura como pendiente pero ya tiene un pago registrado.`,
          refs: { comprobante: c.comprobanteNum, noFactura: c.noFactura, proveedor: c.proveedor },
        });
        if (Math.round(c.total ?? 0) !== Math.round(pago.debito ?? 0)) {
          results.push({
            tipoCruce: "C_CUENTAS_PAGAR",
            severidad: "MEDIA",
            mensaje: `Monto adeudado ($${(c.total ?? 0).toLocaleString("es-CO")}) ≠ monto pagado ($${(pago.debito ?? 0).toLocaleString("es-CO")}) en compra ${c.comprobanteNum}.`,
            refs: { comprobante: c.comprobanteNum, adeudado: c.total, pagado: pago.debito },
          });
        }
      }
    }

    // Pagos sin compra origen
    const cxpKeys = new Set(
      cxp.map((c) => pagoKey(c.comprobanteNum ?? "", c.noFactura ?? "", c.proveedor ?? ""))
    );
    // (informativo: muchos pagos legítimos ya no estarán en cuánto-debo; no se alerta)
    void cxpKeys;
  }

  // ── D: pago a laboratorio vs costo de lentes ──
  if (pagosImpId && pedidoImpId) {
    const pagos = await db.pagoProveedorRow.groupBy({
      by: ["proveedor"],
      where: { importacionId: pagosImpId, debito: { gt: 0 } },
      _sum: { debito: true },
    });
    const pedidos = await db.pedidoLenteRow.groupBy({
      by: ["laboratorio"],
      where: { importacionId: pedidoImpId },
      _sum: { valor: true },
    });
    const pagoPorProv = new Map(pagos.map((p) => [norm(p.proveedor), p._sum.debito ?? 0]));
    for (const ped of pedidos) {
      const pagado = pagoPorProv.get(norm(ped.laboratorio)) ?? 0;
      const costo = ped._sum.valor ?? 0;
      if (pagado > 0 && costo > 0 && Math.abs(pagado - costo) / costo > 0.2) {
        results.push({
          tipoCruce: "D_PAGO_LABORATORIO",
          severidad: "MEDIA",
          mensaje: `Pago a ${ped.laboratorio} ($${pagado.toLocaleString("es-CO")}) difiere >20% del costo de lentes pedidos ($${costo.toLocaleString("es-CO")}).`,
          refs: { laboratorio: ped.laboratorio, pagado, costo },
        });
      }
    }
  }

  // Reemplaza alertas previas de cruce para este óptica+período.
  await db.$transaction([
    db.alertaCruce.deleteMany({ where: { opticaId, periodo } }),
    db.alertaCruce.createMany({
      data: results.map((r) => ({
        opticaId,
        periodo,
        tipoCruce: r.tipoCruce,
        severidad: r.severidad,
        mensaje: r.mensaje,
        refs: r.refs as object,
      })),
    }),
  ]);

  return results.length;
}
