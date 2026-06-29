import { db } from "@/lib/db";
import { BrandLogo } from "@/components/brand-logo";
import { TrasladoForm } from "./_components/traslado-form";

export const dynamic = "force-dynamic";

export default async function RegistrarTrasladoPage() {
  const opticas = await db.optica.findMany({
    where: { activa: true },
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true },
  });

  return (
    <div className="w-full max-w-md">
      <div className="mb-6 flex flex-col items-center gap-2 text-center">
        <BrandLogo variant="horizontal" height={28} priority />
        <h1 className="font-heading text-xl tracking-tight">
          Registrar consignación
        </h1>
        <p className="text-sm text-muted-foreground">
          Sube el valor, la óptica y la foto del comprobante. Queda pendiente de
          revisión del auditor.
        </p>
      </div>
      <TrasladoForm opticas={opticas} />
    </div>
  );
}
