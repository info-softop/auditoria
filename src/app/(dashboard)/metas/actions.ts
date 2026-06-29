"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";

export interface UpsertMetaResult {
  ok: boolean;
  error?: string;
}

function parseNumber(value: FormDataEntryValue | null): number {
  if (value == null) return 0;
  const n = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Crea o actualiza la meta de recaudo (3 niveles) de una óptica + período.
 * Solo ADMIN. Upsert sobre la clave única [opticaId, periodo].
 */
export async function upsertMeta(formData: FormData): Promise<UpsertMetaResult> {
  await requireRole(["ADMIN"]);

  const opticaId = String(formData.get("opticaId") ?? "");
  const periodo = String(formData.get("periodo") ?? "");

  if (!opticaId) return { ok: false, error: "Selecciona una óptica." };
  if (!/^\d{4}-\d{2}$/.test(periodo))
    return { ok: false, error: "El período debe tener el formato YYYY-MM." };

  const recaudoNivel1 = parseNumber(formData.get("recaudoNivel1"));
  const recaudoNivel2 = parseNumber(formData.get("recaudoNivel2"));
  const recaudoNivel3 = parseNumber(formData.get("recaudoNivel3"));

  try {
    await db.meta.upsert({
      where: { opticaId_periodo: { opticaId, periodo } },
      create: { opticaId, periodo, recaudoNivel1, recaudoNivel2, recaudoNivel3 },
      update: { recaudoNivel1, recaudoNivel2, recaudoNivel3 },
    });
  } catch {
    return { ok: false, error: "No se pudo guardar la meta. Intenta de nuevo." };
  }

  revalidatePath("/metas");
  return { ok: true };
}
