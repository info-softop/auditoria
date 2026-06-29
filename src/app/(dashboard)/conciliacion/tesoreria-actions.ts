"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

function txt(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}
function num(v: FormDataEntryValue | null): number {
  const n = Number(String(v ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
function fecha(v: FormDataEntryValue | null): Date {
  const s = txt(v);
  const d = s ? new Date(s) : new Date();
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

/** Crea una cuenta bancaria / pasarela. */
export async function crearCuenta(formData: FormData): Promise<ActionResult> {
  await requireRole(["ADMIN", "AUDITOR"]);
  const nombre = txt(formData.get("nombre"));
  if (!nombre) return { ok: false, error: "El nombre de la cuenta es obligatorio." };

  try {
    await db.cuentaBancaria.create({
      data: {
        nombre,
        bankCode: txt(formData.get("bankCode")),
        tipoCuenta: txt(formData.get("tipoCuenta")) ?? "bank",
        numeroCuenta: txt(formData.get("numeroCuenta")),
        moneda: txt(formData.get("moneda")) ?? "COP",
        opticaId: txt(formData.get("opticaId")),
        saldoInicial: num(formData.get("saldoInicial")),
        saldoInicialFecha: txt(formData.get("saldoInicialFecha"))
          ? fecha(formData.get("saldoInicialFecha"))
          : null,
        notas: txt(formData.get("notas")),
      },
    });
  } catch {
    return { ok: false, error: "No se pudo crear la cuenta." };
  }
  revalidatePath("/conciliacion");
  return { ok: true };
}

/** Registra un movimiento (ingreso/egreso) en una cuenta. */
export async function registrarMovimiento(formData: FormData): Promise<ActionResult> {
  await requireRole(["ADMIN", "AUDITOR"]);
  const cuentaId = txt(formData.get("cuentaId"));
  const concepto = txt(formData.get("concepto"));
  const monto = num(formData.get("monto"));
  const direccion = txt(formData.get("direccion")) === "out" ? "out" : "in";

  if (!cuentaId) return { ok: false, error: "Selecciona la cuenta." };
  if (!concepto) return { ok: false, error: "Escribe el concepto." };
  if (monto <= 0) return { ok: false, error: "El monto debe ser mayor a 0." };

  try {
    await db.movimientoBancario.create({
      data: {
        cuentaId,
        fecha: fecha(formData.get("fecha")),
        direccion,
        monto,
        concepto,
        categoria: txt(formData.get("categoria")),
        origen: "manual",
      },
    });
  } catch {
    return { ok: false, error: "No se pudo registrar el movimiento." };
  }
  revalidatePath("/conciliacion");
  return { ok: true };
}

/** Transferencia entre cuentas: egreso en origen + ingreso en destino. */
export async function transferir(formData: FormData): Promise<ActionResult> {
  await requireRole(["ADMIN", "AUDITOR"]);
  const origenId = txt(formData.get("origenId"));
  const destinoId = txt(formData.get("destinoId"));
  const monto = num(formData.get("monto"));
  const f = fecha(formData.get("fecha"));

  if (!origenId || !destinoId) return { ok: false, error: "Selecciona origen y destino." };
  if (origenId === destinoId) return { ok: false, error: "Origen y destino deben ser distintos." };
  if (monto <= 0) return { ok: false, error: "El monto debe ser mayor a 0." };

  const [origen, destino] = await Promise.all([
    db.cuentaBancaria.findUnique({ where: { id: origenId }, select: { nombre: true } }),
    db.cuentaBancaria.findUnique({ where: { id: destinoId }, select: { nombre: true } }),
  ]);
  if (!origen || !destino) return { ok: false, error: "Cuenta no encontrada." };

  try {
    await db.$transaction([
      db.movimientoBancario.create({
        data: {
          cuentaId: origenId,
          fecha: f,
          direccion: "out",
          monto,
          concepto: `Transferencia a ${destino.nombre}`,
          origen: "traslado",
        },
      }),
      db.movimientoBancario.create({
        data: {
          cuentaId: destinoId,
          fecha: f,
          direccion: "in",
          monto,
          concepto: `Transferencia desde ${origen.nombre}`,
          origen: "traslado",
        },
      }),
    ]);
  } catch {
    return { ok: false, error: "No se pudo registrar la transferencia." };
  }
  revalidatePath("/conciliacion");
  return { ok: true };
}

/** Elimina un movimiento (corrige errores de captura). */
export async function eliminarMovimiento(formData: FormData): Promise<void> {
  await requireRole(["ADMIN", "AUDITOR"]);
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db.movimientoBancario.delete({ where: { id } });
  revalidatePath("/conciliacion");
}
