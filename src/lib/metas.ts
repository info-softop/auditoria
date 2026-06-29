import {
  diasLaborablesDelMes,
  diasLaborablesTranscurridos,
} from "@/lib/dias-laborables";

/**
 * Niveles de la meta de recaudo (comisión escalonada). El % es la comisión que
 * cobra la asesora al alcanzar el monto de recaudo de ese nivel.
 */
export const NIVELES_META = [
  { key: "recaudoNivel1", pct: 1.0 },
  { key: "recaudoNivel2", pct: 1.5 },
  { key: "recaudoNivel3", pct: 2.0 },
] as const;

export type NivelKey = (typeof NIVELES_META)[number]["key"];

/** Montos de meta por nivel (lo que guarda el modelo Meta). */
export interface MetaNiveles {
  recaudoNivel1: number;
  recaudoNivel2: number;
  recaudoNivel3: number;
}

export interface NivelSeguimiento {
  pct: number;
  metaMes: number;
  metaDiaria: number; // metaMes / días laborables del mes
  esperadoALaFecha: number; // metaDiaria × días laborables transcurridos
  cumplimientoPct: number | null; // recaudoReal / metaMes × 100
  alcanzado: boolean; // recaudoReal ya superó la meta del mes
  faltaPorDia: number | null; // (metaMes − real) / días restantes; null si cerrado o ya alcanzado
}

export type EstadoMes = "futuro" | "curso" | "cerrado";

export interface SeguimientoMeta {
  estado: EstadoMes;
  recaudoReal: number;
  diasTotales: number;
  diasTranscurridos: number;
  diasRestantes: number;
  enCurso: boolean; // estado === "curso"
  ritmoRealDiario: number; // recaudoReal / días transcurridos
  proyeccionFinMes: number; // ritmoRealDiario × días totales
  niveles: NivelSeguimiento[];
  nivelAlcanzadoPct: number | null; // % más alto ya alcanzado
  nivelProyectadoPct: number | null; // % más alto que alcanza la proyección
  tieneMeta: boolean; // hay al menos un nivel con monto > 0
}

/** Estado del mes respecto de hoy, por comparación de "YYYY-MM". */
function estadoDelMes(periodo: string, hoy: Date): EstadoMes {
  const hoyPeriodo = `${hoy.getUTCFullYear()}-${String(hoy.getUTCMonth() + 1).padStart(2, "0")}`;
  if (periodo > hoyPeriodo) return "futuro";
  if (periodo < hoyPeriodo) return "cerrado";
  return "curso";
}

/** Lista de "YYYY-MM" desde el mes actual hasta `n` meses adelante (inclusive). */
export function periodosFuturos(hoy: Date, n: number): string[] {
  const out: string[] = [];
  const y = hoy.getUTCFullYear();
  const m = hoy.getUTCMonth(); // 0-based
  for (let i = 0; i <= n; i++) {
    const d = new Date(Date.UTC(y, m + i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

/**
 * Combina la meta (3 niveles) con el recaudo real del período para producir el
 * seguimiento diario: meta diaria, ritmo real, proyección de fin de mes y a qué
 * nivel de comisión va la óptica.
 */
export function calcularSeguimiento(
  periodo: string,
  meta: MetaNiveles | null,
  recaudoReal: number,
  hoy: Date
): SeguimientoMeta {
  const diasTotales = diasLaborablesDelMes(periodo);
  const estado = estadoDelMes(periodo, hoy);
  const enCurso = estado === "curso";
  // Futuro: aún no empieza (0 transcurridos). Cerrado: mes completo. En curso:
  // hasta hoy.
  const diasTranscurridos =
    estado === "futuro"
      ? 0
      : estado === "cerrado"
        ? diasTotales
        : diasLaborablesTranscurridos(periodo, hoy);
  const diasRestantes = Math.max(0, diasTotales - diasTranscurridos);

  const ritmoRealDiario = diasTranscurridos > 0 ? recaudoReal / diasTranscurridos : 0;
  const proyeccionFinMes = enCurso ? ritmoRealDiario * diasTotales : recaudoReal;

  const montos: MetaNiveles = meta ?? {
    recaudoNivel1: 0,
    recaudoNivel2: 0,
    recaudoNivel3: 0,
  };

  let nivelAlcanzadoPct: number | null = null;
  let nivelProyectadoPct: number | null = null;

  const niveles: NivelSeguimiento[] = NIVELES_META.map(({ key, pct }) => {
    const metaMes = montos[key] ?? 0;
    const metaDiaria = diasTotales > 0 ? metaMes / diasTotales : 0;
    const alcanzado = metaMes > 0 && recaudoReal >= metaMes;
    if (alcanzado) nivelAlcanzadoPct = pct;
    if (metaMes > 0 && proyeccionFinMes >= metaMes) nivelProyectadoPct = pct;
    return {
      pct,
      metaMes,
      metaDiaria,
      esperadoALaFecha: metaDiaria * diasTranscurridos,
      cumplimientoPct: metaMes > 0 ? (recaudoReal / metaMes) * 100 : null,
      alcanzado,
      faltaPorDia:
        enCurso && metaMes > 0 && !alcanzado && diasRestantes > 0
          ? (metaMes - recaudoReal) / diasRestantes
          : null,
    };
  });

  return {
    estado,
    recaudoReal,
    diasTotales,
    diasTranscurridos,
    diasRestantes,
    enCurso,
    ritmoRealDiario,
    proyeccionFinMes,
    niveles,
    nivelAlcanzadoPct,
    nivelProyectadoPct,
    tieneMeta: montos.recaudoNivel1 > 0 || montos.recaudoNivel2 > 0 || montos.recaudoNivel3 > 0,
  };
}

/** Suma dos conjuntos de niveles (para el total GLOBAL). */
export function sumarNiveles(a: MetaNiveles, b: MetaNiveles): MetaNiveles {
  return {
    recaudoNivel1: a.recaudoNivel1 + b.recaudoNivel1,
    recaudoNivel2: a.recaudoNivel2 + b.recaudoNivel2,
    recaudoNivel3: a.recaudoNivel3 + b.recaudoNivel3,
  };
}
