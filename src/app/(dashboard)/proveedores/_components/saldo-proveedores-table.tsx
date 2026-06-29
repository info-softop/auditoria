import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatCOP } from "@/lib/format";

export interface SaldoProveedor {
  proveedor: string;
  comprado: number;
  pagado: number;
  saldo: number;
}

export function SaldoProveedoresTable({ filas }: { filas: SaldoProveedor[] }) {
  const totales = filas.reduce(
    (acc, f) => {
      acc.comprado += f.comprado;
      acc.pagado += f.pagado;
      acc.saldo += f.saldo;
      return acc;
    },
    { comprado: 0, pagado: 0, saldo: 0 }
  );

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Proveedor</TableHead>
          <TableHead className="text-right">Comprado</TableHead>
          <TableHead className="text-right">Pagado</TableHead>
          <TableHead className="text-right">Saldo pendiente</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filas.map((f) => (
          <TableRow key={f.proveedor}>
            <TableCell className="font-medium">{f.proveedor}</TableCell>
            <TableCell className="text-right tabular-nums-fin">
              {formatCOP(f.comprado)}
            </TableCell>
            <TableCell className="text-right tabular-nums-fin">
              {formatCOP(f.pagado)}
            </TableCell>
            <TableCell
              className={cn(
                "text-right tabular-nums-fin font-medium",
                f.saldo > 0 && "text-sev-alta"
              )}
            >
              {formatCOP(f.saldo)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell>Total</TableCell>
          <TableCell className="text-right tabular-nums-fin">
            {formatCOP(totales.comprado)}
          </TableCell>
          <TableCell className="text-right tabular-nums-fin">
            {formatCOP(totales.pagado)}
          </TableCell>
          <TableCell
            className={cn(
              "text-right tabular-nums-fin",
              totales.saldo > 0 && "text-sev-alta"
            )}
          >
            {formatCOP(totales.saldo)}
          </TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}
