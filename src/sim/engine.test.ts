/**
 * Tests del motor de simulación para la UI: control PID (lazo de temperatura
 * sobre R), escenarios didácticos y exportación/importación de escenarios.
 *
 * Nota de tiempo: la columna converge desde el perfil inicial en ~1 h de
 * simulación (≈ 35 ticks a 60×). Los ticks se limitan para mantener los
 * tests rápidos; cada uno declara su propio timeout.
 */

import { describe, it, expect } from 'vitest'
import { SimEngine, type ScenarioFile } from './engine'

/** Avanza el motor n ticks a 60× (0.03 h por tick). */
function run(eng: SimEngine, ticks: number): void {
  eng.speed = 60
  for (let i = 0; i < ticks; i++) eng.tick()
}

describe('Control PID del motor', () => {
  it(
    'el lazo T_sensible → R lleva la temperatura a la consigna (acción inversa)',
    { timeout: 30000 },
    () => {
      const eng = new SimEngine({ systemKey: 'bencenoTolueno', nTrays: 12, feedStage: 5 })
      run(eng, 120) // ≈ 3.6 h: cerca del estado estacionario
      const T0 = eng.controlMeasurement
      const R0 = eng.snapshot().inputs.R

      // Consigna por debajo de T actual → el controlador debe SUBIR R (enfriar).
      // Ganancias conservadoras: la columna tiene retraso de respuesta y una
      // ganancia alta provoca ciclo límite (fenómeno didáctico por sí mismo).
      eng.setControl({ enabled: true, setpoint: T0 - 3, kp: 1, ki: 1, kd: 0 })
      run(eng, 400) // ≈ 12 h adicionales para que el lazo se asiente

      const snap = eng.snapshot()
      expect(snap.control.enabled).toBe(true)
      expect(Math.abs(snap.controlMeasurement - snap.control.setpoint)).toBeLessThan(0.6)
      expect(snap.inputs.R).toBeGreaterThan(R0 + 0.1)
      expect(snap.controlOutput).toBeGreaterThanOrEqual(0.5 - 1e-9)
      expect(snap.controlOutput).toBeLessThanOrEqual(10 + 1e-9)
    },
  )

  it(
    'en manual, R no cambia sola',
    { timeout: 20000 },
    () => {
      const eng = new SimEngine({ systemKey: 'bencenoTolueno' })
      run(eng, 120)
      const R = eng.snapshot().inputs.R
      eng.setControl({ enabled: false, setpoint: eng.controlMeasurement - 5 })
      run(eng, 100)
      expect(eng.snapshot().inputs.R).toBe(R)
    },
  )
})

describe('Escenarios didácticos', () => {
  it(
    'pérdida de calefacción: cae Q_R, los fondos se ensucian (x_B sube)',
    { timeout: 30000 },
    () => {
      const eng = new SimEngine({ systemKey: 'bencenoTolueno' })
      run(eng, 120)
      const xB0 = eng.snapshot().column.xB[0]
      const QR0 = eng.snapshot().column.QR
      const VR0 = eng.snapshot().inputs.V_R
      eng.applyScenario('pérdidaCalefacción')
      expect(eng.snapshot().inputs.V_R).toBeCloseTo(VR0 * 0.7, 9)
      run(eng, 200)
      const snap = eng.snapshot()
      expect(snap.column.QR).toBeLessThan(QR0) // menos energía
      expect(snap.column.xB[0]).toBeGreaterThan(xB0) // peor separación en fondos
    },
  )

  it(
    'subir reflujo: x_D sube pero D cae (misma energía, menos producto)',
    { timeout: 30000 },
    () => {
      const eng = new SimEngine({ systemKey: 'bencenoTolueno' })
      run(eng, 120)
      const xD0 = eng.snapshot().column.xD[0]
      const D0 = eng.snapshot().column.D
      eng.applyScenario('subirReflujo')
      run(eng, 200)
      const snap = eng.snapshot()
      expect(snap.column.xD[0]).toBeGreaterThan(xD0)
      expect(snap.column.D).toBeLessThan(D0)
      // Con V_R fijo, la energía por kmol de producto sube aunque Q_C sea igual
      expect(snap.column.QC / snap.column.D).toBeGreaterThan(0)
    },
  )
})

describe('Esquemas de control del motor', () => {
  it('R/V: el PID manipula V_R y la temperatura alcanza la consigna', { timeout: 40000 }, () => {
    const eng = new SimEngine({ systemKey: 'bencenoTolueno', nTrays: 12, feedStage: 5 })
    run(eng, 120)
    const T0 = eng.controlMeasurement
    const VR0 = eng.snapshot().inputs.V_R
    // Consigna por encima de T → más vapor de calefacción (V_R↑, acción directa).
    // Al cambiar el esquema se cargan las ganancias recomendadas (2/4).
    eng.setControl({ enabled: true, scheme: 'RV', setpoint: T0 + 3 })
    run(eng, 500)
    const snap = eng.snapshot()
    expect(snap.control.scheme).toBe('RV')
    expect(Math.abs(snap.controlMeasurement - snap.control.setpoint)).toBeLessThan(0.8)
    expect(snap.inputs.V_R).toBeGreaterThan(VR0 + 1)
    expect(snap.control.kp).toBe(2) // ganancias recomendadas cargadas
  })

  it('D/V: el PID manipula la relación D/V (R = (1−dv)/dv) y alcanza la consigna', { timeout: 40000 }, () => {
    const eng = new SimEngine({ systemKey: 'bencenoTolueno', nTrays: 12, feedStage: 5 })
    run(eng, 120)
    const T0 = eng.controlMeasurement
    const R0 = eng.snapshot().inputs.R
    // Consigna por encima de T → más destilado relativo (dv↑ → R↓ → más caliente)
    eng.setControl({ enabled: true, scheme: 'DV', setpoint: T0 + 1 })
    run(eng, 800)
    const snap = eng.snapshot()
    expect(snap.control.scheme).toBe('DV')
    expect(Math.abs(snap.controlMeasurement - snap.control.setpoint)).toBeLessThan(0.8)
    expect(snap.inputs.R).toBeLessThan(R0)
    // Coherencia: R = (1−dv)/dv con la salida del PID
    expect(snap.inputs.R).toBeCloseTo((1 - snap.controlOutput) / snap.controlOutput, 3)
  })

  it('al cambiar de esquema, el controlador se reinicia y respeta límites', { timeout: 20000 }, () => {
    const eng = new SimEngine()
    eng.setControl({ enabled: true, scheme: 'DV', setpoint: 90, kp: 0.1, ki: 0.2, kd: 0 })
    run(eng, 50)
    const snap = eng.snapshot()
    expect(snap.controlOutput).toBeGreaterThanOrEqual(0.25 - 1e-9)
    expect(snap.controlOutput).toBeLessThanOrEqual(0.75 + 1e-9)
  })
})

describe('Optimización energética guiada', () => {
  it('misión estricta: encuentra el mínimo energético (puede exigir más energía)', { timeout: 120000 }, async () => {
    const eng = new SimEngine({ systemKey: 'bencenoTolueno', nTrays: 12, feedStage: 5 })
    run(eng, 120)
    const before = eng.snapshot()

    // Misión más estricta que el nominal (xD≈0.95, xB≈0.047)
    const res = await eng.optimizeEnergy({ xDmin: 0.97, xBmax: 0.03 })
    expect(res.feasible).toBe(true)
    // Restricciones cumplidas (con tolerancia de evaluación)
    expect(res.xD).toBeGreaterThanOrEqual(0.967)
    expect(res.xB).toBeLessThanOrEqual(0.033)
    // La columna quedó aplicada en el óptimo
    const after = eng.snapshot()
    expect(after.inputs.R).toBeCloseTo(res.R, 6)
    expect(after.inputs.V_R).toBeCloseTo(res.V_R, 6)
    expect(after.column.xD[0]).toBeGreaterThanOrEqual(0.967)
    expect(after.column.xB[0]).toBeLessThanOrEqual(0.033)
    expect(before.column.QR).toBeGreaterThan(0)
  })

  it('punto sobreseparado: reduce Q_R con ahorro real cumpliendo la misión', { timeout: 120000 }, async () => {
    const eng = new SimEngine({ systemKey: 'bencenoTolueno', nTrays: 12, feedStage: 5 })
    run(eng, 120)
    // Operación despilfarradora: mucho reflujo y mucha calefacción
    eng.setInputs({ R: 4, V_R: 280 })
    run(eng, 200)

    const res = await eng.optimizeEnergy({ xDmin: 0.95, xBmax: 0.05 })
    expect(res.feasible).toBe(true)
    expect(res.xD).toBeGreaterThanOrEqual(0.947)
    expect(res.xB).toBeLessThanOrEqual(0.053)
    // Ahorro energético real frente al punto despilfarrador
    expect(res.savingsPct).toBeGreaterThan(5)
    expect(res.QR).toBeLessThan(280 * 31.9 * 1000 * 0.95)
  })

  it('reporta inviabilidad si la pureza pedida es inalcanzable', { timeout: 30000 }, async () => {
    const eng = new SimEngine({ systemKey: 'bencenoTolueno', nTrays: 12, feedStage: 5 })
    run(eng, 60)
    const res = await eng.optimizeEnergy({ xDmin: 0.9999, xBmax: 0.001 })
    expect(res.feasible).toBe(false)
    expect(res.message).toContain('Non se atopan')
  })
})

describe('Exportación/importación de escenarios', () => {
  it(
    'el roundtrip JSON conserva el estado (xD, xB, T, entradas)',
    { timeout: 30000 },
    () => {
      const eng = new SimEngine({ systemKey: 'etanolAgua', nTrays: 14, feedStage: 6 })
      run(eng, 120)
      const json = eng.exportScenario('test')
      const file = JSON.parse(json) as ScenarioFile
      expect(file.app).toBe('destilador-digital-twin')
      expect(file.config.nTrays).toBe(14)

      const eng2 = new SimEngine({ systemKey: 'bencenoTolueno' }) // distinta config inicial
      eng2.importScenario(json)
      const a = eng.snapshot()
      const b = eng2.snapshot()
      expect(b.config.nTrays).toBe(14)
      expect(b.config.systemKey).toBe('etanolAgua')
      expect(b.inputs.R).toBeCloseTo(a.inputs.R, 9)
      expect(b.column.xD[0]).toBeCloseTo(a.column.xD[0], 9)
      expect(b.column.xB[0]).toBeCloseTo(a.column.xB[0], 9)
      expect(b.column.TD).toBeCloseTo(a.column.TD, 9)
      expect(b.column.TB).toBeCloseTo(a.column.TB, 9)
    },
  )

  it(
    'rechaza archivos que no son escenarios',
    { timeout: 10000 },
    () => {
      const eng = new SimEngine()
      expect(() => eng.importScenario('{"app":"otra-app"}')).toThrow()
      expect(() => eng.importScenario('no-json')).toThrow()
    },
  )
})
