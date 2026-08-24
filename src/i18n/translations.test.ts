/**
 * Test de completitud del sistema i18n: los tres idiomas deben tener las
 * mismas claves y sin valores vacíos.
 */

import { describe, it, expect } from 'vitest'
import { translations } from './translations'
import { tGlobal, setGlobalLang } from './index'

describe('Diccionarios de traducción', () => {
  const glKeys = Object.keys(translations.gl).sort()
  const esKeys = Object.keys(translations.es).sort()
  const enKeys = Object.keys(translations.en).sort()

  it('es y en contienen exactamente las mismas claves que gl', () => {
    expect(esKeys).toEqual(glKeys)
    expect(enKeys).toEqual(glKeys)
  })

  it('ningún valor está vacío', () => {
    for (const lang of ['gl', 'es', 'en'] as const) {
      for (const [k, v] of Object.entries(translations[lang])) {
        expect(v.trim().length, `${lang}:${k}`).toBeGreaterThan(0)
      }
    }
  })

  it('tGlobal cambia de idioma y sustituye variables', () => {
    setGlobalLang('en')
    expect(tGlobal('sim.refluxoR')).toBe('Reflux ratio R')
    expect(tGlobal('chart.etapas', { n: 13, f: 5 })).toContain('13 stages')
    expect(tGlobal('eng.optimo', { r: '2.0', qr: '1.17', pct: '10' })).toContain('Optimum')
    setGlobalLang('es')
    expect(tGlobal('sim.refluxoR')).toBe('Reflujo R')
    expect(tGlobal('mt.senRefluxo')).toContain('sin reflujo')
    setGlobalLang('gl')
    expect(tGlobal('sim.refluxoR')).toBe('Refluxo R')
  })
})
