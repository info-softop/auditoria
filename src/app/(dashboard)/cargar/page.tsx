import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { UploadWizard } from "@/components/upload/upload-wizard";
import { ReportChecklist } from "@/components/upload/report-checklist";
import type { TipoReporte } from "@/lib/audit-types";

export default async function CargarPage() {
  await requireRole(["ADMIN", "AUDITOR"]);

  const [opticas, importaciones, ultimaFechaRows] = await Promise.all([
    db.optica.findMany({
      where: { activa: true },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true },
    }),
    db.importacion.findMany({
      select: { periodo: true, opticaId: true, tipoReporte: true },
    }),
    // Última fecha de dato cargada por (período × tipo de reporte). Una sola
    // consulta (agrupada por período) sobre las 6 tablas de filas.
    db.$queryRawUnsafe<{ periodo: string; tipo: string; ult: Date | null }[]>(
      `SELECT i.periodo, 'VENTA_DETALLADA' AS tipo, MAX(v.fecha) AS ult FROM "VentaDetalladaRow" v JOIN "Importacion" i ON i.id=v."importacionId" GROUP BY i.periodo
       UNION ALL SELECT i.periodo, 'PEDIDO_LENTES', MAX(p."fechaOrden") FROM "PedidoLenteRow" p JOIN "Importacion" i ON i.id=p."importacionId" GROUP BY i.periodo
       UNION ALL SELECT i.periodo, 'GASTOS', MAX(g.fecha) FROM "GastoRow" g JOIN "Importacion" i ON i.id=g."importacionId" GROUP BY i.periodo
       UNION ALL SELECT i.periodo, 'COMPROBANTES', MAX(c.fecha) FROM "ComprobanteRow" c JOIN "Importacion" i ON i.id=c."importacionId" GROUP BY i.periodo
       UNION ALL SELECT i.periodo, 'PAGOS_PROVEEDORES', MAX(pp.fecha) FROM "PagoProveedorRow" pp JOIN "Importacion" i ON i.id=pp."importacionId" GROUP BY i.periodo
       UNION ALL SELECT i.periodo, 'CUENTAS_POR_PAGAR', MAX(cp.fecha) FROM "CuentaPorPagarRow" cp JOIN "Importacion" i ON i.id=cp."importacionId" GROUP BY i.periodo`
    ),
  ]);

  // Mapa `${periodo}|${tipo}` -> última fecha (YYYY-MM-DD).
  const ultimaFecha: Record<string, string> = {};
  for (const r of ultimaFechaRows) {
    if (r.ult) ultimaFecha[`${r.periodo}|${r.tipo}`] = new Date(r.ult).toISOString().slice(0, 10);
  }

  // Construye: qué tipos hay cargados por (período × óptica).
  const cargados: Record<string, TipoReporte[]> = {}; // clave `${periodo}|${opticaId}`
  const periodoSet = new Set<string>();
  for (const imp of importaciones) {
    periodoSet.add(imp.periodo);
    const key = `${imp.periodo}|${imp.opticaId}`;
    const arr = (cargados[key] ??= []);
    if (!arr.includes(imp.tipoReporte)) arr.push(imp.tipoReporte);
  }
  const periodos = [...periodoSet].sort().reverse();

  return (
    <>
      <PageHeader
        title="Cargar reportes"
        description="Sube los Excel exportados de Softop. Detectamos el tipo y la fecha de cada fila y validamos los datos. Si ya había datos, se reemplazan solo los días incluidos en el archivo (el resto del mes se conserva); el último export de cada día manda."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <UploadWizard opticas={opticas} />
        <ReportChecklist
          periodos={periodos}
          opticas={opticas}
          cargados={cargados}
          ultimaFecha={ultimaFecha}
        />
      </div>
    </>
  );
}
