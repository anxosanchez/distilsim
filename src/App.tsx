import { lazy, Suspense, useState } from 'react'
import { Simulator } from './sim/Simulator'
import { TwinPanel } from './sim/TwinPanel'
import { TheoryPanel } from './sim/TheoryPanel'
import { AssessmentPanel } from './sim/AssessmentPanel'
import { LanguagePicker } from './sim/LanguagePicker'
import { I18nProvider, useI18n } from './i18n'
import { sessionLog } from './core/session'

// Carga diferida: Three.js solo se descarga al abrir la pestaña 3D
const Column3D = lazy(() => import('./sim/Column3D').then((m) => ({ default: m.Column3D })))

type Tab = 'sim' | 'twin' | 'theory' | 'eval' | '3d'

function AppShell() {
  const [tab, setTab] = useState<Tab>('sim')
  const { t } = useI18n()

  const handleExportSession = () => {
    const { nEvents } = sessionLog.summary()
    sessionLog.download()
    console.log(`Sesión exportada: ${nEvents} eventos rexistrados.`)
  }

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>🧪 {t('app.title')}</h1>
          <div className="sub">{t('app.subtitle')}</div>
        </div>
        <nav className="tabs">
          <button className={`tab ${tab === 'sim' ? 'active' : ''}`} onClick={() => setTab('sim')}>
            {t('tab.simulador')}
          </button>
          <button className={`tab ${tab === '3d' ? 'active' : ''}`} onClick={() => setTab('3d')}>
            {t('tab.3d')}
          </button>
          <button className={`tab ${tab === 'twin' ? 'active' : ''}`} onClick={() => setTab('twin')}>
            {t('tab.twin')}
          </button>
          <button className={`tab ${tab === 'theory' ? 'active' : ''}`} onClick={() => setTab('theory')}>
            {t('tab.teoria')}
          </button>
          <button className={`tab ${tab === 'eval' ? 'active' : ''}`} onClick={() => setTab('eval')}>
            {t('tab.avaliacion')}
          </button>
          <button
            className="tab"
            title={t('header.exportSessionTitle')}
            onClick={handleExportSession}
          >
            {t('header.exportSession')}
          </button>
          <LanguagePicker />
        </nav>
      </header>
      <main className="main">
        {tab === 'sim' && <Simulator />}
        {tab === '3d' && (
          <Suspense
            fallback={
              <div
                className="panel"
                style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <p style={{ color: 'var(--text-dim)' }}>{t('vista3d.cargando')}…</p>
              </div>
            }
          >
            <Column3D />
          </Suspense>
        )}
        {tab === 'twin' && <TwinPanel />}
        {tab === 'theory' && <TheoryPanel />}
        {tab === 'eval' && <AssessmentPanel />}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <I18nProvider>
      <AppShell />
    </I18nProvider>
  )
}
