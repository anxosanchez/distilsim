/**
 * Panel Evaluación: quiz interactivo (corrección automática) e informe de la
 * sesión del alumno con rúbrica (misión de purezas + uso de control + quiz).
 */

import { useState } from 'react'
import {
  QUIZ_QUESTIONS,
  evaluateQuiz,
  assessSession,
  DEFAULT_MISSION,
  type AssessmentReport,
} from '../core/assessment'
import { sessionLog } from '../core/session'
import { UsageStatsPanel } from './UsageStatsPanel'
import { useI18n } from '../i18n'

export function AssessmentPanel() {
  const { t } = useI18n()
  const [answers, setAnswers] = useState<(number | undefined)[]>(
    QUIZ_QUESTIONS.map(() => undefined),
  )
  const [submitted, setSubmitted] = useState(false)
  const [report, setReport] = useState<AssessmentReport | null>(null)

  const result = submitted ? evaluateQuiz(answers) : null

  const handleSubmit = () => {
    const r = evaluateQuiz(answers)
    setSubmitted(true)
    sessionLog.log(
      'note',
      t('quiz.quiz'),
      { score: r.score, correctCount: r.correctCount, total: r.total, quiz: true },
      sessionLog.events.length > 0 ? sessionLog.events[sessionLog.events.length - 1].simTime : 0,
    )
  }

  const handleReport = () => {
    const rep = assessSession(sessionLog)
    setReport(rep)
  }

  const pct = (v: number): string => `${Math.round(v)} s`

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 14, alignItems: 'start' }}>
      {/* Cuestionario */}
      <div className="panel">
        <h3>{t('eval.titulo', { n: QUIZ_QUESTIONS.length })}</h3>
        {QUIZ_QUESTIONS.map((q, qi) => (
          <div key={q.id} style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
            <p style={{ margin: '0 0 8px', fontWeight: 500 }}>{qi + 1}. {t(q.question)}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {q.options.map((opt, oi) => {
                const isSelected = answers[qi] === oi
                const showCorrect = submitted && oi === q.correct
                const showWrong = submitted && isSelected && oi !== q.correct
                return (
                  <label
                    key={oi}
                    style={{
                      display: 'flex',
                      gap: 8,
                      alignItems: 'center',
                      padding: '5px 8px',
                      borderRadius: 6,
                      border: '1px solid var(--border)',
                      cursor: 'pointer',
                      background: showCorrect
                        ? '#122a1a'
                        : showWrong
                          ? '#3a1212'
                          : 'var(--bg-panel-2)',
                      borderColor: showCorrect
                        ? 'var(--accent-2)'
                        : showWrong
                          ? 'var(--danger)'
                          : 'var(--border)',
                    }}
                  >
                    <input
                      type="radio"
                      name={q.id}
                      checked={isSelected}
                      disabled={submitted}
                      onChange={() => {
                        const next = answers.slice()
                        next[qi] = oi
                        setAnswers(next)
                      }}
                    />
                    <span style={{ fontSize: 13 }}>{t(opt)}</span>
                  </label>
                )
              })}
            </div>
            {submitted && (
              <p style={{ fontSize: 12, margin: '6px 0 0', color: answers[qi] === q.correct ? 'var(--accent-2)' : 'var(--danger)' }}>
                {answers[qi] === q.correct ? t('eval.correcto') : t('eval.incorrecto')} — {t(q.explanation)}
              </p>
            )}
          </div>
        ))}
        <div className="row">
          <button className="btn primary" onClick={handleSubmit} disabled={submitted || answers.some((a) => a === undefined)}>
            {t('eval.corrixir')}
          </button>
          <button
            className="btn"
            onClick={() => {
              setAnswers(QUIZ_QUESTIONS.map(() => undefined))
              setSubmitted(false)
            }}
          >
            {t('eval.tentarDeNovo')}
          </button>
        </div>
        {result && (
          <div className="instruments" style={{ marginTop: 12 }}>
            <div className="instrument">
              <div className="k">{t('eval.nota')}</div>
              <div className="v">{result.score.toFixed(1)} / 10</div>
            </div>
            <div className="instrument">
              <div className="k">{t('eval.acertos')}</div>
              <div className="v">{result.correctCount} / {result.total}</div>
            </div>
          </div>
        )}
      </div>

      {/* Informe de sesión */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="panel">
          <h3>{t('eval.informe')}</h3>
          <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '0 0 8px' }}>
            {t('eval.informeDesc1', { mission: t(DEFAULT_MISSION.label) })} {t('eval.informeDesc2')} {t('eval.informeDesc3')}
          </p>
          <button className="btn primary" onClick={handleReport} style={{ width: '100%' }}>
            {t('eval.xerar')}
          </button>
          <button
            className="btn"
            onClick={() => {
              const { nEvents } = sessionLog.summary()
              sessionLog.download()
              console.log(`Sesión exportada: ${nEvents} eventos.`)
            }}
            style={{ width: '100%', marginTop: 8 }}
          >
            {t('eval.exportar')}
          </button>
        </div>

        {report && (
          <div className="panel">
            <h3>{t('eval.resultado')}</h3>
            <div className="instruments">
              <div className="instrument">
                <div className="k">{t('eval.notaTotal')}</div>
                <div className={`v ${report.totalScore >= 15 ? 'good' : report.totalScore >= 10 ? '' : 'bad'}`}>
                  {report.totalScore} / 20
                </div>
              </div>
              <div className="instrument">
                <div className="k">{t('eval.eficiencia')}</div>
                <div className="v">{report.efficiencyScore} / 10</div>
              </div>
              <div className="instrument">
                <div className="k">{t('eval.controlAutomatico')}</div>
                <div className="v">{report.controlBonus} / 2</div>
              </div>
              <div className="instrument">
                <div className="k">{t('eval.cuestionario')}</div>
                <div className="v">{report.quizScore !== undefined ? `${report.quizScore} / 10` : '—'}</div>
              </div>
              <div className="instrument">
                <div className="k">{t('eval.eventosDuracion')}</div>
                <div className="v">{report.nEvents} · {pct(report.durationRealS)}</div>
              </div>
              <div className="instrument">
                <div className="k">{t('eval.mision')}</div>
                <div className={`v ${report.achieved ? 'good' : 'bad'}`}>
                  {report.achieved ? t('eval.misionLograda') : t('eval.nonLograda')}
                </div>
              </div>
            </div>
            <ul style={{ fontSize: 12, color: 'var(--text-dim)', paddingLeft: 18, marginBottom: 0 }}>
              {report.feedback.map((f, i) => (
                <li key={i} style={{ marginBottom: 4 }}>{f}</li>
              ))}
            </ul>
          </div>
        )}

        <UsageStatsPanel />
      </div>
    </div>
  )
}
