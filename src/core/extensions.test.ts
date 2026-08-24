/**
 * Tests de las ampliaciones: columna ternaria, modo identificación del gemelo
 * y registro de sesión.
 */

import { describe, it, expect } from 'vitest'
import { DynamicColumn } from './columnDynamic'
import { DigitalTwin } from './twin'
import { SessionLog } from './session'
import { evaluateQuiz, assessSession, QUIZ_QUESTIONS } from './assessment'
import {
  sistemaBencenoToluenoEtilbenceno,
  sistemaBencenoToluenoEtilbencenoEstireno,
  sistemaBencenoTolueno,
} from './components'
import { flash } from './thermo'

function makeTernary(nTrays = 12, feedStage = 5): DynamicColumn {
  const trays: number[][] = []
  for (let j = 0; j < nTrays; j++) {
    const x0 = 0.6 - (0.55 * j) / Math.max(1, nTrays - 1)
    trays.push([x0, (1 - x0) / 2, (1 - x0) / 2])
  }
  return new DynamicColumn({
    system: sistemaBencenoToluenoEtilbenceno,
    nTrays,
    feedStage,
    P: 760,
    mode: 'total',
    trayHoldup: 0.5,
    reboilerHoldup: 10,
    condenserHoldup: 2,
    x0: { trays, bottoms: [0.02, 0.49, 0.49] },
  })
}

describe('Columna ternaria (benceno–tolueno–etilbenceno)', () => {
  it('alcanza estado estacionario con balances de materia por componente', () => {
    const col = makeTernary()
    col.setInputs({ F: 100, zF: [0.33, 0.33, 0.34], q: 1, R: 2.5, V_R: 180 })
    // Integración explícita (más determinista que el criterio de convergencia)
    for (let i = 0; i < 24000; i++) col.step(0.0005) // 12 h
    const s = col.snapshot()
    const nc = 3

    // Composición de destilado/fondos normalizada
    expect(s.xD.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6)
    expect(s.xB.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6)

    // El más volátil (benceno) se concentra en el destilado; el menos volátil
    // (etilbenceno) en los fondos
    expect(s.xD[0]).toBeGreaterThan(0.33)
    expect(s.xB[0]).toBeLessThan(0.33)
    expect(s.xD[2]).toBeLessThan(0.34)
    expect(s.xB[2]).toBeGreaterThan(0.34)

    // Balances globales por componente: F·z = D·x_D + B·x_B
    const { D, B } = s
    for (let i = 0; i < nc; i++) {
      const target = 100 * 0.33 + (i === 2 ? 1 : 0)
      expect(D * s.xD[i] + B * s.xB[i]).toBeCloseTo(target, 2)
    }
    expect(D + B).toBeCloseTo(100, 6)
    expect(D).toBeGreaterThan(0)
    expect(B).toBeGreaterThan(0)
  })

  it('flash ternario con ψ en (0,1) y composiciones normalizadas', () => {
    const f = flash(sistemaBencenoToluenoEtilbenceno, [0.33, 0.33, 0.34], 760, 105)
    expect(f.psi).toBeGreaterThan(0)
    expect(f.psi).toBeLessThan(1)
    expect(f.x.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6)
    expect(f.y.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6)
    expect(f.y[0]).toBeGreaterThan(f.x[0]) // benceno se enriquece en vapor
    expect(f.y[2]).toBeLessThan(f.x[2]) // etilbenceno se queda en líquido
  })
})

describe('Modo identificación del gemelo', () => {
  function makeTwin() {
    const plant = new DynamicColumn({
      system: sistemaBencenoTolueno,
      nTrays: 12,
      feedStage: 5,
      P: 760,
      mode: 'total',
      trayHoldup: 0.5,
      reboilerHoldup: 10,
      condenserHoldup: 2,
    })
    const model = new DynamicColumn({
      system: sistemaBencenoTolueno,
      nTrays: 12,
      feedStage: 5,
      P: 760,
      mode: 'total',
      trayHoldup: 0.5,
      reboilerHoldup: 10,
      condenserHoldup: 2,
    })
    plant.setInputs({ F: 100, zF: [0.5, 0.5], q: 1, R: 2, V_R: 140 })
    model.setInputs({ F: 100, zF: [0.5, 0.5], q: 1, R: 2, V_R: 140 })
    return new DigitalTwin({ plant, model, noise: { T: 0, x: 0, flow: 0, level: 0 }, seed: 3 })
  }

  it('en identificación, el modelo conserva su propio V_R (residuo crece con la perturbación)', () => {
    const twin = makeTwin()
    twin.syncPlantToModel()
    // Asentar ambas columnas antes de perturbar (estado estacionario común)
    for (let i = 0; i < 800; i++) twin.step(0.002)
    const xB0 = twin.step(0.002).measured.xB[0]
    const TB0 = twin.step(0.002).measured.TB
    twin.setIdentificationMode(true)
    twin.applyDisturbance('lossReboilerHeat', 5) // planta: V_R → 84
    for (let i = 0; i < 400; i++) twin.step(0.002)
    const s1 = twin.step(0.002)
    // El modelo mantiene V_R = 140 mientras la planta opera a 84
    expect(twin.model.getInputs().V_R).toBe(140)
    expect(twin.plant.getInputs().V_R).toBeCloseTo(84, 9)
    // Los residuos informativos de una perturbación de calor son x_B y T_B
    expect(Math.abs(s1.measured.xB[0] - xB0)).toBeGreaterThan(0.05)
    expect(Math.abs(s1.measured.TB - TB0)).toBeGreaterThan(2)
    expect(Math.abs(s1.measured.xB[0] - s1.predicted.xB[0])).toBeGreaterThan(0.05)
  })

  it('sincronizar el modelo con la planta elimina el residuo', () => {
    const twin = makeTwin()
    twin.syncPlantToModel()
    for (let i = 0; i < 800; i++) twin.step(0.002)
    twin.setIdentificationMode(true)
    twin.applyDisturbance('lossReboilerHeat', 5)
    for (let i = 0; i < 300; i++) twin.step(0.002)
    // El alumno "identifica" V_R correcto: 84 (0.6 × 140)
    twin.model.setInputs({ V_R: 84 })
    for (let i = 0; i < 400; i++) twin.step(0.002)
    const s = twin.step(0.002)
    expect(Math.abs(s.measured.xB[0] - s.predicted.xB[0])).toBeLessThan(0.005)
  })

  it('los factores de holdup modifican la dinámica del modelo', () => {
    const twin = makeTwin()
    twin.syncPlantToModel()
    twin.model.setHoldupFactors({ tray: 3, reboiler: 2 })
    expect(twin.model.holdupFactors.tray).toBe(3)
    expect(twin.model.holdupFactors.reboiler).toBe(2)

    const fast = makeTwin()
    fast.syncPlantToModel()
    // Estado de referencia (sin perturbación)
    const xD0 = twin.step(0.002).predicted.xD[0]
    const xD0f = fast.step(0.002).predicted.xD[0]

    twin.applyDisturbance('lossReboilerHeat', 5)
    fast.applyDisturbance('lossReboilerHeat', 5)
    for (let i = 0; i < 200; i++) {
      twin.step(0.002)
      fast.step(0.002)
    }
    const xDSlow = twin.step(0.002).predicted.xD[0]
    const xDFast = fast.step(0.002).predicted.xD[0]
    expect(Number.isFinite(xDSlow)).toBe(true)
    // El modelo con más holdup (más inercia) se desvía MENOS en el mismo tiempo
    expect(Math.abs(xDFast - xD0f)).toBeGreaterThan(Math.abs(xDSlow - xD0))
  })
})

describe('Registro de sesión (SessionLog)', () => {
  it('registra eventos, resume por tipo y exporta JSON', () => {
    const log = new SessionLog()
    log.log('input', 'Reflujo R → 2.5', { R: 2.5 }, 1.2)
    log.log('scenario', 'Pérdida de calefacción', { scenario: 'pérdidaCalefacción' }, 1.5)
    log.log('control', 'Esquema → RV', { scheme: 'RV' }, 2.0)
    log.log('disturbance', '+30 % de alimentación', {}, 3.1)

    const sum = log.summary()
    expect(sum.nEvents).toBe(4)
    expect(sum.byKind.input).toBe(1)
    expect(sum.byKind.scenario).toBe(1)
    expect(sum.byKind.control).toBe(1)
    expect(sum.byKind.disturbance).toBe(1)

    const file = JSON.parse(log.toJSON())
    expect(file.app).toBe('destilador-digital-twin')
    expect(file.events.length).toBe(4)
    expect(file.events[0].simTime).toBe(1.2)
    expect(file.events[1].detail.scenario).toBe('pérdidaCalefacción')
  })

  it('logState captura el estado de la columna en el evento', () => {
    const log = new SessionLog()
    log.logState('input', 'Subir R', { xD: 0.97, xB: 0.03, QR: 4.2e6 }, { R: 2.5 }, 5.0)
    const ev = log.events[0]
    expect(ev.state?.xD).toBe(0.97)
    expect(ev.state?.QR).toBe(4.2e6)
  })
})

describe('Columna cuaternaria (BTES)', () => {
  it('estado estacionario con balances exactos por componente', () => {
    const nc = 4
    const trays: number[][] = []
    for (let j = 0; j < 14; j++) {
      const x0 = 0.4 - (0.36 * j) / 13
      const rest = (1 - x0) / 3
      trays.push([x0, rest, rest, rest])
    }
    const col = new DynamicColumn({
      system: sistemaBencenoToluenoEtilbencenoEstireno,
      nTrays: 14,
      feedStage: 6,
      P: 760,
      mode: 'total',
      trayHoldup: 0.5,
      reboilerHoldup: 12,
      condenserHoldup: 2,
      x0: { trays, bottoms: [0.01, 0.33, 0.33, 0.33] },
    })
    col.setInputs({ F: 100, zF: [0.25, 0.25, 0.25, 0.25], q: 1, R: 3, V_R: 220 })
    for (let i = 0; i < 30000; i++) col.step(0.0005) // 15 h
    const s = col.snapshot()

    expect(s.xD.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6)
    expect(s.xB.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6)

    // Orden de volatilidad: el más volátil arriba, el menos volátil en fondos
    expect(s.xD[0]).toBeGreaterThan(0.25)
    expect(s.xB[nc - 1]).toBeGreaterThan(0.25)
    expect(s.xD[nc - 1]).toBeLessThan(0.25)
    expect(s.xB[0]).toBeLessThan(0.25)

    // Balances por componente: F·z = D·x_D + B·x_B
    const { D, B } = s
    for (let i = 0; i < nc; i++) {
      expect(D * s.xD[i] + B * s.xB[i]).toBeCloseTo(25, 1)
    }
    expect(D + B).toBeCloseTo(100, 6)
  })
})

describe('Evaluación automática', () => {
  it('evaluateQuiz puntúa aciertos y fallos', () => {
    const allCorrect = QUIZ_QUESTIONS.map((q) => q.correct)
    const r1 = evaluateQuiz(allCorrect)
    expect(r1.score).toBe(10)
    expect(r1.correctCount).toBe(QUIZ_QUESTIONS.length)

    const allWrong = QUIZ_QUESTIONS.map((q) => (q.correct + 1) % q.options.length)
    const r2 = evaluateQuiz(allWrong)
    expect(r2.score).toBe(0)
    expect(r2.answers.every((a) => !a)).toBe(true)
  })

  it('assessSession: misión lograda con pocos ajustes → nota alta', () => {
    const log = new SessionLog()
    // El alumno hace 3 ajustes y logra x_D ≥ 0.95, x_B ≤ 0.05
    log.logState('input', 'R → 2.0', { xD: 0.9, xB: 0.08, QR: 4e6 }, { R: 2 }, 1)
    log.logState('input', 'R → 2.8', { xD: 0.94, xB: 0.06, QR: 4.2e6 }, { R: 2.8 }, 2)
    log.logState('input', 'V_R → 150', { xD: 0.952, xB: 0.048, QR: 4.8e6 }, { V_R: 150 }, 3)
    const rep = assessSession(log)
    expect(rep.achieved).toBe(true)
    expect(rep.inputsToAchieve).toBe(3)
    expect(rep.efficiencyScore).toBe(10)
  })

  it('assessSession: sin misión lograda → feedback y nota baja; quiz suma', () => {
    const log = new SessionLog()
    log.logState('input', 'R → 1.2', { xD: 0.85, xB: 0.12, QR: 3.8e6 }, { R: 1.2 }, 1)
    log.logState('scenario', 'Pérdida de calefacción', { xD: 0.83, xB: 0.18, QR: 2.6e6 }, {}, 2)
    log.log('control', 'Esquema → L/D', { scheme: 'LD' }, 3)
    log.log('note', 'Quiz', { score: 8, quiz: true }, 4)

    const rep = assessSession(log)
    expect(rep.achieved).toBe(false)
    expect(rep.efficiencyScore).toBe(0)
    expect(rep.controlBonus).toBe(2)
    expect(rep.quizScore).toBe(8)
    expect(rep.totalScore).toBe(10)
    expect(rep.feedback.some((f) => f.includes('Non se alcanzou'))).toBe(true)
  })
})
