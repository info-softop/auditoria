import { createHash } from "crypto";
import { db } from "@/lib/db";
import {
  TIPO_REPORTE_LABEL,
  type Severidad,
  type TipoReporte,
} from "@/lib/audit-types";

export interface DescarteInfo {
  usuario: string;
  fecha: string; // ISO
  motivo: string | null;
}

export interface AlertaItem {
  key: string; // identificador estable de la alerta (para descartar)
  origen: "cruce" | "reporte";
  optica: string;
  periodo: string;
  severidad: Severidad;
  tipo: string;
  tipoLabel: string;
  reporteLabel: string | null; // de qué reporte viene (alertas de fila)
  orden: string | null; // número de orden / comprobante / referencia
  mensaje: string;
  descarte: DescarteInfo | null; // si fue descartada, quién/cuándo/por qué
  severidadAjustada: { usuario: string } | null; // si un usuario cambió la severidad
}

export interface AlertsFeed {
  items: AlertaItem[];
  opticas: string[];
  periodos: string[];
}

/** Clave estable de una alerta (misma alerta → misma clave entre cargas). */
export function alertaKey(
  origen: string,
  optica: string,
  periodo: string,
  orden: string | null,
  tipo: string,
  mensaje: string
): string {
  return createHash("sha1")
    .update(`${origen}|${optica}|${periodo}|${orden ?? ""}|${tipo}|${mensaje}`)
    .digest("hex");
}

const TIPO_CRUCE_LABEL: Record<string, string> = {
  A_CUADRE_ORDEN: "Cuadre de orden",
  B_COSTO_LENTE: "Costo cero en lente",
  C_CUENTAS_PAGAR: "Cuentas por pagar",
  D_PAGO_LABORATORIO: "Pago a laboratorio",
};

const TIPO_ALERTA_LABEL: Record<string, string> = {
  costo_cero_lente: "Costo cero en lente",
  descuento_excesivo: "Descuento excesivo",
  descuento_imposible: "Descuento imposible",
  cartera_pendiente: "Cartera pendiente",
  venta_perdida: "Venta a pérdida",
  venta_a_perdida: "Venta a pérdida",
  telefono_vacio: "Teléfono vacío",
  motivo_visita_vacio: "Motivo de visita vacío",
  cantidad_invalida: "Cantidad inválida",
  metodo_pago_invalido: "Método de pago inválido",
  pendiente_entrega: "Lente pendiente de entrega",
  partida_doble: "Descuadre partida doble",
  partida_doble_incompleta: "Partida doble incompleta",
  descuadre_partida_doble: "Descuadre partida doble",
  gasto_no_saldado: "Gasto no saldado",
  total_no_positivo: "Total no positivo",
  valor_no_positivo: "Valor no positivo",
  fecha_vacia: "Fecha vacía",
};

/**
 * Eleva la severidad automática BAJA → MEDIA (política del cliente: ya no se
 * usa el nivel "Baja" para las alertas generadas; las de calidad de datos
 * pasan a "Media"). No aplica a reclasificaciones manuales de usuario, que se
 * resuelven aparte y prevalecen.
 */
function normalizaSeveridad(sev: Severidad): Severidad {
  return sev === "BAJA" ? "MEDIA" : sev;
}

export function labelTipoAlerta(tipo: string): string {
  return (
    TIPO_ALERTA_LABEL[tipo] ??
    tipo
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ")
  );
}

interface RawRow {
  alerts: unknown;
  orden: string | null;
  importacion: {
    periodo: string;
    tipoReporte: TipoReporte;
    optica: { nombre: string };
  };
}

const impSelect = {
  periodo: true,
  tipoReporte: true,
  optica: { select: { nombre: true } },
} as const;

/** Reúne TODAS las alertas (cruce + fila) en un feed plano para explorar. */
export async function getAlertsFeed(): Promise<AlertsFeed> {
  const rowWhere = { hasAlert: true };

  // Cada reporte tiene su propio identificador de "orden": orden de venta,
  // comprobante de traslado, número de gasto, comprobante de compra, etc.
  const [cruces, venta, pedido, gasto, comprobante, pago, cxp] = await Promise.all([
    db.alertaCruce.findMany({
      select: {
        tipoCruce: true,
        severidad: true,
        mensaje: true,
        periodo: true,
        refs: true,
        optica: { select: { nombre: true } },
      },
    }),
    db.ventaDetalladaRow.findMany({
      where: rowWhere,
      select: { alerts: true, consecutivo: true, importacion: { select: impSelect } },
    }),
    db.pedidoLenteRow.findMany({
      where: rowWhere,
      select: { alerts: true, orden: true, importacion: { select: impSelect } },
    }),
    db.gastoRow.findMany({
      where: rowWhere,
      select: { alerts: true, noGastos: true, importacion: { select: impSelect } },
    }),
    db.comprobanteRow.findMany({
      where: rowWhere,
      select: { alerts: true, noComprobante: true, importacion: { select: impSelect } },
    }),
    db.pagoProveedorRow.findMany({
      where: rowWhere,
      select: { alerts: true, comprobante: true, importacion: { select: impSelect } },
    }),
    db.cuentaPorPagarRow.findMany({
      where: rowWhere,
      select: { alerts: true, comprobanteNum: true, importacion: { select: impSelect } },
    }),
  ]);

  const items: AlertaItem[] = [];

  for (const c of cruces) {
    const refs = (c.refs ?? {}) as Record<string, unknown>;
    const orden =
      (refs.consecutivo as string | undefined) ??
      (refs.comprobante as string | undefined) ??
      (refs.comprobanteNum as string | undefined) ??
      null;
    const ordenStr = orden != null ? String(orden) : null;
    items.push({
      key: alertaKey("cruce", c.optica.nombre, c.periodo, ordenStr, c.tipoCruce, c.mensaje),
      origen: "cruce",
      optica: c.optica.nombre,
      periodo: c.periodo,
      severidad: normalizaSeveridad(c.severidad as Severidad),
      tipo: c.tipoCruce,
      tipoLabel: TIPO_CRUCE_LABEL[c.tipoCruce] ?? c.tipoCruce,
      reporteLabel: null,
      orden: ordenStr,
      mensaje: c.mensaje,
      descarte: null,
      severidadAjustada: null,
    });
  }

  // Normaliza cada grupo a RawRow (con su campo de orden).
  const rowGroups: RawRow[][] = [
    venta.map((r) => ({ alerts: r.alerts, orden: r.consecutivo, importacion: r.importacion })),
    pedido.map((r) => ({ alerts: r.alerts, orden: r.orden, importacion: r.importacion })),
    gasto.map((r) => ({ alerts: r.alerts, orden: r.noGastos, importacion: r.importacion })),
    comprobante.map((r) => ({ alerts: r.alerts, orden: r.noComprobante, importacion: r.importacion })),
    pago.map((r) => ({ alerts: r.alerts, orden: r.comprobante, importacion: r.importacion })),
    cxp.map((r) => ({ alerts: r.alerts, orden: r.comprobanteNum, importacion: r.importacion })),
  ];
  for (const grupo of rowGroups) {
    for (const r of grupo) {
      const alerts = (r.alerts ?? []) as {
        campo: string;
        severidad: Severidad;
        tipo: string;
        mensaje: string;
      }[];
      for (const a of alerts) {
        const optica = r.importacion.optica.nombre;
        const periodo = r.importacion.periodo;
        const orden = r.orden ?? null;
        items.push({
          key: alertaKey("reporte", optica, periodo, orden, a.tipo, a.mensaje),
          origen: "reporte",
          optica,
          periodo,
          severidad: normalizaSeveridad(a.severidad),
          tipo: a.tipo,
          tipoLabel: labelTipoAlerta(a.tipo),
          reporteLabel: TIPO_REPORTE_LABEL[r.importacion.tipoReporte],
          orden,
          mensaje: a.mensaje,
          descarte: null,
          severidadAjustada: null,
        });
      }
    }
  }

  // Unir alertas por orden: los reportes de partida doble (gastos, comprobantes,
  // pagos) repiten cada fila como Débito y Crédito, generando la MISMA alerta dos
  // veces. Se colapsan las idénticas (clave estable).
  const seen = new Set<string>();
  const dedup = items.filter((i) => {
    if (seen.has(i.key)) return false;
    seen.add(i.key);
    return true;
  });

  // Marcar las descartadas (quién / cuándo / por qué).
  const descartadas = await db.alertaDescartada.findMany({
    select: {
      alertaKey: true,
      motivo: true,
      createdAt: true,
      user: { select: { name: true } },
    },
  });
  const descMap = new Map(
    descartadas.map((d) => [
      d.alertaKey,
      { usuario: d.user.name, fecha: d.createdAt.toISOString(), motivo: d.motivo },
    ])
  );
  for (const i of dedup) {
    const d = descMap.get(i.key);
    if (d) i.descarte = d;
  }

  // Aplicar reclasificación de severidad (override por usuario).
  const overrides = await db.alertaSeveridad.findMany({
    select: { alertaKey: true, severidad: true, user: { select: { name: true } } },
  });
  const sevMap = new Map(
    overrides.map((o) => [o.alertaKey, { severidad: o.severidad as Severidad, usuario: o.user.name }])
  );
  for (const i of dedup) {
    const ov = sevMap.get(i.key);
    if (ov) {
      i.severidad = ov.severidad;
      i.severidadAjustada = { usuario: ov.usuario };
    }
  }

  const opticas = [...new Set(dedup.map((i) => i.optica))].sort();
  const periodos = [...new Set(dedup.map((i) => i.periodo))].sort().reverse();

  return { items: dedup, opticas, periodos };
}
