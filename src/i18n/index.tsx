/**
 * Sistema de internacionalización (i18n) — galego / español / inglés.
 *
 * - Provider React con persistencia en localStorage.
 * - `tGlobal()` para el núcleo (módulos que no son componentes React):
 *   lee el idioma actual en el momento de generar el mensaje.
 * - Selector de idioma (modal con banderas) en LanguagePicker.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { translations, type Lang } from './translations'

export type { Lang }

const STORAGE_KEY = 'dtd-lang'

/* ------------------------------------------------------------------ */
/* t global (para el núcleo: engine, mccabeThiele, assessment)         */
/* ------------------------------------------------------------------ */

let currentLang: Lang = 'gl'

export function setGlobalLang(l: Lang): void {
  currentLang = l
}

export function tGlobal(key: string, vars?: Record<string, string | number>): string {
  let s = translations[currentLang]?.[key] ?? translations.gl[key] ?? key
  if (vars) {
    for (const [vk, vv] of Object.entries(vars)) {
      s = s.split(`{${vk}}`).join(String(vv))
    }
  }
  return s
}

/* ------------------------------------------------------------------ */
/* Provider / hook                                                     */
/* ------------------------------------------------------------------ */

interface I18nValue {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nValue>({
  lang: 'gl',
  setLang: () => undefined,
  t: (k, vars) => tGlobal(k, vars),
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof localStorage === 'undefined') return 'gl'
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved === 'es' || saved === 'en' || saved === 'gl' ? saved : 'gl'
  })

  const setLang = (l: Lang) => {
    setLangState(l)
    setGlobalLang(l)
    try {
      localStorage.setItem(STORAGE_KEY, l)
    } catch {
      /* almacenamiento no disponible */
    }
  }

  useEffect(() => {
    setGlobalLang(lang)
  }, [lang])

  const t = (key: string, vars?: Record<string, string | number>): string => {
    let s = translations[lang]?.[key] ?? translations.gl[key] ?? key
    if (vars) {
      for (const [vk, vv] of Object.entries(vars)) {
        s = s.split(`{${vk}}`).join(String(vv))
      }
    }
    return s
  }

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>
  )
}

export function useI18n(): I18nValue {
  return useContext(I18nContext)
}

/* ------------------------------------------------------------------ */
/* Banderas (SVG)                                                      */
/* ------------------------------------------------------------------ */

export function Flag({ lang, size = 22 }: { lang: Lang; size?: number }) {
  if (lang === 'es') {
    return (
      <svg width={size} height={size * 0.7} viewBox="0 0 30 21" aria-label="España">
        <rect width="30" height="21" fill="#aa151b" />
        <rect y="5.25" width="30" height="10.5" fill="#f1bf00" />
      </svg>
    )
  }
  if (lang === 'en') {
    return (
      <svg width={size} height={size * 0.7} viewBox="0 0 30 21" aria-label="United Kingdom">
        <rect width="30" height="21" fill="#012169" />
        <path d="M0 0L30 21M30 0L0 21" stroke="#fff" strokeWidth="4" />
        <path d="M0 0L30 21M30 0L0 21" stroke="#c8102e" strokeWidth="2.2" />
        <path d="M15 0V21M0 10.5H30" stroke="#fff" strokeWidth="6" />
        <path d="M15 0V21M0 10.5H30" stroke="#c8102e" strokeWidth="3.6" />
      </svg>
    )
  }
  // Galicia: fondo azul con franxa diagonal branca
  return (
    <svg width={size} height={size * 0.7} viewBox="0 0 30 21" aria-label="Galicia">
      <rect width="30" height="21" fill="#0f47af" />
      <path d="M0 0L30 21" stroke="#fff" strokeWidth="5" />
    </svg>
  )
}

export const LANG_NAMES: Record<Lang, { native: string; self: string }> = {
  gl: { native: 'Galego', self: 'Galego' },
  es: { native: 'Español', self: 'Español' },
  en: { native: 'English', self: 'English' },
}
