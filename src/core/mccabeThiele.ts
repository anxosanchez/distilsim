/**
 * Método de McCabe–Thiele numérico.
 *
 * A diferencia del método gráfico clásico (que requiere α constante), aquí la
 * curva de equilibrio se genera numéricamente con el modelo termodinámico
 * (thermo.equilibriumCurveBinary). Esto permite:
 *   - sistemas ideales (benceno–tolueno): idéntico al método clásico;
 *   - sistemas no ideales (etanol–agua): la curva corta la diagonal en el
 *     azeótropo y el escalonado muestra el "pellizco" (imposibilidad de cruzar);
 *   - detección de inviabilidad si x_D supera la composición azeotrópica.
 */

import type { SystemDef } from './components'
import { tGlobal } from '../i18n'
import { equilibriumCurveBinary } from './thermo'

export interface Line2D {
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface MccabeThieleOptions {
  /** Composición del alimento (fracción molar del componente más volátil) */
  zF: number
  /** Composición del destilado */
  xD: number
  /** Composición de fondos */
  xB: number
  /** Estado térmico del alimento (q) */
  q: number
  /** Relación de reflujo de operación R = L0/D */
  R: number
  /** Presión, mmHg */
  P: number
}

export interface MccabeThieleResult {
  /** Curva de equilibrio (x → y) */
  xEq: number[]
  yEq: number[]
  /** Línea q (segmento para dibujar) */
  qLine: Line2D
  /** Línea de operación de enriquecimiento */
  enriching: Line2D
  /** Línea de operación de agotamiento */
  stripping: Line2D
  /** Puntos de la polilínea del escalonado (para dibujar) */
  staircase: Array<{ x: number; y: number }>
  /** Etapas teóricas (incluye el rehervidor) */
  nStages: number
  /** Etapa de alimentación óptima (1 = tope) */
  feedStage: number
  /** Reflujo mínimo estimado */
  rMin: number
  /** Etapas mínimas a reflujo total (Fenske) */
  nMin: number
  /** Volatilidad relativa media usada en Fenske */
  alphaAvg: number
  /** ¿Es alcanzable la separación pedida? */
  feasible: boolean
  /** Mensaje explicativo (p. ej. inviabilidad por azeótropo) */
  message?: string
  /** Coordenada x de intersección de la línea q con la de operación */
  xIntersect: number
  /** Composición azeotrópica detectada (si existe en la curva) */
  xAzeotrope?: number
}

export function mccabeThiele(
  system: SystemDef,
  opts: MccabeThieleOptions,
): MccabeThieleResult {
  const { zF, xD, xB, q, R, P } = opts
  const fail = (message: string): MccabeThieleResult => ({
    xEq: [], yEq: [], qLine: { x1: 0, y1: 0, x2: 1, y2: 1 },
    enriching: { x1: 0, y1: 0, x2: 1, y2: 1 },
    stripping: { x1: 0, y1: 0, x2: 1, y2: 1 },
    staircase: [], nStages: 0, feedStage: 0, rMin: 0, nMin: 0,
    alphaAvg: 0, feasible: false, message, xIntersect: 0, xAzeotrope: undefined,
  })
  if (!(xD > xB)) return fail(tGlobal('mt.xDmaior'))
  if (!(zF > xB && zF < xD)) return fail(tGlobal('mt.zFentre'))
  if (!(R >= 0)) return fail(tGlobal('mt.RmaiorIgual'))

  const { x: xEq, y: yEq } = equilibriumCurveBinary(system, P, 401)

  // Detectar cruce con la diagonal (azeótropo de mínimo): primer x con y <= x
  let xAz: number | undefined
  for (let i = 1; i < xEq.length; i++) {
    if (yEq[i] <= xEq[i] + 1e-9 && yEq[i - 1] > xEq[i - 1]) {
      xAz = xEq[i]
      break
    }
  }
  // También puede haber cruce de máximo (y >= x por encima): irrelevante para
  // la viabilidad del destilado rico en el componente más volátil.

  if (xAz !== undefined && xD > xAz) {
    return fail(
      tGlobal('mt.azeotropo1', { xd: xD.toFixed(3), xaz: xAz.toFixed(3) }) +
        tGlobal('mt.azeotropo2'),
    )
  }

  // Interpolación directa: y tal que y_eq(x)
  const yEqAt = (x: number): number => {
    if (x <= xEq[0]) return yEq[0]
    if (x >= xEq[xEq.length - 1]) return yEq[xEq.length - 1]
    let lo = 0
    let hi = xEq.length - 1
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (xEq[mid] <= x) lo = mid
      else hi = mid
    }
    const t = (x - xEq[lo]) / (xEq[hi] - xEq[lo] + 1e-300)
    return yEq[lo] + t * (yEq[hi] - yEq[lo])
  }

  // Interpolación inversa: x tal que y_eq(x) = y (curva monótona creciente)
  const invEq = (y: number): number => {
    if (y <= yEq[0]) return xEq[0]
    if (y >= yEq[yEq.length - 1]) return xEq[xEq.length - 1]
    let lo = 0
    let hi = yEq.length - 1
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (yEq[mid] <= y) lo = mid
      else hi = mid
    }
    const t = (y - yEq[lo]) / (yEq[hi] - yEq[lo] + 1e-300)
    return xEq[lo] + t * (xEq[hi] - xEq[lo])
  }

  // Reflujo mínimo por el punto de pellizco: intersección de la línea q con la
  // curva de equilibrio. Para q=1 el pellizco está en x = zF.
  interface Pt { x: number; y: number }
  let pinch: Pt | undefined
  if (Math.abs(q - 1) < 1e-9) {
    pinch = { x: zF, y: yEqAt(zF) }
  } else if (Math.abs(q) < 1e-9) {
    pinch = { x: invEq(zF), y: zF }
  } else {
    const yQ = (x: number) => (q / (q - 1)) * x - zF / (q - 1)
    let best: Pt | undefined
    let bestDist = Infinity
    for (let i = 1; i < xEq.length; i++) {
      const g0 = yEq[i - 1] - yQ(xEq[i - 1])
      const g1 = yEq[i] - yQ(xEq[i])
      if (g0 * g1 < 0) {
        const t = g0 / (g0 - g1 + 1e-300)
        const xp = xEq[i - 1] + t * (xEq[i] - xEq[i - 1])
        if (xp > xB && xp < xD) {
          const d = Math.abs(xp - zF)
          if (d < bestDist) {
            bestDist = d
            best = { x: xp, y: yQ(xp) }
          }
        }
      }
    }
    pinch = best
  }

  let rMin = 0
  if (pinch && pinch.x < xD - 1e-6 && pinch.y > pinch.x) {
    rMin = (xD - pinch.y) / (pinch.y - pinch.x)
  }
  if (rMin <= 0) {
    // Respaldo: barrido de pendientes restringido a x ≥ pellizco
    const xLo = pinch ? pinch.x : Math.max(0.05, zF - 0.2)
    for (let i = 1; i < xEq.length - 1; i++) {
      const x = xEq[i]
      if (x < xLo || x >= xD - 1e-6) continue
      const y = yEq[i]
      const m = (y - xD) / (x - xD)
      if (m > 0 && m < 1) rMin = Math.max(rMin, m / (1 - m))
    }
  }
  if (rMin <= 0) return fail(tGlobal('mt.nonEstimou'))

  // Líneas de operación
  const mE = R / (R + 1)
  const bE = xD / (R + 1)
  const enrichY = (x: number) => mE * x + bE

  // Línea q: y = q/(q−1)·x − zF/(q−1)
  const qLine: Line2D =
    Math.abs(q - 1) < 1e-9
      ? { x1: zF, y1: 0, x2: zF, y2: 1 } // vertical
      : (() => {
          const mq = q / (q - 1)
          const bq = -zF / (q - 1)
          return { x1: 0, y1: bq, x2: 1, y2: mq + bq }
        })()

  // Intersección enriquecimiento ↔ línea q
  let xInt: number
  let yInt: number
  if (Math.abs(q - 1) < 1e-9) {
    xInt = zF
    yInt = enrichY(zF)
  } else {
    const mq = q / (q - 1)
    const bq = -zF / (q - 1)
    xInt = (bq - bE) / (mE - mq)
    yInt = mE * xInt + bE
  }
  // Línea de agotamiento: pasa por (xB, xB) y (xInt, yInt)
  const mS = (yInt - xB) / (xInt - xB + 1e-300)
  const bS = xB - mS * xB
  const stripY = (x: number) => mS * x + bS

  const enriching: Line2D = { x1: xD, y1: xD, x2: xInt, y2: yInt }
  const stripping: Line2D = { x1: xB, y1: xB, x2: xInt, y2: yInt }

  // Escalonado
  const staircase: Array<{ x: number; y: number }> = [{ x: xD, y: xD }]
  let xCur = xD
  let yCur = xD
  let nStages = 0
  let feedStage = 0
  let crossedFeed = false
  let stalled = false
  let prevXNew = Infinity
  for (let guard = 0; guard < 500; guard++) {
    // Paso horizontal → equilibrio (una etapa)
    const xNew = invEq(yCur)
    // Sin progreso (p. ej. R = 0: línea de enriquecimiento horizontal → no hay
    // rectificación y el escalonado no avanza). Evita el bucle degenerado.
    if (xNew >= prevXNew - 1e-12) {
      stalled = true
      break
    }
    prevXNew = xNew
    staircase.push({ x: xNew, y: yCur })
    nStages++
    if (!crossedFeed && xNew <= xInt) {
      crossedFeed = true
      feedStage = nStages
    }
    if (xNew <= xB) break
    // Paso vertical → línea de operación activa
    const active = xCur > xInt ? enrichY : stripY
    yCur = active(xNew)
    staircase.push({ x: xNew, y: yCur })
    xCur = xNew
    if (yCur < xB) break
  }
  if (feedStage === 0) feedStage = nStages

  // Fenske con α medio (media geométrica de α(x) sobre la curva)
  let sumLogAlpha = 0
  let count = 0
  for (let i = 1; i < xEq.length; i += 10) {
    const x = xEq[i]
    const y = yEq[i]
    if (x > 0 && x < 1 && y > 0 && y < 1) {
      const a = (y / x) / ((1 - y) / (1 - x))
      if (a > 1) {
        sumLogAlpha += Math.log(a)
        count++
      }
    }
  }
  const alphaAvg = Math.exp(sumLogAlpha / Math.max(1, count))
  const nMin =
    Math.log((xD / (1 - xD)) * ((1 - xB) / xB)) / Math.log(Math.max(1.001, alphaAvg))

  const message = stalled ? tGlobal('mt.senRefluxo') : undefined

  return {
    xEq, yEq, qLine, enriching, stripping, staircase,
    nStages, feedStage, rMin, nMin, alphaAvg,
    feasible: true, xIntersect: xInt, xAzeotrope: xAz, message,
  }
}
