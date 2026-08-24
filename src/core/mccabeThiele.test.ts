/**
 * Tests del método de McCabe–Thiele numérico.
 * Se validan contra el ejemplo resuelto del documento teórico
 * (docs/teoria-destilacion.md, sección 11): benceno–tolueno con
 * zF=0.50, xD=0.95, xB=0.05, q=1, R=1.65 → N_PS ≈ 13, plato de
 * alimentación ≈ 5, R_min ≈ 1.10.
 */

import { describe, it, expect } from 'vitest'
import { mccabeThiele } from './mccabeThiele'
import { sistemaBencenoTolueno, sistemaEtanolAgua } from './components'

const closeTo = (a: number, b: number, tol: number) =>
  expect(Math.abs(a - b)).toBeLessThanOrEqual(tol)

describe('McCabe–Thiele · Benceno–Tolueno (ideal)', () => {
  const res = mccabeThiele(sistemaBencenoTolueno, {
    zF: 0.5,
    xD: 0.95,
    xB: 0.05,
    q: 1,
    R: 1.65,
    P: 760,
  })

  it('es alcanzable', () => {
    expect(res.feasible).toBe(true)
  })

  it('R_min ≈ 1.10 (teoría: 1.10)', () => {
    closeTo(res.rMin, 1.1, 0.15)
  })

  it('N_PS ≈ 13 etapas teóricas (teoría: 13)', () => {
    closeTo(res.nStages, 13, 2)
  })

  it('plato de alimentación ≈ 5 (teoría: 5)', () => {
    closeTo(res.feedStage, 5, 1)
  })

  it('N_min por Fenske ≈ 6.4 (teoría: 6.4)', () => {
    closeTo(res.nMin, 6.4, 0.8)
  })

  it('α media ≈ 2.5', () => {
    closeTo(res.alphaAvg, 2.5, 0.3)
  })

  it('R = 0 (sin reflujo): escalonado degenerado evitado, con mensaje claro', () => {
    const r0 = mccabeThiele(sistemaBencenoTolueno, {
      zF: 0.5,
      xD: 0.8,
      xB: 0.3,
      q: 1,
      R: 0,
      P: 760,
    })
    expect(r0.feasible).toBe(true)
    // Sin bucle de 500 etapas: el escalonado se detiene al no progresar
    expect(r0.nStages).toBeLessThan(5)
    expect(r0.staircase.length).toBeLessThan(10)
    expect(r0.message).toBeDefined()
    expect(r0.message ?? '').toContain('sen refluxo')
  })

  it('la curva de equilibrio es coherente (y>0.71 en x=0.5)', () => {
    const idx = res.xEq.findIndex((x) => x >= 0.5)
    expect(res.yEq[idx]).toBeGreaterThan(0.7)
    expect(res.yEq[idx]).toBeLessThan(0.75)
  })
})

describe('McCabe–Thiele · Etanol–Agua (no ideal)', () => {
  it('x_D por debajo del azeótropo es alcanzable', () => {
    const res = mccabeThiele(sistemaEtanolAgua, {
      zF: 0.3,
      xD: 0.8,
      xB: 0.05,
      q: 1,
      R: 2,
      P: 760,
    })
    expect(res.feasible).toBe(true)
    expect(res.xAzeotrope).toBeDefined()
    if (res.xAzeotrope !== undefined) closeTo(res.xAzeotrope, 0.895, 0.03)
  })

  it('x_D por encima del azeótropo es inviable (mensaje claro)', () => {
    const res = mccabeThiele(sistemaEtanolAgua, {
      zF: 0.3,
      xD: 0.99,
      xB: 0.05,
      q: 1,
      R: 5,
      P: 760,
    })
    expect(res.feasible).toBe(false)
    expect(res.message).toBeDefined()
    expect(res.message ?? '').toContain('inviable')
  })

  it('mayor R → menos etapas (compromiso reflujo/etapas)', () => {
    const base = { zF: 0.3, xD: 0.8, xB: 0.05, q: 1, P: 760 }
    const rLow = mccabeThiele(sistemaEtanolAgua, { ...base, R: 1.5 })
    const rHigh = mccabeThiele(sistemaEtanolAgua, { ...base, R: 4 })
    expect(rHigh.nStages).toBeLessThan(rLow.nStages)
  })
})
