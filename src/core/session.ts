/**
 * Registro de sesión de alumnos (auditoría didáctica).
 *
 * Cada acción relevante del operador (cambios de consigna, escenarios,
 * perturbaciones, control, importación/exportación) se registra con su
 * instante real, tiempo de simulación y detalles. La sesión completa se
 * exporta como JSON para su evaluación.
 */

export type SessionEventKind =
  | 'input'
  | 'scenario'
  | 'control'
  | 'disturbance'
  | 'identify'
  | 'import'
  | 'export'
  | 'note'

export interface SessionEvent {
  /** Instante real (ISO) */
  at: string
  /** Tiempo de simulación (h) en el momento del evento */
  simTime: number
  kind: SessionEventKind
  label: string
  detail: Record<string, unknown>
  /** Estado de la columna en el momento del evento (para evaluación) */
  state?: { xD: number; xB: number; QR: number }
}

export interface SessionFile {
  app: 'destilador-digital-twin'
  version: 1
  startedAt: string
  endedAt: string
  events: SessionEvent[]
}

export class SessionLog {
  startedAt = new Date().toISOString()
  events: SessionEvent[] = []

  log(
    kind: SessionEventKind,
    label: string,
    detail: Record<string, unknown> = {},
    simTime = 0,
  ): void {
    this.events.push({ at: new Date().toISOString(), simTime, kind, label, detail })
  }

  /** Registra un evento capturando además el estado de la columna (para rúbricas). */
  logState(
    kind: SessionEventKind,
    label: string,
    state: { xD: number; xB: number; QR: number },
    detail: Record<string, unknown> = {},
    simTime = 0,
  ): void {
    this.events.push({
      at: new Date().toISOString(),
      simTime,
      kind,
      label,
      detail,
      state,
    })
  }

  clear(): void {
    this.events = []
    this.startedAt = new Date().toISOString()
  }

  summary(): { nEvents: number; durationRealS: number; byKind: Record<string, number> } {
    const byKind: Record<string, number> = {}
    for (const e of this.events) byKind[e.kind] = (byKind[e.kind] ?? 0) + 1
    const durationRealS =
      (Date.now() - new Date(this.startedAt).getTime()) / 1000
    return { nEvents: this.events.length, durationRealS, byKind }
  }

  toJSON(): string {
    const file: SessionFile = {
      app: 'destilador-digital-twin',
      version: 1,
      startedAt: this.startedAt,
      endedAt: new Date().toISOString(),
      events: this.events,
    }
    return JSON.stringify(file, null, 2)
  }

  /** Descarga la sesión como archivo JSON. */
  download(filename = `sesion-destilador-${Date.now()}.json`): void {
    if (typeof document === 'undefined') return // SSR
    const blob = new Blob([this.toJSON()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }
}

/** Sesión compartida por todos los paneles de la app. */
export const sessionLog = new SessionLog()
