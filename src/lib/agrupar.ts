export interface GrupoAgg {
  label: string;
  monto: number;
  n: number;
}

/**
 * Agrupa filas por una clave normalizada (mayúsculas + espacios colapsados),
 * sumando un monto. Evita partir un mismo rubro/proveedor por diferencias de
 * casing/espacios (ej. "Optica popular" / "OPTICA POPULAR"). El label mostrado
 * es la variante original de mayor monto dentro del grupo.
 */
export function agrupar<T>(
  rows: T[],
  keyFn: (r: T) => string | null | undefined,
  montoFn: (r: T) => number
): GrupoAgg[] {
  const m = new Map<string, GrupoAgg & { _top: number }>();
  for (const r of rows) {
    const raw = (keyFn(r) ?? "").trim();
    if (!raw) continue;
    const key = raw.toUpperCase().replace(/\s+/g, " ");
    const monto = montoFn(r) || 0;
    const g = m.get(key) ?? { label: raw, monto: 0, n: 0, _top: -Infinity };
    g.monto += monto;
    g.n += 1;
    if (monto > g._top) {
      g._top = monto;
      g.label = raw;
    }
    m.set(key, g);
  }
  return [...m.values()]
    .map(({ label, monto, n }) => ({ label, monto, n }))
    .sort((a, b) => b.monto - a.monto);
}
