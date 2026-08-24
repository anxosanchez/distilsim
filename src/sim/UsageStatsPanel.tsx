/**
 * Panel de estatísticas de uso anónimas: visitas, tempo de uso, idioma da
 * interface, idioma do navegador, país aproximado (zona horaria), pestanas
 * visitadas e eventos de sesión. Exportable a JSON e borrable polo usuario.
 */

import { useEffect, useState } from 'react'
import {
  getUsageStats,
  sessionTimeMs,
  downloadUsageStats,
  resetUsageStats,
  formatDuration,
  type UsageStatsData,
} from '../core/stats'
import { useI18n, type Lang } from '../i18n'
import { sessionLog } from '../core/session'

export function UsageStatsPanel() {
  const { t } = useI18n()
  const [data, setData] = useState<UsageStatsData>(() => getUsageStats())
  const [sessionMs, setSessionMs] = useState(() => sessionTimeMs())

  useEffect(() => {
    const id = setInterval(() => {
      setData(getUsageStats())
      setSessionMs(sessionTimeMs())
    }, 1000)
    return () => clearInterval(id)
  }, [])

  const langs: Lang[] = ['gl', 'es', 'en']
  const maxLang = Math.max(1, ...langs.map((l) => data.languageChoices[l] ?? 0))
  const tabs = Object.entries(data.tabsVisited).sort((a, b) => b[1] - a[1])

  return (
    <div className="panel">
      <h3>{t('stats.titulo')}</h3>

      <div className="instruments">
        <div className="instrument">
          <div className="k">{t('stats.visitas')}</div>
          <div className="v">{data.visits}</div>
        </div>
        <div className="instrument">
          <div className="k">{t('stats.tiempoTotal')}</div>
          <div className="v">{formatDuration(data.totalTimeMs)}</div>
        </div>
        <div className="instrument">
          <div className="k">{t('stats.tiempoSesion')}</div>
          <div className="v">{formatDuration(sessionMs)}</div>
        </div>
        <div className="instrument">
          <div className="k">{t('stats.idiomaNavegador')}</div>
          <div className="v">{data.browserLang || '—'}</div>
        </div>
        <div className="instrument">
          <div className="k">{t('stats.pais')}</div>
          <div className="v">{data.countryGuess || '—'}</div>
        </div>
        <div className="instrument">
          <div className="k">{t('stats.zonaHoraria')}</div>
          <div className="v">{data.timezone || '—'}</div>
        </div>
        <div className="instrument">
          <div className="k">{t('stats.eventos')}</div>
          <div className="v">{sessionLog.summary().nEvents}</div>
        </div>
        <div className="instrument">
          <div className="k">{t('stats.pestanas')}</div>
          <div className="v">{tabs.length}</div>
        </div>
      </div>

      {/* Idioma da interface (histograma) */}
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>
          {t('stats.idiomaInterfaz')}
        </div>
        {langs.map((l) => {
          const count = data.languageChoices[l] ?? 0
          return (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <span style={{ width: 76, fontSize: 12 }}>{t(`lang.${l}`)}</span>
              <div style={{ flex: 1, height: 12, background: 'var(--bg-panel-2)', borderRadius: 4, overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${(count / maxLang) * 100}%`,
                    background: l === 'gl' ? '#0f47af' : l === 'es' ? '#f1bf00' : '#c8102e',
                    transition: 'width 0.3s',
                  }}
                />
              </div>
              <span style={{ width: 40, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12 }}>
                {count}
              </span>
            </div>
          )
        })}
      </div>

      {/* Pestanas visitadas */}
      {tabs.length > 0 && (
        <div style={{ marginTop: 10, fontSize: 12 }}>
          {tabs.map(([k, n]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-dim)', marginBottom: 2 }}>
              <span>{t(`tab.${k === '3d' ? '3d' : k}`)}</span>
              <span style={{ fontFamily: 'var(--mono)' }}>{n}</span>
            </div>
          ))}
        </div>
      )}

      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn primary" onClick={downloadUsageStats}>
          {t('stats.exportar')}
        </button>
        <button
          className="btn"
          onClick={() => {
            if (confirm(t('stats.confirmarBorrar'))) {
              resetUsageStats()
              setData(getUsageStats())
              setSessionMs(sessionTimeMs())
            }
          }}
        >
          {t('stats.borrar')}
        </button>
      </div>

      <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '10px 0 0' }}>
        {t('stats.privacidad')}
      </p>
    </div>
  )
}
