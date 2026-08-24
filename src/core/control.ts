/**
 * Controlador PID con anti-windup, para los lazos de control de la columna
 * (nivel de acumulador, nivel de rehervidor, temperatura de plato sensible,
 * presión). Esquemas de control típicos: L/D, R/V, D/V.
 *
 * Forma posicional:
 *   u(t) = Kp·e + Ki·∫e dt + Kd·de/dt
 * con limitación de salida y saturación del término integral (anti-windup).
 */

export interface PidConfig {
  kp: number
  ki: number
  kd: number
  /** Límites de la salida (válvula 0..100, flujo 0..máx, etc.) */
  outMin: number
  outMax: number
  /** Dirección: 1 = acción directa, −1 = acción inversa */
  direction?: 1 | -1
  /** Filtro de la derivada (τ_d, mismo tiempo que dt) para evitar ruido */
  derivativeFilter?: number
}

export class PID {
  private cfg: PidConfig
  private integral = 0
  private prevError = 0
  private prevDeriv = 0
  private initialized = false

  constructor(cfg: PidConfig) {
    this.cfg = { direction: 1, derivativeFilter: 0.1, ...cfg }
  }

  reset(): void {
    this.integral = 0
    this.prevError = 0
    this.prevDeriv = 0
    this.initialized = false
  }

  /** Actualiza el controlador con un paso dt (mismas unidades que la simulación). */
  update(setpoint: number, measurement: number, dt: number): number {
    const { kp, ki, kd, outMin, outMax, derivativeFilter } = this.cfg
    const direction = this.cfg.direction ?? 1
    const e = direction * (setpoint - measurement)
    const safeDt = Math.max(dt, 1e-9)

    this.integral += e * safeDt
    let deriv = this.initialized ? (e - this.prevError) / safeDt : 0
    if (derivativeFilter && derivativeFilter > 0) {
      const a = safeDt / (derivativeFilter + safeDt)
      deriv = a * deriv + (1 - a) * this.prevDeriv
    }

    let u = kp * e + ki * this.integral + kd * deriv
    // Anti-windup por "clamping": si la salida satura, ajustar la integral
    // para que u quede exactamente en el límite (back-calculation).
    if (u > outMax) {
      u = outMax
      this.integral = ki > 0 ? (outMax - kp * e - kd * deriv) / ki : 0
    } else if (u < outMin) {
      u = outMin
      this.integral = ki > 0 ? (outMin - kp * e - kd * deriv) / ki : 0
    }

    this.prevError = e
    this.prevDeriv = deriv
    this.initialized = true
    return u
  }

  get state(): { integral: number } {
    return { integral: this.integral }
  }
}

/* ------------------------------------------------------------------ */
/* Esquemas de control de columna                                      */
/* ------------------------------------------------------------------ */

export type ControlScheme = 'L/D' | 'R/V' | 'D/V'

export interface ColumnControllers {
  /** Controlador de temperatura de plato sensible → manipula reflujo (L/D) */
  temperature: PID
  /** Controlador de nivel de acumulador → manipula D */
  drumLevel: PID
  /** Controlador de nivel de rehervidor → manipula B */
  reboilerLevel: PID
  scheme: ControlScheme
}

export interface ControlTargets {
  /** Temperatura objetivo del plato sensible, °C */
  TSetpoint: number
  /** Nivel objetivo del acumulador, kmol */
  drumLevelSetpoint: number
  /** Nivel objetivo del rehervidor, kmol */
  reboilerLevelSetpoint: number
}

/**
 * Calcula las entradas de la columna a partir de los controladores.
 * devuelve { R, D_override, B_override } según el esquema.
 */
export function applyControlScheme(
  ctrl: ColumnControllers,
  targets: ControlTargets,
  meas: {
    TSensible: number
    drumLevel: number
    reboilerLevel: number
  },
  dt: number,
  base: { R0: number; VR0: number },
): { R: number; V_R: number; D: number; B: number } {
  const { scheme } = ctrl
  // Niveles siempre controlados (P puro)
  const D = ctrl.drumLevel.update(targets.drumLevelSetpoint, meas.drumLevel, dt)
  const B = ctrl.reboilerLevel.update(targets.reboilerLevelSetpoint, meas.reboilerLevel, dt)
  // Temperatura: manipula R (L/D) o relación R/V
  const uT = ctrl.temperature.update(targets.TSetpoint, meas.TSensible, dt)

  if (scheme === 'L/D') {
    // Reflujo fijo por temperatura; destilado por nivel
    return { R: uT, V_R: base.VR0, D, B }
  }
  if (scheme === 'R/V') {
    // Relación reflujo–vapor fija: R = uT, V_R se escala con la relación
    const rv = uT // relación R/V manipulada
    const V_R = base.VR0 * (1 + (rv - base.R0) / (base.R0 + 1e-9))
    return { R: rv, V_R, D, B }
  }
  // D/V: destilado–vapor
  const dv = uT
  const V_R = base.VR0
  const R = dv * V_R / (V_R - dv * V_R + 1e-9)
  return { R, V_R, D, B }
}
