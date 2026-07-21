import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { detectReportType, parseReport } from "@/lib/parsers/detect";
import { readSheet } from "@/lib/parsers/utils";
import { TIPO_REPORTE_LABEL } from "@/lib/audit-types";
import { db } from "@/lib/db";
import { detectOpticaFromFilename } from "@/lib/optica-from-filename";
import { DATE_FIELD } from "@/lib/persist";

// Vista previa: detecta tipo y parsea, SIN persistir.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Archivo faltante" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let tipoReporte;
  try {
    const { headers } = readSheet(buffer);
    tipoReporte = detectReportType(headers);
  } catch {
    return NextResponse.json(
      { error: "No se pudo leer el archivo Excel." },
      { status: 400 }
    );
  }

  if (!tipoReporte) {
    return NextResponse.json(
      {
        error:
          "No se reconoció el tipo de reporte. Verifica que sea un Excel exportado de Softop.",
      },
      { status: 422 }
    );
  }

  const result = parseReport(tipoReporte, buffer);
  const filasConAlerta = result.rows.filter((r) => r.alerts.length > 0).length;

  // Rango de fechas de los datos (para mostrar hasta qué día llega el archivo).
  const dateField = DATE_FIELD[tipoReporte];
  let desde: Date | null = null;
  let hasta: Date | null = null;
  for (const r of result.rows) {
    const v = (r.data as unknown as Record<string, unknown>)[dateField];
    if (v instanceof Date && !Number.isNaN(v.getTime())) {
      if (!desde || v < desde) desde = v;
      if (!hasta || v > hasta) hasta = v;
    }
  }
  const rango = hasta
    ? { desde: desde!.toISOString().slice(0, 10), hasta: hasta.toISOString().slice(0, 10) }
    : null;

  // Para reportes sin columna óptica, detectar la óptica por el ID en el nombre.
  const opticaDetectada =
    result.opticas.length === 0
      ? await detectOpticaFromFilename(file.name)
      : null;

  // Resolver las ópticas de ESTE archivo (para acotar el aviso de duplicados
  // a la misma óptica: una carga de Óptica A no debe avisar por datos de B).
  let opticaIdsArchivo: string[] = [];
  if (result.opticas.length > 0) {
    const todas = await db.optica.findMany({ select: { id: true, nombre: true } });
    const byNombre = new Map(todas.map((o) => [o.nombre.trim().toLowerCase(), o.id]));
    opticaIdsArchivo = result.opticas
      .map((n) => byNombre.get(n.trim().toLowerCase()))
      .filter((id): id is string => Boolean(id));
  } else if (opticaDetectada) {
    opticaIdsArchivo = [opticaDetectada.id];
  }

  // Períodos del archivo que YA tienen datos de este tipo PARA LA MISMA óptica.
  // Al confirmar se REEMPLAZA ese (óptica, período, tipo): se borra lo anterior y
  // se carga el archivo nuevo. Si no se conoce la óptica, no se avisa nada todavía.
  const yaCargados =
    opticaIdsArchivo.length > 0
      ? await db.importacion.findMany({
          where: {
            tipoReporte,
            periodo: { in: result.periodos },
            opticaId: { in: opticaIdsArchivo },
          },
          select: {
            periodo: true,
            totalFilas: true,
            optica: { select: { nombre: true } },
          },
        })
      : [];

  return NextResponse.json({
    tipoReporte,
    tipoLabel: TIPO_REPORTE_LABEL[tipoReporte],
    periodos: result.periodos,
    opticas: result.opticas,
    rango, // { desde, hasta } en YYYY-MM-DD, o null si no hay fechas
    totalFilas: result.rows.length,
    filasConAlerta,
    opticaDetectada, // { id, nombre, codigoInterno } | null (solo reportes sin óptica)
    existentes: yaCargados.map((i) => ({
      periodo: i.periodo,
      optica: i.optica.nombre,
      filas: i.totalFilas,
    })),
    preview: result.rows.slice(0, 10).map((r) => ({
      rowIndex: r.rowIndex,
      data: r.data,
      alerts: r.alerts,
    })),
  });
}
