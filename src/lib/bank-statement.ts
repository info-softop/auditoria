import * as XLSX from "xlsx";
import { toNum, toDate, decodeEntities } from "@/lib/parsers/utils";

/** Un movimiento individual del extracto bancario, ya normalizado. */
export interface BankMovement {
  fecha: Date | null;
  descripcion: string;
  valor: number; // valor absoluto
  tipo: "INGRESO" | "EGRESO";
}

const DATE_HINTS = ["fecha", "date", "dia"];
const DESC_HINTS = ["descrip", "detalle", "concepto", "referencia", "transacc", "movimiento"];
const VALUE_HINTS = ["valor", "monto", "importe"];
const DEBIT_HINTS = ["debito", "débito", "debe", "cargo", "retiro", "egreso"];
const CREDIT_HINTS = ["credito", "crédito", "haber", "abono", "consign", "deposito", "ingreso"];

function matchCol(headers: string[], hints: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].toLowerCase();
    if (hints.some((hint) => h.includes(hint))) return i;
  }
  return -1;
}

/**
 * Parser HEURÍSTICO de extracto bancario (xlsx/csv). Auto-detecta:
 *  - la fila de encabezados (busca en las primeras 20 filas),
 *  - columnas de fecha, descripción y valor (columna única con signo,
 *    o columnas separadas de débito/crédito).
 * Cubre la mayoría de exportaciones de bancos colombianos. Para un formato
 * muy particular basta ajustar las pistas (HINTS) o añadir un caso.
 */
export function parseBankStatement(buffer: Buffer): {
  movimientos: BankMovement[];
  columnasDetectadas: { fecha: string; descripcion: string; valor: string };
} {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  });

  // Localizar la fila de encabezados: la primera (en las 20 iniciales) con
  // una pista de fecha y alguna de valor/débito/crédito.
  let headerRow = 0;
  for (let i = 0; i < Math.min(20, matrix.length); i++) {
    const cells = (matrix[i] ?? []).map((c) => String(c ?? "").toLowerCase());
    const hasFecha = cells.some((c) => DATE_HINTS.some((h) => c.includes(h)));
    const hasValor = cells.some((c) =>
      [...VALUE_HINTS, ...DEBIT_HINTS, ...CREDIT_HINTS].some((h) => c.includes(h))
    );
    if (hasFecha && hasValor) {
      headerRow = i;
      break;
    }
  }

  const headers = (matrix[headerRow] ?? []).map((h) => String(h ?? "").trim());
  const iFecha = matchCol(headers, DATE_HINTS);
  const iDesc = matchCol(headers, DESC_HINTS);
  const iValor = matchCol(headers, VALUE_HINTS);
  const iDebito = matchCol(headers, DEBIT_HINTS);
  const iCredito = matchCol(headers, CREDIT_HINTS);

  const movimientos: BankMovement[] = [];
  for (let r = headerRow + 1; r < matrix.length; r++) {
    const row = matrix[r] ?? [];
    if (row.every((c) => c == null || String(c).trim() === "")) continue;

    const fecha = iFecha >= 0 ? toDate(row[iFecha]) : null;
    const descripcion =
      iDesc >= 0 ? decodeEntities(String(row[iDesc] ?? "")).trim() : "";

    if (/saldo|total/i.test(descripcion) && !fecha) continue;

    let valor = 0;
    let tipo: "INGRESO" | "EGRESO";

    if (iDebito >= 0 || iCredito >= 0) {
      const deb = iDebito >= 0 ? toNum(row[iDebito]) : 0;
      const cred = iCredito >= 0 ? toNum(row[iCredito]) : 0;
      if (cred > 0) {
        valor = cred;
        tipo = "INGRESO";
      } else if (deb > 0) {
        valor = deb;
        tipo = "EGRESO";
      } else {
        continue;
      }
    } else if (iValor >= 0) {
      const v = toNum(row[iValor]);
      if (v === 0) continue;
      valor = Math.abs(v);
      tipo = v >= 0 ? "INGRESO" : "EGRESO";
    } else {
      continue;
    }

    movimientos.push({ fecha, descripcion, valor, tipo });
  }

  return {
    movimientos,
    columnasDetectadas: {
      fecha: iFecha >= 0 ? headers[iFecha] : "(no detectada)",
      descripcion: iDesc >= 0 ? headers[iDesc] : "(no detectada)",
      valor:
        iDebito >= 0 || iCredito >= 0
          ? `${iDebito >= 0 ? headers[iDebito] : ""}/${iCredito >= 0 ? headers[iCredito] : ""}`
          : iValor >= 0
            ? headers[iValor]
            : "(no detectada)",
    },
  };
}
