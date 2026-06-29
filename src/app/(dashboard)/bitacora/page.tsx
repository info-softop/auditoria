import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { BitacoraTable, type RegistroItem } from "./_components/bitacora-table";

const ACCION_LABEL: Record<string, string> = {
  descartar_alerta: "Descartó alerta",
  restaurar_alerta: "Restauró alerta",
  cambiar_severidad: "Cambió severidad",
};

function fechaHora(d: Date): string {
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default async function BitacoraPage() {
  await requireRole(["ADMIN"]);

  const registros = await db.registroAuditoria.findMany({
    orderBy: { createdAt: "desc" },
    take: 1000,
    select: {
      id: true,
      accion: true,
      detalle: true,
      createdAt: true,
      user: { select: { name: true } },
    },
  });

  const items: RegistroItem[] = registros.map((r) => ({
    id: r.id,
    accion: r.accion,
    accionLabel: ACCION_LABEL[r.accion] ?? r.accion,
    detalle: r.detalle,
    usuario: r.user.name,
    fecha: fechaHora(r.createdAt),
  }));

  return (
    <>
      <PageHeader
        title="Logs movimientos"
        description="Registro de acciones de los usuarios sobre las alertas (quién, cuándo y qué hizo)."
      />
      <Card>
        <CardContent className="pt-6">
          <BitacoraTable registros={items} />
        </CardContent>
      </Card>
    </>
  );
}
