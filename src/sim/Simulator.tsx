/**
 * Panel Simulador: controles de operación, columna animada en SVG,
 * instrumentos y gráficos en tiempo real.
 */

import { useI18n } from '../i18n'
import { useEffect, useRef, useState } from 'react'
import { SimEngine, type SimSnapshot, type OptimizeResult } from './engine'
import { McKabeThieleChart, ProfileChart, TimeSeriesChart } from './charts'
import { ALL_SYSTEMS } from '../core/components'
import { sessionLog } from '../core/session'
import type { CondenserMode, ColumnInputs, ColumnStateVars } from '../core/columnDynamic'

const SYS_KEYS = Object.keys(ALL_SYSTEMS)

/* ------------------------------------------------------------------ */
/* Columna esquemática                                                 */
/* ------------------------------------------------------------------ */

function ColumnSVG({ snap }: { snap: SimSnapshot }) {
  const { t } = useI18n()
  const { nTrays, feedStage, mode } = snap.config
  const trays = snap.column.trays
  const T = trays.map((tr) => tr.T)
  const tMin = Math.min(...T)
  const tMax = Math.max(...T)

  // Escala de color por temperatura (azul → rojo)
  const tempColor = (v: number): string => {
    const f = (v - tMin) / Math.max(1e-6, tMax - tMin)
    const r = Math.round(40 + 190 * f)
    const b = Math.round(190 - 170 * f)
    const g = Math.round(90 + 40 * f)
    return `rgb(${r},${g},${b})`
  }

  const W = 300
  const H = 560
  const colX = 130
  const colW = 52
  const trayGap = (H - 190) / nTrays

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="column-svg" style={{ width: '100%' }}>
      {/* Condensador */}
      <rect x={colX - 8} y={18} width={colW + 16} height={34} rx={5} fill="#1c2330" stroke="#58a6ff" />
      <text x={colX + colW / 2} y={38} textAnchor="middle" fontSize={10} fill="#58a6ff">
        {mode === 'total' ? t('sim.condensadorTotal') : t('sim.condensadorParcial')}
      </text>
      {/* Línea de reflujo */}
      <line x1={colX + colW / 2} y1={52} x2={colX + colW / 2} y2={78} stroke="#3fb950" strokeWidth={2} />
      <text x={colX + colW / 2 + 6} y={70} fontSize={10} fill="#3fb950">
        L₀ = {snap.column.L_rect.toFixed(1)}
      </text>
      {/* Destilado */}
      <line x1={colX + colW + 10} y1={35} x2={colX + colW + 46} y2={35} stroke="#e3b341" strokeWidth={2} />
      <text x={colX + colW + 20} y={24} fontSize={10} fill="#e3b341">
        D = {snap.column.D.toFixed(1)}
      </text>

      {/* Cuerpo de la columna */}
      <rect x={colX} y={78} width={colW} height={H - 190} fill="none" stroke="#2d333b" strokeWidth={2} />
      {trays.map((tr, j) => (
        <g key={j}>
          <rect
            x={colX}
            y={78 + j * trayGap + trayGap * 0.25}
            width={colW}
            height={trayGap * 0.5}
            fill={tempColor(tr.T)}
            opacity={0.85}
          />
          <text x={colX - 6} y={78 + j * trayGap + trayGap * 0.55} textAnchor="end" fontSize={9} fill="#8b949e">
            {j + 1}
          </text>
          <text x={colX + colW + 5} y={78 + j * trayGap + trayGap * 0.55} fontSize={9} fill="#8b949e">
            {tr.T.toFixed(0)}°
          </text>
        </g>
      ))}

      {/* Alimentación */}
      <line
        x1={colX - 55}
        y1={78 + (feedStage - 0.5) * trayGap}
        x2={colX}
        y2={78 + (feedStage - 0.5) * trayGap}
        stroke="#bc8cff"
        strokeWidth={2.5}
      />
      <text x={colX - 52} y={78 + (feedStage - 0.5) * trayGap - 5} fontSize={10} fill="#bc8cff">
        F = {snap.inputs.F.toFixed(0)} · z = [{snap.inputs.zF.map((z) => z.toFixed(2)).join(', ')}]
      </text>

      {/* Rehervidor */}
      <rect x={colX - 10} y={H - 96} width={colW + 20} height={40} rx={5} fill="#1c2330" stroke="#f0883e" />
      <text x={colX + colW / 2} y={H - 74} textAnchor="middle" fontSize={10} fill="#f0883e">
        {t('sim.refervedorTitulo')}
      </text>
      {/* Fondos */}
      <line x1={colX + colW / 2} y1={H - 56} x2={colX + colW / 2} y2={H - 36} stroke="#f85149" strokeWidth={2} />
      <text x={colX + colW / 2 + 6} y={H - 42} fontSize={10} fill="#f85149">
        B = {snap.column.B.toFixed(1)}
      </text>
      <text x={colX - 8} y={H - 18} fontSize={9} fill="#8b949e">
        Q_R = {(snap.column.QR / 3.6e6).toFixed(2)} MW
      </text>
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/* Panel principal                                                     */
/* ------------------------------------------------------------------ */

export function Simulator() {
  const { t } = useI18n()
  const engineRef = useRef<SimEngine | null>(null)
  if (!engineRef.current) engineRef.current = new SimEngine()
  const engine = engineRef.current

  const [snap, setSnap] = useState<SimSnapshot>(() => engine.snapshot())
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)
  const [graphAspect, setGraphAspect] = useState(1)
  const [, force] = useState(0)

  // Modo de reflujo del condensador: sin reflujo / parcial / total
  type RefluxMode = 'none' | 'partial' | 'total'
  const [refluxMode, setRefluxMode] = useState<RefluxMode>('partial')
  const partialR = useRef(1.65) // último R en modo parcial

  const handleRefluxMode = (mode: RefluxMode) => {
    const Rcur = snap.inputs.R
    if (Rcur > 0 && Rcur < 100) partialR.current = Rcur
    if (mode === 'none') {
      // Sen refluxo: R = 0 y V_R debe ser < q·F para que B > 0
      const maxVR = Math.max(45, snap.inputs.q * snap.inputs.F - 5)
      engine.setInputs({ R: 0, V_R: Math.min(snap.inputs.V_R, maxVR) })
      engine.setControl({ enabled: false })
      sessionLog.log('input', t('eng.modoRefluxoSen'), { R: 0 }, engine.column.time)
    } else if (mode === 'total') {
      // Reflujo total: D ≈ 0 (R muy grande)
      engine.setInputs({ R: 999 })
      engine.setControl({ enabled: false })
      sessionLog.log('input', t('eng.modoRefluxoTotal'), { R: 999 }, engine.column.time)
    } else {
      engine.setInputs({ R: partialR.current })
      sessionLog.log('input', t('eng.modoRefluxoParcial', { r: partialR.current.toFixed(2) }), { R: partialR.current }, engine.column.time)
    }
    setRefluxMode(mode)
    setSnap(engine.snapshot())
  }

  // Bucle de animación
  useEffect(() => {
    let raf = 0
    const loop = () => {
      engine.tick()
      setSnap(engine.snapshot())
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [engine])

  const sys = ALL_SYSTEMS[snap.config.systemKey]
  const binary = sys.components.length === 2
  const nc = sys.components.length
  const xD0 = snap.column.xD[0]
  const xB0 = snap.column.xB[nc - 1] // componente menos volátil en fondos
  const zF0 = snap.inputs.zF[0]
  // Componente mostrado en el perfil de composición (selector)
  const [profileComp, setProfileComp] = useState(0)

  const handleRebuild = (patch: Partial<SimSnapshot['config']>) => {
    const nTrays = patch.nTrays ?? snap.config.nTrays
    const feedStage = Math.min(
      patch.feedStage ?? snap.config.feedStage,
      Math.max(2, nTrays - 1),
    )
    engine.rebuild({ ...patch, nTrays, feedStage })
    setSnap(engine.snapshot())
    force((f) => f + 1)
  }

  const handleSteadyState = async () => {
    setBusy(true)
    setProgress(0)
    await engine.resetToSteadyStateAsync((p) => setProgress(p))
    setBusy(false)
    setSnap(engine.snapshot())
  }

  const set = (patch: Partial<SimSnapshot['inputs']>, label?: string) => {
    engine.setInputs(patch)
    const s = engine.column.snapshot()
    sessionLog.logState(
      'input',
      label ?? t('eng.cambioConsigna'),
      { xD: s.xD[0], xB: s.xB[0], QR: s.QR },
      { ...patch },
      engine.column.time,
    )
    setSnap(engine.snapshot())
  }

  const setCtrl = (patch: Partial<SimSnapshot['control']>) => {
    engine.setControl(patch)
    setSnap(engine.snapshot())
  }

  // Optimización enerxética guiada
  const [optTargets, setOptTargets] = useState({ xDmin: 0.97, xBmax: 0.03 })
  const [optState, setOptState] = useState<{
    busy: boolean
    progress: number
    msg: string
    result: OptimizeResult | null
    saved: { state: ColumnStateVars; inputs: ColumnInputs } | null
  }>({ busy: false, progress: 0, msg: '', result: null, saved: null })

  const handleOptimize = async () => {
    if (optState.busy) return
    const saved = {
      state: engine.column.exportState(),
      inputs: engine.column.getInputs(),
    }
    setOptState({ busy: true, progress: 0, msg: t('sim.iniciando'), result: null, saved })
    const res = await engine.optimizeEnergy(optTargets, (frac, msg) => {
      setOptState((prev) => ({ ...prev, progress: frac, msg }))
    })
    setOptState((prev) => ({ ...prev, busy: false, progress: 1, msg: '', result: res }))
    setSnap(engine.snapshot())
  }

  const handleRestoreOpt = () => {
    if (!optState.saved) return
    engine.column.importState(optState.saved.state)
    engine.setInputs(optState.saved.inputs)
    setOptState((prev) => ({ ...prev, result: null }))
    setSnap(engine.snapshot())
  }

  const handleScenario = (name: Parameters<SimEngine['applyScenario']>[0]) => {
    const msg = engine.applyScenario(name)
    setNotice(msg)
    setSnap(engine.snapshot())
  }

  const handleExport = () => {
    const json = engine.exportScenario(t('eng.escenarioGuardado'))
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `destilador-escenario-${engine.column.time.toFixed(2)}h.json`
    a.click()
    URL.revokeObjectURL(url)
    setNotice(t('eng.escenarioExportadoOk'))
  }

  const handleImportFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const note = engine.importScenario(String(reader.result))
        setNotice(note ?? t('eng.escenarioImportadoOk'))
        setSnap(engine.snapshot())
      } catch (e) {
        setNotice(t('eng.erroImportar', { msg: (e as Error).message }))
      }
    }
    reader.readAsText(file)
  }

  // Series temporales para gráficos
  const hist = snap.history
  const tsXD = hist.map((h) => ({ t: h.t, y: h.xD[0] }))
  const tsXB = hist.map((h) => ({ t: h.t, y: h.xB[0] }))
  const tsTD = hist.map((h) => ({ t: h.t, y: h.TD }))
  const tsTB = hist.map((h) => ({ t: h.t, y: h.TB }))
  const tProf = snap.column.trays.map((tr) => tr.T)
  const stageLabels = snap.column.trays.map((_, i) => `${i + 1}`)

  const simTime = snap.column.t.toFixed(2)

  return (
    <div className="grid-sim">
      <div className="col-left">
        {/* Configuración */}
        <div className="panel">
          <h3>{t('sim.sistemaColumna')}</h3>
          <div className="ctrl">
            <label>{t('sim.mezcla')}</label>
            <select
              value={snap.config.systemKey}
              onChange={(e) => handleRebuild({ systemKey: e.target.value })}
            >
              {SYS_KEYS.map((k) => (
                <option key={k} value={k}>
                  {ALL_SYSTEMS[k].label}
                </option>
              ))}
            </select>
          </div>
          <div className="ctrl">
            <label>
              {t('sim.condensador')}{' '}
              <b>{snap.config.mode === 'total' ? t('sim.total') : t('sim.parcial')}</b>
            </label>
            <div className="row">
              <button
                className={`btn ${snap.config.mode === 'total' ? 'active' : ''}`}
                onClick={() => handleRebuild({ mode: 'total' })}
              >
                {t('sim.condensadorTotal')}
              </button>
              <button
                className={`btn ${snap.config.mode === 'partial' ? 'active' : ''}`}
                onClick={() => handleRebuild({ mode: 'partial' })}
              >
                {t('sim.condensadorParcial')}
              </button>
            </div>
          </div>
          <div className="ctrl">
            <label>
              {t('sim.pratos')} <b>{snap.config.nTrays}</b>
            </label>
            <input
              type="range"
              min={4}
              max={30}
              value={snap.config.nTrays}
              onChange={(e) => handleRebuild({ nTrays: Number(e.target.value) })}
            />
          </div>
          <div className="ctrl">
            <label>
              {t('sim.pratoAlimentacion')} <b>{snap.config.feedStage}</b>
            </label>
            <input
              type="range"
              min={2}
              max={Math.max(2, snap.config.nTrays - 1)}
              value={snap.config.feedStage}
              onChange={(e) => handleRebuild({ feedStage: Number(e.target.value) })}
            />
          </div>
          <div className="row">
            <button className="btn primary" onClick={handleSteadyState} disabled={busy}>
              {busy ? `${t('sim.estadoEstacionario')}… ${Math.round(progress * 100)}%` : t('sim.estadoEstacionario')}
            </button>
            <button
              className="btn"
              onClick={() => {
                engine.running = !engine.running
                force((f) => f + 1)
              }}
            >
              {engine.running ? t('sim.pausa') : t('sim.reanudar')}
            </button>
          </div>
        </div>

        {/* Variables manipuladas */}
        <div className="panel">
          <h3>{t('sim.variablesOperacion')}</h3>
          <div className="ctrl">
            <label>
              {t('sim.alimentacionF')} <b>{snap.inputs.F.toFixed(0)} kmol/h</b>
            </label>
            <input type="range" min={40} max={200} value={snap.inputs.F} onChange={(e) => set({ F: Number(e.target.value) })} />
          </div>
          {nc >= 2 && (
            <div className="ctrl">
              <label>
                {t('sim.zF', { n: 1 })} <b>{zF0.toFixed(2)}</b>
              </label>
              <input
                type="range"
                min={0.02}
                max={Math.min(0.95, 1 - (nc - 2) * 0.02)}
                step={0.01}
                value={zF0}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  const zF = snap.inputs.zF.slice()
                  zF[0] = v
                  // Repartir el resto entre los demás componentes
                  const rest = 1 - v
                  const others = zF.slice(1)
                  const sumOthers = others.reduce((a, b) => a + b, 0)
                  if (sumOthers > 0) {
                    for (let i = 1; i < zF.length; i++) zF[i] = (others[i - 1] / sumOthers) * rest
                  } else {
                    for (let i = 1; i < zF.length; i++) zF[i] = rest / (nc - 1)
                  }
                  set({ zF }, t('sim.zF', { n: 1 }))
                }}
              />
            </div>
          )}
          {nc === 3 && (
            <div className="ctrl">
              <label>
                {t('sim.zF', { n: 2 })} <b>{snap.inputs.zF[1].toFixed(2)}</b>
              </label>
              <input
                type="range"
                min={0.02}
                max={Math.min(0.95, 1 - snap.inputs.zF[0] - 0.02)}
                step={0.01}
                value={snap.inputs.zF[1]}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  const zF = snap.inputs.zF.slice()
                  zF[1] = v
                  zF[2] = Math.max(0.02, 1 - zF[0] - v)
                  set({ zF }, t('sim.zF', { n: 2 }))
                }}
              />
            </div>
          )}
          <div className="ctrl">
            <label>
              {t('sim.estadoTermico')} <b>{snap.inputs.q.toFixed(2)}</b>
            </label>
            <input type="range" min={0} max={2} step={0.05} value={snap.inputs.q} onChange={(e) => set({ q: Number(e.target.value) })} />
            <div className="row" style={{ marginTop: 4 }}>
              <button className="btn" onClick={() => set({ q: 1 })}>{t('sim.liquidoSaturado')}</button>
              <button className="btn" onClick={() => set({ q: 0 })}>{t('sim.vaporSaturado')}</button>
            </div>
          </div>
          <div className="ctrl">
            <label>{t('sim.modoRefluxo')}</label>
            <div className="row">
              <button
                className={`btn ${refluxMode === 'none' ? 'active' : ''}`}
                onClick={() => handleRefluxMode('none')}
              >
                {t('sim.sinRefluxo')}
              </button>
              <button
                className={`btn ${refluxMode === 'partial' ? 'active' : ''}`}
                onClick={() => handleRefluxMode('partial')}
              >
                {t('sim.parcial')}
              </button>
              <button
                className={`btn ${refluxMode === 'total' ? 'active' : ''}`}
                onClick={() => handleRefluxMode('total')}
              >
                {t('sim.total')}
              </button>
            </div>
            {refluxMode === 'none' && (
              <p style={{ fontSize: 11, color: 'var(--warn)', margin: '6px 0 0' }}>
                {t('sim.sinRefluxoNota1')}
                {t('sim.sinRefluxoNota2')}
              </p>
            )}
            {refluxMode === 'total' && (
              <p style={{ fontSize: 11, color: 'var(--warn)', margin: '6px 0 0' }}>
                {t('sim.refluxoTotalNota1')}
                {t('sim.refluxoTotalNota2')}
              </p>
            )}
          </div>
          <div className="ctrl">
            <label>
              {t('sim.refluxoR')}{' '}
              <b>
                {refluxMode === 'total' ? t('sim.refluxoInfinito') : refluxMode === 'none' ? t('sim.refluxoCero') : snap.inputs.R.toFixed(2)}
              </b>
            </label>
            <input
              type="range"
              min={0.5}
              max={10}
              step={0.05}
              value={Math.min(10, snap.inputs.R)}
              disabled={refluxMode !== 'partial'}
              onChange={(e) => {
                set({ R: Number(e.target.value) })
                setRefluxMode('partial')
              }}
            />
          </div>
          <div className="ctrl">
            <label>
              {t('sim.vaporizacionVR')} <b>{snap.inputs.V_R.toFixed(1)} kmol/h</b>
            </label>
            <input
              type="range"
              min={40}
              max={refluxMode === 'none' ? Math.max(45, snap.inputs.q * snap.inputs.F - 5) : 300}
              value={snap.inputs.V_R}
              onChange={(e) => set({ V_R: Number(e.target.value) })}
            />
          </div>
          <div className="ctrl">
            <label>
              {t('sim.velocidad')} <b>{engine.speed}×</b>
            </label>
            <div className="row">
              {[1, 10, 60, 300].map((s) => (
                <button key={s} className={`btn ${engine.speed === s ? 'active' : ''}`} onClick={() => { engine.speed = s; force((f) => f + 1) }}>
                  {s}×
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Control de temperatura (PID) */}
        <div className="panel">
          <h3>{t('sim.controlTemperatura')}</h3>
          <div className="ctrl">
            <label>{t('sim.esquemaControl')}</label>
            <div className="row">
              {(['LD', 'RV', 'DV'] as const).map((s) => (
                <button
                  key={s}
                  className={`btn ${snap.control.scheme === s ? 'active' : ''}`}
                  onClick={() => setCtrl({ scheme: s })}
                >
                  {s === 'LD' ? t('sim.esquemaLD') : s === 'RV' ? t('sim.esquemaRV') : t('sim.esquemaDV')}
                </button>
              ))}
            </div>
          </div>
          <div className="row" style={{ marginBottom: 10 }}>
            <button
              className={`btn ${snap.control.enabled ? 'primary' : ''}`}
              disabled={refluxMode !== 'partial'}
              onClick={() => setCtrl({ enabled: !snap.control.enabled })}
            >
              {snap.control.enabled ? t('sim.auto') : t('sim.manual')}
            </button>
          </div>
          {refluxMode !== 'partial' && (
            <p style={{ fontSize: 11, color: 'var(--warn)', margin: '0 0 10px' }}>
              {t('sim.controlSoloParcial1')}
              {t('sim.controlSoloParcial2')}
            </p>
          )}
          <div className="ctrl">
            <label>
              {t('sim.pratoSensible')} <b>{snap.control.sensibleTray}</b>
            </label>
            <input
              type="range"
              min={1}
              max={snap.config.nTrays}
              value={snap.control.sensibleTray}
              onChange={(e) => setCtrl({ sensibleTray: Number(e.target.value) })}
            />
          </div>
          <div className="ctrl">
            <label>
              {t('sim.consignaT')} <b>{snap.control.setpoint.toFixed(1)} °C</b>
            </label>
            <input
              type="range"
              min={60}
              max={120}
              step={0.5}
              value={snap.control.setpoint}
              onChange={(e) => setCtrl({ setpoint: Number(e.target.value) })}
            />
          </div>
          <div className="ctrl">
            <label>
              {t('sim.kpKi', { kp: snap.control.kp.toFixed(1), ki: snap.control.ki.toFixed(1) })}
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <input type="range" min={0} max={10} step={0.1} value={snap.control.kp} onChange={(e) => setCtrl({ kp: Number(e.target.value) })} />
              <input type="range" min={0} max={20} step={0.5} value={snap.control.ki} onChange={(e) => setCtrl({ ki: Number(e.target.value) })} />
            </div>
          </div>
          <div className="instruments">
            <div className="instrument">
              <div className="k">{t('sim.tMedida', { n: snap.control.sensibleTray })}</div>
              <div className="v">{snap.controlMeasurement.toFixed(2)} °C</div>
            </div>
            <div className="instrument">
              <div className="k">{t('sim.salidaPid', { var: engine.controlVariableLabel })}</div>
              <div className="v">
                {snap.control.scheme === 'DV'
                  ? snap.controlOutput.toFixed(3)
                  : snap.controlOutput.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        {/* Escenarios didácticos */}
        <div className="panel">
          <h3>{t('sim.escenarios')}</h3>
          <div className="row">
            <button className="btn" onClick={() => handleScenario('nominal')}>{t('sim.operacionNominal')}</button>
            <button className="btn warn" onClick={() => handleScenario('pérdidaCalefacción')}>{t('sim.perdaCalefaccion')}</button>
            <button className="btn warn" onClick={() => handleScenario('cambioAlimento')}>{t('sim.cambioAlimento')}</button>
            <button className="btn warn" onClick={() => handleScenario('subirReflujo')}>{t('sim.refluxo50')}</button>
            <button className="btn warn" onClick={() => handleScenario('bajarAlimentación')}>{t('sim.alimentacion25')}</button>
          </div>
          {notice && (
            <p style={{ fontSize: 12, color: 'var(--warn)', margin: '8px 0 0' }}>{notice}</p>
          )}
        </div>

        {/* Optimización enerxética guiada */}
        <div className="panel">
          <h3>{t('sim.optimizacion')}</h3>
          <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '0 0 8px' }}>
            {t('sim.optimizacionDesc1')}
            {t('sim.optimizacionDesc2')}
            {t('sim.optimizacionDesc3')}
          </p>
          <div className="ctrl">
            <label>
              {t('sim.xDminimo')} <b>{optTargets.xDmin.toFixed(2)}</b>
            </label>
            <input
              type="range"
              min={0.85}
              max={0.98}
              step={0.01}
              value={optTargets.xDmin}
              onChange={(e) => setOptTargets((t) => ({ ...t, xDmin: Number(e.target.value) }))}
            />
          </div>
          <div className="ctrl">
            <label>
              {t('sim.xBmaximo')} <b>{optTargets.xBmax.toFixed(2)}</b>
            </label>
            <input
              type="range"
              min={0.02}
              max={0.12}
              step={0.01}
              value={optTargets.xBmax}
              onChange={(e) => setOptTargets((t) => ({ ...t, xBmax: Number(e.target.value) }))}
            />
          </div>
          <div className="row">
            <button className="btn primary" onClick={handleOptimize} disabled={optState.busy}>
              {optState.busy ? t('sim.optimizando') : t('sim.optimizar')}
            </button>
            <button className="btn" onClick={handleRestoreOpt} disabled={!optState.saved || optState.busy}>
              {t('sim.restaurarInicial')}            </button>
          </div>
          {optState.busy && (
            <div style={{ marginTop: 8 }}>
              <div style={{ height: 6, background: 'var(--bg-panel-2)', borderRadius: 4, overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${Math.round(optState.progress * 100)}%`,
                    background: 'var(--accent)',
                    transition: 'width 0.2s',
                  }}
                />
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '4px 0 0' }}>{optState.msg}</p>
            </div>
          )}
          {optState.result && (
            <div style={{ marginTop: 8, fontSize: 12 }}>
              <p style={{ margin: '0 0 6px', color: optState.result.feasible ? 'var(--accent-2)' : 'var(--danger)' }}>
                {optState.result.message}
              </p>
              {optState.result.feasible && (
                <div className="instruments">
                  <div className="instrument">
                    <div className="k">{t('sim.qrOptima')}</div>
                    <div className="v">{(optState.result.QR / 3.6e6).toFixed(2)} MW</div>
                  </div>
                  <div className="instrument">
                    <div className="k">{t('sim.ahorro')}</div>
                    <div className="v good">{optState.result.savingsPct.toFixed(1)} %</div>
                  </div>
                  <div className="instrument">
                    <div className="k">{t('sim.rOptimo')}</div>
                    <div className="v">{optState.result.R.toFixed(2)}</div>
                  </div>
                  <div className="instrument">
                    <div className="k">{t('sim.vrOptimo')}</div>
                    <div className="v">{optState.result.V_R.toFixed(1)}</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Guardar / cargar escenario */}
        <div className="panel">
          <h3>{t('sim.guardarCargar')}</h3>
          <div className="row">
            <button className="btn" onClick={handleExport}>{t('sim.exportarJson')}</button>
            <label className="btn" style={{ textAlign: 'center', cursor: 'pointer' }}>
              {t('sim.importar')}
              <input
                type="file"
                accept="application/json"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleImportFile(f)
                  e.target.value = ''
                }}
              />
            </label>
          </div>
        </div>

        {/* Cuestiones */}
        <div className="panel">
          <h3>{t('sim.cuestiones')}</h3>
          <details>
            <summary style={{ cursor: 'pointer', fontSize: 13 }}>{t('sim.cuestion1')}</summary>
            <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>{t('sim.cuestion1Resp')}</p>
          </details>
          <details>
            <summary style={{ cursor: 'pointer', fontSize: 13 }}>{t('sim.cuestion2')}</summary>
            <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>{t('sim.cuestion2Resp')}</p>
          </details>
          <details>
            <summary style={{ cursor: 'pointer', fontSize: 13 }}>{t('sim.cuestion3')}</summary>
            <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>{t('sim.cuestion3Resp')}</p>
          </details>
          <details>
            <summary style={{ cursor: 'pointer', fontSize: 13 }}>{t('sim.cuestion4')}</summary>
            <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>{t('sim.cuestion4Resp')}</p>
          </details>
        </div>

        {/* Instrumentos */}
        <div className="panel">
          <h3>{t('sim.instrumentos', { t: simTime })}</h3>
          <div className="instruments">
            <div className="instrument">
              <div className="k">{t('sim.xD')}</div>
              <div className="v">{xD0.toFixed(4)}</div>
            </div>
            <div className="instrument">
              <div className="k">{t('sim.xB')}</div>
              <div className="v">{snap.column.xB[nc - 1].toFixed(4)}</div>
            </div>
            <div className="instrument">
              <div className="k">{t('sim.tCabeza')}</div>
              <div className="v">{snap.column.TD.toFixed(1)} °C</div>
            </div>
            <div className="instrument">
              <div className="k">{t('sim.tFondos')}</div>
              <div className="v">{snap.column.TB.toFixed(1)} °C</div>
            </div>
            <div className="instrument">
              <div className="k">{t('sim.destiladoD')}</div>
              <div className="v">{snap.column.D.toFixed(1)} <small>kmol/h</small></div>
            </div>
            <div className="instrument">
              <div className="k">{t('sim.fondosB')}</div>
              <div className="v">{snap.column.B.toFixed(1)} <small>kmol/h</small></div>
            </div>
            <div className="instrument">
              <div className="k">{t('sim.calorRefervedor')}</div>
              <div className="v">{(snap.column.QR / 3.6e6).toFixed(2)} <small>MW</small></div>
            </div>
            <div className="instrument">
              <div className="k">{t('sim.calorCondensador')}</div>
              <div className="v">{(snap.column.QC / 3.6e6).toFixed(2)} <small>MW</small></div>
            </div>
          </div>
        </div>
      </div>

      {/* Columna central: representación de platos (20 % del ancho) */}
      <div className="col-middle">
        <div className="panel">
          <h3>{t('sim.columnaPratos')}</h3>
          <ColumnSVG snap={snap} />
        </div>
      </div>

      {/* Columna de gráficos (50 % del ancho, todo el alto) — 3 gráficos apilados */}
      <div className="col-right">
        <div className="panel chart-toolbar" style={{ padding: '8px 12px' }}>
          <div className="ctrl" style={{ margin: 0 }}>
            <label>
              {t('sim.proporcionGraficos', { n: graphAspect.toFixed(2) })}
            </label>
            <input
              type="range"
              min={0.5}
              max={1.6}
              step={0.05}
              value={graphAspect}
              onChange={(e) => setGraphAspect(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="panel">
          {binary ? (
            <McKabeThieleChart
              system={sys}
              P={sys.defaultPressure}
              xD={xD0}
              xB={xB0}
              zF={zF0}
              q={snap.inputs.q}
              R={snap.inputs.R}
              aspect={graphAspect}
            />
          ) : (
            <div className="chart-note">
              {t('sim.mtSoloBinario1')}
              {t('sim.mtSoloBinario2')}
            </div>
          )}
        </div>

        <div className="panel">
          <div className="row" style={{ marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--text-dim)', alignSelf: 'center' }}>
              {t('sim.perfilPorPrato')}
            </span>
            {sys.components.map((c, i) => (
              <button
                key={c.id}
                className={`btn ${profileComp === i ? 'active' : ''}`}
                style={{ flex: 0, minWidth: 0, padding: '3px 10px' }}
                onClick={() => setProfileComp(i)}
              >
                {c.formula}
              </button>
            ))}
          </div>
          <ProfileChart
            title={t('sim.perfilTitulo', { formula: sys.components[profileComp].formula })}
            values={snap.column.trays.map((tr) => tr.x[profileComp])}
            valuesRight={tProf}
            labels={stageLabels}
            yLabel={`x ${sys.components[profileComp].formula}`}
            yLabelRight={t('chart.etapaTemp')}
            color="#58a6ff"
            colorRight="#f0883e"
            aspect={graphAspect}
          />
        </div>

        <div className="panel">
          <TimeSeriesChart
            title={t('sim.produtosTemperaturas')}
            yLabel={t('sim.composicion')}
            yLabelRight={t('sim.temperatura')}
            aspect={graphAspect}
            series={[
              { name: 'x_D', color: '#3fb950', points: tsXD, axis: 'left' },
              { name: 'x_B', color: '#f85149', points: tsXB, axis: 'left' },
              { name: t('sim.tCabeza'), color: '#e3b341', points: tsTD, axis: 'right' },
              { name: t('sim.tFondos'), color: '#f0883e', points: tsTB, axis: 'right' },
            ]}
          />
        </div>
      </div>
    </div>
  )
}

export type { CondenserMode }
