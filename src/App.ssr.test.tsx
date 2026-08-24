/**
 * Smoke test de render: monta a app completa (SSR) e verifica que a árbore
 * de compoñentes se renderiza sen erros e produce contido esperado.
 * Os hooks de efectos (rAF, mermaid) non corren en SSR: valida o render
 * puro de Simulador, Xemelgo dixital e Teoría (idioma galego).
 */

import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { createElement } from 'react'
import App from './App'
import { Simulator } from './sim/Simulator'
import { TwinPanel } from './sim/TwinPanel'
import { TheoryPanel } from './sim/TheoryPanel'
import { AssessmentPanel } from './sim/AssessmentPanel'
import { McKabeThieleChart } from './sim/charts'
import { sistemaEtanolAgua } from './core/components'
import { setGlobalLang } from './i18n'

describe('Render da UI (SSR)', () => {
  it('App completa renderiza coas catro pestanas e exportar sesión', () => {
    const html = renderToString(createElement(App))
    expect(html).toContain('Simulador')
    expect(html).toContain('Xemelgo dixital')
    expect(html).toContain('Teoría')
    expect(html).toContain('Avaliación')
    expect(html).toContain('Columna 3D')
    expect(html).toContain('Exportar sesión')
    // O panel Simulador (pestana activa) debe estar presente
    expect(html).toContain('Destilado x_D')
    expect(html).toContain('Refervedor')
    // O selector de idioma (modal) renderízase no primeiro acceso
    expect(html).toContain('Escolle o idioma da aplicación')
  })

  it('Simulador renderiza controis, PID, esquemas, optimización, escenarios e instrumentos', () => {
    const html = renderToString(createElement(Simulator))
    expect(html).toContain('Variables de operación')
    expect(html).toContain('Refluxo R')
    expect(html).toContain('Estado estacionario')
    expect(html).toContain('Control de temperatura')
    expect(html).toContain('Esquema de control')
    expect(html).toContain('D/V')
    expect(html).toContain('Optimización enerxética')
    expect(html).toContain('Optimizar enerxía')
    expect(html).toContain('Modo de refluxo do condensador')
    expect(html).toContain('Sen refluxo')
    expect(html).toContain('Total')
    expect(html).toContain('Perfil por prato')
    expect(html).toContain('Escenarios didácticos')
    expect(html).toContain('Perda de calefacción')
    expect(html).toContain('Exportar JSON')
    expect(html).toContain('Cuestións para pensar')
  })

  it('TwinPanel renderiza controis, identificación e diagnóstico', () => {
    const html = renderToString(createElement(TwinPanel))
    expect(html).toContain('Perturbacións')
    expect(html).toContain('Perda de vapor')
    expect(html).toContain('Identificación do modelo')
    expect(html).toContain('Sincronizar modelo')
    expect(html).toContain('minimizar o residuo')
  })

  it('AssessmentPanel renderiza o cuestionario e o informe', () => {
    const html = renderToString(createElement(AssessmentPanel))
    expect(html).toContain('Cuestionario de destilación')
    expect(html).toContain('Informe da sesión')
    expect(html).toContain('Xerar informe')
    expect(html).toContain('Corrixir cuestionario')
    expect(html).toContain('Estatísticas de uso')
    expect(html).toContain('Duración por pestana')
  })

  it('Teoría renderiza o markdown con ecuacións KaTeX', () => {
    const html = renderToString(createElement(TheoryPanel))
    expect(html).toContain('Fundamentos Teóricos da Destilación')
    expect(html).toContain('McCabe')
  })

  it('McCabe–Thiele con sistema non ideal (etanol–auga) xera escalonado', () => {
    const html = renderToString(
      createElement(McKabeThieleChart, {
        system: sistemaEtanolAgua,
        P: 760,
        xD: 0.8,
        xB: 0.05,
        zF: 0.3,
        q: 1,
        R: 2,
      }),
    )
    // Nota do gráfico (dicionario gl): etapas teóricas e reflujo mínimo
    expect(html).toContain('etapas (incl. refervedor)')
    expect(html).toContain('R_min =')
  })

  it('o mesmo simulador renderiza en español e inglés (trilingüe)', () => {
    setGlobalLang('es')
    let html = renderToString(createElement(Simulator))
    expect(html).toContain('Variables de operación')
    expect(html).toContain('Reflujo R')
    expect(html).toContain('Escenarios didácticos')

    setGlobalLang('en')
    html = renderToString(createElement(Simulator))
    expect(html).toContain('Operation variables')
    expect(html).toContain('Reflux ratio R')
    expect(html).toContain('Teaching scenarios')
    expect(html).toContain('Tray column')

    setGlobalLang('gl') // restaurar por defecto
  })
})
