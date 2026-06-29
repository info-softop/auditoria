// Mapeo de método de pago → cuenta destino del dinero (conciliación bancaria).
// Cada óptica tiene su propia Banco de Bogotá Corriente y Bancolombia Ahorros.

export type CuentaDestino = "CAJA_MENOR" | "BANCO_BOGOTA" | "BANCOLOMBIA";

export const CUENTA_LABEL: Record<CuentaDestino, string> = {
  CAJA_MENOR: "Caja Menor (efectivo)",
  BANCO_BOGOTA: "Banco de Bogotá Corriente",
  BANCOLOMBIA: "Bancolombia Ahorros",
};

export const CUENTA_ORDEN: CuentaDestino[] = [
  "CAJA_MENOR",
  "BANCO_BOGOTA",
  "BANCOLOMBIA",
];

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // sin acentos
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

// Clave = m\u00e9todo de pago normalizado (sin acentos, min\u00fasculas).
const METODO_A_CUENTA: Record<string, CuentaDestino> = {
  efectivo: "CAJA_MENOR",
  "tarjeta debito": "BANCO_BOGOTA",
  "tarjeta credito": "BANCO_BOGOTA",
  "transferencia bogota": "BANCO_BOGOTA",
  "transferencia aval": "BANCO_BOGOTA", // Grupo Aval → Banco de Bogotá
  "credito addi": "BANCO_BOGOTA", // Addi paga a 30 días
  bancolombia: "BANCOLOMBIA",
  "bancolombia 0457_optica": "BANCOLOMBIA",
};

// Métodos con desfase de desembolso (días) hasta que llega al banco.
const METODO_DEMORA_DIAS: Record<string, number> = {
  "credito addi": 30,
};

export function cuentaDeMetodo(metodo: string | null | undefined): CuentaDestino | null {
  if (!metodo) return null;
  return METODO_A_CUENTA[norm(metodo)] ?? null;
}

export function demoraDeMetodo(metodo: string | null | undefined): number {
  if (!metodo) return 0;
  return METODO_DEMORA_DIAS[norm(metodo)] ?? 0;
}
