/**
 * Modo gemelo digital.
 *
 * Dos instancias del modelo dinámico corren en paralelo:
 *   - "planta" (proceso físico simulado): recibe perturbaciones y ruido de
 *     medición (simula los sensores reales: T, caudales, niveles).
 *   - "modelo" (gemelo): réplica nominal que el alumno puede ajustar
 *     (parámetros o entradas) y comparar contra las "mediciones".
 *
 * El alumno actúa como operador: detecta desviaciones, corrige consignas y
 * observa si el gemelo vuelve a seguir a la planta. Permite escenarios
 * didácticos (arranque, pérdida de vapor de calefacción, cambio de alimento).
 */

import { DynamicColumn, type ColumnSnapshot } from './columnDynamic'

export interface NoiseLevels {
  /** Desviación estándar de temperatura, °C */
  T: number
  /** Desviación estándar de composición (fracción molar) */
  x: number
  /** Desviación estándar de caudales, kmol/h */
  flow: number
  /** Desviación estándar de nivel, kmol */
  level: number
}

export type Disturbance = 'none' | 'lossReboilerHeat' | 'feedCompositionStep' | 'feedFlowStep'

export interface TwinConfig {
  plant: DynamicColumn
  model: DynamicColumn
  noise?: Partial<NoiseLevels>
  seed?: number
}

export interface TwinMeasurement {
  TProfile: number[]
  xD: number[]
  xB: number[]
  TD: number
  TB: number
  D: number
  B: number
  QR: number
  drumLevel: number
  reboilerLevel: number
}

export interface TwinSnapshot {
  time: number
  /** Medidas "de planta" (con ruido) */
  measured: TwinMeasurement
  /** Predicciones del gemelo (modelo, sin ruido) */
  predicted: ColumnSnapshot
  /** Estado verdadero de la planta (sin ruido, para el profesor) */
  truePlant: ColumnSnapshot
  /** Perturbación activa */
  disturbance: Disturbance
  /** Tiempo restante de la perturbación (h) */
  disturbanceRemaining: number
}

/** Generador congruencial simple para ruido reproducible. */
export class Rng {
  private s: number
  constructor(seed = 12345) {
    this.s = seed >>> 0
  }
  next(): number {
    // LCG (Park–Miller)
    this.s = (this.s * 48271) % 2147483647
    return (this.s / 2147483647) * 2 - 1
  }
  gaussian(): number {
    // Box–Muller
    const u1 = (this.next() + 1) / 2
    const u2 = (this.next() + 1) / 2
    return Math.sqrt(-2 * Math.log(Math.max(u1, 1e-12))) * Math.cos(2 * Math.PI * u2)
  }
}

export class DigitalTwin {
  readonly plant: DynamicColumn
  readonly model: DynamicColumn
  private noise: Required<NoiseLevels>
  private rng: Rng
  private disturbance: Disturbance = 'none'
  private disturbanceRemaining = 0
  private disturbanceApplied = false
  private identificationMode = false
  private t = 0

  constructor(config: TwinConfig) {
    this.plant = config.plant
    this.model = config.model
    this.noise = { T: 0.3, x: 0.002, flow: 0.5, level: 0.1, ...config.noise }
    this.rng = new Rng(config.seed ?? 12345)
  }

  /** Aplica una perturbación didáctica durante dur horas (escalón, se aplica una vez). */
  applyDisturbance(d: Disturbance, durH: number): void {
    this.disturbance = d
    this.disturbanceRemaining = durH
    this.disturbanceApplied = false
  }

  /** Ajusta los niveles de ruido de medición (para enseñar identificación). */
  setNoise(noise: Partial<NoiseLevels>): void {
    this.noise = { ...this.noise, ...noise }
  }

  /**
   * Modo identificación de modelo: el modelo conserva su propio V_R (y sus
   * holdups) mientras sigue recibiendo F, zF, q y R de la planta. El alumno
   * ajusta los parámetros del modelo para minimizar el residuo.
   */
  setIdentificationMode(on: boolean): void {
    this.identificationMode = on
  }

  get isIdentificationMode(): boolean {
    return this.identificationMode
  }

  /** Copia las entradas Y el estado de la planta al modelo (punto de partida). */
  syncPlantToModel(): void {
    this.model.setInputs(this.plant.getInputs())
    this.model.importState(this.plant.exportState())
  }

  get activeDisturbance(): Disturbance {
    return this.disturbance
  }

  /** Avanza planta y gemelo dt horas. */
  step(dt: number): TwinSnapshot {
    // Perturbaciones: se aplican UNA vez como escalón y duran durH horas.
    if (this.disturbanceRemaining > 0) {
      if (!this.disturbanceApplied) {
        const plantInputs = this.plant.getInputs()
        if (this.disturbance === 'lossReboilerHeat') {
          plantInputs.V_R *= 0.6
        } else if (this.disturbance === 'feedCompositionStep') {
          plantInputs.zF = plantInputs.zF.map((z, i) =>
            i === 0 ? Math.min(0.95, z + 0.15) : Math.max(0.05, z - 0.15),
          )
        } else if (this.disturbance === 'feedFlowStep') {
          plantInputs.F *= 1.3
        }
        this.plant.setInputs(plantInputs)
        this.disturbanceApplied = true
      }
      this.disturbanceRemaining -= dt
      if (this.disturbanceRemaining <= 0) {
        this.disturbance = 'none'
        this.disturbanceApplied = false
      }
    }

    // Sincronización de consignas del modelo con la planta:
    //  - normal: el modelo recibe TODAS las entradas de la planta (incluidas
    //    las perturbaciones de V_R): compara "mismo modelo, mismos inputs".
    //  - identificación: el modelo recibe F/zF/q/R pero conserva su propio
    //    V_R y holdups (que el alumno ajusta para minimizar el residuo).
    const plantInputs = this.plant.getInputs()
    if (this.identificationMode) {
      const mi = this.model.getInputs()
      this.model.setInputs({ F: plantInputs.F, zF: plantInputs.zF, q: plantInputs.q, R: plantInputs.R, V_R: mi.V_R })
    } else {
      this.model.setInputs(plantInputs)
    }

    this.plant.step(dt)
    this.model.step(dt)
    this.t += dt

    const truePlant = this.plant.snapshot()
    const predicted = this.model.snapshot()

    const noisy = (v: number, sd: number, min = 0): number =>
      Math.max(min, v + this.rng.gaussian() * sd)

    const measured: TwinMeasurement = {
      TProfile: truePlant.trays.map((tray) => noisy(tray.T, this.noise.T)),
      xD: truePlant.xD.map((v) => noisy(v, this.noise.x, 0)),
      xB: truePlant.xB.map((v) => noisy(v, this.noise.x, 0)),
      TD: noisy(truePlant.TD, this.noise.T),
      TB: noisy(truePlant.TB, this.noise.T),
      D: noisy(truePlant.D, this.noise.flow, 0),
      B: noisy(truePlant.B, this.noise.flow, 0),
      QR: noisy(truePlant.QR, this.noise.flow * 1000, 0),
      drumLevel: noisy(5, this.noise.level, 0),
      reboilerLevel: noisy(10, this.noise.level, 0),
    }

    return {
      time: this.t,
      measured,
      predicted,
      truePlant,
      disturbance: this.disturbance,
      disturbanceRemaining: Math.max(0, this.disturbanceRemaining),
    }
  }
}
