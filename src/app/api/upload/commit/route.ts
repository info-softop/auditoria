import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { detectReportType, parseReport } from "@/lib/parsers/detect";
import { readSheet, periodoFromDate } from "@/lib/parsers/utils";
import { persistReport } from "@/lib/persist";
import { db } from "@/lib/db";
import { runCrossChecks } from "@/lib/cross-checks";
import { detectOpticaFromFilename } from "@/lib/optica-from-filename";
import type { TipoReporte } from "@/lib/audit-types";
import type { ParsedRow } from "@/lib/parsers/types";

// Campo de fecha por tipo de reporte, para derivar el período de cada fila.
const DATE_FIELD: Record<TipoReporte, string> = {
  VENTA_DETALLADA: "fecha",
  PEDIDO_LENTES: "fechaOrden",
  GASTOS: "fecha",
  COMPROBANTES: "fecha",
  PAGOS_PROVEEDORES: "fecha",
  CUENTAS_POR_PAGAR: "fecha",
};

// Confirma la carga: separa las filas por (óptica × mes real) y persiste cada grupo.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (session.user.role === "VIEWER") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file");
  const periodoFallback = String(form.get("periodo") ?? "");
  const opticaIdManual = form.get("opticaId") ? String(form.get("opticaId")) : null;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Archivo faltante" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}$/.test(periodoFallback)) {
    return NextResponse.json({ error: "Período inválido" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { headers } = readSheet(buffer);
  const tipoReporte = detectReportType(headers);
  if (!tipoReporte) {
    return NextResponse.json({ error: "Tipo de reporte no reconocido" }, { status: 422 });
  }

  const result = parseReport(tipoReporte, buffer);
  const traeOptica = result.opticas.length > 0;

  // Para reportes sin óptica: usar la selección manual o detectar por el ID
  // en el nombre del archivo. Prioriza la manual si viene.
  let opticaIdResuelta = opticaIdManual;
  if (!traeOptica && !opticaIdResuelta) {
    const detectada = await detectOpticaFromFilename(file.name);
    opticaIdResuelta = detectada?.id ?? null;
  }

  if (!traeOptica && !opticaIdResuelta) {
    return NextResponse.json(
      {
        error:
          "No se pudo determinar la óptica. Nombra el archivo con el ID de la óptica (ej. ...14676420.xlsx) o selecciónala manualmente.",
      },
      { status: 400 }
    );
  }

  const dateField = DATE_FIELD[tipoReporte];

  // Resuelve el período de una fila desde su fecha; si no tiene, usa el fallback.
  const rowPeriodo = (row: ParsedRow<Record<string, unknown>>): string => {
    const fecha = row.data[dateField] as Date | null | undefined;
    return periodoFromDate(fecha ?? null) ?? periodoFallback;
  };
  // Nombre de óptica de una fila (solo reportes que la traen).
  const rowOpticaNombre = (row: ParsedRow<Record<string, unknown>>): string =>
    String((row.data as { optica?: string }).optica ?? "").trim();

  // Resolver/crear ópticas detectadas en el archivo.
  const opticas = await db.optica.findMany();
  const byNombre = new Map(opticas.map((o) => [o.nombre.trim().toLowerCase(), o]));
  if (traeOptica) {
    for (const nombre of result.opticas) {
      const key = nombre.trim().toLowerCase();
      if (!byNombre.has(key)) {
        const nueva = await db.optica.create({
          data: { nombre: nombre.trim(), grupo: "Sin grupo" },
        });
        byNombre.set(key, nueva);
      }
    }
  }

  // Agrupar filas por (opticaId × período).
  const grupos = new Map<string, { opticaId: string; periodo: string; rows: ParsedRow<Record<string, unknown>>[] }>();
  for (const row of result.rows as unknown as ParsedRow<Record<string, unknown>>[]) {
    const opticaId = traeOptica
      ? byNombre.get(rowOpticaNombre(row).toLowerCase())?.id
      : opticaIdResuelta!;
    if (!opticaId) continue; // óptica no resoluble (no debería pasar)
    const periodo = rowPeriodo(row);
    const key = `${opticaId}|${periodo}`;
    if (!grupos.has(key)) grupos.set(key, { opticaId, periodo, rows: [] });
    grupos.get(key)!.rows.push(row);
  }

  const importacionesCreadas: string[] = [];
  const opticasAfectadas = new Set<string>();
  let totalInsertadas = 0;
  let totalDuplicadas = 0;

  for (const { opticaId, periodo, rows } of grupos.values()) {
    const res = await persistReport({
      opticaId,
      periodo,
      tipoReporte,
      fileName: file.name,
      userId: session.user.id,
      result: { ...result, rows },
    });
    if (res.imp) importacionesCreadas.push(res.imp.id);
    totalInsertadas += res.insertadas;
    totalDuplicadas += res.duplicadas;
    // La óptica se reprocesa aunque todo fueran duplicados (cruces idempotentes).
    opticasAfectadas.add(opticaId);
  }

  // Re-ejecutar cruces en TODOS los períodos de las ópticas afectadas: el cruce
  // de costo de lente vincula venta↔pedido por ORDEN sin importar el mes, así
  // que subir un reporte de un mes puede resolver costos de otros meses.
  for (const opticaId of opticasAfectadas) {
    const periodos = await db.importacion.findMany({
      where: { opticaId },
      distinct: ["periodo"],
      select: { periodo: true },
    });
    for (const { periodo } of periodos) {
      await runCrossChecks(opticaId, periodo);
    }
  }

  return NextResponse.json({
    ok: true,
    importaciones: importacionesCreadas,
    grupos: grupos.size,
    insertadas: totalInsertadas,
    duplicadas: totalDuplicadas,
    periodos: [...new Set([...grupos.values()].map((g) => g.periodo))].sort(),
  });
}
