"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export interface AlertaSnapshot {
  key: string;
  optica?: string | null;
  periodo?: string | null;
  orden?: string | null;
  tipo?: string | null;
  mensaje?: string | null;
}

/** Descarta una alerta y registra quién, cuándo y por qué. */
export async function descartarAlerta(
  alerta: AlertaSnapshot,
  motivo: string
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "No autorizado" };
  if (session.user.role === "VIEWER")
    return { ok: false, error: "Sin permisos para descartar" };

  const motivoLimpio = motivo.trim();
  if (motivoLimpio.length < 3)
    return { ok: false, error: "Indica un motivo (mínimo 3 caracteres)." };

  await db.alertaDescartada.upsert({
    where: { alertaKey: alerta.key },
    update: { motivo: motivoLimpio, userId: session.user.id, createdAt: new Date() },
    create: {
      alertaKey: alerta.key,
      optica: alerta.optica ?? null,
      periodo: alerta.periodo ?? null,
      orden: alerta.orden ?? null,
      tipo: alerta.tipo ?? null,
      mensaje: alerta.mensaje ?? null,
      motivo: motivoLimpio,
      userId: session.user.id,
    },
  });

  await db.registroAuditoria.create({
    data: {
      accion: "descartar_alerta",
      detalle: `Descartó alerta "${alerta.tipo ?? ""}" de ${alerta.optica ?? "—"} (${alerta.periodo ?? "—"}${alerta.orden ? `, orden ${alerta.orden}` : ""}). Motivo: ${motivoLimpio}`,
      userId: session.user.id,
    },
  });

  revalidatePath("/alertas");
  return { ok: true };
}

/** Cambia (reclasifica) la severidad de una alerta y lo registra. */
export async function cambiarSeveridad(
  alerta: AlertaSnapshot,
  severidad: "ALTA" | "MEDIA" | "BAJA"
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "No autorizado" };
  if (session.user.role === "VIEWER")
    return { ok: false, error: "Sin permisos" };

  await db.alertaSeveridad.upsert({
    where: { alertaKey: alerta.key },
    update: { severidad, userId: session.user.id, createdAt: new Date() },
    create: {
      alertaKey: alerta.key,
      severidad,
      optica: alerta.optica ?? null,
      periodo: alerta.periodo ?? null,
      orden: alerta.orden ?? null,
      tipo: alerta.tipo ?? null,
      userId: session.user.id,
    },
  });

  await db.registroAuditoria.create({
    data: {
      accion: "cambiar_severidad",
      detalle: `Cambió severidad a ${severidad} de alerta "${alerta.tipo ?? ""}" en ${alerta.optica ?? "—"} (${alerta.periodo ?? "—"}${alerta.orden ? `, orden ${alerta.orden}` : ""}).`,
      userId: session.user.id,
    },
  });

  revalidatePath("/alertas");
  return { ok: true };
}

/** Restaura una alerta previamente descartada (y lo registra). */
export async function restaurarAlerta(
  key: string
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "No autorizado" };
  if (session.user.role === "VIEWER")
    return { ok: false, error: "Sin permisos" };

  const prev = await db.alertaDescartada.findUnique({ where: { alertaKey: key } });
  if (prev) {
    await db.alertaDescartada.delete({ where: { alertaKey: key } });
    await db.registroAuditoria.create({
      data: {
        accion: "restaurar_alerta",
        detalle: `Restauró alerta "${prev.tipo ?? ""}" de ${prev.optica ?? "—"} (${prev.periodo ?? "—"}${prev.orden ? `, orden ${prev.orden}` : ""}).`,
        userId: session.user.id,
      },
    });
  }

  revalidatePath("/alertas");
  return { ok: true };
}
