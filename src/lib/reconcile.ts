import { db } from "@/lib/db";
import type { BankMovement } from "@/lib/bank-statement";

export interface SoftopMovement {
  fecha: Date | null;
  descripcion: string;
  valor: number;
  tipo: "INGRESO" | "EGRESO";
  origen: string; // "Consignación" | "Pago a proveedor"
}

export interface MatchedPair {
  softop: SoftopMovement;
  banco: BankMovement;
  difValor: number;
}

export interface ReconcileResult {
  conciliados: MatchedPair[];
  soloSoftop: SoftopMovement[]; // registrado en Softop, ausente en el banco
  soloBanco: BankMovement[]; // en el banco, sin registro en Softop
  resumen: {
    totalSoftop: number;
    totalBanco: number;
    nConciliados: number;
    nSoloSoftop: number;
    nSoloBanco: number;
    montoConciliado: number;
  };
}

/** Reúne los movimientos discretos que Softop espera ver en el banco. */
async function softopMovements(
  opticaId: string | null,
  periodo: string
): Promise<SoftopMovement[]> {
  const impWhere = { periodo, ...(opticaId ? { opticaId } : {}) };

  const [consignaciones, pagosBanco] = await Promise.all([
    db.comprobanteRow.findMany({
      where: { importacion: impWhere, total: { gt: 0 } },
      select: { fecha: true, total: true, noComprobante: true },
    }),
    db.pagoProveedorRow.findMany({
      where: {
        importacion: impWhere,
        credito: { gt: 0 },
        descripcion: { startsWith: "banco", mode: "insensitive" },
      },
      select: { fecha: true, credito: true, proveedor: true },
    }),
  ]);

  const movs: SoftopMovement[] = [];
  for (const c of consignaciones) {
    movs.push({
      fecha: c.fecha,
      descripcion: `Consignación ${c.noComprobante ?? ""}`.trim(),
      valor: c.total ?? 0,
      tipo: "INGRESO",
      origen: "Consignación",
    });
  }
  for (const p of pagosBanco) {
    movs.push({
      fecha: p.fecha,
      descripcion: `Pago ${p.proveedor ?? ""}`.trim(),
      valor: p.credito ?? 0,
      tipo: "EGRESO",
      origen: "Pago a proveedor",
    });
  }
  return movs;
}

function daysBetween(a: Date | null, b: Date | null): number {
  if (!a || !b) return 0; // si falta alguna fecha, no penaliza
  return Math.abs(a.getTime() - b.getTime()) / 86_400_000;
}

/**
 * Concilia los movimientos del extracto contra los de Softop.
 * Empareja por tipo + monto (±tolerancia) + cercanía de fecha (±5 días).
 */
export async function reconcile(
  opticaId: string | null,
  periodo: string,
  banco: BankMovement[]
): Promise<ReconcileResult> {
  const softop = await softopMovements(opticaId, periodo);
  const bancoLibres = banco.map((b, i) => ({ b, i, usado: false }));

  const conciliados: MatchedPair[] = [];
  const soloSoftop: SoftopMovement[] = [];

  for (const s of softop) {
    const tol = Math.max(100, s.valor * 0.01);
    // Mejor candidato: mismo tipo, dentro de tolerancia, menor distancia de fecha.
    let best = -1;
    let bestScore = Infinity;
    for (const cand of bancoLibres) {
      if (cand.usado) continue;
      if (cand.b.tipo !== s.tipo) continue;
      const dif = Math.abs(cand.b.valor - s.valor);
      if (dif > tol) continue;
      const dias = daysBetween(s.fecha, cand.b.fecha);
      if (dias > 5) continue;
      const score = dif + dias * 10;
      if (score < bestScore) {
        bestScore = score;
        best = cand.i;
      }
    }
    if (best >= 0) {
      const cand = bancoLibres.find((x) => x.i === best)!;
      cand.usado = true;
      conciliados.push({ softop: s, banco: cand.b, difValor: cand.b.valor - s.valor });
    } else {
      soloSoftop.push(s);
    }
  }

  const soloBanco = bancoLibres.filter((x) => !x.usado).map((x) => x.b);

  return {
    conciliados,
    soloSoftop,
    soloBanco,
    resumen: {
      totalSoftop: softop.reduce((a, m) => a + m.valor, 0),
      totalBanco: banco.reduce((a, m) => a + m.valor, 0),
      nConciliados: conciliados.length,
      nSoloSoftop: soloSoftop.length,
      nSoloBanco: soloBanco.length,
      montoConciliado: conciliados.reduce((a, m) => a + m.softop.valor, 0),
    },
  };
}
