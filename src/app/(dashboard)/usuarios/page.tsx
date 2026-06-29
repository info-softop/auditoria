import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
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
import { formatFecha } from "@/lib/format";
import { UserDialog } from "./_components/user-dialog";
import { RoleSelect } from "./_components/role-select";

export default async function UsuariosPage() {
  await requireRole(["ADMIN"]);

  const usuarios = await db.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  return (
    <>
      <PageHeader
        title="Usuarios"
        description="Gestiona las cuentas de acceso y sus roles dentro del sistema."
      >
        <UserDialog />
      </PageHeader>

      <Card>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Correo</TableHead>
                  <TableHead>Creado</TableHead>
                  <TableHead className="w-44">Rol</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usuarios.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="py-10 text-center text-muted-foreground"
                    >
                      No hay usuarios registrados.
                    </TableCell>
                  </TableRow>
                )}
                {usuarios.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {u.email}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatFecha(u.createdAt)}
                    </TableCell>
                    <TableCell>
                      <RoleSelect userId={u.id} role={u.role} />
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
