import { db } from "@/lib/db";

export interface RankingAsesora {
  asesora: string;
  ventas: number; // ingreso por líneas (Σ precioVenta)
  ordenes: number;
  unidades: number;
  margenBruto: number;
  margenPct: number;
  descuento: number;
  ticket: number;
}

export interface MixItem {
  nombre: string;
  ventas: number;
  margenBruto: number;
  margenPct: number;
  unidades: number;
}

export interface ProductoItem {
  producto: string;
  ventas: number;
  margenBruto: number;
  margenPct: number;
  unidades: number;
}

export interface AnalisisComercial {
  descuentoTotal: number;
  descuentoPct: number; // Σ descuento / Σ (precioLista × cantidad)
  upt: number; // unidades por orden
  asesoras: RankingAsesora[];
  categorias: MixItem[];
  marcas: MixItem[];
  topProductos: ProductoItem[];
  bajoMargen: ProductoItem[];
}

/** Período anterior ("YYYY-MM" − 1 mes). */
export function periodoAnterior(periodo: string): string {
  const [y, m] = periodo.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

interface Acc {
  ventas: number;
  margen: number;
  unidades: number;
  descuento: number;
  ordenes: Set<string>;
}

function nuevoAcc(): Acc {
  return { ventas: 0, margen: 0, unidades: 0, descuento: 0, ordenes: new Set() };
}

function mix(map: Map<string, Acc>): MixItem[] {
  return [...map.entries()]
    .map(([nombre, a]) => ({
      nombre,
      ventas: a.ventas,
      margenBruto: a.margen,
      margenPct: a.ventas > 0 ? (a.margen / a.ventas) * 100 : 0,
      unidades: a.unidades,
    }))
    .filter((m) => m.ventas > 0)
    .sort((x, y) => y.ventas - x.ventas);
}

/**
 * Métricas comerciales por asesora, categoría, marca y producto para un período
 * (opcional óptica). Se calcula SOLO sobre líneas tipoMovimiento='Venta' (las
 * filas "Abono" repiten los productos y duplicarían los agregados de línea).
 */
export async function analisisComercial(
  periodo: string,
  opticaId?: string | null
): Promise<AnalisisComercial> {
  const rows = await db.ventaDetalladaRow.findMany({
    where: {
      importacion: { periodo, tipoReporte: "VENTA_DETALLADA", ...(opticaId ? { opticaId } : {}) },
      // Insensible a mayúsculas ("VENTA"/"venta") — P-2.
      tipoMovimiento: { equals: "Venta", mode: "insensitive" },
    },
    select: {
      atendidoPor: true,
      categoria: true,
      marca: true,
      referencia: true,
      idProducto: true,
      consecutivo: true,
      cantidad: true,
      precioLista: true,
      precioVenta: true,
      costoCompra: true,
      descuento: true,
    },
  });

  const porAsesora = new Map<string, Acc>();
  const porCategoria = new Map<string, Acc>();
  const porMarca = new Map<string, Acc>();
  const porProducto = new Map<string, Acc>();

  let descuentoTotal = 0;
  let baseDescuento = 0; // Σ precioLista × cantidad
  let unidadesTotal = 0;
  const ordenesTotal = new Set<string>();

  const sumar = (map: Map<string, Acc>, clave: string, r: (typeof rows)[number]) => {
    const a = map.get(clave) ?? nuevoAcc();
    const pv = r.precioVenta ?? 0;
    a.ventas += pv;
    a.margen += pv - (r.costoCompra ?? 0);
    a.unidades += r.cantidad ?? 0;
    a.descuento += r.descuento ?? 0;
    if (r.consecutivo) a.ordenes.add(r.consecutivo);
    map.set(clave, a);
  };

  for (const r of rows) {
    const asesora = (r.atendidoPor ?? "").trim() || "Sin asignar";
    const categoria = (r.categoria ?? "").trim() || "Sin categoría";
    const marca = (r.marca ?? "").trim() || "Sin marca";
    // El nombre legible del producto está en MARCA (ej. "ZEISS VS 1.6...").
    // REFERENCIA es un número, así que NO se usa como nombre.
    const producto =
      (r.marca ?? "").trim() ||
      (r.categoria ?? "").trim() ||
      "Sin nombre";

    sumar(porAsesora, asesora, r);
    sumar(porCategoria, categoria, r);
    sumar(porMarca, marca, r);
    sumar(porProducto, producto, r);

    descuentoTotal += r.descuento ?? 0;
    baseDescuento += (r.precioLista ?? 0) * (r.cantidad ?? 0);
    unidadesTotal += r.cantidad ?? 0;
    if (r.consecutivo) ordenesTotal.add(r.consecutivo);
  }

  const asesoras: RankingAsesora[] = [...porAsesora.entries()]
    .map(([asesora, a]) => ({
      asesora,
      ventas: a.ventas,
      ordenes: a.ordenes.size,
      unidades: a.unidades,
      margenBruto: a.margen,
      margenPct: a.ventas > 0 ? (a.margen / a.ventas) * 100 : 0,
      descuento: a.descuento,
      ticket: a.ordenes.size > 0 ? a.ventas / a.ordenes.size : 0,
    }))
    .filter((x) => x.ventas > 0)
    .sort((x, y) => y.ventas - x.ventas);

  const productos: ProductoItem[] = [...porProducto.entries()]
    .map(([producto, a]) => ({
      producto,
      ventas: a.ventas,
      margenBruto: a.margen,
      margenPct: a.ventas > 0 ? (a.margen / a.ventas) * 100 : 0,
      unidades: a.unidades,
    }))
    .filter((p) => p.ventas > 0);

  return {
    descuentoTotal,
    descuentoPct: baseDescuento > 0 ? (descuentoTotal / baseDescuento) * 100 : 0,
    upt: ordenesTotal.size > 0 ? unidadesTotal / ordenesTotal.size : 0,
    asesoras,
    categorias: mix(porCategoria),
    marcas: mix(porMarca),
    topProductos: [...productos].sort((x, y) => y.ventas - x.ventas).slice(0, 8),
    bajoMargen: productos
      .filter((p) => p.unidades >= 3)
      .sort((x, y) => x.margenPct - y.margenPct)
      .slice(0, 6),
  };
}
