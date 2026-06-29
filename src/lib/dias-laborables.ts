import { festivosColombia } from "@/lib/festivos-colombia";

/**
 * Días hábiles en Colombia = lunes a sábado, EXCLUYENDO domingos y festivos
 * nacionales (Ley Emiliani + Semana Santa). La meta mensual de recaudo se
 * reparte entre estos días hábiles para obtener la meta diaria. Cálculo en UTC
 * para evitar corrimientos por zona horaria (los períodos son "YYYY-MM").
 */

function partesPeriodo(periodo: string): { anio: number; mes: number } {
  const [anio, mes] = periodo.split("-").map(Number);
  return { anio, mes };
}

function ymd(anio: number, mes: number, dia: number): string {
  return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** ¿El día es hábil? Lun–sáb (dow 1..6) y que no sea festivo. */
function esHabil(dow: number, clave: string, festivos: Set<string>): boolean {
  return dow !== 0 && !festivos.has(clave);
}

/** Total de días hábiles (lun–sáb, sin festivos) del mes "YYYY-MM". */
export function diasLaborablesDelMes(periodo: string): number {
  const { anio, mes } = partesPeriodo(periodo);
  const festivos = festivosColombia(anio);
  const diasEnMes = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  let n = 0;
  for (let d = 1; d <= diasEnMes; d++) {
    const dow = new Date(Date.UTC(anio, mes - 1, d)).getUTCDay();
    if (esHabil(dow, ymd(anio, mes, d), festivos)) n++;
  }
  return n;
}

/**
 * Días hábiles transcurridos desde el día 1 hasta `hasta` (inclusive), acotado
 * al mes del período. Posterior al mes → total del mes; anterior → 0.
 */
export function diasLaborablesTranscurridos(periodo: string, hasta: Date): number {
  const { anio, mes } = partesPeriodo(periodo);
  const festivos = festivosColombia(anio);
  const diasEnMes = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const inicioMes = new Date(Date.UTC(anio, mes - 1, 1));
  const finMes = new Date(Date.UTC(anio, mes - 1, diasEnMes));

  if (hasta < inicioMes) return 0;
  const topeDia =
    hasta > finMes
      ? diasEnMes
      : new Date(Date.UTC(hasta.getUTCFullYear(), hasta.getUTCMonth(), hasta.getUTCDate())).getUTCDate();

  let n = 0;
  for (let d = 1; d <= topeDia; d++) {
    const dow = new Date(Date.UTC(anio, mes - 1, d)).getUTCDay();
    if (esHabil(dow, ymd(anio, mes, d), festivos)) n++;
  }
  return n;
}

/** ¿El período "YYYY-MM" es el mes en curso respecto de `hoy`? */
export function esMesEnCurso(periodo: string, hoy: Date): boolean {
  const { anio, mes } = partesPeriodo(periodo);
  return hoy.getUTCFullYear() === anio && hoy.getUTCMonth() + 1 === mes;
}
