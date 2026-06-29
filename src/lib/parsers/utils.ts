import * as XLSX from "xlsx";

export interface RawSheet {
  sheetName: string;
  headers: string[];
  rows: unknown[][];
}

/** Lee la primera hoja de un buffer Excel y devuelve encabezados + filas (como arrays). */
export function readSheet(buffer: Buffer | ArrayBuffer): RawSheet {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  });
  const headers = (matrix[0] ?? []).map((h) => String(h ?? "").trim());
  const rows = matrix.slice(1);
  return { sheetName, headers, rows };
}

/** Parsea un valor a número. Tolera strings con comas de miles y vacíos. */
export function toNum(x: unknown): number {
  if (x == null || x === "") return 0;
  if (typeof x === "number") return Number.isFinite(x) ? x : 0;
  const cleaned = String(x).replace(/\s/g, "").replace(/,/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/** Igual que toNum pero devuelve null si no es un número válido. */
export function toNumOrNull(x: unknown): number | null {
  if (x == null || x === "") return null;
  const n = toNum(x);
  return n === 0 && String(x).trim() !== "0" && String(x).trim() !== "" ? null : n;
}

/** Parsea fecha desde Date, serial Excel o string. Devuelve null si inválida. */
export function toDate(x: unknown): Date | null {
  if (x == null || x === "") return null;
  if (x instanceof Date) return Number.isNaN(x.getTime()) ? null : x;
  if (typeof x === "number") {
    // serial Excel
    const d = XLSX.SSF ? new Date(Math.round((x - 25569) * 86400 * 1000)) : null;
    return d && !Number.isNaN(d.getTime()) ? d : null;
  }
  const s = String(x).trim();
  if (!s || s.toUpperCase() === "NO") return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

const HTML_ENTITIES: Record<string, string> = {
  "&Oacute;": "Ó", "&oacute;": "ó", "&Aacute;": "Á", "&aacute;": "á",
  "&Eacute;": "É", "&eacute;": "é", "&Iacute;": "Í", "&iacute;": "í",
  "&Uacute;": "Ú", "&uacute;": "ú", "&Ntilde;": "Ñ", "&ntilde;": "ñ",
  "&Uuml;": "Ü", "&uuml;": "ü", "&amp;": "&", "&quot;": '"', "&#39;": "'",
  "&aacute": "á", "&nbsp;": " ",
};

/** Decodifica entidades HTML que Softop deja en sus exportaciones (ej. &Oacute;). */
export function decodeEntities(s: string): string {
  return s.replace(/&[a-zA-Z]+;?|&#\d+;/g, (m) => HTML_ENTITIES[m] ?? m);
}

export function str(x: unknown): string | null {
  if (x == null) return null;
  const s = decodeEntities(String(x)).trim();
  return s === "" ? null : s;
}

/** Normaliza texto para comparación: minúsculas, sin espacios extra. */
export function norm(x: unknown): string {
  return decodeEntities(String(x ?? "")).toLowerCase().trim().replace(/\s+/g, " ");
}

/** ¿Es una fila vacía o de totales? (heurística: sin valor en la columna llave). */
export function isBlankRow(row: unknown[]): boolean {
  return row.every((c) => c == null || String(c).trim() === "");
}

/** Deriva el período "YYYY-MM" desde una fecha. */
export function periodoFromDate(d: Date | null): string | null {
  if (!d) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
