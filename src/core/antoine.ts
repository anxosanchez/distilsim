/**
 * Ecuación de Antoine: presión de vapor de saturación.
 *
 * Forma usada (clásica, manuales):
 *   log10(P_sat[mmHg]) = A - B / (T[°C] + C)
 *
 * Todas las funciones de este módulo son puras y sin estado.
 */

export interface AntoineParams {
  /** A, adimensional (log10(P) en mmHg) */
  A: number
  /** B, en °C */
  B: number
  /** C, en °C */
  C: number
}

/** Presión de vapor de saturación en mmHg a la temperatura T (en °C). */
export function psatMMHg(p: AntoineParams, T_C: number): number {
  return Math.pow(10, p.A - p.B / (T_C + p.C))
}

/** Presión de vapor de saturación en kPa. */
export function psatKPa(p: AntoineParams, T_C: number): number {
  return psatMMHg(p, T_C) * 0.133322368
}

/** Temperatura (°C) a la que la presión de vapor iguala P (mmHg): inversa de Antoine. */
export function tsatFromPressure(p: AntoineParams, P_mmHg: number): number {
  return p.B / (p.A - Math.log10(P_mmHg)) - p.C
}

/** Temperatura normal de ebullición (°C a 760 mmHg). */
export function normalBoilingPoint(p: AntoineParams): number {
  return tsatFromPressure(p, 760)
}

/** Rango de validez recomendado (en °C), para informar al usuario. */
export function validRange(_p: AntoineParams): [number, number] {
  // Rango típico declarado por componente; se sobrescribe en la base de datos.
  return [0, 150]
}
