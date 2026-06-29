"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";

/** Marca como revisado un traslado registrado desde el link público. */
export async function marcarTrasladoRevisado(formData: FormData): Promise<void> {
  await requireRole(["ADMIN", "AUDITOR"]);
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db.trasladoPublico.update({
    where: { id },
    data: { revisado: true },
  });
  revalidatePath("/consignaciones");
}
