import { db } from "@/lib/db";

export interface ActiveFilters {
  periodo: string | null;
  opticaId: string | null;
}

/** Lee filtros de searchParams; si faltan, usa el período/óptica más reciente con datos. */
export async function resolveFilters(searchParams: {
  periodo?: string;
  optica?: string;
}): Promise<ActiveFilters & { periodos: string[]; opticas: { id: string; nombre: string }[] }> {
  const [periodosRaw, opticas] = await Promise.all([
    db.importacion.findMany({
      distinct: ["periodo"],
      select: { periodo: true },
      orderBy: { periodo: "desc" },
    }),
    db.optica.findMany({
      where: { activa: true },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
  ]);

  const periodos = periodosRaw.map((p) => p.periodo);
  const periodo = searchParams.periodo ?? periodos[0] ?? null;
  const opticaId = searchParams.optica ?? null;

  return { periodo, opticaId, periodos, opticas };
}
