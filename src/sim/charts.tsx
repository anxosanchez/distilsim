/**
 * Gráficos SVG ligeros (sin dependencias externas).
 * - XYChart: base con ejes y cuadrícula para el diagrama x–y.
 * - McKabeThieleChart: curva de equilibrio + escalonado en vivo.
 * - ProfileChart: perfil por etapa (temperatura o composición).
 * - TimeSeriesChart: series temporales (xD, xB, TD, TB…).
 */

import { useI18n } from '../i18n'
import { useMemo } from 'react'
import { mccabeThiele, type MccabeThieleResult } from '../core/mccabeThiele'
import type { SystemDef } from '../core/components'

/* ------------------------------------------------------------------ */
/* Base                                                                */
/* ------------------------------------------------------------------ */

interface XYChartProps {
  xDomain: [number, number]
  yDomain: [number, number]
  xLabel?: string
  yLabel?: string
  children: React.ReactNode
  height?: number
  gridX?: number
  gridY?: number
  /** Formato de los ticks (fracción) */
  fmt?: (v: number) => string
}

export function XYChart({
  xDomain,
  yDomain,
  xLabel,
  yLabel,
  children,
  height = 300,
  gridX = 0.2,
  gridY = 0.2,
  fmt = (v) => v.toFixed(2),
}: XYChartProps) {
  const W = 600
  const H = height
  const M = { l: 44, r: 12, t: 14, b: 28 }
  const px = (x: number) => M.l + ((x - xDomain[0]) / (xDomain[1] - xDomain[0])) * (W - M.l - M.r)
  const py = (y: number) => M.t + (1 - (y - yDomain[0]) / (yDomain[1] - yDomain[0])) * (H - M.t - M.b)

  const gridLines = []
  for (let gx = Math.ceil(xDomain[0] / gridX) * gridX; gx <= xDomain[1] + 1e-9; gx += gridX) {
    gridLines.push(
      <line key={`gx${gx}`} x1={px(gx)} y1={py(yDomain[0])} x2={px(gx)} y2={py(yDomain[1])} stroke="#232a33" strokeWidth={1} />,
    )
    gridLines.push(
      <text key={`tx${gx}`} x={px(gx)} y={H - 8} textAnchor="middle" fill="#8b949e" fontSize={10}>
        {fmt(gx)}
      </text>,
    )
  }
  for (let gy = Math.ceil(yDomain[0] / gridY) * gridY; gy <= yDomain[1] + 1e-9; gy += gridY) {
    gridLines.push(
      <line key={`gy${gy}`} x1={px(xDomain[0])} y1={py(gy)} x2={px(xDomain[1])} y2={py(gy)} stroke="#232a33" strokeWidth={1} />,
    )
    gridLines.push(
      <text key={`ty${gy}`} x={M.l - 6} y={py(gy) + 3} textAnchor="end" fill="#8b949e" fontSize={10}>
        {fmt(gy)}
      </text>,
    )
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img">
      {gridLines}
      {children}
      {xLabel && (
        <text x={(M.l + W - M.r) / 2} y={H - 4} textAnchor="middle" fill="#8b949e" fontSize={11}>
          {xLabel}
        </text>
      )}
      {yLabel && (
        <text x={14} y={(M.t + H - M.b) / 2} textAnchor="middle" fill="#8b949e" fontSize={11} transform={`rotate(-90 14 ${(M.t + H - M.b) / 2})`}>
          {yLabel}
        </text>
      )}
    </svg>
  )
}

/** Convierte puntos (dominio 0..1) a polilínea SVG con el mapeo de XYChart. */
export function svgPoints(
  pts: Array<{ x: number; y: number }>,
  xDomain: [number, number],
  yDomain: [number, number],
  W = 600,
  H = 300,
  M = { l: 44, r: 12, t: 14, b: 28 },
): string {
  const px = (x: number) => M.l + ((x - xDomain[0]) / (xDomain[1] - xDomain[0])) * (W - M.l - M.r)
  const py = (y: number) => M.t + (1 - (y - yDomain[0]) / (yDomain[1] - yDomain[0])) * (H - M.t - M.b)
  return pts.map((p) => `${px(p.x).toFixed(1)},${py(p.y).toFixed(1)}`).join(' ')
}

/* ------------------------------------------------------------------ */
/* McCabe–Thiele                                                       */
/* ------------------------------------------------------------------ */

interface MTProps {
  system: SystemDef
  P: number
  xD: number
  xB: number
  zF: number
  q: number
  R: number
  /** Multiplicador de altura (proporción de aspecto ajustable) */
  aspect?: number
}

export function McKabeThieleChart({ system, P, xD, xB, zF, q, R, aspect = 1 }: MTProps) {
  const { t } = useI18n()
  const res = useMemo<MccabeThieleResult | null>(() => {
    try {
      return mccabeThiele(system, { zF, xD, xB, q, R, P })
    } catch {
      return null
    }
  }, [system, P, xD, xB, zF, q, R])

  const H = 300 * aspect
  const domain: [number, number] = [0, 1]

  if (!res || !res.feasible) {
    return (
      <div className="chart-note">
        {res?.message ?? t('chart.parametrosInvalidos')} — {t('chart.axusta')}
      </div>
    )
  }

  const curve = res.xEq.map((x, i) => ({ x, y: res.yEq[i] }))
  const qLinePts = [
    { x: res.qLine.x1, y: res.qLine.y1 },
    { x: res.qLine.x2, y: res.qLine.y2 },
  ]
  const enrPts = [
    { x: res.enriching.x1, y: res.enriching.y1 },
    { x: res.enriching.x2, y: res.enriching.y2 },
  ]
  const stripPts = [
    { x: res.stripping.x1, y: res.stripping.y1 },
    { x: res.stripping.x2, y: res.stripping.y2 },
  ]
  const stair = res.staircase

  const diag = [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
  ]

  return (
    <div className="chart-wrap">
      <XYChart xDomain={domain} yDomain={domain} xLabel={t('chart.xLiquido')} yLabel={t('chart.yVapor')} height={H}>
        <polyline points={svgPoints(diag, domain, domain, 600, H)} fill="none" stroke="#6e7681" strokeWidth={1} strokeDasharray="4 3" />
        <polyline points={svgPoints(curve, domain, domain, 600, H)} fill="none" stroke="#3fb950" strokeWidth={2} />
        <polyline points={svgPoints(qLinePts, domain, domain, 600, H)} fill="none" stroke="#bc8cff" strokeWidth={1.2} strokeDasharray="5 4" />
        <polyline points={svgPoints(enrPts, domain, domain, 600, H)} fill="none" stroke="#58a6ff" strokeWidth={1.4} />
        <polyline points={svgPoints(stripPts, domain, domain, 600, H)} fill="none" stroke="#58a6ff" strokeWidth={1.4} />
        <polyline points={svgPoints(stair, domain, domain, 600, H)} fill="none" stroke="#f0883e" strokeWidth={1.6} />
        {res.xAzeotrope !== undefined && (
          <circle cx={pxA(res.xAzeotrope)} cy={pyA(res.xAzeotrope)} r={4} fill="none" stroke="#f85149" strokeWidth={2} />
        )}
        <circle cx={pxA(res.xIntersect)} cy={pyA(res.qLine.y1 === 0 ? res.enriching.y2 : res.enriching.y2)} r={3.5} fill="#e3b341" />
      </XYChart>
      <div className="chart-note" style={{ maxWidth: '60%' }}>
        <div>
          {t('chart.etapas', { n: res.nStages, f: res.feedStage })} ·{' '}
          {t('chart.rmin', { v: res.rMin.toFixed(2), v2: res.nMin.toFixed(1) })}
          {res.xAzeotrope !== undefined && <>{t('chart.azeotropo', { v: res.xAzeotrope.toFixed(3) })}</>}
        </div>
        {res.message && (
          <div style={{ color: 'var(--warn)', marginTop: 2, fontSize: 10 }}>{res.message}</div>
        )}
      </div>
    </div>
  )

  function pxA(x: number): number {
    return 44 + x * (600 - 44 - 12)
  }
  function pyA(y: number): number {
    return 14 + (1 - y) * (H - 14 - 28)
  }
}

/* ------------------------------------------------------------------ */
/* Perfil por etapa                                                    */
/* ------------------------------------------------------------------ */

interface ProfileProps {
  title: string
  /** Valor por etapa (plato 1..N), eje izquierdo */
  values: number[]
  /** Segunda serie por etapa, eje derecho (p. ej. temperatura °C) */
  valuesRight?: number[]
  labels?: string[]
  yLabel?: string
  /** Etiqueta del eje derecho */
  yLabelRight?: string
  color?: string
  /** Color de la segunda serie */
  colorRight?: string
  height?: number
  /** Multiplicador de altura (proporción de aspecto ajustable) */
  aspect?: number
}

export function ProfileChart({
  title,
  values,
  valuesRight,
  labels,
  yLabel,
  yLabelRight,
  color = '#58a6ff',
  colorRight = '#f0883e',
  height = 190,
  aspect = 1,
}: ProfileProps) {
  const { t } = useI18n()
  const n = values.length
  const H = height * aspect
  const W = 600
  const M = { l: 46, r: yLabelRight ? 44 : 12, t: 16, b: 26 }
  const yMin = Math.min(...values)
  const yMax = Math.max(...values)
  const pad = (yMax - yMin) * 0.12 + 1e-9
  const yLo = Math.max(0, yMin - pad)
  const yHi = yMax + pad

  const right = valuesRight && valuesRight.length === n ? valuesRight : null
  let yLoR = 0
  let yHiR = 1
  if (right) {
    const rMin = Math.min(...right)
    const rMax = Math.max(...right)
    const rPad = (rMax - rMin) * 0.12 + 1e-9
    yLoR = rMin - rPad
    yHiR = rMax + rPad
  }

  const px = (i: number) => M.l + (i / Math.max(1, n - 1)) * (W - M.l - M.r)
  const py = (v: number) => M.t + (1 - (v - yLo) / (yHi - yLo + 1e-12)) * (H - M.t - M.b)
  const pyR = (v: number) => M.t + (1 - (v - yLoR) / (yHiR - yLoR + 1e-12)) * (H - M.t - M.b)

  const pts = values.map((v, i) => ({ x: px(i), y: py(v) }))
  const line = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const lineR = right
    ? right.map((v, i) => `${px(i).toFixed(1)},${pyR(v).toFixed(1)}`).join(' ')
    : null

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%' }}>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <line
            key={t}
            x1={M.l}
            y1={M.t + t * (H - M.t - M.b)}
            x2={W - M.r}
            y2={M.t + t * (H - M.t - M.b)}
            stroke="#232a33"
            strokeWidth={1}
          />
        ))}
        {lineR && <polyline points={lineR} fill="none" stroke={colorRight} strokeWidth={1.8} strokeDasharray="5 3" />}
        <polyline points={line} fill="none" stroke={color} strokeWidth={2} />
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={color} />
        ))}
        {labels &&
          labels.map((lb, i) => (
            <text key={lb} x={px(i)} y={H - 8} textAnchor="middle" fill="#8b949e" fontSize={9}>
              {lb}
            </text>
          ))}
        <text x={M.l} y={10} fill="#8b949e" fontSize={10}>
          {title}
        </text>
        {yLabel && (
          <text x={12} y={(M.t + H - M.b) / 2} textAnchor="middle" fill="#8b949e" fontSize={10} transform={`rotate(-90 12 ${(M.t + H - M.b) / 2})`}>
            {yLabel}
          </text>
        )}
        {yLabelRight && right && (
          <text x={W - 5} y={(M.t + H - M.b) / 2} textAnchor="middle" fill="#8b949e" fontSize={10} transform={`rotate(90 ${W - 5} ${(M.t + H - M.b) / 2})`}>
            {yLabelRight}
          </text>
        )}
        {right && (
          <g>
            <line x1={W - M.r - 66} y1={12} x2={W - M.r - 50} y2={12} stroke={colorRight} strokeWidth={2} strokeDasharray="5 3" />
            <text x={W - M.r - 44} y={15} fill="#8b949e" fontSize={10}>
              {t('chart.etapaTemp')}
            </text>
          </g>
        )}
      </svg>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Series temporales                                                   */
/* ------------------------------------------------------------------ */

export interface TimeSeries {
  name: string
  color: string
  points: Array<{ t: number; y: number }>
  /** Eje y: izquierda (por defecto) o derecha (segunda escala, p. ej. °C) */
  axis?: 'left' | 'right'
}

interface TSProps {
  series: TimeSeries[]
  title: string
  height?: number
  yLabel?: string
  /** Etiqueta del eje derecho (segunda escala) */
  yLabelRight?: string
  /** Multiplicador de altura (proporción de aspecto ajustable) */
  aspect?: number
}

export function TimeSeriesChart({ series, title, height = 190, yLabel, yLabelRight, aspect = 1 }: TSProps) {
  const { t } = useI18n()
  const H = height * aspect
  const W = 600
  const M = { l: yLabelRight ? 52 : 46, r: 16, t: 16, b: 26 }

  const all = series.flatMap((s) => s.points)
  if (all.length < 2) {
    return <div className="chart-note">{t('chart.recolectando')}</div>
  }
  const tMin = all[0].t
  const tMax = all[all.length - 1].t
  const leftSeries = series.filter((s) => (s.axis ?? 'left') === 'left')
  const rightSeries = series.filter((s) => s.axis === 'right')

  const range = (ss: TimeSeries[]): [number, number] => {
    if (ss.length === 0) return [0, 1]
    const vals = ss.flatMap((s) => s.points.map((p) => p.y))
    let lo = Math.min(...vals)
    let hi = Math.max(...vals)
    const pad = (hi - lo) * 0.15 + 1e-9
    return [lo - pad, hi + pad]
  }
  const [yLo, yHi] = range(leftSeries)
  const [yLoR, yHiR] = range(rightSeries)

  const px = (t: number) => M.l + ((t - tMin) / (tMax - tMin + 1e-12)) * (W - M.l - M.r)
  const py = (y: number) => M.t + (1 - (y - yLo) / (yHi - yLo + 1e-12)) * (H - M.t - M.b)
  const pyR = (y: number) => M.t + (1 - (y - yLoR) / (yHiR - yLoR + 1e-12)) * (H - M.t - M.b)

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%' }}>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <line key={t} x1={M.l} y1={M.t + t * (H - M.t - M.b)} x2={W - M.r} y2={M.t + t * (H - M.t - M.b)} stroke="#232a33" strokeWidth={1} />
        ))}
        {series.map((s) => {
          const f = (s.axis ?? 'left') === 'left' ? py : pyR
          const line = s.points.map((p) => `${px(p.t).toFixed(1)},${f(p.y).toFixed(1)}`).join(' ')
          return <polyline key={s.name} points={line} fill="none" stroke={s.color} strokeWidth={1.6} />
        })}
        <text x={M.l} y={10} fill="#8b949e" fontSize={10}>
          {title}
        </text>
        {yLabel && (
          <text x={11} y={(M.t + H - M.b) / 2} textAnchor="middle" fill="#8b949e" fontSize={10} transform={`rotate(-90 11 ${(M.t + H - M.b) / 2})`}>
            {yLabel}
          </text>
        )}
        {yLabelRight && rightSeries.length > 0 && (
          <text x={W - 6} y={(M.t + H - M.b) / 2} textAnchor="middle" fill="#8b949e" fontSize={10} transform={`rotate(90 ${W - 6} ${(M.t + H - M.b) / 2})`}>
            {yLabelRight}
          </text>
        )}
        {series.map((s, i) => (
          <g key={s.name}>
            <line x1={W - M.r - 86} y1={12 + i * 12} x2={W - M.r - 68} y2={12 + i * 12} stroke={s.color} strokeWidth={2} />
            <text x={W - M.r - 64} y={15 + i * 12} fill="#8b949e" fontSize={10}>
              {s.name}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}
