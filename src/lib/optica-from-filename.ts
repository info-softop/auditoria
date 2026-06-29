import { db } from "@/lib/db";

export interface OpticaMatch {
  id: string;
  nombre: string;
  codigoInterno: string;
}

/**
 * Detecta la óptica a partir del nombre del archivo, que contiene el
 * ID (codigoInterno) de la óptica. Ej: "reportePagos_14676420.xlsx" →
 * Óptica Medica. Devuelve null si ninguna coincide.
 *
 * Coincide por el codigoInterno más largo presente en el nombre (evita que
 * un ID que es prefijo de otro gane por error).
 */
export async function detectOpticaFromFilename(
  fileName: string
): Promise<OpticaMatch | null> {
  const opticas = await db.optica.findMany({
    where: { codigoInterno: { not: null } },
    select: { id: true, nombre: true, codigoInterno: true },
  });
  const limpio = fileName.replace(/\.[^.]+$/, ""); // sin extensión
  const candidatos = opticas
    .filter((o) => o.codigoInterno && limpio.includes(o.codigoInterno))
    .sort((a, b) => (b.codigoInterno!.length - a.codigoInterno!.length));
  const m = candidatos[0];
  return m ? { id: m.id, nombre: m.nombre, codigoInterno: m.codigoInterno! } : null;
}
