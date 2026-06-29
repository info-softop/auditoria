"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";

export interface EmpleadoResult {
  ok: boolean;
  error?: string;
}

function txt(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}

function num(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").replace(/[^\d.-]/g, "");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function fecha(v: FormDataEntryValue | null): Date | null {
  const s = txt(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Busca un Cargo por nombre o lo crea (para no obligar a gestionarlos aparte). */
async function resolverCargoId(nombre: string | null): Promise<string | null> {
  if (!nombre) return null;
  const existente = await db.cargo.findFirst({ where: { nombre } });
  if (existente) return existente.id;
  const creado = await db.cargo.create({ data: { nombre } });
  return creado.id;
}

/** Crea o actualiza un empleado (solo ADMIN). */
export async function upsertEmpleado(formData: FormData): Promise<EmpleadoResult> {
  await requireRole(["ADMIN"]);

  const id = txt(formData.get("id"));
  const nombre = txt(formData.get("nombre"));
  if (!nombre) return { ok: false, error: "El nombre es obligatorio." };

  const cargoId = await resolverCargoId(txt(formData.get("cargoNombre")));
  const estado = txt(formData.get("estado")) ?? "activo";

  const data = {
    codigo: txt(formData.get("codigo")),
    tipoEmpleado: txt(formData.get("tipoEmpleado")) ?? "dependiente",
    tipoIdentificacion: txt(formData.get("tipoIdentificacion")) ?? "CC",
    numeroIdentificacion: txt(formData.get("numeroIdentificacion")),
    tipoContrato: txt(formData.get("tipoContrato")) ?? "indefinido",
    nombre,
    primerApellido: txt(formData.get("primerApellido")),
    segundoApellido: txt(formData.get("segundoApellido")),
    telefono: txt(formData.get("telefono")),
    correo: txt(formData.get("correo")),
    fechaAdmision: fecha(formData.get("fechaAdmision")),
    municipalidad: txt(formData.get("municipalidad")),
    direccion: txt(formData.get("direccion")),
    metodoPago: txt(formData.get("metodoPago")) ?? "transferencia_debito",
    bancoNombre: txt(formData.get("bancoNombre")),
    tipoCuenta: txt(formData.get("tipoCuenta")),
    numeroCuenta: txt(formData.get("numeroCuenta")),
    salario: num(formData.get("salario")),
    subsidioTransporte: formData.get("subsidioTransporte") != null,
    subsidioTransporteValor: num(formData.get("subsidioTransporteValor")),
    pensionAltoRiesgo: formData.get("pensionAltoRiesgo") != null,
    salarioIntegral: formData.get("salarioIntegral") != null,
    cargoId,
    opticaId: txt(formData.get("opticaId")),
    estado,
    fechaRetiro: estado === "inactivo" ? fecha(formData.get("fechaRetiro")) : null,
    motivoRetiro: estado === "inactivo" ? txt(formData.get("motivoRetiro")) : null,
    notas: txt(formData.get("notas")),
  };

  try {
    if (id) await db.empleado.update({ where: { id }, data });
    else await db.empleado.create({ data });
  } catch {
    return { ok: false, error: "No se pudo guardar el empleado." };
  }

  revalidatePath("/empleados");
  return { ok: true };
}

/** Elimina un empleado (solo ADMIN). */
export async function eliminarEmpleado(formData: FormData): Promise<void> {
  await requireRole(["ADMIN"]);
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db.empleado.delete({ where: { id } });
  revalidatePath("/empleados");
}
