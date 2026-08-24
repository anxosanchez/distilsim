import { useState } from 'react'
import { Simulator } from './sim/Simulator'
import { TwinPanel } from './sim/TwinPanel'
import { TheoryPanel } from './sim/TheoryPanel'
import { AssessmentPanel } from './sim/AssessmentPanel'
import { LanguagePicker } from './sim/LanguagePicker'
import { I18nProvider, useI18n } from './i18n'
import { sessionLog } from './core/session'

type Tab = 'sim' | 'twin' | 'theory' | 'eval'

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
