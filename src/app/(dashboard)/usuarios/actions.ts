"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-helpers";
import { Role } from "@/generated/prisma";

const roleEnum = z.nativeEnum(Role);

const createUserSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio"),
  email: z.string().trim().toLowerCase().email("Correo inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  role: roleEnum,
});

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function createUser(input: {
  name: string;
  email: string;
  password: string;
  role: Role;
}): Promise<ActionResult> {
  await requireRole(["ADMIN"]);
  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { name, email, password, role } = parsed.data;
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, error: "Ya existe un usuario con ese correo" };
  }
  const hashed = await bcrypt.hash(password, 10);
  await db.user.create({
    data: { name, email, password: hashed, role },
  });
  revalidatePath("/usuarios");
  return { ok: true };
}

export async function updateUserRole(
  id: string,
  role: Role
): Promise<ActionResult> {
  const actor = await requireRole(["ADMIN"]);
  if (!id) return { ok: false, error: "Identificador inválido" };
  const parsed = roleEnum.safeParse(role);
  if (!parsed.success) {
    return { ok: false, error: "Rol inválido" };
  }
  if (actor.id === id && parsed.data !== "ADMIN") {
    return { ok: false, error: "No puedes quitarte tu propio rol de administrador" };
  }
  await db.user.update({ where: { id }, data: { role: parsed.data } });
  revalidatePath("/usuarios");
  return { ok: true };
}
