/**
 * Estatísticas de uso anónimas e respectuosas coa privacidade.
 *
 * Recóllese SÓ o que o navegador revela voluntariamente:
 *  - idioma da interface elixido polo usuario,
 *  - idioma do navegador (navigator.language),
 *  - zona horaria (da que se deriva un PAÍS APROXIMADO; sen xeolocalización
 *    nin enderezos IP),
 *  - tempo de uso (heartbeat), visitas, pestanas visitadas e eventos.
 *
 * Todo se almacena en localStorage (sen servidores nin terceiros) e o
 * docente pode exportalo como JSON para a súa análise.
 */

import type { Lang } from '../i18n/translations'

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface UsageStatsData {
  firstVisit: string
  visits: number
  totalTimeMs: number
  lastBeat: number
  sessionStart: number
  languageChoices: Record<string, number>
  browserLang: string
  timezone: string
  countryGuess: string
  tabsVisited: Record<string, number>
  /** Nº de veces que se pulsa "Optimizar enerxía" */
  optimizeCount: number
  /** Tempo acumulado por pestana (ms) */
  tabTime: Record<string, number>
  /** Pestana activa e momento de entrada (para duración por pestana) */
  currentTab: string | null
  currentTabStart: number
}

const KEY = 'dtd-usage'
const HEARTBEAT_MS = 30000

/* ------------------------------------------------------------------ */
/* Storage (inyectable para tests)                                     */
/* ------------------------------------------------------------------ */

let storage: StorageLike | null =
  typeof localStorage !== 'undefined' ? localStorage : null

export function initStatsStorage(s: StorageLike | null): void {
  storage = s
}

/* ------------------------------------------------------------------ */
/* País aproximado a partir da zona horaria                            */
/* ------------------------------------------------------------------ */

const TZ_COUNTRY: Record<string, string> = {
  'Europe/Madrid': 'Spain',
  'Europe/Lisbon': 'Portugal',
  'Europe/London': 'United Kingdom',
  'Europe/Paris': 'France',
  'Europe/Berlin': 'Germany',
  'Europe/Rome': 'Italy',
  'Europe/Vienna': 'Austria',
  'Europe/Amsterdam': 'Netherlands',
  'Europe/Brussels': 'Belgium',
  'Europe/Zurich': 'Switzerland',
  'Europe/Stockholm': 'Sweden',
  'Europe/Oslo': 'Norway',
  'Europe/Copenhagen': 'Denmark',
  'Europe/Helsinki': 'Finland',
  'Europe/Warsaw': 'Poland',
  'Europe/Prague': 'Czech Republic',
  'Europe/Athens': 'Greece',
  'Europe/Istanbul': 'Turkey',
  'Europe/Kiev': 'Ukraine',
  'Europe/Moscow': 'Russia',
  'America/Mexico_City': 'Mexico',
  'America/Argentina/Buenos_Aires': 'Argentina',
  'America/Santiago': 'Chile',
  'America/Bogota': 'Colombia',
  'America/Lima': 'Peru',
  'America/Caracas': 'Venezuela',
  'America/Havana': 'Cuba',
  'America/Guatemala': 'Guatemala',
  'America/Santo_Domingo': 'Dominican Republic',
  'America/Sao_Paulo': 'Brazil',
  'America/New_York': 'USA (East)',
  'America/Chicago': 'USA (Central)',
  'America/Denver': 'USA (Mountain)',
  'America/Los_Angeles': 'USA (West)',
  'America/Toronto': 'Canada',
  'America/Vancouver': 'Canada',
  'Asia/Tokyo': 'Japan',
  'Asia/Shanghai': 'China',
  'Asia/Seoul': 'South Korea',
  'Asia/Kolkata': 'India',
  'Asia/Manila': 'Philippines',
  'Australia/Sydney': 'Australia',
  'Pacific/Auckland': 'New Zealand',
  'Africa/Cairo': 'Egypt',
  'Africa/Johannesburg': 'South Africa',
}

/** País aproximado a partir dunha zona horaria IANA (función pura, probábel). */
export function countryFromTimezone(tz: string): string {
  if (!tz) return 'Unknown'
  const hit = TZ_COUNTRY[tz]
  if (hit) return hit
  // Fallback: primeiro segmento (continente/país) da zona
  const first = tz.split('/')[0]
  if (first === 'Europe') return 'Europe (other)'
  if (first === 'America') return 'Americas (other)'
  if (first === 'Asia') return 'Asia (other)'
  if (first === 'Australia') return 'Australia'
  if (first === 'Africa') return 'Africa (other)'
  return tz
}

export function currentTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'Unknown'
  } catch {
    return 'Unknown'
  }
}

/* ------------------------------------------------------------------ */
/* Núcleo                                                              */
/* ------------------------------------------------------------------ */

function defaults(): UsageStatsData {
  return {
    firstVisit: '',
    visits: 0,
    totalTimeMs: 0,
    lastBeat: Date.now(),
    sessionStart: Date.now(),
    languageChoices: { gl: 0, es: 0, en: 0 },
    browserLang: '',
    timezone: 'Unknown',
    countryGuess: 'Unknown',
    tabsVisited: {},
    optimizeCount: 0,
    tabTime: {},
    currentTab: null,
    currentTabStart: 0,
  }
}

function load(): UsageStatsData {
  const d = defaults()
  if (!storage) return d
  try {
    const raw = storage.getItem(KEY)
    if (raw) return { ...d, ...(JSON.parse(raw) as Partial<UsageStatsData>) }
  } catch {
    /* datos corruptos: empezar de cero */
  }
  return d
}

function save(d: UsageStatsData): void {
  if (!storage) return
  try {
    storage.setItem(KEY, JSON.stringify(d))
  } catch {
    /* almacenamento cheo/non dispoñible */
  }
}

/** Rexistra unha nova visita (chamar ao montar a aplicación). */
export function recordVisit(): void {
  const d = load()
  d.visits += 1
  if (!d.firstVisit) {
    d.firstVisit = new Date().toISOString()
    d.browserLang = typeof navigator !== 'undefined' ? navigator.language : ''
    d.timezone = currentTimezone()
    d.countryGuess = countryFromTimezone(d.timezone)
  }
  d.lastBeat = Date.now()
  d.sessionStart = Date.now()
  save(d)
}

/** Rexistra a elección de idioma da interface. */
export function recordLang(lang: Lang): void {
  const d = load()
  d.languageChoices[lang] = (d.languageChoices[lang] ?? 0) + 1
  save(d)
}

/** Rexistra a entrada nunha pestana e acumula o tempo da pestana anterior. */
export function recordTab(tab: string): void {
  const d = load()
  const now = Date.now()
  if (d.currentTab && d.currentTabStart > 0 && d.currentTab !== tab) {
    d.tabTime[d.currentTab] = (d.tabTime[d.currentTab] ?? 0) + (now - d.currentTabStart)
  }
  d.currentTab = tab
  d.currentTabStart = now
  d.tabsVisited[tab] = (d.tabsVisited[tab] ?? 0) + 1
  save(d)
}

/** Rexistra unha execución da optimización enerxética. */
export function recordOptimize(): void {
  const d = load()
  d.optimizeCount += 1
  save(d)
}

/** Duración media (s) por visita dunha pestana. */
export function avgTabTimeMs(tab: string): number {
  const d = load()
  const visits = d.tabsVisited[tab] ?? 0
  if (visits === 0) return 0
  return (d.tabTime[tab] ?? 0) / visits
}

/** Heartbeat: acumula o tempo de uso e o da pestana activa. */
export function heartbeat(): void {
  const d = load()
  const now = Date.now()
  if (d.lastBeat > 0 && now > d.lastBeat) {
    const delta = now - d.lastBeat
    d.totalTimeMs += delta
    if (d.currentTab) {
      d.tabTime[d.currentTab] = (d.tabTime[d.currentTab] ?? 0) + delta
    }
  }
  d.lastBeat = now
  save(d)
}

/** Tempo da sesión actual (dende o inicio da visita). */
export function sessionTimeMs(): number {
  const d = load()
  return Math.max(0, Date.now() - d.sessionStart)
}

export function getUsageStats(): UsageStatsData {
  return load()
}

/** Exporta as estatísticas como JSON. */
export function exportUsageStats(): string {
  const d = load()
  const out = {
    ...d,
    exportedAt: new Date().toISOString(),
    totalTimeHuman: formatDuration(d.totalTimeMs),
    sessionTimeHuman: formatDuration(Math.max(0, Date.now() - d.sessionStart)),
  }
  return JSON.stringify(out, null, 2)
}

export function downloadUsageStats(): void {
  if (typeof document === 'undefined') return
  const blob = new Blob([exportUsageStats()], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `distilsim-usage-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

/** Borra os datos de uso (decisión do usuario). */
export function resetUsageStats(): void {
  if (!storage) return
  try {
    storage.removeItem(KEY)
  } catch {
    /* ignorar */
  }
}

/** Formato h:mm:ss (función pura, probábel). */
export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(sec).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`
}

export { HEARTBEAT_MS }
