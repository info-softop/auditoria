/**
 * Festivos nacionales de Colombia. Calculados por año (no hardcodeados) para que
 * sirvan en cualquier mes/período:
 *  - Fijos: no se mueven.
 *  - Ley Emiliani: se trasladan al lunes siguiente si no caen en lunes.
 *  - Semana Santa / móviles: relativos a la Pascua (algoritmo de Computus).
 *
 * Todo en UTC; las claves son "YYYY-MM-DD".
 */

function ymd(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate()
  ).padStart(2, "0")}`;
}

/** Domingo de Pascua del año (Meeus/Jones/Butcher, calendario gregoriano). */
function pascua(anio: number): Date {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31); // 3 = marzo, 4 = abril
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(anio, mes - 1, dia));
}

/** Traslada al lunes siguiente (Ley Emiliani); si ya es lunes, no cambia. */
function siguienteLunes(d: Date): Date {
  const add = (1 - d.getUTCDay() + 7) % 7; // domingo→+1, martes→+6, lunes→0
  return new Date(d.getTime() + add * 86_400_000);
}

const DIA = 86_400_000;

/** Conjunto de festivos colombianos ("YYYY-MM-DD") del año dado. */
export function festivosColombia(anio: number): Set<string> {
  const f = new Set<string>();
  const add = (mes: number, dia: number) =>
    f.add(ymd(new Date(Date.UTC(anio, mes - 1, dia))));
  const addEmiliani = (mes: number, dia: number) =>
    f.add(ymd(siguienteLunes(new Date(Date.UTC(anio, mes - 1, dia)))));

  // Fijos (no se trasladan).
  add(1, 1); // Año Nuevo
  add(5, 1); // Día del Trabajo
  add(7, 20); // Independencia
  add(8, 7); // Batalla de Boyacá
  add(12, 8); // Inmaculada Concepción
  add(12, 25); // Navidad

  // Ley Emiliani (lunes siguiente).
  addEmiliani(1, 6); // Reyes Magos
  addEmiliani(3, 19); // San José
  addEmiliani(6, 29); // San Pedro y San Pablo
  addEmiliani(8, 15); // Asunción de la Virgen
  addEmiliani(10, 12); // Día de la Raza
  addEmiliani(11, 1); // Todos los Santos
  addEmiliani(11, 11); // Independencia de Cartagena

  // Móviles (relativos a la Pascua). Los offsets de Ascensión, Corpus y Sagrado
  // Corazón ya incluyen el traslado a lunes.
  const p = pascua(anio).getTime();
  const off = (n: number) => f.add(ymd(new Date(p + n * DIA)));
  off(-3); // Jueves Santo
  off(-2); // Viernes Santo
  off(43); // Ascensión del Señor
  off(64); // Corpus Christi
  off(71); // Sagrado Corazón

  return f;
}
