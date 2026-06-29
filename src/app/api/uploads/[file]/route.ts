import { NextResponse } from "next/server";
import { auth } from "@/auth";

/**
 * Sirve las fotos de consignaciones/traslados desde un bucket de GCS PRIVADO.
 * Solo usuarios con sesión pueden verlas (documentos financieros). El bucket no
 * es público; este endpoint usa las credenciales de la app (ADC en Cloud Run).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ file: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("No autorizado", { status: 401 });
  }

  const bucket = process.env.GCS_BUCKET;
  if (!bucket) {
    return new NextResponse("Almacenamiento no configurado", { status: 404 });
  }

  const { file } = await params;
  // El segmento es un único nombre de archivo (sin slashes); evita path traversal.
  if (!file || file.includes("/") || file.includes("..")) {
    return new NextResponse("Solicitud inválida", { status: 400 });
  }

  try {
    const { Storage } = await import("@google-cloud/storage");
    const gcsFile = new Storage().bucket(bucket).file(`uploads/${file}`);
    const [buffer] = await gcsFile.download();
    const [meta] = await gcsFile.getMetadata();
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": meta.contentType ?? "application/octet-stream",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch {
    return new NextResponse("No encontrado", { status: 404 });
  }
}
