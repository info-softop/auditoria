"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";

export interface GastoResult {
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
function fecha(v: FormDataEntryValue | null): Date | null {
  const s = txt(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Crea o edita un gasto (ADMIN/AUDITOR). No toca tesorería; el pago va aparte. */
export async function upsertGasto(formData: FormData): Promise<GastoResult> {
  await requireRole(["ADMIN", "AUDITOR"]);

  const id = txt(formData.get("id"));
  const concepto = txt(formData.get("concepto"));
  const categoria = txt(formData.get("categoria"));
  const monto = num(formData.get("monto"));
  const fechaVence = fecha(formData.get("fechaVence")) ?? new Date();
  const estado = txt(formData.get("estado")) ?? "pendiente";

  if (!concepto) return { ok: false, error: "Escribe el concepto." };
  if (!categoria) return { ok: false, error: "Indica la categoría." };
  if (monto <= 0) return { ok: false, error: "El monto debe ser mayor a 0." };

  const data = {
    fechaVence,
    fechaPago: estado === "pagado" ? fecha(formData.get("fechaPago")) ?? new Date() : null,
    concepto,
    categoria: categoria.toUpperCase(),
    subcategoria: txt(formData.get("subcategoria")),
    monto,
    estado,
    tercero: txt(formData.get("tercero")),
    terceroId: txt(formData.get("terceroId")),
    empleadoId: txt(formData.get("empleadoId")),
    opticaId: txt(formData.get("opticaId")),
    notas: txt(formData.get("notas")),
  };

  try {
    if (id) await db.gasto.update({ where: { id }, data });
    else await db.gasto.create({ data });
  } catch {
    return { ok: false, error: "No se pudo guardar el gasto." };
  }
  revalidatePath("/gastos");
  return { ok: true };
}

/**
 * Marca un gasto como pagado. Si se elige una cuenta bancaria, genera un egreso
 * en el ledger de tesorería (idempotente: solo si aún no tiene movimiento).
 */
export async function marcarPagado(formData: FormData): Promise<GastoResult> {
  await requireRole(["ADMIN", "AUDITOR"]);
  const id = txt(formData.get("id"));
  if (!id) return { ok: false, error: "Gasto no válido." };
  const cuentaBancariaId = txt(formData.get("cuentaBancariaId"));
  const fechaPago = fecha(formData.get("fechaPago")) ?? new Date();

  const gasto = await db.gasto.findUnique({ where: { id } });
  if (!gasto) return { ok: false, error: "Gasto no encontrado." };

  try {
    await db.$transaction(async (tx) => {
      let movimientoId = gasto.movimientoId;
      if (cuentaBancariaId && !movimientoId) {
        const mov = await tx.movimientoBancario.create({
          data: {
            cuentaId: cuentaBancariaId,
            fecha: fechaPago,
            direccion: "out",
            monto: gasto.monto,
            concepto: gasto.concepto,
            categoria: gasto.categoria,
            origen: "gasto",
          },
        });
        movimientoId = mov.id;
      }
      await tx.gasto.update({
        where: { id },
        data: { estado: "pagado", fechaPago, cuentaBancariaId, movimientoId },
      });
    });
  } catch {
    return { ok: false, error: "No se pudo registrar el pago." };
  }
  revalidatePath("/gastos");
  revalidatePath("/conciliacion");
  return { ok: true };
}

/** Elimina un gasto y su movimiento bancario asociado (si lo tiene). */
export async function eliminarGasto(formData: FormData): Promise<void> {
  await requireRole(["ADMIN", "AUDITOR"]);
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const gasto = await db.gasto.findUnique({ where: { id }, select: { movimientoId: true } });
  await db.$transaction(async (tx) => {
    if (gasto?.movimientoId) {
      await tx.movimientoBancario.delete({ where: { id: gasto.movimientoId } }).catch(() => {});
    }
    await tx.gasto.delete({ where: { id } });
  });
  revalidatePath("/gastos");
  revalidatePath("/conciliacion");
}
