import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { parseBankStatement } from "@/lib/bank-statement";
import { reconcile } from "@/lib/reconcile";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");
  const periodo = String(form.get("periodo") ?? "");
  const opticaId = form.get("opticaId") ? String(form.get("opticaId")) : null;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Archivo faltante" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}$/.test(periodo)) {
    return NextResponse.json({ error: "Selecciona un período" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = parseBankStatement(Buffer.from(await file.arrayBuffer()));
  } catch {
    return NextResponse.json(
      { error: "No se pudo leer el extracto. Sube un Excel o CSV del banco." },
      { status: 400 }
    );
  }

  if (parsed.movimientos.length === 0) {
    return NextResponse.json(
      {
        error:
          "No se detectaron movimientos. Verifica que el archivo tenga columnas de fecha y valor (o débito/crédito).",
        columnasDetectadas: parsed.columnasDetectadas,
      },
      { status: 422 }
    );
  }

  const result = await reconcile(opticaId, periodo, parsed.movimientos);

  return NextResponse.json({
    ok: true,
    columnasDetectadas: parsed.columnasDetectadas,
    movimientosExtracto: parsed.movimientos.length,
    ...result,
  });
}
