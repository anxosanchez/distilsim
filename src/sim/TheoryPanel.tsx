/**
 * Vista Teoría: renderiza docs/teoria-destilacion.md con KaTeX (ecuaciones)
 * y Mermaid (diagramas de flujo y arquitectura del gemelo digital).
 */

import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import theoryMd from '../../docs/teoria-destilacion.md?raw'

export function TheoryPanel() {
  const [mermaidOk, setMermaidOk] = useState(false)

  useEffect(() => {
    let cancelled = false
    import('mermaid').then(async (mod) => {
      if (cancelled) return
      const mermaid = mod.default
      mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'loose' })
      // Renderizar bloques ```mermaid que produjo react-markdown
      const blocks = Array.from(document.querySelectorAll('.theory pre code.language-mermaid'))
      for (const el of blocks) {
        try {
          const id = 'mmd-' + Math.random().toString(36).slice(2, 10)
          const { svg } = await mermaid.render(id, el.textContent ?? '')
          const pre = el.closest('pre')
          if (pre) {
            const wrap = document.createElement('div')
            wrap.innerHTML = svg
            pre.replaceWith(wrap)
          }
        } catch (e) {
          console.warn('Mermaid render falló:', e)
        }
      }
      if (!cancelled) setMermaidOk(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="theory">
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          code({ inline, children, className, ...props }: any) {
            const lang = /language-(\w+)/.exec(className ?? '')?.[1]
            if (lang === 'mermaid') {
              // Mermaid se procesa en el efecto; aquí solo el código fuente
              return (
                <pre>
                  <code className={className} {...props}>
                    {children}
                  </code>
                </pre>
              )
            }
            return inline ? (
              <code className={className} {...props}>{children}</code>
            ) : (
              <pre>
                <code className={className} {...props}>{children}</code>
              </pre>
            )
          },
        }}
      >
        {theoryMd}
      </ReactMarkdown>
      {!mermaidOk && (
        <p style={{ color: 'var(--text-dim)', fontSize: 12 }}>
          Diagramas de flujo (Mermaid) cargando…
        </p>
      )}
    </div>
  )
}
