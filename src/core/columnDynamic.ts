/**
 * Modelo dinámico de una columna de destilación por etapas.
 *
 * Hipótesis (modelo simplificado tipo Luyben, adecuado para enseñanza):
 *   - Flujo molar constante (CMO) por sección: los flujos líquido/vapor se
 *     deducen algebraicamente de las variables manipuladas.
 *   - Holdup de plato constante (M_tray); rehervidor y acumulador con holdup
 *     constante por "control de nivel perfecto" (D y B se ajustan para
 *     mantener nivel: D = V_rect − L_rect, B = L_strip − V_R).
 *   - Equilibrio instantáneo en cada etapa (burbuja), con K-values del modelo
 *     termodinámico (ideal o Wilson/NRTL).
 *   - Sin holdup de vapor; presión uniforme.
 *
 * Variables manipuladas:  F, z_F (vector), q, R (relación de reflujo), V_R
 * (vaporización en el rehervidor; Q_R ≈ V_R·λ).
 *
 * Condensador:
 *   - total:   x_D = y_1 (sin etapa adicional).
 *   - parcial: el condensador es una etapa de equilibrio más; el destilado es
 *     vapor en equilibrio con el reflujo (y_D = K(x_C)·x_C), T_C = burbuja.
 */

import type { SystemDef } from './components'
import { bubblePoint, kValues } from './thermo'
import { integrate, type IntegratorName } from './integrator'

export type CondenserMode = 'total' | 'partial'

export interface DynamicColumnConfig {
  system: SystemDef
  /** Número de platos (sin contar rehervidor ni condensador) */
  nTrays: number
  /** Plato de alimentación (1 = superior) */
  feedStage: number
  /** Presión, mmHg */
  P: number
  mode: CondenserMode
  /** Holdup molar por plato, kmol */
  trayHoldup: number
  /** Holdup del rehervidor, kmol */
  reboilerHoldup: number
  /** Holdup del acumulador (solo condensador parcial), kmol */
  condenserHoldup: number
  /** Variables iniciales de composición (fracciones molares por componente) */
  x0?: {
    trays: number[][] // nTrays × N_C
    bottoms: number[]
    condenser?: number[]
  }
  integrator?: IntegratorName
  /** Paso de integración por defecto (h), horas */
  dtDefault?: number
}

export interface ColumnInputs {
  /** Alimentación total, kmol/h */
  F: number
  /** Composición del alimento, fracciones molares */
  zF: number[]
  /** Estado térmico del alimento */
  q: number
  /** Relación de reflujo R = L_rect/D */
  R: number
  /** Vaporización del rehervidor, kmol/h (Q_R = V_R·λ) */
  V_R: number
}

export interface StageProfile {
  x: number[] // líquido
  y: number[] // vapor en equilibrio
  T: number // °C
}

export interface ColumnSnapshot {
  t: number
  trays: StageProfile[]
  distillate: StageProfile | null // condensador parcial: etapa adicional
  xD: number[]
  xB: number[]
  TD: number
  TB: number
  L: number[] // flujos líquidos por plato (kmol/h)
  V: number[] // flujos de vapor por plato
  L_rect: number
  L_strip: number
  V_rect: number
  V_strip: number
  D: number
  B: number
  QR: number // kJ/h
  QC: number // kJ/h
  R: number
}

/** Estado interno exportable de la columna (para guardar escenarios). */
export interface ColumnStateVars {
  t: number
  xTrays: number[][]
  xReb: number[]
  xCond: number[] | null
  lastT: number[]
}

export class DynamicColumn {
  readonly system: SystemDef
  readonly config: DynamicColumnConfig
  private nc: number
  private n: number
  private inputs: ColumnInputs
  private xTrays: number[][] // n × nc
  private xReb: number[]
  private xCond: number[] | null
  private lastT: number[] // semillas de temperatura por etapa (aceleran burbuja)
  private t = 0
  private lambda: number // calor latente medio, kJ/kmol
  /** Factores de holdup (para identificación de modelo): >1 → más inercia */
  holdupFactors = { tray: 1, reboiler: 1 }

  constructor(config: DynamicColumnConfig) {
    this.config = config
    this.system = config.system
    this.nc = config.system.components.length
    this.n = config.nTrays
    this.lambda =
      config.system.components.reduce((s, c) => s + c.latentHeat * 1000, 0) /
      config.system.components.length

    const initX = (comp: number): number[] => {
      const v = new Array<number>(this.nc).fill(1e-6)
      v[comp] = 1 - (this.nc - 1) * 1e-6
      return v
    }

    const x0 = config.x0
    this.xTrays = []
    for (let j = 0; j < this.n; j++) {
      const xi = x0?.trays?.[j] ?? initX(0)
      this.xTrays.push(sanitize(xi))
    }
    this.xReb = sanitize(x0?.bottoms ?? initX(this.nc - 1))
    this.xCond = config.mode === 'partial' ? sanitize(x0?.condenser ?? initX(0)) : null

    // Semillas de temperatura: burbuja inicial de cada etapa (1 sola vez)
    this.lastT = new Array<number>(this.n + 1 + (this.xCond ? 1 : 0)).fill(90)
    for (let j = 0; j < this.n; j++) {
      this.lastT[j] = bubblePoint(this.system, this.xTrays[j].slice(), config.P, 90).T
    }
    this.lastT[this.n] = bubblePoint(this.system, this.xReb.slice(), config.P, 110).T
    if (this.xCond) {
      this.lastT[this.n + 1] = bubblePoint(this.system, this.xCond.slice(), config.P, 80).T
    }

    this.inputs = {
      F: 100,
      zF: initX(0),
      q: 1,
      R: 2,
      V_R: 150,
    }
  }

  /* ---------------------------------------------------------------- */
  /* Entradas                                                          */
  /* ---------------------------------------------------------------- */

  setInputs(inputs: Partial<ColumnInputs>): void {
    Object.assign(this.inputs, inputs)
  }

  /** Ajusta los factores de holdup (parámetros de identificación). */
  setHoldupFactors(f: Partial<{ tray: number; reboiler: number }>): void {
    if (f.tray !== undefined) this.holdupFactors.tray = Math.max(0.05, f.tray)
    if (f.reboiler !== undefined) this.holdupFactors.reboiler = Math.max(0.05, f.reboiler)
  }

  getInputs(): ColumnInputs {
    return { ...this.inputs }
  }

  /** Reflujo líquido L_rect (kmol/h) derivado de R y V_rect. */
  get reflux(): number {
    const { R, V_R, F, q } = this.inputs
    const V_rect = V_R + (1 - q) * F
    return (R * V_rect) / (R + 1)
  }

  get V_rect(): number {
    const { V_R, F, q } = this.inputs
    return V_R + (1 - q) * F
  }

  get L_strip(): number {
    const { F, q } = this.inputs
    return this.reflux + q * F
  }

  get D(): number {
    return this.V_rect - this.reflux
  }

  get B(): number {
    return this.L_strip - this.inputs.V_R
  }

  get time(): number {
    return this.t
  }

  /* ---------------------------------------------------------------- */
  /* Derivadas (RHS de la ODE)                                         */
  /* ---------------------------------------------------------------- */

  private flows(): { L: number[]; V: number[] } {
    // Flujos por plato: L_j, V_j (salientes)
    const L_rect = this.reflux
    const L_strip = this.L_strip
    const V_rect = this.V_rect
    const V_strip = this.inputs.V_R
    const f = Math.max(1, Math.min(this.n, this.config.feedStage))
    const L = new Array<number>(this.n)
    const V = new Array<number>(this.n)
    for (let j = 0; j < this.n; j++) {
      L[j] = j + 1 < f ? L_rect : L_strip
      V[j] = j + 1 < f ? V_rect : V_strip
    }
    return { L, V }
  }

  private bubble(x: number[], slot: number): { y: number[]; T: number } {
    const b = bubblePoint(this.system, x.slice(), this.config.P, this.lastT[slot] || undefined)
    this.lastT[slot] = b.T
    return { y: b.y, T: b.T }
  }

  /** Derivadas del estado. Orden: platos (x_{j,i}), rehervidor, condensador (parcial). */
  deriv(_t: number, y: number[]): number[] {
    const { L, V } = this.flows()
    const { F, zF } = this.inputs
    const f = Math.max(1, Math.min(this.n, this.config.feedStage))
    const d = new Array<number>(y.length).fill(0)
    let idx = 0
    const nc = this.nc
    const zero = new Array<number>(nc).fill(0)

    // Composición del vapor de cada plato (equilibrio)
    const yVap: number[][] = this.xTrays.map((x, j) => this.bubble(x, j).y)

    // Platos
    for (let j = 0; j < this.n; j++) {
      const xj = this.xTrays[j]
      // Líquido entrante: reflujo (con x_D = y_1 si condensador total, o x_C si
      // parcial) o líquido del plato superior.
      const L_in = j === 0 ? this.reflux : L[j - 1]
      const x_in =
        j === 0 ? (this.xCond ? this.xCond.slice() : yVap[0].slice()) : this.xTrays[j - 1]
      const V_in = V[j + 1] ?? this.inputs.V_R // vapor del plato inferior o rehervidor
      const y_in = j === this.n - 1 ? this.bubble(this.xReb, this.n).y : yVap[j + 1]
      const F_j = j === f - 1 ? F : 0
      const z_j = j === f - 1 ? zF : zero

      for (let i = 0; i < nc - 1; i++) {
        d[idx] =
          (L_in * x_in[i] + V_in * y_in[i] + F_j * z_j[i] -
            L[j] * xj[i] - V[j] * yVap[j][i]) /
            (this.config.trayHoldup * this.holdupFactors.tray)
        idx++
      }
    }

    // Rehervidor
    const yR = this.bubble(this.xReb, this.n).y
    for (let i = 0; i < nc - 1; i++) {
      d[idx] =
        (L[this.n - 1] * this.xTrays[this.n - 1][i] -
          this.inputs.V_R * yR[i] - this.B * this.xReb[i]) /
        this.config.reboilerHoldup * this.holdupFactors.reboiler
      idx++
    }

    // Condensador parcial (etapa de equilibrio adicional)
    if (this.xCond) {
      const yTop = yVap[0]
      const yD = this.bubble(this.xCond, this.n + 1).y
      for (let i = 0; i < nc - 1; i++) {
        d[idx] =
          (this.V_rect * yTop[i] -
            this.reflux * this.xCond[i] - this.D * yD[i]) /
          this.config.condenserHoldup
        idx++
      }
    }

    return d
  }

  /* ---------------------------------------------------------------- */
  /* Integración                                                       */
  /* ---------------------------------------------------------------- */

  private toState(): number[] {
    const s: number[] = []
    for (const x of this.xTrays) for (let i = 0; i < this.nc - 1; i++) s.push(x[i])
    for (let i = 0; i < this.nc - 1; i++) s.push(this.xReb[i])
    if (this.xCond) for (let i = 0; i < this.nc - 1; i++) s.push(this.xCond[i])
    return s
  }

  private fromState(s: number[]): void {
    let idx = 0
    for (let j = 0; j < this.n; j++) {
      const x = this.xTrays[j]
      for (let i = 0; i < this.nc - 1; i++) x[i] = s[idx++]
      x[this.nc - 1] = 1 - x.slice(0, this.nc - 1).reduce((a, b) => a + b, 0)
    }
    for (let i = 0; i < this.nc - 1; i++) this.xReb[i] = s[idx++]
    this.xReb[this.nc - 1] = 1 - this.xReb.slice(0, this.nc - 1).reduce((a, b) => a + b, 0)
    if (this.xCond) {
      for (let i = 0; i < this.nc - 1; i++) this.xCond[i] = s[idx++]
      this.xCond[this.nc - 1] =
        1 - this.xCond.slice(0, this.nc - 1).reduce((a, b) => a + b, 0)
    }
  }

  /** Avanza el modelo dt horas con el integrador configurado. */
  step(dt?: number): void {
    const h = dt ?? this.config.dtDefault ?? 0.001
    const integrator = this.config.integrator ?? 'rk4'
    const y0 = this.toState()
    const rhs = (t: number, y: number[]): number[] => {
      this.fromState(y)
      return this.deriv(t, y)
    }
    const res = integrate(integrator, rhs, y0, this.t, this.t + h, h)
    this.fromState(res.y)
    this.t = res.t
  }

  /** Estado estacionario aproximado: integra hasta que el cambio sea pequeño. */
  runToSteadyState(maxTimeH = 100, tol = 1e-6, dt = 0.001): number {    for (let t = 0; t < maxTimeH / dt; t++) {
      this.step(dt)
      if (t % 50 === 0) {
        // Criterio: cambio relativo de x_D y x_B pequeño
        const xD = this.snapshot().xD
        const xB = this.xReb
        const xD1 = xD[0]
        const xB1 = xB[0]
        if (this.prevCheck !== undefined) {
          const dD = Math.abs(xD1 - this.prevCheck.xD)
          const dB = Math.abs(xB1 - this.prevCheck.xB)
          if (dD < tol && dB < tol) return this.t
        }
        this.prevCheck = { xD: xD1, xB: xB1 }
      }
    }
    return this.t
  }

  private prevCheck: { xD: number; xB: number } | undefined

  /* ---------------------------------------------------------------- */
  /* Exportación / importación de estado (para escenarios JSON)        */
  /* ---------------------------------------------------------------- */

  /** Devuelve una copia del estado interno (para guardar escenarios). */
  exportState(): ColumnStateVars {
    return {
      t: this.t,
      xTrays: this.xTrays.map((r) => r.slice()),
      xReb: this.xReb.slice(),
      xCond: this.xCond ? this.xCond.slice() : null,
      lastT: this.lastT.slice(),
    }
  }

  /** Restaura un estado exportado (config y entradas deben coincidir). */
  importState(v: ColumnStateVars): void {
    if (v.xTrays.length !== this.n) {
      throw new Error('O estado exportado non coincide co número de pratos actual')
    }
    // Restauración exacta (sin saneado): el JSON debe ser íntegro.
    for (let j = 0; j < this.n; j++) this.xTrays[j] = v.xTrays[j].slice()
    this.xReb = v.xReb.slice()
    if (this.xCond && v.xCond) this.xCond = v.xCond.slice()
    if (v.lastT && v.lastT.length === this.lastT.length) this.lastT = v.lastT.slice()
    this.t = v.t ?? 0
  }

  /* ---------------------------------------------------------------- */
  /* Salidas                                                           */
  /* ---------------------------------------------------------------- */

  snapshot(): ColumnSnapshot {
    const { L, V } = this.flows()
    const trays: StageProfile[] = this.xTrays.map((x, j) => {
      const b = this.bubble(x, j)
      return { x: x.slice(), y: b.y, T: b.T }
    })
    const bReb = this.bubble(this.xReb, this.n)
    const bCond = this.xCond ? this.bubble(this.xCond, this.n + 1) : null
    const xD =
      this.config.mode === 'total'
        ? trays[0].y.slice()
        : (bCond ? bCond.y.slice() : trays[0].y.slice())
    const TD = this.config.mode === 'total' ? trays[0].T : (bCond ? bCond.T : trays[0].T)
    const distillate: StageProfile | null =
      this.config.mode === 'partial' && this.xCond && bCond
        ? { x: this.xCond.slice(), y: bCond.y, T: bCond.T }
        : null

    return {
      t: this.t,
      trays,
      distillate,
      xD,
      xB: this.xReb.slice(),
      TD,
      TB: bReb.T,
      L,
      V,
      L_rect: this.reflux,
      L_strip: this.L_strip,
      V_rect: this.V_rect,
      V_strip: this.inputs.V_R,
      D: this.D,
      B: this.B,
      QR: this.inputs.V_R * this.lambda,
      QC: this.V_rect * this.lambda,
      R: this.inputs.R,
    }
  }
}

function sanitize(x: number[]): number[] {
  const out = x.slice()
  const sum = out.reduce((a, b) => a + b, 0)
  if (sum <= 0 || !Number.isFinite(sum)) out.fill(1 / out.length)
  for (let i = 0; i < out.length; i++) {
    if (out[i] < 0) out[i] = 0
    if (out[i] > 1) out[i] = 1
  }
  const s2 = out.reduce((a, b) => a + b, 0)
  if (s2 > 0) for (let i = 0; i < out.length; i++) out[i] /= s2
  return out
}

// Re-export para conveniencia del llamador
export { kValues }
