import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { UploadWizard } from "@/components/upload/upload-wizard";
import { ReportChecklist } from "@/components/upload/report-checklist";
import type { TipoReporte } from "@/lib/audit-types";

export default async function CargarPage() {
  await requireRole(["ADMIN", "AUDITOR"]);

  const [opticas, importaciones] = await Promise.all([
    db.optica.findMany({
      where: { activa: true },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true },
    }),
    db.importacion.findMany({
      select: { periodo: true, opticaId: true, tipoReporte: true },
    }),
  ]);

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
        />
      </div>
    </>
  );
}
