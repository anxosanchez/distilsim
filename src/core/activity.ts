/**
 * Coeficientes de actividad: modelos Wilson y NRTL para líquidos no ideales.
 *
 * Convenciones:
 *  - x: fracciones molares del líquido (una por componente).
 *  - T_K: temperatura en kelvin.
 *  - Los parámetros binarios se leen de SystemDef.activity (components.ts).
 *    Para Wilson se almacenan los valores adimensionales Λ_12 y Λ_21 finales
 *    (ya incluyen el cociente de volúmenes molares); para NRTL, Δg_12 y Δg_21
 *    en J/mol y α.
 */

import type { SystemDef } from './components'
import { getBinaryActivityParams } from './components'

const R_J = 8.314462618 // J/mol·K

export function cToK(T_C: number): number {
  return T_C + 273.15
}

/**
 * Coeficientes de actividad a partir de la composición del líquido x.
 * Modelo 'ideal' → γ = 1. Para mezclas de más de 2 componentes se combinan
 * los pares binarios con la regla de mezclado del modelo correspondiente.
 */
export function activityCoeffs(
  system: SystemDef,
  x: number[],
  T_K: number,
): number[] {
  const nc = system.components.length
  if (x.length !== nc) throw new Error('x debe tener un valor por componente')

  // Vía rápida binaria (caso dominante en la simulación de columnas):
  // sin Set, sin concatenación de claves, una sola asignación.
  if (nc === 2) {
    const p = getBinaryActivityParams(system, 0, 1)
    if (!p) return [1, 1]
    if (p.model === 'wilson') return wilsonBinary(x[0], p.lambda12, p.lambda21)
    return nrtlBinary(x[0], p.dg12, p.dg21, p.alpha, T_K)
  }

  // Multicomponente: detectar modelo entre pares disponibles
  let model: 'ideal' | 'wilson' | 'nrtl' = 'ideal'
  for (let i = 0; i < nc; i++) {
    for (let j = i + 1; j < nc; j++) {
      const p = getBinaryActivityParams(system, i, j)
      if (p) {
        if (model !== 'ideal' && model !== p.model) {
          console.warn(
            'Mezcla de modelos de actividad diferentes: se usará el primero encontrado.',
          )
        } else if (model === 'ideal') {
          model = p.model
        }
      }
    }
  }
  if (model === 'ideal') return new Array<number>(nc).fill(1)
  return model === 'wilson' ? wilson(system, x, T_K) : nrtl(system, x, T_K)
}

/** Wilson binario: γ1, γ2 con una sola asignación. Λ12, Λ21 adimensionales. */
export function wilsonBinary(x1: number, lambda12: number, lambda21: number): number[] {
  const x2 = 1 - x1
  const d1 = x1 + x2 * lambda12
  const d2 = x1 * lambda21 + x2
  const lnG1 = 1 - Math.log(d1) - (x1 / d1 + (x2 * lambda21) / d2)
  const lnG2 = 1 - Math.log(d2) - ((x1 * lambda12) / d1 + x2 / d2)
  return [Math.exp(lnG1), Math.exp(lnG2)]
}

/** NRTL binario: γ1, γ2 sin matrices. Δg en J/mol. */
export function nrtlBinary(
  x1: number,
  dg12: number,
  dg21: number,
  alpha: number,
  T_K: number,
): number[] {
  const x2 = 1 - x1
  const tau12 = dg12 / (R_J * T_K)
  const tau21 = dg21 / (R_J * T_K)
  const G12 = Math.exp(-alpha * tau12)
  const G21 = Math.exp(-alpha * tau21)
  const d1 = x1 + x2 * G21 // Σ x_k G_k1
  const d2 = x2 + x1 * G12 // Σ x_k G_k2
  const lnG1 =
    x2 * x2 * (tau21 * (G21 / d1) ** 2 + (tau12 * G12) / d2 ** 2)
  const lnG2 =
    x1 * x1 * (tau12 * (G12 / d2) ** 2 + (tau21 * G21) / d1 ** 2)
  return [Math.exp(lnG1), Math.exp(lnG2)]
}

/* ------------------------------------------------------------------ */
/* Wilson (1964)                                                       */
/*                                                                     */
/*   ln γ_i = 1 − ln(Σ_k x_k Λ_ik) − Σ_j [ x_j Λ_ji / Σ_k x_k Λ_jk ]  */
/* ------------------------------------------------------------------ */

export function wilson(system: SystemDef, x: number[], _T_K: number): number[] {
  const nc = system.components.length

  // Matriz Λ: Λ_ii = 1; para el par (i,j) con i<j, Λ_ij = lambda12, Λ_ji = lambda21.
  const Lambda: number[][] = Array.from({ length: nc }, () => new Array(nc).fill(1))
  for (let i = 0; i < nc; i++) {
    for (let j = i + 1; j < nc; j++) {
      const p = getBinaryActivityParams(system, i, j)
      if (p && p.model === 'wilson') {
        Lambda[i][j] = p.lambda12
        Lambda[j][i] = p.lambda21
      }
    }
  }

  // Denominadores Σ_k x_k Λ_jk (por fila j)
  const denom = new Array<number>(nc).fill(0)
  for (let j = 0; j < nc; j++) {
    for (let k = 0; k < nc; k++) denom[j] += x[k] * Lambda[j][k]
  }

  const gamma = new Array<number>(nc).fill(0)
  for (let i = 0; i < nc; i++) {
    let sumXLambda = 0
    for (let k = 0; k < nc; k++) sumXLambda += x[k] * Lambda[i][k]
    let inner = 0
    for (let j = 0; j < nc; j++) {
      inner += (x[j] * Lambda[j][i]) / denom[j]
    }
    gamma[i] = Math.exp(1 - Math.log(sumXLambda) - inner)
  }
  return gamma
}

/* ------------------------------------------------------------------ */
/* NRTL (Renon & Prausnitz, 1968)                                      */
/*                                                                     */
/*   ln γ_i = Σ_j x_j τ_ji G_ji / Σ_k x_k G_ki                         */
/*          + Σ_j [ x_j G_ij / Σ_k x_k G_kj ]·( τ_ij − Σ_m x_m τ_mj G_mj / Σ_k x_k G_kj ) */
/*   con τ_ij = Δg_ij/(RT), G_ij = exp(−α_ij τ_ij)                    */
/* ------------------------------------------------------------------ */

export function nrtl(system: SystemDef, x: number[], T_K: number): number[] {
  const nc = system.components.length

  const tau: number[][] = Array.from({ length: nc }, () => new Array(nc).fill(0))
  const alpha: number[][] = Array.from({ length: nc }, () => new Array(nc).fill(0.3))
  const G: number[][] = Array.from({ length: nc }, () => new Array(nc).fill(1))

  for (let i = 0; i < nc; i++) {
    for (let j = i + 1; j < nc; j++) {
      const p = getBinaryActivityParams(system, i, j)
      if (p && p.model === 'nrtl') {
        tau[i][j] = p.dg12 / (R_J * T_K)
        tau[j][i] = p.dg21 / (R_J * T_K)
        alpha[i][j] = p.alpha
        alpha[j][i] = p.alpha
        G[i][j] = Math.exp(-alpha[i][j] * tau[i][j])
        G[j][i] = Math.exp(-alpha[j][i] * tau[j][i])
      }
    }
  }

  const denomG = new Array<number>(nc).fill(0) // Σ_k x_k G_kj
  for (let j = 0; j < nc; j++) {
    for (let k = 0; k < nc; k++) denomG[j] += x[k] * G[k][j]
  }

  const gamma = new Array<number>(nc).fill(0)
  for (let i = 0; i < nc; i++) {
    // Término 1: Σ_j x_j τ_ji G_ji / Σ_k x_k G_ki
    let sumXG = 0
    for (let k = 0; k < nc; k++) sumXG += x[k] * G[k][i]
    let term1 = 0
    if (sumXG > 0) {
      for (let j = 0; j < nc; j++) term1 += (x[j] * tau[j][i] * G[j][i]) / sumXG
    }

    // Término 2
    let term2 = 0
    for (let j = 0; j < nc; j++) {
      if (denomG[j] === 0) continue
      let inner = 0
      for (let m = 0; m < nc; m++) inner += (x[m] * tau[m][j] * G[m][j]) / denomG[j]
      term2 += (x[j] * G[i][j] / denomG[j]) * (tau[i][j] - inner)
    }
    gamma[i] = Math.exp(term1 + term2)
  }
  return gamma
}
