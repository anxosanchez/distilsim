import { describe, it, expect } from 'vitest'
import { SimEngine } from './engine'
import { mccabeThiele } from '../core/mccabeThiele'
import { sistemaBencenoTolueno, sistemaEtanolAgua } from '../core/components'

describe('Rendimiento UI', () => {
  it('engine.tick() (60 pasos RK4) < 40 ms para sistemas ideal y no ideal', () => {
    for (const key of ['bencenoTolueno', 'etanolAgua', 'acetonaCloroformo']) {
      const eng = new SimEngine({ systemKey: key as any, nTrays: 12, feedStage: 5 })
      // Calentamiento (JIT + cachés)
      for (let i = 0; i < 5; i++) eng.tick()
      const t0 = performance.now()
      for (let i = 0; i < 20; i++) eng.tick()
      const perTick = (performance.now() - t0) / 20
      console.log(`  ${key}: ${perTick.toFixed(2)} ms/tick`)
      expect(perTick).toBeLessThan(40)
    }
  })

  it('McCabe–Thiele (con caché de curva) < 5 ms', () => {
    const t0 = performance.now()
    for (let i = 0; i < 20; i++) {
      mccabeThiele(sistemaBencenoTolueno, { zF: 0.5, xD: 0.95, xB: 0.05, q: 1, R: 1.65, P: 760 })
      mccabeThiele(sistemaEtanolAgua, { zF: 0.3, xD: 0.8, xB: 0.05, q: 1, R: 2, P: 760 })
    }
    const per = (performance.now() - t0) / 20
    console.log(`  McCabe-Thiele (ideal+no ideal): ${per.toFixed(2)} ms`)
    expect(per).toBeLessThan(5)
  })
})
