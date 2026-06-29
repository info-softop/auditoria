import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];

export async function POST(
  req: Request,
  { params }: { params: Promise<{ comprobanteId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (session.user.role === "VIEWER") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { comprobanteId } = await params;

  const comprobante = await db.comprobanteRow.findUnique({
    where: { id: comprobanteId },
    select: { id: true },
  });
  if (!comprobante) {
    return NextResponse.json({ error: "Traslado no encontrado" }, { status: 404 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Se esperaba un formulario multipart con un archivo" },
      { status: 400 }
    );
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Archivo faltante" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "Archivo vacío" }, { status: 400 });
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

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileUrl = await storage.save(
    buffer,
    file.name || "comprobante",
    file.type || "application/octet-stream"
  );

  const foto = await db.consignacionFoto.create({
    data: {
      comprobanteId,
      fileUrl,
      uploadedById: session.user.id,
    },
    select: { id: true, fileUrl: true, uploadedAt: true },
  });

  return NextResponse.json({ ok: true, foto }, { status: 201 });
}
