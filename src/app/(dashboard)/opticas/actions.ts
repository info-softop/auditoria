"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-helpers";

const opticaSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
  grupo: z.string().trim().min(1, "El grupo es obligatorio"),
  codigoInterno: z.string().trim().optional(),
  activa: z.boolean().optional(),
});

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function createOptica(input: {
  nombre: string;
  grupo: string;
  codigoInterno?: string;
  activa?: boolean;
}): Promise<ActionResult> {
  await requireRole(["ADMIN"]);
  const parsed = opticaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { nombre, grupo, codigoInterno, activa } = parsed.data;
  const existing = await db.optica.findUnique({ where: { nombre } });
  if (existing) {
    return { ok: false, error: "Ya existe una óptica con ese nombre" };
  }
  await db.optica.create({
    data: {
      nombre,
      grupo,
      codigoInterno: codigoInterno || null,
      activa: activa ?? true,
    },
  });
  revalidatePath("/opticas");
  return { ok: true };
}

export async function updateOptica(
  id: string,
  input: { nombre: string; grupo: string; codigoInterno?: string }
): Promise<ActionResult> {
  await requireRole(["ADMIN"]);
  if (!id) return { ok: false, error: "Identificador inválido" };
  const parsed = opticaSchema.omit({ activa: true }).safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { nombre, grupo, codigoInterno } = parsed.data;
  const clash = await db.optica.findFirst({
    where: { nombre, id: { not: id } },
  });
  if (clash) {
    return { ok: false, error: "Ya existe otra óptica con ese nombre" };
  }
  await db.optica.update({
    where: { id },
    data: { nombre, grupo, codigoInterno: codigoInterno || null },
  });
  revalidatePath("/opticas");
  return { ok: true };
}

export async function toggleOptica(
  id: string,
  activa: boolean
): Promise<ActionResult> {
  await requireRole(["ADMIN"]);
  if (!id) return { ok: false, error: "Identificador inválido" };
  await db.optica.update({ where: { id }, data: { activa } });
  revalidatePath("/opticas");
  return { ok: true };
}
