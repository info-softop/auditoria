import { db } from "@/lib/db";

export interface CuentaConSaldo {
  id: string;
  nombre: string;
  bankCode: string | null;
  tipoCuenta: string; // bank | gateway
  numeroCuenta: string | null;
  moneda: string;
  activa: boolean;
  opticaNombre: string | null;
  saldo: number; // saldoInicial + Σ ingresos − Σ egresos
}

/** Suma de ingresos/egresos por cuenta (para el saldo del día). */
async function totalesPorCuenta(): Promise<{
  ingresos: Map<string, number>;
  egresos: Map<string, number>;
}> {
  const sums = await db.movimientoBancario.groupBy({
    by: ["cuentaId", "direccion"],
    _sum: { monto: true },
  });
  const ingresos = new Map<string, number>();
  const egresos = new Map<string, number>();
  for (const s of sums) {
    const m = s._sum.monto ?? 0;
    (s.direccion === "in" ? ingresos : egresos).set(s.cuentaId, m);
  }
  return { ingresos, egresos };
}

/** Cuentas bancarias con su saldo del día (auditable desde el ledger). */
export async function cuentasConSaldo(): Promise<CuentaConSaldo[]> {
  const [cuentas, { ingresos, egresos }] = await Promise.all([
    db.cuentaBancaria.findMany({
      orderBy: [{ activa: "desc" }, { sortOrder: "asc" }, { nombre: "asc" }],
      include: { optica: { select: { nombre: true } } },
    }),
    totalesPorCuenta(),
  ]);

  return cuentas.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    bankCode: c.bankCode,
    tipoCuenta: c.tipoCuenta,
    numeroCuenta: c.numeroCuenta,
    moneda: c.moneda,
    activa: c.activa,
    opticaNombre: c.optica?.nombre ?? null,
    saldo: c.saldoInicial + (ingresos.get(c.id) ?? 0) - (egresos.get(c.id) ?? 0),
  }));
}

export interface MovimientoConSaldo {
  id: string;
  fecha: Date;
  direccion: string;
  monto: number;
  concepto: string;
  categoria: string | null;
  origen: string;
  conciliado: boolean;
  saldoCorrido: number;
}

/** Detalle de una cuenta con sus movimientos y el saldo corrido. */
export async function detalleCuenta(cuentaId: string): Promise<{
  cuenta: Awaited<ReturnType<typeof db.cuentaBancaria.findUnique>>;
  movimientos: MovimientoConSaldo[];
  saldo: number;
} | null> {
  const cuenta = await db.cuentaBancaria.findUnique({
    where: { id: cuentaId },
    include: { optica: { select: { nombre: true } } },
  });
  if (!cuenta) return null;

  const movs = await db.movimientoBancario.findMany({
    where: { cuentaId },
    orderBy: [{ fecha: "asc" }, { createdAt: "asc" }],
  });

  let saldo = cuenta.saldoInicial;
  const movimientos: MovimientoConSaldo[] = movs.map((m) => {
    saldo += m.direccion === "in" ? m.monto : -m.monto;
    return {
      id: m.id,
      fecha: m.fecha,
      direccion: m.direccion,
      monto: m.monto,
      concepto: m.concepto,
      categoria: m.categoria,
      origen: m.origen,
      conciliado: m.conciliado,
      saldoCorrido: saldo,
    };
  });
  // Orden descendente para mostrar (lo más reciente arriba).
  movimientos.reverse();

  return { cuenta, movimientos, saldo };
}
