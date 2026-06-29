import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];

/**
 * Endpoint PÚBLICO (sin login) para registrar un traslado/consignación desde el
 * link que usan las asesoras. Recibe multipart: valor, opticaId, file y campos
 * opcionales (fecha, observacion, registradoPor). Todo entra como revisado=false
 * para que el auditor lo apruebe/concilie después.
 */
export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Se esperaba un formulario con la foto" },
      { status: 400 }
    );
  }

  const opticaId = String(form.get("opticaId") ?? "");
  const valor = Number(String(form.get("valor") ?? "").replace(/[^\d.-]/g, ""));
  const file = form.get("file");

  if (!opticaId) {
    return NextResponse.json({ error: "Selecciona la óptica" }, { status: 400 });
  }
  if (!Number.isFinite(valor) || valor <= 0) {
    return NextResponse.json({ error: "El valor debe ser mayor a 0" }, { status: 400 });
  }

  // La óptica debe existir y estar activa (evita basura/IDs inventados).
  const optica = await db.optica.findFirst({
    where: { id: opticaId, activa: true },
    select: { id: true },
  });
  if (!optica) {
    return NextResponse.json({ error: "Óptica no válida" }, { status: 400 });
  }

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Adjunta la foto de la consignación" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "El archivo supera los 10 MB" }, { status: 413 });
  }
  if (file.type && !ALLOWED.includes(file.type)) {
    return NextResponse.json(
      { error: "Formato no soportado (usa imagen o PDF)" },
      { status: 415 }
    );
  }

  const fechaRaw = String(form.get("fecha") ?? "").trim();
  const fecha = fechaRaw ? new Date(fechaRaw) : null;
  const registradoPor = String(form.get("registradoPor") ?? "").trim() || null;
  const observacion = String(form.get("observacion") ?? "").trim() || null;

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileUrl = await storage.save(
    buffer,
    file.name || "consignacion",
    file.type || "application/octet-stream"
  );

  await db.trasladoPublico.create({
    data: {
      opticaId,
      valor,
      fileUrl,
      fecha: fecha && !Number.isNaN(fecha.getTime()) ? fecha : null,
      registradoPor,
      observacion,
    },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
