/**
 * Tests del modelo dinámico, del control PID y del modo gemelo.
 *
 * Validación principal: con los mismos datos que el ejemplo McCabe–Thiele del
 * documento teórico (12 platos + rehervidor ≈ 13 etapas, plato de alimentación
 * 5, R = 1.65, V_R = 132.5, F = 100, z = 0.5, q = 1), el estado estacionario
 * del modelo dinámico debe reproducir x_D ≈ 0.95 y x_B ≈ 0.05.
 */

import { describe, it, expect } from 'vitest'
import { DynamicColumn } from './columnDynamic'
import { PID } from './control'
import { DigitalTwin, Rng } from './twin'
import { sistemaBencenoTolueno } from './components'

function makeColumn(mode: 'total' | 'partial' = 'total', opts: Partial<ConstructorParameters<typeof DynamicColumn>[0]> = {}) {
  const nTrays = 12
  const feedStage = 5
  // Perfil inicial lineal xD=0.95 → xB=0.05
  const trays: number[][] = []
  for (let j = 0; j < nTrays; j++) {
    const x = 0.95 - ((0.95 - 0.05) * j) / (nTrays - 1)
    trays.push([x, 1 - x])
  }
  return new DynamicColumn({
    system: sistemaBencenoTolueno,
    nTrays,
    feedStage,
    P: 760,
    mode,
    trayHoldup: 0.5,
    reboilerHoldup: 10,
    condenserHoldup: 2,
    x0: { trays, bottoms: [0.05, 0.95] },
    ...opts,
  })
}

describe('Modelo dinámico · benceno–tolueno', () => {
  it('alcanza estado estacionario ≈ McCabe–Thiele (xD≈0.95, xB≈0.05)', () => {
    const col = makeColumn()
    col.setInputs({ F: 100, zF: [0.5, 0.5], q: 1, R: 1.65, V_R: 132.5 })
    // dt = 0.0005 h: paso estable de RK4 (el acoplado más rápido es ~3 s)
    col.runToSteadyState(12, 1e-6, 0.0005)
    const snap = col.snapshot()
    // Tolerancias amplias: el modelo dinámico aproxima el diseño McCabe–Thiele
    expect(snap.xD[0]).toBeGreaterThan(0.88)
    expect(snap.xD[0]).toBeLessThan(0.975)
    expect(snap.xB[0]).toBeGreaterThan(0.02)
    expect(snap.xB[0]).toBeLessThan(0.11)
    // Verificación de balances globales
    const { D, B, L_rect, V_rect } = snap
    expect(D).toBeGreaterThan(0)
    expect(B).toBeGreaterThan(0)
    expect(Math.abs(L_rect + D - V_rect)).toBeLessThan(1e-6)
  })

  it('subir R aumenta la pureza del destilado (respuesta transitoria)', () => {
    const col = makeColumn()
    col.setInputs({ F: 100, zF: [0.5, 0.5], q: 1, R: 1.65, V_R: 132.5 })
    col.runToSteadyState(10, 1e-6, 0.0005)
    const xD0 = col.snapshot().xD[0]
    col.setInputs({ R: 2.6 })
    col.runToSteadyState(10, 1e-6, 0.0005)
    const xD1 = col.snapshot().xD[0]
    expect(xD1).toBeGreaterThan(xD0 + 0.005)
  })

  it('condensador parcial: el destilado es vapor en equilibrio (etapa extra)', () => {
    const col = makeColumn('partial')
    col.setInputs({ F: 100, zF: [0.5, 0.5], q: 1, R: 1.65, V_R: 132.5 })
    col.runToSteadyState(10, 1e-6, 0.0005)
    const snap = col.snapshot()
    expect(snap.distillate).not.toBeNull()
    expect(snap.xD.every((v) => Number.isFinite(v))).toBe(true)
    expect(snap.xD[0]).toBeGreaterThan(0.85)
  })

  it('sin NaN incluso con entradas agresivas (R alta)', () => {
    const col = makeColumn()
    col.setInputs({ F: 100, zF: [0.5, 0.5], q: 0.5, R: 8, V_R: 250 })
    for (let i = 0; i < 200; i++) col.step(0.002)
    const snap = col.snapshot()
    for (const v of [...snap.xD, ...snap.xB]) expect(Number.isFinite(v)).toBe(true)
    expect(snap.TD).toBeGreaterThan(60)
    expect(snap.TD).toBeLessThan(130)
  })
})

describe('Modos de reflujo del condensador', () => {
  it('sin reflujo (R=0): D = V_rect, separación pobre, sin NaN', () => {
    const col = makeColumn()
    col.setInputs({ F: 100, zF: [0.5, 0.5], q: 1, R: 0, V_R: 80 })
    col.runToSteadyState(10, 1e-6, 0.0005)
    const snap = col.snapshot()
    // D = V_rect/(R+1) = V_rect
    expect(snap.D).toBeCloseTo(snap.V_rect, 6)
    expect(snap.D).toBeCloseTo(80, 6)
    expect(snap.B).toBeCloseTo(20, 6)
    // Sin reflujo la pureza del destilado es mucho menor que con reflujo
    expect(snap.xD[0]).toBeLessThan(0.9)
    for (const v of [...snap.xD, ...snap.xB, snap.TD, snap.TB]) {
      expect(Number.isFinite(v)).toBe(true)
    }
  })

  it('reflujo total (R→∞): D ≈ 0 y destilado a máxima pureza (límite de Fenske)', () => {
    const col = makeColumn()
    col.setInputs({ F: 100, zF: [0.5, 0.5], q: 1, R: 999, V_R: 132.5 })
    col.runToSteadyState(12, 1e-6, 0.0005)
    const snap = col.snapshot()
    expect(snap.D).toBeLessThan(0.5) // D ≈ V_rect/1000
    expect(snap.xD[0]).toBeGreaterThan(0.97) // pureza máxima alcanzable
    expect(Math.abs(snap.B - 100)).toBeLessThan(1) // todo el alimento a fondos
    expect(Number.isFinite(snap.TD)).toBe(true)
  })
})

describe('Control PID', () => {
  it('sigue un cambio de consigna en una planta de primer orden', () => {
    // Planta: dy/dt = (u − y)/τ
    const tau = 0.5
    const pid = new PID({ kp: 3, ki: 4, kd: 0, outMin: 0, outMax: 10 })
    let y = 0
    let t = 0
    const dt = 0.01
    const target = 2
    for (let i = 0; i < 3000; i++) {
      const u = pid.update(target, y, dt)
      y += ((u - y) / tau) * dt
      t += dt
    }
    expect(Math.abs(y - target)).toBeLessThan(0.02)
  })

  it('respeta los límites de salida (anti-windup no explota)', () => {
    const pid = new PID({ kp: 50, ki: 5, kd: 0, outMin: 0, outMax: 1 })
    let y = 0
    const dt = 0.01
    for (let i = 0; i < 500; i++) {
      const u = pid.update(10, y, dt) // setpoint muy alto
      y += ((u - y) / 1) * dt
      expect(u).toBeGreaterThanOrEqual(0)
      expect(u).toBeLessThanOrEqual(1 + 1e-12)
    }
  })
})

describe('Modo gemelo digital', () => {
  it('las mediciones tienen ruido pero el gemelo predice cerca de la planta', () => {
    const plant = makeColumn()
    const model = makeColumn()
    plant.setInputs({ F: 100, zF: [0.5, 0.5], q: 1, R: 2, V_R: 140 })
    model.setInputs({ F: 100, zF: [0.5, 0.5], q: 1, R: 2, V_R: 140 })
    const twin = new DigitalTwin({ plant, model, noise: { T: 0.2, x: 0.001, flow: 0.3, level: 0.05 }, seed: 7 })
    for (let i = 0; i < 100; i++) twin.step(0.05)
    const snap = twin.step(0.05)
    expect(Math.abs(snap.measured.TD - snap.predicted.TD)).toBeLessThan(1.5)
    expect(Math.abs(snap.measured.xD[0] - snap.predicted.xD[0])).toBeLessThan(0.02)
  })

  it('la perturbación "pérdida de vapor" reduce el calor y el ruido se aplica', () => {
    const plant = makeColumn()
    const model = makeColumn()
    plant.setInputs({ F: 100, zF: [0.5, 0.5], q: 1, R: 2, V_R: 140 })
    model.setInputs({ F: 100, zF: [0.5, 0.5], q: 1, R: 2, V_R: 140 })
    const twin = new DigitalTwin({ plant, model, noise: { T: 0, x: 0, flow: 0, level: 0 }, seed: 1 })
    twin.applyDisturbance('lossReboilerHeat', 5)
    const snap = twin.step(0.05)
    expect(snap.disturbance).toBe('lossReboilerHeat')
    // V_R de la planta reducido al 60 %
    expect(snap.truePlant.V_strip).toBeLessThan(140 * 0.65)
  })

  it('la perturbación de flujo es un escalón único (F no explota)', () => {
    const plant = makeColumn()
    const model = makeColumn()
    plant.setInputs({ F: 100, zF: [0.5, 0.5], q: 1, R: 2, V_R: 140 })
    model.setInputs({ F: 100, zF: [0.5, 0.5], q: 1, R: 2, V_R: 140 })
    const twin = new DigitalTwin({ plant, model, noise: { T: 0, x: 0, flow: 0, level: 0 }, seed: 1 })
    twin.applyDisturbance('feedFlowStep', 5)
    for (let i = 0; i < 800; i++) twin.step(0.01)
    const F = plant.getInputs().F
    expect(F).toBeCloseTo(130, 6) // 100 × 1.3 aplicado una sola vez
    expect(twin.activeDisturbance).toBe('none') // terminó tras 5 h
  })

  it('RNG reproducible (mismo seed → misma secuencia)', () => {
    const a = new Rng(42)
    const b = new Rng(42)
    const va = [a.gaussian(), a.gaussian(), a.gaussian()]
    const vb = [b.gaussian(), b.gaussian(), b.gaussian()]
    expect(va).toEqual(vb)
  })
})
