"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { TIPOS_AUSENCIA } from "@/lib/vacaciones";

export interface VacacionResult {
  ok: boolean;
  error?: string;
}

function fecha(v: FormDataEntryValue | null): Date | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Agrega un movimiento de vacaciones (tomada/pagada/ajuste) — ADMIN. */
export async function agregarVacacion(formData: FormData): Promise<VacacionResult> {
  await requireRole(["ADMIN"]);

  const empleadoId = String(formData.get("empleadoId") ?? "");
  const tipo = String(formData.get("tipo") ?? "");
  const dias = Number(String(formData.get("dias") ?? "").replace(/[^\d.-]/g, ""));

  if (!empleadoId) return { ok: false, error: "Empleado no válido." };
  if (!(TIPOS_AUSENCIA as readonly string[]).includes(tipo))
    return { ok: false, error: "Tipo inválido." };
  if (!Number.isFinite(dias) || dias === 0)
    return { ok: false, error: "Indica los días (puede ser negativo en ajuste)." };

  try {
    await db.vacacion.create({
      data: {
        empleadoId,
        tipo,
        dias,
        fechaInicio: fecha(formData.get("fechaInicio")),
        fechaFin: fecha(formData.get("fechaFin")),
        nota: String(formData.get("nota") ?? "").trim() || null,
      },
    });
  } catch {
    return { ok: false, error: "No se pudo registrar." };
  }

  revalidatePath(`/empleados/${empleadoId}`);
  return { ok: true };
}

/** Elimina un movimiento de vacaciones — ADMIN. */
export async function eliminarVacacion(formData: FormData): Promise<void> {
  await requireRole(["ADMIN"]);
  const id = String(formData.get("id") ?? "");
  const empleadoId = String(formData.get("empleadoId") ?? "");
  if (!id) return;
  await db.vacacion.delete({ where: { id } });
  if (empleadoId) revalidatePath(`/empleados/${empleadoId}`);
}
