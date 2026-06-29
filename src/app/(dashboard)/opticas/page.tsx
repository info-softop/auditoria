import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { formatNumber } from "@/lib/format";
import { OpticaDialog } from "./_components/optica-dialog";
import { ToggleOptica } from "./_components/toggle-optica";

export default async function OpticasPage() {
  await requireRole(["ADMIN"]);

  const opticas = await db.optica.findMany({
    orderBy: [{ activa: "desc" }, { nombre: "asc" }],
    include: { _count: { select: { importaciones: true } } },
  });

  return (
    <>
      <PageHeader
        title="Ópticas"
        description="Administra las ópticas auditadas: crea, edita y activa o desactiva cada una."
      >
        <OpticaDialog />
      </PageHeader>

      <Card>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Grupo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Importaciones</TableHead>
                  <TableHead className="w-24 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {opticas.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-10 text-center text-muted-foreground"
                    >
                      No hay ópticas registradas todavía.
                    </TableCell>
                  </TableRow>
                )}
                {opticas.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">
                      {o.nombre}
                      {o.codigoInterno && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {o.codigoInterno}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {o.grupo}
                    </TableCell>
                    <TableCell>
                      {o.activa ? (
                        <Badge variant="secondary">Activa</Badge>
                      ) : (
                        <Badge variant="outline">Inactiva</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(o._count.importaciones)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <OpticaDialog
                          optica={{
                            id: o.id,
                            nombre: o.nombre,
                            grupo: o.grupo,
                            codigoInterno: o.codigoInterno,
                            activa: o.activa,
                          }}
                        />
                        <ToggleOptica id={o.id} activa={o.activa} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
