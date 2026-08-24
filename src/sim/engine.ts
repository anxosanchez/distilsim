/**
 * Motor de simulación para la UI.
 *
 * Envuelve DynamicColumn con: bucle de tiempo real (rAF), historia de series
 * temporales, reinicio a estado estacionario asíncrono (sin bloquear la UI),
 * control PID de temperatura (esquema L/D), exportación/importación de
 * escenarios (JSON) y escenarios didácticos predefinidos.
 */

import {
  DynamicColumn,
  type ColumnSnapshot,
  type ColumnInputs,
  type CondenserMode,
  type ColumnStateVars,
} from '../core/columnDynamic'
import { ALL_SYSTEMS, type SystemDef } from '../core/components'
import { PID } from '../core/control'
import { sessionLog } from '../core/session'
import { tGlobal } from '../i18n'

export interface SimConfig {
  systemKey: string
  mode: CondenserMode
  nTrays: number
  feedStage: number
  trayHoldup: number
  reboilerHoldup: number
}

export type ControlScheme = 'LD' | 'RV' | 'DV'

export interface ControlConfig {
  /** Control automático de temperatura (PID sobre la variable del esquema) */
  enabled: boolean
  /** Esquema de control: L/D (R), R/V (V_R) o D/V (relación D/V) */
  scheme: ControlScheme
  /** Plato sensible (1 = tope) cuya temperatura se controla */
  sensibleTray: number
  /** Consigna de temperatura, °C */
  setpoint: number
  kp: number
  ki: number
  kd: number
}

export interface HistoryPoint {
  t: number
  xD: number[]
  xB: number[]
  TD: number
  TB: number
  D: number
  B: number
  QR: number
}

export interface SimSnapshot {
  config: SimConfig
  inputs: ColumnInputs
  column: ColumnSnapshot
  history: HistoryPoint[]
  control: ControlConfig
  /** Salida actual del controlador (R) si está en auto */
  controlOutput: number
  /** Temperatura medida en el plato sensible */
  controlMeasurement: number
}

export interface ScenarioFile {
  app: 'destilador-digital-twin'
  version: 1
  config: SimConfig
  inputs: ColumnInputs
  state: ColumnStateVars
  savedAt: string
  note?: string
}

export interface OptimizeOptions {
  /** Pureza mínima del destilado (componente más volátil) */
  xDmin: number
  /** Impureza máxima en fondos (componente más volátil) */
  xBmax: number
}

export interface OptimizeResult {
  feasible: boolean
  R: number
  V_R: number
  QR: number
  xD: number
  xB: number
  iterations: number
  /** Ahorro energético frente al punto inicial (%) */
  savingsPct: number
  message: string
  /** Energía del punto inicial (para "restaurar y comparar") */
  initialQR: number
}

const DEFAULTS: Record<string, { inputs: ColumnInputs }> = {
  bencenoTolueno: { inputs: { F: 100, zF: [0.5, 0.5], q: 1, R: 1.65, V_R: 132.5 } },
  etanolAgua: { inputs: { F: 100, zF: [0.3, 0.7], q: 1, R: 2.2, V_R: 160 } },
  metanolAgua: { inputs: { F: 100, zF: [0.4, 0.6], q: 1, R: 2, V_R: 150 } },
  acetonaCloroformo: { inputs: { F: 100, zF: [0.5, 0.5], q: 1, R: 2, V_R: 130 } },
  bencenoToluenoEtilbenceno: {
    inputs: { F: 100, zF: [0.33, 0.33, 0.34], q: 1, R: 2.5, V_R: 180 },
  },
  bencenoToluenoEtilbencenoEstireno: {
    inputs: { F: 100, zF: [0.25, 0.25, 0.25, 0.25], q: 1, R: 3, V_R: 220 },
  },
}

/** Parámetros del PID según el esquema de control. */
function pidParams(scheme: ControlScheme): { outMin: number; outMax: number; direction: 1 | -1 } {
  if (scheme === 'RV') return { outMin: 40, outMax: 300, direction: 1 }
  // D/V: la relación D/V se traduce a R = (1−r)/r; el rango [0.25, 0.75]
  // mantiene R en [0.33, 3] (fuera de ese rango el mapeo es demasiado agresivo)
  if (scheme === 'DV') return { outMin: 0.25, outMax: 0.75, direction: 1 }
  return { outMin: 0.5, outMax: 10, direction: -1 } // L/D
}

/** Ganancias recomendadas por esquema (se aplican al cambiar de esquema). */
function defaultGains(scheme: ControlScheme): { kp: number; ki: number } {
  if (scheme === 'RV') return { kp: 2, ki: 4 }
  if (scheme === 'DV') return { kp: 0.1, ki: 0.2 } // mapeo R = (1−r)/r muy sensible
  return { kp: 1, ki: 1 } // L/D
}

export type ScenarioName =
  | 'nominal'
  | 'pérdidaCalefacción'
  | 'cambioAlimento'
  | 'subirReflujo'
  | 'bajarAlimentación'

export class SimEngine {
  config: SimConfig
  column: DynamicColumn
  history: HistoryPoint[] = []
  running = true
  /** Velocidad: multiplicador del tiempo de simulación por segundo real */
  speed = 60
  /** Paso de simulación por tick (h) */
  readonly dtTick = 0.0005
  control: ControlConfig
  controlOutput: number
  /** PID del lazo de temperatura; los parámetros dependen del esquema */
  private pid: PID
  private maxHistory = 600

  constructor(config?: Partial<SimConfig>) {
    this.config = {
      systemKey: 'bencenoTolueno',
      mode: 'total',
      nTrays: 12,
      feedStage: 5,
      trayHoldup: 0.5,
      reboilerHoldup: 10,
      ...config,
    }
    this.column = this.build()
    this.control = {
      enabled: false,
      scheme: 'LD',
      sensibleTray: Math.max(1, this.config.feedStage - 1),
      setpoint: 92,
      kp: 1,
      ki: 1,
      kd: 0,
    }
    this.pid = this.makePid()
    this.controlOutput = this.column.getInputs().R
  }

  private makePid(): PID {
    const { outMin, outMax, direction } = pidParams(this.control.scheme)
    return new PID({
      kp: this.control.kp,
      ki: this.control.ki,
      kd: this.control.kd,
      outMin,
      outMax,
      direction,
    })
  }

  /** Etiqueta de la variable manipulada según el esquema (para la UI). */
  get controlVariableLabel(): string {
    return this.control.scheme === 'LD'
      ? 'R (L/D)'
      : this.control.scheme === 'RV'
        ? 'V_R (R/V)'
        : 'D/V'
  }

  private build(): DynamicColumn {
    const sys = this.system
    const nc = sys.components.length
    // Perfil inicial lineal entre xB (abajo) y xD (arriba) para converger rápido.
    // xD debe estar en la región ALCANZABLE del sistema (por debajo del azeótropo).
    const initXD: Record<string, number> = {
      bencenoTolueno: 0.95,
      etanolAgua: 0.85, // azeótropo en 0.895
      metanolAgua: 0.95,
      acetonaCloroformo: 0.25, // azeótropo máximo en 0.34
      bencenoToluenoEtilbenceno: 0.6,
      bencenoToluenoEtilbencenoEstireno: 0.4,
    }
    const xD = initXD[this.config.systemKey] ?? 0.9
    const xB = 0.05
    const trays: number[][] = []
    for (let j = 0; j < this.config.nTrays; j++) {
      const x0 = xD - ((xD - xB) * j) / Math.max(1, this.config.nTrays - 1)
      const row = new Array<number>(nc).fill((1 - x0) / (nc - 1))
      row[0] = x0
      trays.push(row)
    }
    const bottoms = new Array<number>(nc).fill((1 - xB) / (nc - 1))
    bottoms[0] = xB
    const col = new DynamicColumn({
      system: sys,
      nTrays: this.config.nTrays,
      feedStage: this.config.feedStage,
      P: sys.defaultPressure,
      mode: this.config.mode,
      trayHoldup: this.config.trayHoldup,
      reboilerHoldup: this.config.reboilerHoldup,
      condenserHoldup: 2,
      x0: { trays, bottoms },
      integrator: 'rk4',
    })
    const d = DEFAULTS[this.config.systemKey] ?? DEFAULTS.bencenoTolueno
    col.setInputs(d.inputs)
    return col
  }

  /** Reconstruye la columna con la configuración actual (pierde la historia). */
  rebuild(config?: Partial<SimConfig>): void {
    if (config) {
      this.config = { ...this.config, ...config }
      sessionLog.log('input', tGlobal('eng.reconfiguracion'), { ...config }, this.column.time)
    }
    this.column = this.build()
    this.history = []
    this.control.sensibleTray = Math.max(
      1,
      Math.min(this.config.nTrays, this.control.sensibleTray),
    )
    this.pid.reset()
    this.controlOutput = this.column.getInputs().R
    this.pushHistory()
  }

  setInputs(inputs: Partial<ColumnInputs>): void {
    this.column.setInputs(inputs)
    if (!this.control.enabled) this.controlOutput = this.column.getInputs().R
  }

  /** El sistema termodinámico activo. */
  get system(): SystemDef {
    return ALL_SYSTEMS[this.config.systemKey] ?? ALL_SYSTEMS.bencenoTolueno
  }

  /** Configura el controlador PID (temperatura de plato sensible → esquema). */
  setControl(patch: Partial<ControlConfig>): void {
    const prev = this.control
    this.control = { ...prev, ...patch }
    // Al cambiar de esquema, cargar las ganancias recomendadas (el alumno
    // puede re-sintonizar desde ahí).
    if (patch.scheme !== undefined && patch.scheme !== prev.scheme) {
      const g = defaultGains(patch.scheme)
      this.control.kp = g.kp
      this.control.ki = g.ki
      sessionLog.log(
        'control',
        tGlobal('eng.esquemaControl', { scheme: patch.scheme }),
        { scheme: patch.scheme, kp: g.kp, ki: g.ki },
        this.column.time,
      )
    }
    const recreate =
      patch.kp !== undefined ||
      patch.ki !== undefined ||
      patch.kd !== undefined ||
      patch.scheme !== undefined
    if (recreate) this.pid = this.makePid()
    if (patch.enabled !== undefined && patch.enabled !== prev.enabled) this.pid.reset()
    if (!this.control.enabled) {
      const inp = this.column.getInputs()
      this.controlOutput = this.control.scheme === 'RV' ? inp.V_R : inp.R
    }
  }

  /** Temperatura actual del plato sensible (°C). */
  get controlMeasurement(): number {
    const s = this.column.snapshot()
    const idx = Math.max(0, Math.min(this.config.nTrays - 1, this.control.sensibleTray - 1))
    return s.trays[idx].T
  }

  /** Un tick de simulación (llamar desde rAF): avanza dtSim·speed horas. */
  tick(): void {
    if (!this.running) return
    const steps = Math.max(1, Math.round(this.speed))
    const dtSim = steps * this.dtTick

    if (this.control.enabled) {
      // Controlador en tiempo de simulación (resultados independientes de la velocidad)
      const T = this.controlMeasurement
      const u = this.pid.update(this.control.setpoint, T, dtSim)
      if (this.control.scheme === 'LD') {
        this.column.setInputs({ R: u })
        this.controlOutput = u
      } else if (this.control.scheme === 'RV') {
        this.column.setInputs({ V_R: u })
        this.controlOutput = u
      } else {
        // D/V: fijar la relación D/V → R = (1−dv)/dv (V_R se mantiene)
        const dv = u
        this.column.setInputs({ R: (1 - dv) / dv })
        this.controlOutput = dv
      }
    }

    for (let i = 0; i < steps; i++) {
      this.column.step(this.dtTick)
    }
    this.pushHistory()
  }

  private pushHistory(): void {
    const s = this.column.snapshot()
    this.history.push({
      t: s.t,
      xD: s.xD.slice(),
      xB: s.xB.slice(),
      TD: s.TD,
      TB: s.TB,
      D: s.D,
      B: s.B,
      QR: s.QR,
    })
    if (this.history.length > this.maxHistory) {
      this.history.splice(0, this.history.length - this.maxHistory)
    }
  }

  /** Reinicia y lleva la columna a estado estacionario por trozos (no bloquea la UI). */
  async resetToSteadyStateAsync(onProgress?: (frac: number) => void): Promise<void> {
    this.running = false
    this.rebuild()
    const totalSteps = 24000 // ≈ 12 h a dtTick (paso estable de RK4)
    const chunk = 400
    for (let done = 0; done < totalSteps; done += chunk) {
      for (let i = 0; i < chunk; i++) this.column.step(this.dtTick)
      onProgress?.(done / totalSteps)
      await new Promise((r) => setTimeout(r, 0))
    }
    this.pushHistory()
    this.running = true
  }

  /* ---------------------------------------------------------------- */
  /* Escenarios didácticos                                             */
  /* ---------------------------------------------------------------- */

  /** Aplica un escenario predefinido (cambios sobre la configuración actual). */
  applyScenario(name: ScenarioName): string {
    const inp = this.column.getInputs()
    let msg: string
    if (name === 'nominal') {
      this.rebuild()
      msg = tGlobal('eng.operacionNominal')
    } else if (name === 'pérdidaCalefacción') {
      this.setInputs({ V_R: inp.V_R * 0.7 })
      msg = tGlobal('eng.perdaCalefaccion')
    } else if (name === 'cambioAlimento') {
      this.setInputs({ zF: inp.zF.map((z, i) => (i === 0 ? Math.max(0.1, z - 0.15) : Math.min(0.9, z + 0.15))) })
      msg = tGlobal('eng.cambioAlimento')
    } else if (name === 'subirReflujo') {
      this.setInputs({ R: Math.min(10, inp.R * 1.5) })
      msg = tGlobal('eng.refluxo50')
    } else {
      this.setInputs({ F: Math.max(40, inp.F * 0.75) })
      msg = tGlobal('eng.alimentacion25')
    }
    const snapState = () => {
      const s = this.column.snapshot()
      return { xD: s.xD[0], xB: s.xB[0], QR: s.QR }
    }
    sessionLog.logState('scenario', msg.split('.')[0], snapState(), { scenario: name }, this.column.time)
    return msg
  }

  /* ---------------------------------------------------------------- */
  /* Exportación / importación de escenarios (JSON)                    */
  /* ---------------------------------------------------------------- */

  exportScenario(note?: string): string {
    const file: ScenarioFile = {
      app: 'destilador-digital-twin',
      version: 1,
      config: { ...this.config },
      inputs: this.column.getInputs(),
      state: this.column.exportState(),
      savedAt: new Date().toISOString(),
      note,
    }
    sessionLog.log('export', tGlobal('eng.escenarioExportado'), { note }, this.column.time)
    return JSON.stringify(file, null, 2)
  }

  /** Carga un escenario exportado; devuelve la nota si existe. */
  importScenario(json: string): string | undefined {
    const file = JSON.parse(json) as ScenarioFile
    if (file.app !== 'destilador-digital-twin') {
      throw new Error(tGlobal('eng.ficheiroNonRecoñecido'))
    }
    this.running = false
    this.rebuild(file.config)
    this.column.setInputs(file.inputs)
    this.column.importState(file.state)
    this.history = []
    this.pushHistory()
    this.running = true
    const s = this.column.snapshot()
    sessionLog.logState(
      'import',
      file.note ?? tGlobal('eng.escenarioImportado'),
      { xD: s.xD[0], xB: s.xB[0], QR: s.QR },
      {},
      this.column.time,
    )
    return file.note
  }

  /* ---------------------------------------------------------------- */
  /* Optimización energética guiada                                    */
  /* ---------------------------------------------------------------- */

  /**
   * Optimización energética guiada: minimiza Q_R cumpliendo
   * x_D ≥ xDmin y x_B ≤ xBmax.
   *
   * Enfoque de diseño (el mismo que se enseña en McCabe–Thiele):
   *   1. El balance global fija el caudal de destilado:
   *        D* = F·(z_F − x_Bmax)/(x_Dmin − x_Bmax)
   *   2. Con D fijo, V_R = (R+1)·D* − (1−q)·F, así que minimizar Q_R
   *      equivale a minimizar R.
   *   3. Se busca el R mínimo que cumple AMBAS purezas (evaluando el modelo
   *      dinámico en estacionario) y se refina por bisección.
   *
   * Resultado didáctico: si la misión es más estricta que el punto actual, el
   * ahorro es negativo ("la pureza cuesta energía"); si el punto actual está
   * sobreseparado, el ahorro es real.
   */
  async optimizeEnergy(
    opts: OptimizeOptions,
    onProgress?: (frac: number, msg: string) => void,
  ): Promise<OptimizeResult> {
    const { xDmin, xBmax } = opts
    this.running = false
    const initialQR = this.column.snapshot().QR
    const { F, q, zF } = this.column.getInputs()
    const zF0 = zF[0]

    if (!(xDmin > xBmax && xBmax < zF0 && xDmin > zF0)) {
      this.running = true
      return {
        feasible: false, R: this.column.getInputs().R, V_R: this.column.getInputs().V_R,
        QR: this.column.snapshot().QR, xD: 0, xB: 0, iterations: 0, savingsPct: 0, initialQR,
        message: tGlobal('eng.misionIncoherente'),
      }
    }

    // D* por el balance de la misión (limitado a (1, F−1))
    const Dtarget = Math.max(1, Math.min(F - 1, (F * (zF0 - xBmax)) / (xDmin - xBmax)))

    const evaluate = (): { xD: number; xB: number } => {
      const steps = 2400
      for (let i = 0; i < steps; i++) this.column.step(this.dtTick)
      const s = this.column.snapshot()
      return { xD: s.xD[0], xB: s.xB[0] }
    }

    const tol = 0.003
    let iterations = 0

    /** Fija R y V_R = (R+1)·D* − (1−q)·F; evalúa en estacionario. */
    const probe = async (R: number): Promise<{ xD: number; xB: number } | null> => {
      const V_R = (R + 1) * Dtarget - (1 - q) * F
      if (V_R < 40 || V_R > 300) return null
      this.setInputs({ R, V_R })
      iterations++
      const e = evaluate()
      return e
    }

    const meets = (p: { xD: number; xB: number } | null): p is { xD: number; xB: number } =>
      p !== null && p.xD >= xDmin - tol && p.xB <= xBmax + tol

    // Búsqueda gruesa: R de 1.0 hacia arriba (paso ×1.15)
    let loR: number | null = null // último R infactible
    let hiR: number | null = null // primer R factible
    let best: { R: number; xD: number; xB: number } | null = null
    let R = 1.0
    for (let guard = 0; guard < 14; guard++) {
      onProgress?.(0.15 + 0.7 * (guard / 14), tGlobal('eng.buscandoRefluxo', { r: R.toFixed(2) }))
      const p = await probe(R)
      if (meets(p)) {
        best = { R, xD: p.xD, xB: p.xB }
        hiR = R
        break
      }
      loR = R
      const next = R * 1.15
      if (next > 9.5) break
      R = next
      await new Promise((r) => setTimeout(r, 0))
    }

    if (!best) {
      this.running = true
      const s = this.column.snapshot()
      return {
        feasible: false, R: this.column.getInputs().R, V_R: this.column.getInputs().V_R,
        QR: s.QR, xD: s.xD[0], xB: s.xB[0], iterations, savingsPct: 0, initialQR,
        message: tGlobal('eng.nonSeAtopan', { d: Dtarget.toFixed(1), xd: xDmin.toFixed(2), xb: xBmax.toFixed(2), n: this.config.nTrays }),
      }
    }

    // Refinamiento por bisección en R
    if (loR !== null) {
      let lo = loR
      let hi = hiR as number
      for (let b = 0; b < 3; b++) {
        const mid = (lo + hi) / 2
        const p = await probe(mid)
        if (meets(p)) {
          best = { R: mid, xD: p.xD, xB: p.xB }
          hi = mid
        } else {
          lo = mid
        }
        onProgress?.(0.9 + 0.03 * b, tGlobal('eng.afinando', { r: hi.toFixed(3) }))
        await new Promise((r) => setTimeout(r, 0))
      }
    }

    // Aplicar el óptimo y estabilizar
    const VRopt = (best.R + 1) * Dtarget - (1 - q) * F
    this.setInputs({ R: best.R, V_R: VRopt })
    for (let i = 0; i < 2400; i++) this.column.step(this.dtTick)
    const fin = this.column.snapshot()
    const savingsPct = initialQR > 0 ? ((initialQR - fin.QR) / initialQR) * 100 : 0
    this.pushHistory()
    this.running = true

    sessionLog.logState(
      'note',
      tGlobal('eng.optimizacionEnerxetica'),
      { xD: fin.xD[0], xB: fin.xB[0], QR: fin.QR },
      { xDmin, xBmax, R: best.R, V_R: VRopt, D: Dtarget, savingsPct: Math.round(savingsPct * 10) / 10 },
      this.column.time,
    )

    return {
      feasible: true,
      R: best.R,
      V_R: VRopt,
      QR: fin.QR,
      xD: fin.xD[0],
      xB: fin.xB[0],
      iterations,
      savingsPct,
      initialQR,
      message:
        savingsPct >= 0.5
          ? tGlobal('eng.optimo', { r: best.R.toFixed(2), qr: (fin.QR / 3.6e6).toFixed(2), pct: savingsPct.toFixed(1) })
          : savingsPct <= -0.5
            ? tGlobal('eng.maisEnerxia', { r: best.R.toFixed(2), qr: (fin.QR / 3.6e6).toFixed(2), pct: (-savingsPct).toFixed(1) })
            : tGlobal('eng.minimoEnerxetico', { r: best.R.toFixed(2) }),
    }
  }

  snapshot(): SimSnapshot {
    return {
      config: { ...this.config },
      inputs: this.column.getInputs(),
      column: this.column.snapshot(),
      history: this.history.map((h) => ({ ...h, xD: h.xD.slice(), xB: h.xB.slice() })),
      control: { ...this.control },
      controlOutput: this.controlOutput,
      controlMeasurement: this.controlMeasurement,
    }
  }
}
