/**
 * Base de datos de componentes y parámetros de interacción binaria.
 *
 * Antoine: log10 P[mmHg] = A − B/(T[°C] + C)  (fuentes: NIST / Perry / DECHEMA)
 * Cp líquido y calor latente: valores aproximados a 25 °C–ebullición, suficientes
 * para un modelo didáctico (balances de energía simplificados).
 *
 * Los parámetros de actividad (Wilson/NRTL) están en unidades coherentes:
 *   Wilson: Λ_ij adimensionales (se usan directamente).
 *   NRTL:   Δg_ij en J/mol y α_ij adimensional.
 */

import type { AntoineParams } from './antoine'

export interface ComponentDef {
  id: string
  name: string
  formula: string
  /** Masa molar, g/mol */
  molarMass: number
  /** Calor latente de vaporización medio, kJ/mol */
  latentHeat: number
  /** Capacidad calorífica del líquido, J/mol·K (aprox. constante) */
  cpLiquid: number
  antoine: AntoineParams
  /** Temperatura normal de ebullición (°C) — se calcula y cachea */
  tboil?: number
}

export type ActivityModelName = 'ideal' | 'wilson' | 'nrtl'

export interface WilsonPairParams {
  model: 'wilson'
  /** Λ_12, Λ_21 adimensionales */
  lambda12: number
  lambda21: number
  /** Volúmenes molares líquidos (cm³/mol) — se usan para Λ si no se dan */
  v1?: number
  v2?: number
}

export interface NrtlPairParams {
  model: 'nrtl'
  /** Δg_12 = g12 − g22, Δg_21 = g21 − g11, en J/mol */
  dg12: number
  dg21: number
  /** Parámetro de no-aleatoriedad (0.2–0.47) */
  alpha: number
}

export type BinaryActivityParams = WilsonPairParams | NrtlPairParams

export interface SystemDef {
  /** Componentes en orden (índice 0 = más volátil para sistemas binarios ideales) */
  components: ComponentDef[]
  /** Parámetros de actividad por par (id1, id2), orden simétrico */
  activity?: Record<string, BinaryActivityParams>
  /** Presión de operación por defecto, mmHg */
  defaultPressure: number
  /** Etiqueta corta para la UI */
  label: string
}

/* ------------------------------------------------------------------ */
/* Componentes                                                         */
/* ------------------------------------------------------------------ */

export const benceno: ComponentDef = {
  id: 'benceno',
  name: 'Benceno',
  formula: 'C₆H₆',
  molarMass: 78.11,
  latentHeat: 30.7,
  cpLiquid: 136,
  antoine: { A: 6.90565, B: 1211.033, C: 220.79 },
}

export const tolueno: ComponentDef = {
  id: 'tolueno',
  name: 'Tolueno',
  formula: 'C₇H₈',
  molarMass: 92.14,
  latentHeat: 33.2,
  cpLiquid: 157,
  antoine: { A: 6.95464, B: 1344.8, C: 219.482 },
}

export const etanol: ComponentDef = {
  id: 'etanol',
  name: 'Etanol',
  formula: 'C₂H₅OH',
  molarMass: 46.07,
  latentHeat: 38.6,
  cpLiquid: 112,
  antoine: { A: 8.20417, B: 1642.89, C: 230.3 },
}

export const agua: ComponentDef = {
  id: 'agua',
  name: 'Auga',
  formula: 'H₂O',
  molarMass: 18.02,
  latentHeat: 40.7,
  cpLiquid: 75.3,
  antoine: { A: 8.07131, B: 1730.63, C: 233.426 },
}

export const metanol: ComponentDef = {
  id: 'metanol',
  name: 'Metanol',
  formula: 'CH₃OH',
  molarMass: 32.04,
  latentHeat: 35.2,
  cpLiquid: 79.5,
  antoine: { A: 8.08097, B: 1582.271, C: 239.726 },
}

export const acetona: ComponentDef = {
  id: 'acetona',
  name: 'Acetona',
  formula: 'C₃H₆O',
  molarMass: 58.08,
  latentHeat: 29.1,
  cpLiquid: 126,
  antoine: { A: 7.11714, B: 1210.595, C: 229.664 },
}

export const cloroformo: ComponentDef = {
  id: 'cloroformo',
  name: 'Cloroformo',
  formula: 'CHCl₃',
  molarMass: 119.38,
  latentHeat: 29.7,
  cpLiquid: 114,
  antoine: { A: 6.95465, B: 1170.966, C: 226.232 },
}

export const isopropanol: ComponentDef = {
  id: 'isopropanol',
  name: 'Isopropanol',
  formula: 'C₃H₈O',
  molarMass: 60.1,
  latentHeat: 39.9,
  cpLiquid: 156,
  antoine: { A: 8.11778, B: 1580.92, C: 219.61 },
}

export const etilbenceno: ComponentDef = {
  id: 'etilbenceno',
  name: 'Etilbenceno',
  formula: 'C₈H₁₀',
  molarMass: 106.17,
  latentHeat: 35.6,
  cpLiquid: 186,
  antoine: { A: 6.95719, B: 1424.255, C: 213.206 },
}

export const estireno: ComponentDef = {
  id: 'estireno',
  name: 'Estireno',
  formula: 'C₈H₈',
  molarMass: 104.15,
  latentHeat: 33.8,
  cpLiquid: 182,
  antoine: { A: 6.92409, B: 1420.0, C: 206.0 },
}

export const ALL_COMPONENTS: Record<string, ComponentDef> = {
  benceno,
  tolueno,
  etanol,
  agua,
  metanol,
  acetona,
  cloroformo,
  isopropanol,
  etilbenceno,
  estireno,
}

/* ------------------------------------------------------------------ */
/* Sistemas predefinidos                                               */
/* ------------------------------------------------------------------ */

/**
 * Benceno–tolueno: sistema ideal (Raoult válido), α ≈ 2.5 a 1 atm.
 * Clásico para McCabe–Thiele.
 */
export const sistemaBencenoTolueno: SystemDef = {
  label: 'Benceno–Tolueno (ideal)',
  components: [benceno, tolueno],
  defaultPressure: 760,
}

/**
 * Etanol–agua: fuertemente no ideal, azeótropo de mínimo a ebullición
 * (x_EtOH ≈ 0.895, T ≈ 78.2 °C a 1 atm). Wilson, parámetros DECHEMA.
 */
export const sistemaEtanolAgua: SystemDef = {
  label: 'Etanol–Auga (non ideal, azeótropo)',
  components: [etanol, agua],
  defaultPressure: 760,
  activity: {
    'etanol|agua': {
      model: 'wilson',
      lambda12: 0.12492,
      lambda21: 0.87433,
      v1: 58.68,
      v2: 18.07,
    },
  },
}

/**
 * Metanol–agua: moderadamente no ideal, sin azeótropo.
 * Útil para mostrar el efecto de γ sin el problema del azeótropo.
 */
export const sistemaMetanolAgua: SystemDef = {
  label: 'Metanol–Auga (non ideal, sen azeótropo)',
  components: [metanol, agua],
  defaultPressure: 760,
  activity: {
    'metanol|agua': {
      model: 'wilson',
      lambda12: 0.29561,
      lambda21: 0.60477,
      v1: 40.73,
      v2: 18.07,
    },
  },
}

/**
 * Acetona–cloroformo: desviación negativa, azeótropo de máximo a ebullición
 * (x_acetona ≈ 0.34, T ≈ 64.5 °C a 1 atm). NRTL ajustado para reproducir
 * el azeótropo (τ12 ≈ 1.35, τ21 ≈ −1.15 a 64.5 °C, α = 0.47).
 */
export const sistemaAcetonaCloroformo: SystemDef = {
  label: 'Acetona–Cloroformo (non ideal, azeótropo máximo)',
  components: [acetona, cloroformo],
  defaultPressure: 760,
  activity: {
    'acetona|cloroformo': {
      model: 'nrtl',
      dg12: 906 * 4.184, // cal/mol → J/mol
      dg21: -772 * 4.184,
      alpha: 0.47,
    },
  },
}

/**
 * Benceno–tolueno–etilbenceno: sistema ternario ideal (sin azeótropos).
 * Clásico del diseño de columnas multicomponente (p. ej. fraccionamiento BTX).
 * Puntos de ebullición: benceno 80.1, tolueno 110.6, etilbenceno 136.2 °C.
 */
export const sistemaBencenoToluenoEtilbenceno: SystemDef = {
  label: 'Benceno–Tolueno–Etilbenceno (ternario ideal)',
  components: [benceno, tolueno, etilbenceno],
  defaultPressure: 760,
}

/**
 * Benceno–tolueno–etilbenceno–estireno: sistema CUATERNARIO ideal.
 * Ruta industrial BTXS (benceno, tolueno, etilbenceno, estireno — el
 * etilbenceno se deshidrogena a estireno para poliestireno). Puntos de
 * ebullición: 80.1 / 110.6 / 136.2 / 145.2 °C.
 */
export const sistemaBencenoToluenoEtilbencenoEstireno: SystemDef = {
  label: 'Benceno–Tolueno–Etilbenceno–Estireno (cuaternario ideal)',
  components: [benceno, tolueno, etilbenceno, estireno],
  defaultPressure: 760,
}

export const ALL_SYSTEMS: Record<string, SystemDef> = {
  bencenoTolueno: sistemaBencenoTolueno,
  etanolAgua: sistemaEtanolAgua,
  metanolAgua: sistemaMetanolAgua,
  acetonaCloroformo: sistemaAcetonaCloroformo,
  bencenoToluenoEtilbenceno: sistemaBencenoToluenoEtilbenceno,
  bencenoToluenoEtilbencenoEstireno: sistemaBencenoToluenoEtilbencenoEstireno,
}

/** Devuelve el parámetro de actividad para el par (i, j), en cualquier orden. */
const pairCache = new WeakMap<SystemDef, Map<string, BinaryActivityParams | undefined>>()

export function getBinaryActivityParams(
  system: SystemDef,
  i: number,
  j: number,
): BinaryActivityParams | undefined {
  if (!system.activity) return undefined
  let cache = pairCache.get(system)
  if (!cache) {
    cache = new Map()
    pairCache.set(system, cache)
  }
  const a = system.components[i]
  const b = system.components[j]
  // Clave de caché con orden canónico; las claves de system.activity usan el
  // orden de inserción, así que se prueban ambos órdenes en la fuente.
  const cacheKey = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`
  if (!cache.has(cacheKey)) {
    const hit = system.activity[`${a.id}|${b.id}`] ?? system.activity[`${b.id}|${a.id}`]
    cache.set(cacheKey, hit)
  }
  return cache.get(cacheKey)
}

/** Componentes por id (helper; el punto de ebullición se calcula en thermo.ts). */
export function resolveComponents(ids: string[]): ComponentDef[] {
  return ids.map((id) => {
    const c = ALL_COMPONENTS[id]
    if (!c) throw new Error(`Componente desconocido: ${id}`)
    return c
  })
}

export { psatMMHg } from './antoine'
