/**
 * Tests del núcleo termodinámico.
 *
 * Verifican valores conocidos de la literatura:
 *  - Benceno–tolueno (ideal): T_burbuja(0.5) ≈ 92.0 °C, y ≈ 0.71, α ≈ 2.5
 *  - Etanol–agua: azeótropo mínimo en x_EtOH ≈ 0.895, T ≈ 78.2 °C
 *  - Metanol–agua: sin azeótropo
 *  - Acetona–cloroformo: azeótropo máximo en x_acetona ≈ 0.34, T ≈ 64.5 °C
 */

import { describe, it, expect } from 'vitest'
import {
  sistemaBencenoTolueno,
  sistemaEtanolAgua,
  sistemaMetanolAgua,
  sistemaAcetonaCloroformo,
} from './components'
import {
  bubblePoint,
  dewPoint,
  kValues,
  flash,
  isAzeotrope,
} from './thermo'
import { tboil } from './thermo'

const closeTo = (a: number, b: number, tol: number) =>
  expect(Math.abs(a - b)).toBeLessThanOrEqual(tol)

describe('Benceno–Tolueno (ideal)', () => {
  const sys = sistemaBencenoTolueno
  const P = 760

  it('puntos de ebullición normales (80.1 y 110.6 °C)', () => {
    closeTo(tboil(sys.components[0]), 80.1, 0.5)
    closeTo(tboil(sys.components[1]), 110.6, 0.5)
  })

  it('punto de burbuja de x=0.5 → T ≈ 92.0 °C, y ≈ 0.71', () => {
    const b = bubblePoint(sys, [0.5, 0.5], P)
    closeTo(b.T, 92.0, 1.5)
    closeTo(b.y[0], 0.71, 0.02)
  })

  it('punto de rocío de y=0.5 → T ≈ 98.8 °C', () => {
    const d = dewPoint(sys, [0.5, 0.5], P)
    closeTo(d.T, 98.8, 1.5)
  })

  it('volatilidad relativa ≈ 2.5 (K1/K2 a 92 °C)', () => {
    const K = kValues(sys, [0.5, 0.5], 92, P)
    closeTo(K[0] / K[1], 2.5, 0.3)
  })

  it('sin azeótropo en x=0.5', () => {
    expect(isAzeotrope(sys, [0.5, 0.5], P)).toBe(false)
  })
})

describe('Etanol–Agua (no ideal, azeótropo mínimo)', () => {
  const sys = sistemaEtanolAgua
  const P = 760

  it('el azeótropo está en x_EtOH ≈ 0.895 con T ≈ 78.2 °C', () => {
    // Buscar x* donde y(x) = x barriendo la curva de equilibrio
    let xStar = -1
    let tStar = -1
    let prevY = 0
    for (let i = 0; i <= 200; i++) {
      const x = i / 200
      const b = bubblePoint(sys, [x, 1 - x], P)
      const y = b.y[0]
      if (prevY !== undefined && (y - x) * (prevY - (x - 0.005)) < 0) {
        xStar = x
        tStar = b.T
        break
      }
      prevY = y
    }
    if (xStar < 0) {
      // No se cruza la diagonal: el parámetro Λ del sistema es incorrecto
      expect(xStar).toBeGreaterThan(0)
      return
    }
    closeTo(xStar, 0.895, 0.03)
    closeTo(tStar, 78.2, 2.0)
  })

  it('γ en el azeótropo: γ_EtOH ≈ 1.12, γ_agua ≈ 2.3 (K = 1 en el azeótropo)', () => {
    // En el azeótropo K_i = 1 → γ_i = P / P_i^sat
    const T = 78.2
    const K = kValues(sys, [0.895, 0.105], T, P)
    const gammaEtOH = K[0] * P / psatAt(sys.components[0].antoine, T)
    const gammaAgua = K[1] * P / psatAt(sys.components[1].antoine, T)
    closeTo(gammaEtOH, 1.12, 0.15)
    closeTo(gammaAgua, 2.31, 0.4)
    expect(gammaAgua).toBeGreaterThan(1.5) // desviación positiva fuerte
  })
})

describe('Metanol–Agua (no ideal, sin azeótropo)', () => {
  const sys = sistemaMetanolAgua
  const P = 760

  it('y > x en todo el rango (sin cruce de diagonal)', () => {
    for (let i = 5; i <= 95; i += 5) {
      const x = i / 100
      const b = bubblePoint(sys, [x, 1 - x], P)
      expect(b.y[0]).toBeGreaterThan(x + 0.01)
    }
  })

  it('T de burbuja entre los puntos de ebullición puros', () => {
    const tbMet = tboil(sys.components[0])
    const tbAg = tboil(sys.components[1])
    for (let i = 10; i <= 90; i += 10) {
      const x = i / 100
      const b = bubblePoint(sys, [x, 1 - x], P)
      expect(b.T).toBeGreaterThan(tbMet - 0.5)
      expect(b.T).toBeLessThan(tbAg + 0.5)
    }
  })
})

describe('Acetona–Cloroformo (no ideal, azeótropo máximo)', () => {
  const sys = sistemaAcetonaCloroformo
  const P = 760

  it('azeótropo máximo en x_acetona ≈ 0.34, T ≈ 64.5 °C', () => {
    let xStar = -1
    let tStar = -1
    let prev = 0
    for (let i = 0; i <= 200; i++) {
      const x = i / 200
      const b = bubblePoint(sys, [x, 1 - x], P)
      const y = b.y[0]
      if (i > 0 && (y - x) * (prev - (x - 0.005)) < 0) {
        xStar = x
        tStar = b.T
        break
      }
      prev = y
    }
    if (xStar < 0) {
      expect(xStar).toBeGreaterThan(0)
      return
    }
    closeTo(xStar, 0.34, 0.04)
    closeTo(tStar, 64.5, 2.0)
    // Azeótropo de máximo: T mayor que los puntos de ebullición puros
    expect(tStar).toBeGreaterThan(tboil(sys.components[0]))
    expect(tStar).toBeGreaterThan(tboil(sys.components[1]))
  })
})

describe('Flash', () => {
  it('flash benceno–tolueno z=0.5 a 95 °C y 760 mmHg: 0 < ψ < 1', () => {
    const f = flash(sistemaBencenoTolueno, [0.5, 0.5], 760, 95)
    expect(f.psi).toBeGreaterThan(0)
    expect(f.psi).toBeLessThan(1)
    // A 95 °C el líquido debe ser más pobre en benceno que el alimento
    expect(f.x[0]).toBeLessThan(0.5)
    expect(f.y[0]).toBeGreaterThan(0.5)
  })
})

// Helper local
import type { AntoineParams } from './antoine'
import { psatMMHg } from './antoine'
function psatAt(p: AntoineParams, T: number): number {
  return psatMMHg(p, T)
}
