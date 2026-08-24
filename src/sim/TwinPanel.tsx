/**
 * Panel Gemelo Digital: la "planta" (proceso físico simulado con ruido de
 * medición) corre en paralelo con el "modelo" (réplica nominal). El alumno
 * aplica perturbaciones, ajusta el ruido y compara mediciones vs predicciones.
 */

import { useEffect, useRef, useState } from 'react'
import { DigitalTwin, type TwinSnapshot } from '../core/twin'
import { DynamicColumn, type ColumnInputs, type CondenserMode } from '../core/columnDynamic'
import { ALL_SYSTEMS } from '../core/components'
import { sessionLog } from '../core/session'
import { TimeSeriesChart } from './charts'
import { useI18n } from '../i18n'

interface TwinRunner {
  twin: DigitalTwin
  plant: DynamicColumn
  model: DynamicColumn
  history: TwinSnapshot[]
  running: boolean
  speed: number
  noise: { T: number; x: number; flow: number; level: number }
  systemKey: string
  mode: CondenserMode
  nTrays: number
  feedStage: number
  /** Parámetros de identificación del modelo (el alumno los ajusta) */
  identification: boolean
  modelVR: number
  trayFactor: number
  reboilerFactor: number
  /** Tiempo de simulación actual (h), para el registro de sesión */
  simTime: number
}

function buildColumn(systemKey: string, mode: CondenserMode, nTrays: number, feedStage: number): DynamicColumn {
  const sys = ALL_SYSTEMS[systemKey]
  const nc = sys.components.length
  const trays: number[][] = []
  for (let j = 0; j < nTrays; j++) {
    const x0 = 0.95 - (0.9 * j) / Math.max(1, nTrays - 1)
    const row = new Array<number>(nc).fill((1 - x0) / (nc - 1))
    row[0] = x0
    trays.push(row)
  }
  const bottoms = new Array<number>(nc).fill(0.95 / (nc - 1))
  bottoms[0] = 0.05
  return new DynamicColumn({
    system: sys,
    nTrays,
    feedStage,
    P: sys.defaultPressure,
    mode,
    trayHoldup: 0.5,
    reboilerHoldup: 10,
    condenserHoldup: 2,
    x0: { trays, bottoms },
    integrator: 'rk4',
  })
}

function makeRunner(systemKey: string, mode: CondenserMode, nTrays: number, feedStage: number): TwinRunner {
  const plant = buildColumn(systemKey, mode, nTrays, feedStage)
  const model = buildColumn(systemKey, mode, nTrays, feedStage)
  const defaults: Record<string, ColumnInputs> = {
    bencenoTolueno: { F: 100, zF: [0.5, 0.5], q: 1, R: 1.65, V_R: 132.5 },
    etanolAgua: { F: 100, zF: [0.3, 0.7], q: 1, R: 2.2, V_R: 160 },
    metanolAgua: { F: 100, zF: [0.4, 0.6], q: 1, R: 2, V_R: 150 },
    acetonaCloroformo: { F: 100, zF: [0.5, 0.5], q: 1, R: 2, V_R: 130 },
  }
  const inp = defaults[systemKey] ?? defaults.bencenoTolueno
  plant.setInputs(inp)
  model.setInputs(inp)
  const twin = new DigitalTwin({ plant, model, noise: { T: 0.3, x: 0.002, flow: 0.5, level: 0.1 }, seed: 12345 })
  return {
    twin, plant, model, history: [], running: true, speed: 60,
    noise: { T: 0.3, x: 0.002, flow: 0.5, level: 0.1 },
    systemKey, mode, nTrays, feedStage,
    identification: false,
    modelVR: inp.V_R,
    trayFactor: 1,
    reboilerFactor: 1,
    simTime: 0,
  }
}

export function TwinPanel() {
  const { t } = useI18n()
  const runnerRef = useRef<TwinRunner | null>(null)
  if (!runnerRef.current) runnerRef.current = makeRunner('bencenoTolueno', 'total', 12, 5)
  const runner = runnerRef.current

  const [snap, setSnap] = useState<TwinSnapshot | null>(runner.history[runner.history.length - 1] ?? null)
  const [, force] = useState(0)
  const dtTick = 0.0005 // paso estable de RK4 (modo acoplado más rápido ~3 s)

  useEffect(() => {
    let raf = 0
    const loop = () => {
      const r = runner
      if (r.running) {
        // Aplicar parámetros de identificación del modelo (si procede)
        if (r.identification) {
          r.twin.setIdentificationMode(true)
          r.model.setInputs({ V_R: r.modelVR })
          r.model.setHoldupFactors({ tray: r.trayFactor, reboiler: r.reboilerFactor })
        } else {
          r.twin.setIdentificationMode(false)
        }
        const steps = Math.max(1, Math.round(r.speed))
        let last: TwinSnapshot | null = null
        for (let i = 0; i < steps; i++) last = r.twin.step(dtTick)
        if (last) {
          r.history.push(last)
          if (r.history.length > 500) r.history.splice(0, r.history.length - 500)
          r.simTime = last.time
          setSnap(last)
        }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [runner])

  const rebuild = () => {
    runnerRef.current = makeRunner(runner.systemKey, runner.mode, runner.nTrays, runner.feedStage)
    setSnap(null)
    force((f) => f + 1)
  }

  const setNoise = (patch: Partial<TwinRunner['noise']>) => {
    runner.noise = { ...runner.noise, ...patch }
    runner.twin.setNoise(patch)
    force((f) => f + 1)
  }

  const hist = runner.history
  const mk = (get: (s: TwinSnapshot) => number) => hist.map((h) => ({ t: h.time, y: get(h) }))

  const measuredXD = mk((s) => s.measured.xD[0])
  const predictedXD = mk((s) => s.predicted.xD[0])
  const measuredXB = mk((s) => s.measured.xB[0])
  const predictedXB = mk((s) => s.predicted.xB[0])
  const measuredTD = mk((s) => s.measured.TD)
  const predictedTD = mk((s) => s.predicted.TD)

  const last = snap
  const residXD = last ? (last.measured.xD[0] - last.predicted.xD[0]) : 0
  const residTD = last ? (last.measured.TD - last.predicted.TD) : 0

  // RMSE sobre la ventana de historia (métrica de ajuste del modelo)
  const rmse = (get: (s: TwinSnapshot) => number): number => {
    if (hist.length < 5) return 0
    let s = 0
    const n = Math.min(hist.length, 300)
    for (let i = hist.length - n; i < hist.length; i++) {
      const d = get(hist[i])
      s += d * d
    }
    return Math.sqrt(s / n)
  }
  const rmseXD = rmse((h) => h.measured.xD[0] - h.predicted.xD[0])
  const rmseXB = rmse((h) => h.measured.xB[0] - h.predicted.xB[0])
  const rmseTB = rmse((h) => h.measured.TB - h.predicted.TB)

  return (
    <div className="twin-grid">
      <div className="col-left">
        <div className="panel">
          <h3>{t('twin.configuracion')}</h3>
          <div className="ctrl">
            <label>{t('twin.mezcla')}</label>
            <select
              value={runner.systemKey}
              onChange={(e) => {
                runner.systemKey = e.target.value
                rebuild()
              }}
            >
              {Object.entries(ALL_SYSTEMS).map(([k, s]) => (
                <option key={k} value={k}>{s.label}</option>
              ))}
            </select>
          </div>
          <div className="ctrl">
            <label>
              {t('twin.pratos')} <b>{runner.nTrays}</b>
            </label>
            <input
              type="range"
              min={4}
              max={30}
              value={runner.nTrays}
              onChange={(e) => {
                const nTrays = Number(e.target.value)
                runner.nTrays = nTrays
                runner.feedStage = Math.min(runner.feedStage, Math.max(2, nTrays - 1))
                rebuild()
              }}
            />
          </div>
          <div className="ctrl">
            <label>
              {t('twin.pratoAlimentacion')} <b>{runner.feedStage}</b>
            </label>
            <input
              type="range"
              min={2}
              max={Math.max(2, runner.nTrays - 1)}
              value={runner.feedStage}
              onChange={(e) => { runner.feedStage = Number(e.target.value); rebuild() }}
            />
          </div>
          <div className="ctrl">
            <label>{t('twin.ruido')}</label>
            <label style={{ marginTop: 6 }}>
              {t('twin.temperatura')} <b>{t('twin.desvT', { v: runner.noise.T.toFixed(1) })}</b>
            </label>
            <input type="range" min={0} max={1.5} step={0.05} value={runner.noise.T} onChange={(e) => setNoise({ T: Number(e.target.value) })} />
            <label>
              {t('twin.composicion')} <b>{t('twin.desvX', { v: runner.noise.x.toFixed(3) })}</b>
            </label>
            <input type="range" min={0} max={0.01} step={0.0005} value={runner.noise.x} onChange={(e) => setNoise({ x: Number(e.target.value) })} />
            <label>
              {t('twin.cabal')} <b>{t('twin.desvFlow', { v: runner.noise.flow.toFixed(1) })}</b>
            </label>
            <input type="range" min={0} max={3} step={0.1} value={runner.noise.flow} onChange={(e) => setNoise({ flow: Number(e.target.value) })} />
          </div>
          <div className="row">
            <button className="btn primary" onClick={() => { runner.running = !runner.running; force((f) => f + 1) }}>
              {runner.running ? t('twin.pausa') : t('twin.reanudar')}
            </button>
            <button className="btn" onClick={rebuild}>{t('twin.reiniciar')}</button>
          </div>
          <div className="ctrl" style={{ marginTop: 10 }}>
            <label>
              {t('twin.velocidad')} <b>{runner.speed}×</b>
            </label>
            <div className="row">
              {[10, 60, 300].map((s) => (
                <button key={s} className={`btn ${runner.speed === s ? 'active' : ''}`} onClick={() => { runner.speed = s; force((f) => f + 1) }}>
                  {s}×
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="panel">
          <h3>{t('twin.perturbaciones')}</h3>
          <div className="row">
            <button
              className="btn warn"
              onClick={() => {
                runner.twin.applyDisturbance('lossReboilerHeat', 5)
                sessionLog.log('disturbance', t('eng.perdaCalefaccionCorto'), {}, runner.simTime)
              }}
            >
              {t('twin.perdaVapor')}
            </button>
            <button
              className="btn warn"
              onClick={() => {
                runner.twin.applyDisturbance('feedCompositionStep', 5)
                sessionLog.log('disturbance', t('eng.cambioAlimentoCorto'), {}, runner.simTime)
              }}
            >
              {t('twin.cambioComposicion')}
            </button>
            <button
              className="btn warn"
              onClick={() => {
                runner.twin.applyDisturbance('feedFlowStep', 5)
                sessionLog.log('disturbance', t('eng.alimentacion30'), {}, runner.simTime)
              }}
            >
              {t('twin.alimentacion30')}
            </button>
          </div>
          {snap && snap.disturbance !== 'none' && (
            <p style={{ margin: '10px 0 0' }}>
              <span className="badge warn">{t('twin.perturbacionActiva', { name: snap.disturbance, h: snap.disturbanceRemaining.toFixed(1) })}</span>
            </p>
          )}
          {snap && snap.disturbance === 'none' && (
            <p style={{ margin: '10px 0 0' }}>
              <span className="badge ok">{t('twin.plantaNormal')}</span>
            </p>
          )}
        </div>

        {/* Identificación de modelo */}
        <div className="panel">
          <h3>{t('twin.identificacion')}</h3>
          <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '0 0 10px' }}>
            {t('twin.identDesc1')} {t('twin.identDesc2')}
          </p>
          <div className="row" style={{ marginBottom: 10 }}>
            <button
              className={`btn ${runner.identification ? 'primary' : ''}`}
              onClick={() => {
                runner.identification = !runner.identification
                runner.twin.setIdentificationMode(runner.identification)
                sessionLog.log('identify', t('eng.modoIdentificacion', { estado: runner.identification ? t('eng.activado') : t('eng.desactivado') }), {}, runner.simTime)
                force((f) => f + 1)
              }}
            >
              {runner.identification ? t('twin.identActiva') : t('twin.identOff')}
            </button>
            <button
              className="btn"
              onClick={() => {
                runner.twin.syncPlantToModel()
                runner.modelVR = runner.model.getInputs().V_R
                sessionLog.log('identify', t('eng.modeloSincronizado'), {}, runner.simTime)
                force((f) => f + 1)
              }}
            >
              {t('twin.sincronizar')}
            </button>
          </div>
          <div className="ctrl">
            <label>
              {t('twin.vrModelo')} <b>{runner.modelVR.toFixed(1)} kmol/h</b>
            </label>
            <input
              type="range"
              min={40}
              max={300}
              value={runner.modelVR}
              onChange={(e) => {
                runner.modelVR = Number(e.target.value)
                force((f) => f + 1)
              }}
            />
          </div>
          <div className="ctrl">
            <label>
              {t('twin.holdupPrato')} <b>{runner.trayFactor.toFixed(2)}</b>
            </label>
            <input
              type="range"
              min={0.2}
              max={3}
              step={0.05}
              value={runner.trayFactor}
              onChange={(e) => {
                runner.trayFactor = Number(e.target.value)
                force((f) => f + 1)
              }}
            />
          </div>
          <div className="ctrl">
            <label>
              {t('twin.holdupRefervedor')} <b>{runner.reboilerFactor.toFixed(2)}</b>
            </label>
            <input
              type="range"
              min={0.2}
              max={3}
              step={0.05}
              value={runner.reboilerFactor}
              onChange={(e) => {
                runner.reboilerFactor = Number(e.target.value)
                force((f) => f + 1)
              }}
            />
          </div>
          {runner.identification && (
            <p style={{ fontSize: 12, color: 'var(--warn)', margin: 0 }}>
              {t('twin.consello1')} {t('twin.consello2')} {t('twin.consello3')}
            </p>
          )}
        </div>

        <div className="panel">
          <h3>{t('twin.diagnostico')}</h3>
          {last ? (
            <div className="instruments">
              <div className="instrument">
                <div className="k">{t('twin.xDmedido')}</div>
                <div className="v">{last.measured.xD[0].toFixed(4)}</div>
              </div>
              <div className="instrument">
                <div className="k">{t('twin.xDpredito')}</div>
                <div className="v">{last.predicted.xD[0].toFixed(4)}</div>
              </div>
              <div className="instrument">
                <div className="k">{t('twin.residuoXD')}</div>
                <div className={`v ${Math.abs(residXD) > 3 * 0.002 ? 'bad' : 'good'}`}>
                  {residXD >= 0 ? '+' : ''}{residXD.toFixed(4)}
                </div>
              </div>
              <div className="instrument">
                <div className="k">{t('twin.residuoTCabeza')}</div>
                <div className={`v ${Math.abs(residTD) > 3 * 0.3 ? 'bad' : 'good'}`}>
                  {residTD >= 0 ? '+' : ''}{residTD.toFixed(2)} °C
                </div>
              </div>
              <div className="instrument">
                <div className="k">{t('twin.residuoXB')}</div>
                <div className={`v ${Math.abs(last.measured.xB[0] - last.predicted.xB[0]) > 3 * 0.002 ? 'bad' : 'good'}`}>
                  {(last.measured.xB[0] - last.predicted.xB[0]) >= 0 ? '+' : ''}
                  {(last.measured.xB[0] - last.predicted.xB[0]).toFixed(4)}
                </div>
              </div>
              <div className="instrument">
                <div className="k">{t('twin.rmseXD')}</div>
                <div className={`v ${rmseXD > 0.005 ? 'bad' : 'good'}`}>
                  {rmseXD.toFixed(4)}
                </div>
              </div>
              <div className="instrument">
                <div className="k">{t('twin.rmseXB')}</div>
                <div className={`v ${rmseXB > 0.005 ? 'bad' : 'good'}`}>
                  {rmseXB.toFixed(4)}
                </div>
              </div>
              <div className="instrument">
                <div className="k">{t('twin.rmseTFondos')}</div>
                <div className={`v ${rmseTB > 0.8 ? 'bad' : 'good'}`}>
                  {rmseTB.toFixed(2)} °C
                </div>
              </div>
            </div>
          ) : (
            <div className="chart-note">{t('twin.arrancando')}</div>
          )}
        </div>
      </div>

      <div className="twin-plots">
        <div className="panel">
          <TimeSeriesChart
            title={t('twin.graficoXD')}
            series={[
              { name: t('twin.planta'), color: '#f0883e', points: measuredXD },
              { name: t('twin.xemelgo'), color: '#58a6ff', points: predictedXD },
            ]}
          />
        </div>
        <div className="panel">
          <TimeSeriesChart
            title={t('twin.graficoXB')}
            series={[
              { name: t('twin.planta'), color: '#f0883e', points: measuredXB },
              { name: t('twin.xemelgo'), color: '#58a6ff', points: predictedXB },
            ]}
          />
        </div>
        <div className="panel">
          <TimeSeriesChart
            title={t('twin.graficoTCabeza')}
            series={[
              { name: t('twin.planta'), color: '#f0883e', points: measuredTD },
              { name: t('twin.xemelgo'), color: '#58a6ff', points: predictedTD },
            ]}
          />
        </div>
        <div className="panel">
          <TimeSeriesChart
            title={t('twin.residuoXDg')}
            series={[
              { name: t('twin.residuo'), color: '#e3b341', points: mk((s) => s.measured.xD[0] - s.predicted.xD[0]) },
            ]}
          />
        </div>
        <div className="panel">
          <TimeSeriesChart
            title={t('twin.residuoXBg')}
            series={[
              { name: t('twin.residuo'), color: '#e3b341', points: mk((s) => s.measured.xB[0] - s.predicted.xB[0]) },
            ]}
          />
        </div>
        <div className="panel">
          <TimeSeriesChart
            title={t('twin.residuoTFondosg')}
            series={[
              { name: t('twin.residuo'), color: '#e3b341', points: mk((s) => s.measured.TB - s.predicted.TB) },
            ]}
          />
        </div>
      </div>
    </div>
  )
}
