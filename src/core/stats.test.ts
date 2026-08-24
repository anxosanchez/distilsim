/**
 * Tests das estatísticas de uso anónimas (storage inxectado, reloxo simulado).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  initStatsStorage,
  recordVisit,
  recordLang,
  recordTab,
  heartbeat,
  getUsageStats,
  countryFromTimezone,
  formatDuration,
  resetUsageStats,
  sessionTimeMs,
} from './stats'

function memStorage() {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => {
      m.set(k, v)
    },
    removeItem: (k: string) => {
      m.delete(k)
    },
  }
}

describe('Estatísticas de uso', () => {
  let now = 1_000_000

  beforeEach(() => {
    now = 1_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    initStatsStorage(memStorage())
  })

  it('recordVisit incrementa visitas e captura a primeira visita', () => {
    recordVisit()
    recordVisit()
    const d = getUsageStats()
    expect(d.visits).toBe(2)
    expect(d.firstVisit).toBeTruthy()
  })

  it('recordLang acumula as eleccións de idioma', () => {
    recordLang('gl')
    recordLang('es')
    recordLang('gl')
    const d = getUsageStats()
    expect(d.languageChoices.gl).toBe(2)
    expect(d.languageChoices.es).toBe(1)
    expect(d.languageChoices.en).toBe(0)
  })

  it('recordTab rexistra as pestanas visitadas', () => {
    recordTab('sim')
    recordTab('3d')
    recordTab('sim')
    const d = getUsageStats()
    expect(d.tabsVisited.sim).toBe(2)
    expect(d.tabsVisited['3d']).toBe(1)
  })

  it('heartbeat acumula o tempo transcorrido', () => {
    recordVisit()
    now += 60_000
    heartbeat()
    now += 30_000
    heartbeat()
    expect(getUsageStats().totalTimeMs).toBe(90_000)
  })

  it('sessionTimeMs mide dende o inicio da visita', () => {
    recordVisit()
    now += 42_000
    expect(sessionTimeMs()).toBe(42_000)
  })

  it('countryFromTimezone mapea zonas coñecidas e descoñecidas', () => {
    expect(countryFromTimezone('Europe/Madrid')).toBe('Spain')
    expect(countryFromTimezone('America/Mexico_City')).toBe('Mexico')
    expect(countryFromTimezone('America/Argentina/Buenos_Aires')).toBe('Argentina')
    expect(countryFromTimezone('')).toBe('Unknown')
    expect(countryFromTimezone('Mars/Olympus')).toBe('Mars/Olympus')
  })

  it('formatDuration formatea h:mm:ss', () => {
    expect(formatDuration(0)).toBe('0:00')
    expect(formatDuration(65_000)).toBe('1:05')
    expect(formatDuration(3_661_000)).toBe('1:01:01')
  })

  it('resetUsageStats borra os datos', () => {
    recordVisit()
    recordLang('gl')
    resetUsageStats()
    const d = getUsageStats()
    expect(d.visits).toBe(0)
    expect(d.languageChoices.gl).toBe(0)
  })
})
