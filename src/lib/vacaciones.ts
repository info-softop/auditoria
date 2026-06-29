/**
 * Saldo de vacaciones (regla colombiana, portado de softop-administrador):
 * causadas = 1.25 días por mes desde la fecha de admisión;
 * saldo = causadas − tomadas/pagadas ± ajustes.
 */
/** Tipos que SÍ afectan el saldo de vacaciones. Los permisos solo se registran. */
export const TIPOS_VACACION = ["tomada", "pagada", "ajuste"] as const;
export const TIPOS_PERMISO = [
  "permiso_remunerado",
  "permiso_no_remunerado",
  "incapacidad",
  "licencia",
] as const;
export const TIPOS_AUSENCIA = [...TIPOS_VACACION, ...TIPOS_PERMISO] as const;

export const TIPO_AUSENCIA_LABEL: Record<string, string> = {
  tomada: "Vacaciones tomadas",
  pagada: "Vacaciones pagadas",
  ajuste: "Ajuste (±)",
  permiso_remunerado: "Permiso remunerado",
  permiso_no_remunerado: "Permiso no remunerado",
  incapacidad: "Incapacidad",
  licencia: "Licencia",
};

export interface ResumenVacaciones {
  causadas: number;
  tomadas: number;
  ajustes: number;
  saldo: number;
  permisos: number; // días de permisos/incapacidades/licencias (informativo)
}

export function resumenVacaciones(
  fechaAdmision: Date | null,
  movs: { tipo: string; dias: number }[],
  hoy: Date
): ResumenVacaciones {
  let causadas = 0;
  if (fechaAdmision) {
    const months = Math.max(
      0,
      (hoy.getUTCFullYear() - fechaAdmision.getUTCFullYear()) * 12 +
        (hoy.getUTCMonth() - fechaAdmision.getUTCMonth())
    );
    causadas = Math.round(months * 1.25 * 100) / 100;
  }
  let tomadas = 0;
  let ajustes = 0;
  let permisos = 0;
  for (const m of movs) {
    if (m.tipo === "ajuste") ajustes += m.dias;
    else if (m.tipo === "tomada" || m.tipo === "pagada") tomadas += m.dias;
    else permisos += m.dias; // permisos/incapacidades/licencias: no tocan el saldo
  }
  const saldo = Math.round((causadas - tomadas + ajustes) * 100) / 100;
  return {
    causadas,
    tomadas,
    ajustes,
    saldo,
    permisos: Math.round(permisos * 100) / 100,
  };
}
