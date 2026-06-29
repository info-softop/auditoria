"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";

export interface NominaItem {
  empleadoId: string;
  salarioBase: number;
  subsidioTransporte: number;
  bonos: number;
  deducciones: number;
}

export interface NominaLotePayload {
  periodo: string; // YYYY-MM
  quincena: number | null; // 1 | 2 | null
  fechaPago: string; // YYYY-MM-DD
  items: NominaItem[];
}

export interface NominaResult {
  ok: boolean;
  error?: string;
  creados?: number;
}

/** Registra el pago de nómina de varios empleados a la vez (solo ADMIN). */
export async function registrarNominaLote(
  payload: NominaLotePayload
): Promise<NominaResult> {
  await requireRole(["ADMIN"]);

  if (!/^\d{4}-\d{2}$/.test(payload.periodo)) {
    return { ok: false, error: "Período inválido." };
  }
  const fechaPago = new Date(payload.fechaPago);
  if (Number.isNaN(fechaPago.getTime())) {
    return { ok: false, error: "Fecha de pago inválida." };
  }
  const items = (payload.items ?? []).filter((i) => i.empleadoId);
  if (items.length === 0) {
    return { ok: false, error: "Selecciona al menos un empleado." };
  }

  const quincena = payload.quincena === 1 || payload.quincena === 2 ? payload.quincena : null;

  try {
    await db.$transaction(async (tx) => {
      for (const i of items) {
        const salarioBase = Number(i.salarioBase) || 0;
        const subsidioTransporte = Number(i.subsidioTransporte) || 0;
        const bonos = Number(i.bonos) || 0;
        const deducciones = Number(i.deducciones) || 0;
        const neto = salarioBase + subsidioTransporte + bonos - deducciones;

        const pago = await tx.pagoNomina.create({
          data: {
            empleadoId: i.empleadoId,
            periodo: payload.periodo,
            quincena,
            salarioBase,
            subsidioTransporte,
            bonos,
            deducciones,
            neto,
            fechaPago,
          },
        });

        // Cada pago de nómina genera su gasto (categoría NOMINA), enlazado al
        // empleado y al pago de origen (sourceId) para trazabilidad.
        await tx.gasto.create({
          data: {
            fechaVence: fechaPago,
            fechaPago,
            concepto: `Nómina ${payload.periodo}${quincena ? ` Q${quincena}` : ""}`,
            categoria: "NOMINA",
            monto: neto,
            estado: "pagado",
            empleadoId: i.empleadoId,
            origen: "nomina",
            sourceId: pago.id,
          },
        });
      }
    });
  } catch {
    return { ok: false, error: "No se pudo registrar la nómina." };
  }

  revalidatePath("/gastos");

  revalidatePath("/empleados/nomina");
  return { ok: true, creados: items.length };
}

/** Elimina un pago de nómina (corregir errores). */
export async function eliminarPagoNomina(formData: FormData): Promise<void> {
  await requireRole(["ADMIN"]);
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db.pagoNomina.delete({ where: { id } });
  revalidatePath("/empleados/nomina");
}
