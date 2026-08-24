/**
 * Integradores numéricos para sistemas de ODE.
 *
 * El modelo dinámico de la columna produce un sistema de ODE con constantes
 * de tiempo muy dispares (platos: segundos; acumulador/rehervidor: minutos):
 * puede ser rígido. Se ofrecen dos métodos:
 *   - RK4 (clásico, no rígido): bueno para el aula y para sistemas con holdup
 *     de plato razonable.
 *   - Euler implícito (backward Euler) con iteración de punto fijo: estable
 *     para sistemas rígidos con pasos mayores.
 */

export type OdeRhs = (t: number, y: number[]) => number[]

export interface IntegratorResult {
  /** Tiempo final alcanzado */
  t: number
  /** Estado final */
  y: number[]
  /** Número de evaluaciones de la función */
  evaluations: number
  /** Número de pasos */
  steps: number
}

/** Integra desde t0 hasta t1 con paso fijo h usando RK4. */
export function rk4(
  rhs: OdeRhs,
  y0: number[],
  t0: number,
  t1: number,
  h: number,
): IntegratorResult {
  let t = t0
  let y = y0.slice()
  let evaluations = 0
  let steps = 0
  const safe = Math.abs(h)
  while (t < t1 - 1e-12) {
    const dt = Math.min(safe, t1 - t)
    const k1 = rhs(t, y)
    const k2 = rhs(t + dt / 2, y.map((v, i) => v + (dt / 2) * k1[i]))
    const k3 = rhs(t + dt / 2, y.map((v, i) => v + (dt / 2) * k2[i]))
    const k4 = rhs(t + dt, y.map((v, i) => v + dt * k3[i]))
    y = y.map((v, i) => v + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]))
    t += dt
    steps++
    evaluations += 4
  }
  return { t, y, evaluations, steps }
}

export interface ImplicitEulerOptions {
  /** Tolerancia de la iteración de punto fijo */
  tol?: number
  /** Máximo de iteraciones internas */
  maxIter?: number
}

/** Euler implícito (backward Euler) con punto fijo; estable para ODE rígidas. */
export function implicitEuler(
  rhs: OdeRhs,
  y0: number[],
  t0: number,
  t1: number,
  h: number,
  opts: ImplicitEulerOptions = {},
): IntegratorResult {
  const { tol = 1e-9, maxIter = 50 } = opts
  let t = t0
  let y = y0.slice()
  let evaluations = 0
  let steps = 0
  while (t < t1 - 1e-12) {
    const dt = Math.min(Math.abs(h), t1 - t)
    // Punto fijo: y_{n+1} = y_n + dt·f(t+dt, y_{n+1})
    let guess = y.slice()
    for (let it = 0; it < maxIter; it++) {
      const f = rhs(t + dt, guess)
      evaluations++
      const next = y.map((v, i) => v + dt * f[i])
      const maxd = Math.max(...next.map((v, i) => Math.abs(v - guess[i])))
      guess = next
      if (maxd < tol * (1 + Math.max(...guess.map(Math.abs)))) break
    }
    y = guess
    t += dt
    steps++
  }
  return { t, y, evaluations, steps }
}

export type IntegratorName = 'rk4' | 'implicit'

export function integrate(
  name: IntegratorName,
  rhs: OdeRhs,
  y0: number[],
  t0: number,
  t1: number,
  h: number,
): IntegratorResult {
  return name === 'rk4'
    ? rk4(rhs, y0, t0, t1, h)
    : implicitEuler(rhs, y0, t0, t1, h)
}
