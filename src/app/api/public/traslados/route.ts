import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];

// Rate-limit BÁSICO por IP (en memoria; por instancia de Cloud Run). Frena abuso
// simple del link público. Para algo global haría falta un store compartido.
const RL_WINDOW_MS = 60_000;
const RL_MAX = 10; // máx. envíos por IP por minuto
const rlHits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (rlHits.get(ip) ?? []).filter((t) => now - t < RL_WINDOW_MS);
  arr.push(now);
  rlHits.set(ip, arr);
  if (rlHits.size > 5000) {
    for (const [k, v] of rlHits) if (v.every((t) => now - t >= RL_WINDOW_MS)) rlHits.delete(k);
  }
  return arr.length > RL_MAX;
}

/** Detecta el tipo REAL por magic bytes (no confía en el file.type del cliente). */
function sniffMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return "application/pdf"; // %PDF
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (buf.toString("ascii", 4, 8) === "ftyp") {
    const brand = buf.toString("ascii", 8, 12);
    if (["heic", "heix", "hevc", "heim", "heis", "mif1", "msf1"].includes(brand)) return "image/heic";
  }
  return null;
}

/**
 * Endpoint PÚBLICO (sin login) para registrar un traslado/consignación desde el
 * link que usan las asesoras. Recibe multipart: valor, opticaId, file y campos
 * opcionales (fecha, observacion, registradoPor). Todo entra como revisado=false
 * para que el auditor lo apruebe/concilie después.
 */
export async function POST(req: Request) {
  // Rate-limit por IP (Cloud Run pone la IP del cliente en x-forwarded-for).
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "desconocido";
  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Intenta de nuevo en un minuto." },
      { status: 429 }
    );
  }

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

  // Verificación por CONTENIDO (magic bytes): no confiar solo en el file.type
  // que envía el cliente (se puede falsear). Debe ser una imagen o PDF real.
  const realMime = sniffMime(buffer);
  if (!realMime || !ALLOWED.includes(realMime)) {
    return NextResponse.json(
      { error: "El archivo no es una imagen o PDF válido." },
      { status: 415 }
    );
  }

  const fileUrl = await storage.save(buffer, file.name || "consignacion", realMime);

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
