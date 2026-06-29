/**
 * Cálculo de nómina colombiana — seguridad social + prestaciones (portado de
 * softop-administrador). Valores 2026 (Decretos 1469/1470 de 2025):
 * SMMLV $1.750.905, auxilio $249.095. Actualizar SMMLV/AUX cada año.
 */
export const SMMLV_2026 = 1_750_905;
export const AUX_TRANSPORTE_2026 = 249_095;

/** Tarifas ARL por nivel de riesgo (I=oficina … V=alto riesgo). */
export const ARL_RIESGO: Record<number, number> = {
  1: 0.00522,
  2: 0.01044,
  3: 0.02436,
  4: 0.0435,
  5: 0.0696,
};

export interface NominaInput {
  salario: number;
  auxilioTransporte?: number;
  salarioIntegral?: boolean;
  riesgoArl?: number; // 1..5
  esPersonaJuridica?: boolean;
  esPrestacionServicios?: boolean;
}

export interface NominaResult {
  ibc: number;
  empleado: { salud: number; pension: number; fsp: number; total: number };
  empleador: {
    salud: number;
    pension: number;
    arl: number;
    sena: number;
    icbf: number;
    caja: number;
    total: number;
  };
  prestaciones: {
    cesantias: number;
    interesesCesantias: number;
    prima: number;
    vacaciones: number;
    total: number;
  };
  netoPagar: number;
  costoMensualEmpleador: number;
}

const r = (n: number) => Math.round(n);

/** Fondo de Solidaridad Pensional (empleado) según múltiplos de SMMLV del IBC. */
function fspRate(ibc: number): number {
  const m = ibc / SMMLV_2026;
  if (m < 4) return 0;
  if (m < 16) return 0.01;
  if (m < 17) return 0.012;
  if (m < 18) return 0.014;
  if (m < 19) return 0.016;
  if (m < 20) return 0.018;
  return 0.02;
}

export function calcularNominaCO(input: NominaInput): NominaResult {
  // Prestación de servicios: sin prestaciones ni aportes patronales.
  if (input.esPrestacionServicios) {
    return {
      ibc: 0,
      empleado: { salud: 0, pension: 0, fsp: 0, total: 0 },
      empleador: { salud: 0, pension: 0, arl: 0, sena: 0, icbf: 0, caja: 0, total: 0 },
      prestaciones: { cesantias: 0, interesesCesantias: 0, prima: 0, vacaciones: 0, total: 0 },
      netoPagar: input.salario,
      costoMensualEmpleador: input.salario,
    };
  }

  const salario = input.salario;
  const auxilio = input.auxilioTransporte ?? 0;
  const integral = !!input.salarioIntegral;
  const juridica = input.esPersonaJuridica ?? true;
  const arlRate = ARL_RIESGO[input.riesgoArl ?? 1] ?? ARL_RIESGO[1];

  // Base de cotización (IBC). Salario integral cotiza sobre el 70%.
  const ibc = integral ? salario * 0.7 : salario;
  const baseSocial = salario;
  const basePrestacional = salario + auxilio;

  // Exoneración Art. 114-1 ET: persona jurídica + salario < 10 SMMLV.
  const exonerado = juridica && salario < 10 * SMMLV_2026;

  // Empleado (deducciones de nómina).
  const eSalud = ibc * 0.04;
  const ePension = ibc * 0.04;
  const eFsp = ibc * fspRate(ibc);
  const empleadoTotal = eSalud + ePension + eFsp;

  // Empleador (aportes patronales).
  const pSalud = exonerado ? 0 : ibc * 0.085;
  const pPension = ibc * 0.12;
  const pArl = ibc * arlRate;
  const pSena = exonerado ? 0 : ibc * 0.02;
  const pIcbf = exonerado ? 0 : ibc * 0.03;
  const pCaja = ibc * 0.04;
  const empleadorTotal = pSalud + pPension + pArl + pSena + pIcbf + pCaja;

  // Prestaciones sociales (provisión mensual; no aplica en salario integral).
  const cesantias = integral ? 0 : basePrestacional * 0.0833;
  const interesesCesantias = integral ? 0 : basePrestacional * 0.01;
  const prima = integral ? 0 : basePrestacional * 0.0833;
  const vacaciones = integral ? 0 : baseSocial * 0.0417;
  const prestacionesTotal = cesantias + interesesCesantias + prima + vacaciones;

  const netoPagar = salario + auxilio - empleadoTotal;
  const costoMensualEmpleador = salario + auxilio + empleadorTotal + prestacionesTotal;

  return {
    ibc: r(ibc),
    empleado: { salud: r(eSalud), pension: r(ePension), fsp: r(eFsp), total: r(empleadoTotal) },
    empleador: {
      salud: r(pSalud),
      pension: r(pPension),
      arl: r(pArl),
      sena: r(pSena),
      icbf: r(pIcbf),
      caja: r(pCaja),
      total: r(empleadorTotal),
    },
    prestaciones: {
      cesantias: r(cesantias),
      interesesCesantias: r(interesesCesantias),
      prima: r(prima),
      vacaciones: r(vacaciones),
      total: r(prestacionesTotal),
    },
    netoPagar: r(netoPagar),
    costoMensualEmpleador: r(costoMensualEmpleador),
  };
}
