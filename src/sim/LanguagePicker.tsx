/**
 * Selector de idioma: modal moderno coas tres bandeiras (galego, español,
 * inglés). Amósase ao primeiro acceso (sen idioma gardado) e pode reabrirse
 * desde a cabecera.
 */

import { useEffect, useState } from 'react'
import { Flag, LANG_NAMES, useI18n, type Lang } from '../i18n'

export function LanguagePicker() {
  const { lang, setLang, t } = useI18n()
  const [open, setOpen] = useState<boolean>(() => {
    if (typeof localStorage === 'undefined') return true
    return localStorage.getItem('dtd-lang') === null
  })

  useEffect(() => {
    if (typeof document === 'undefined') return
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  const choose = (l: Lang) => {
    setLang(l)
    setOpen(false)
  }

  const langs: Lang[] = ['gl', 'es', 'en']

  return (
    <>
      {open && (
        <div className="lang-overlay" onClick={() => setOpen(false)}>
          <div className="lang-modal" onClick={(e) => e.stopPropagation()}>
            <div className="lang-modal-head">
              <div>
                <h2>{t('lang.title')}</h2>
                <p>{t('lang.subtitle')}</p>
              </div>
              <button className="lang-close" onClick={() => setOpen(false)} aria-label="close">
                ✕
              </button>
            </div>
            <div className="lang-options">
              {langs.map((l) => (
                <button
                  key={l}
                  className={`lang-option ${lang === l ? 'active' : ''}`}
                  onClick={() => choose(l)}
                >
                  <span className="lang-flag">
                    <Flag lang={l} size={34} />
                  </span>
                  <span className="lang-name">{LANG_NAMES[l].native}</span>
                  <span className="lang-self">{t(`lang.${l}`)}</span>
                  {lang === l && <span className="lang-check">✓</span>}
                </button>
              ))}
            </div>
            <p className="lang-hint">{t('lang.subtitle')}</p>
          </div>
        </div>
      )}
      {/* Botón na cabecera para reabrir o selector */}
      <button
        className="tab lang-btn"
        title={t('lang.buttonTitle')}
        onClick={() => setOpen(true)}
      >
        <Flag lang={lang} size={16} />
      </button>
    </>
  )
}
