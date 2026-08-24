/**
 * Termodinámica del equilibrio líquido–vapor (ELV).
 *
 * Funciones puras que el resto del simulador (estacionario, dinámico, gemelo)
 * usa como "motor" de cálculo:
 *   - K-values: K_i = γ_i·P_i^sat / P  (ideal si γ = 1)
 *   - Punto de burbuja:  dados P y x → T y y
 *   - Punto de rocío:    dados P y y → T y x
 *   - Flash:             dados P, T y z → ψ, x, y  (Rachford–Rice)
 */

import { psatMMHg } from './antoine'
import type { ComponentDef, SystemDef } from './components'
import { activityCoeffs, cToK } from './activity'

/* ------------------------------------------------------------------ */
/* Constantes K                                                        */
/* ------------------------------------------------------------------ */

/** K_i = γ_i(T,x)·P_i^sat(T) / P. La fase líquida x solo importa con modelo de actividad. */
export function kValues(
  system: SystemDef,
  x: number[],
  T_C: number,
  P_mmHg: number,
): number[] {
  const nc = system.components.length
  const gamma = activityCoeffs(system, x, cToK(T_C))
  const K = new Array<number>(nc)
  for (let i = 0; i < nc; i++) {
    K[i] = (gamma[i] * psatMMHg(system.components[i].antoine, T_C)) / P_mmHg
  }
  return K
}

/** Temperatura normal de ebullición de un componente (a 760 mmHg). */
export function tboil(comp: ComponentDef): number {
  return comp.antoine.B / (comp.antoine.A - Math.log10(760)) - comp.antoine.C
}

/* ------------------------------------------------------------------ */
/* Punto de burbuja                                                    */
/* ------------------------------------------------------------------ */

export interface BubbleResult {
  /** Temperatura de burbuja, °C */
  T: number
  /** Composición del vapor en equilibrio, fracciones molares */
  y: number[]
  /** Número de iteraciones */
  iterations: number
}

/**
 * Punto de burbuja a P dada: encuentra T tal que Σ x_i·K_i(T) = 1.
 * Método: bisección sobre T entre los límites de ebullición de los componentes.
 */
export function bubblePoint(
  system: SystemDef,
  x: number[],
  P_mmHg: number,
  T_guess?: number,
): BubbleResult {
  const nc = system.components.length
  normalizeInPlace(x)

  // Límites de temperatura: entre el más volátil y el menos volátil
  let tMin = Infinity
  let tMax = -Infinity
  for (const c of system.components) {
    const tb = tboil(c)
    tMin = Math.min(tMin, tb)
    tMax = Math.max(tMax, tb)
  }
  // Ampliar márgenes para mezclas no ideales (los límites pueden superar los puros)
  tMin -= 10
  tMax += 10

  const f = (T: number): number => {
    const K = kValues(system, x, T, P_mmHg)
    let s = 0
    for (let i = 0; i < nc; i++) s += x[i] * K[i]
    return s - 1
  }

  let lo = tMin
  let hi = tMax
  let flo = f(lo)
  let fhi = f(hi)
  // Expandir si el intervalo no encierra la raíz (P fuera del rango normal)
  for (let guard = 0; guard < 40 && flo * fhi > 0; guard++) {
    if (flo > 0) {
      lo -= 20
      flo = f(lo)
    } else {
      hi += 20
      fhi = f(hi)
    }
  }
  if (flo * fhi > 0) {
    // No se encontró la raíz: devolver la mejor aproximación (salida didáctica)
    return { T: (lo + hi) / 2, y: bubbleVapor(system, x, (lo + hi) / 2, P_mmHg), iterations: 40 }
  }

  let iterations = 0
  let T = (lo + hi) / 2
  if (T_guess !== undefined && T_guess > lo && T_guess < hi) {
    T = T_guess
  }
  const TOL = 1e-8
  for (let iter = 0; iter < 100; iter++) {
    iterations++
    const fT = f(T)
    if (Math.abs(fT) < TOL) break
    // Bisección con aproximación de secante para convergencia más rápida
    if (fT > 0) {
      lo = T
      flo = fT
    } else {
      hi = T
      fhi = fT
    }
    const Tnew = hi - (fhi * (hi - lo)) / (fhi - flo + 1e-300)
    T = Number.isFinite(Tnew) ? Tnew : (lo + hi) / 2
  }
  return { T, y: bubbleVapor(system, x, T, P_mmHg), iterations }
}

/** Composición del vapor en equilibrio a T conocida (sin re-resolver T). */
export function bubbleVapor(system: SystemDef, x: number[], T_C: number, P_mmHg: number): number[] {
  const K = kValues(system, x, T_C, P_mmHg)
  const y = x.map((xi, i) => xi * K[i])
  normalizeInPlace(y)
  return y
}

/* ------------------------------------------------------------------ */
/* Punto de rocío                                                      */
/* ------------------------------------------------------------------ */

export interface DewResult {
  /** Temperatura de rocío, °C */
  T: number
  /** Composición del líquido en equilibrio, fracciones molares */
  x: number[]
  iterations: number
}

/** Punto de rocío a P dada: encuentra T tal que Σ y_i/K_i(T) = 1. */
export function dewPoint(
  system: SystemDef,
  y: number[],
  P_mmHg: number,
  T_guess?: number,
): DewResult {
  const nc = system.components.length
  normalizeInPlace(y)

  let tMin = Infinity
  let tMax = -Infinity
  for (const c of system.components) {
    const tb = tboil(c)
    tMin = Math.min(tMin, tb)
    tMax = Math.max(tMax, tb)
  }
  tMin -= 10
  tMax += 10

  // El rocío requiere resolver T con K que depende de x (líquido incógnita).
  // Enfoque: iteración externa sobre T; para cada T se resuelve x por sustitución
  // sucesiva x_i = y_i/K_i(T, x) hasta normalización estable.
  const sumYoverK = (T: number): number => {
    let x: number[] = y.slice()
    for (let it = 0; it < 30; it++) {
      const K = kValues(system, x, T, P_mmHg)
      const xn = y.map((yi, i) => yi / K[i])
      normalizeInPlace(xn)
      const maxd = Math.max(...xn.map((v, i) => Math.abs(v - x[i])))
      x = xn
      if (maxd < 1e-9) break
    }
    const K = kValues(system, x, T, P_mmHg)
    let s = 0
    for (let i = 0; i < nc; i++) s += y[i] / K[i]
    return s - 1
  }

  const f = sumYoverK
  let lo = tMin
  let hi = tMax
  let flo = f(lo)
  let fhi = f(hi)
  for (let guard = 0; guard < 40 && flo * fhi > 0; guard++) {
    if (flo > 0) {
      lo -= 20
      flo = f(lo)
    } else {
      hi += 20
      fhi = f(hi)
    }
  }
  if (flo * fhi > 0) {
    return { T: (lo + hi) / 2, x: y.slice(), iterations: 40 }
  }

  let iterations = 0
  let T = (lo + hi) / 2
  if (T_guess !== undefined && T_guess > lo && T_guess < hi) T = T_guess
  for (let iter = 0; iter < 100; iter++) {
    iterations++
    const fT = f(T)
    if (Math.abs(fT) < 1e-9) break
    if (fT > 0) {
      lo = T
      flo = fT
    } else {
      hi = T
      fhi = fT
    }
    const Tnew = hi - (fhi * (hi - lo)) / (fhi - flo + 1e-300)
    T = Number.isFinite(Tnew) ? Tnew : (lo + hi) / 2
  }

  // Líquido en equilibrio a T final
  let x: number[] = y.slice()
  for (let it = 0; it < 30; it++) {
    const K = kValues(system, x, T, P_mmHg)
    const xn = y.map((yi, i) => yi / K[i])
    normalizeInPlace(xn)
    const maxd = Math.max(...xn.map((v, i) => Math.abs(v - x[i])))
    x = xn
    if (maxd < 1e-9) break
  }
  return { T, x, iterations }
}

/* ------------------------------------------------------------------ */
/* Flash (Rachford–Rice)                                               */
/* ------------------------------------------------------------------ */

export interface FlashResult {
  /** Fracción vaporizada (molar) ψ */
  psi: number
  x: number[]
  y: number[]
  iterations: number
}

/**
 * Flash isotérmico a P y T: resuelve ψ en la ecuación de Rachford–Rice.
 * Devuelve ψ fuera de [0,1] si la mezcla es subenfriada o sobrecalentada
 * (el llamador debe interpretarlo).
 */
export function flash(
  system: SystemDef,
  z: number[],
  P_mmHg: number,
  T_C: number,
): FlashResult {
  const nc = system.components.length
  normalizeInPlace(z)

  // K depende de x e y (no idealidad); se resuelve con doble bucle:
  // interior: ψ por Rachford–Rice con K fijo; exterior: actualizar x, y, K.
  let x = z.slice()
  let y = z.slice()
  let psi = 0.5
  let iterations = 0

  for (let outer = 0; outer < 20; outer++) {
    const K = kValues(system, x, T_C, P_mmHg)

    // Rachford–Rice: Σ z_i (K_i − 1) / (1 + ψ(K_i − 1)) = 0
    let lo = 0
    let hi = 1
    // Verificar si ψ está en [0,1]
    let flo = rr(0)
    let fhi = rr(1)
    let fpsi = rr(psi)
    if (flo * fhi > 0) {
      // Fuera de rango: dos fases no coexisten a estas condiciones
      if (flo < 0) psi = 0
      else psi = 1
    } else {
      for (let it = 0; it < 60; it++) {
        iterations++
        if (Math.abs(fpsi) < 1e-10) break
        if (fpsi > 0) lo = psi
        else hi = psi
        psi = (lo + hi) / 2
        fpsi = rr(psi)
      }
    }

    function rr(v: number): number {
      let s = 0
      for (let i = 0; i < nc; i++) {
        s += (z[i] * (K[i] - 1)) / (1 + v * (K[i] - 1) + 1e-300)
      }
      return s
    }

    if (psi <= 0) {
      x = z.slice()
      y = bubbleVapor(system, x, T_C, P_mmHg)
      return { psi, x, y, iterations }
    }
    if (psi >= 1) {
      y = z.slice()
      const d = dewPoint(system, y, P_mmHg, T_C)
      return { psi, x: d.x, y, iterations }
    }

    const xn = z.map((zi, i) => zi / (1 + psi * (K[i] - 1)))
    const yn = z.map((zi, i) => (zi * K[i]) / (1 + psi * (K[i] - 1)))
    normalizeInPlace(xn)
    normalizeInPlace(yn)
    const maxd = Math.max(
      ...xn.map((v, i) => Math.abs(v - x[i])),
      ...yn.map((v, i) => Math.abs(v - y[i])),
    )
    x = xn
    y = yn
    if (maxd < 1e-8) break
  }
  return { psi, x, y, iterations }
}

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

/** Normaliza un vector de fracciones a suma 1 (recortando negativos pequeños). */
export function normalizeInPlace(v: number[]): void {
  const sum = v.reduce((a, b) => a + b, 0)
  if (sum <= 0 || !Number.isFinite(sum)) {
    v.fill(1 / v.length)
    return
  }
  for (let i = 0; i < v.length; i++) {
    let val = v[i] / sum
    if (val < 0 && val > -1e-9) val = 0
    v[i] = val
  }
}

/** Verifica si una composición es un azeótropo (x ≈ y), útil para diagnósticos. */
export function isAzeotrope(system: SystemDef, x: number[], P_mmHg: number, tol = 1e-4): boolean {
  const b = bubblePoint(system, x, P_mmHg)
  return x.every((xi, i) => Math.abs(xi - b.y[i]) < tol)
}

/**
 * Curva de equilibrio binaria: para cada x genera y (para McCabe–Thiele numérico).
 * Con caché: la curva depende solo de (sistema, P), y la UI la solicita cada
 * frame — se evita recalcular 200+ puntos de burbuja por frame.
 */
const curveCache = new Map<SystemDef, Map<number, { x: number[]; y: number[] }>>()

export function equilibriumCurveBinary(
  system: SystemDef,
  P_mmHg: number,
  nPoints = 201,
): { x: number[]; y: number[] } {
  let byP = curveCache.get(system)
  if (!byP) {
    byP = new Map()
    curveCache.set(system, byP)
  }
  const key = Math.round(P_mmHg * 1000)
  const hit = byP.get(key)
  if (hit) return hit

  const x: number[] = []
  const y: number[] = []
  for (let i = 0; i < nPoints; i++) {
    const xi = i / (nPoints - 1)
    const b = bubblePoint(system, [xi, 1 - xi], P_mmHg)
    x.push(xi)
    y.push(Math.max(0, Math.min(1, b.y[0])))
  }
  const out = { x, y }
  byP.set(key, out)
  return out
}
