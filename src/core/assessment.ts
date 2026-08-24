/**
 * Evaluación automática: banco de preguntas (quiz) y rúbrica de sesión.
 *
 * - El quiz corrige al instante, puntúa y registra el resultado en la sesión.
 * - La rúbrica analiza los eventos registrados (con estado xD/xB/QR) frente a
 *   una "misión" (objetivos de pureza) y puntúa la eficiencia del alumno.
 */

import type { SessionLog } from './session'
import { tGlobal } from '../i18n'

/* ------------------------------------------------------------------ */
/* Quiz                                                                */
/* ------------------------------------------------------------------ */

export interface QuizQuestion {
  id: string
  question: string
  options: string[]
  correct: number // índice de la opción correcta
  explanation: string
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 'q1',
    question:
      'quiz.q1',
    options: [
      'quiz.q1o1',
      'quiz.q1o2',
      'quiz.q1o3',
      'quiz.q1o4',
    ],
    correct: 1,
    explanation:
      'quiz.q1e',
  },
  {
    id: 'q2',
    question:
      'quiz.q2',
    options: [
      'quiz.q2o1',
      'quiz.q2o2',
      'quiz.q2o3',
      'quiz.q2o4',
    ],
    correct: 1,
    explanation:
      'quiz.q2e',
  },
  {
    id: 'q3',
    question: 'quiz.q3',
    options: [
      'quiz.q3o1',
      'quiz.q3o2',
      'quiz.q3o3',
      'quiz.q3o4',
    ],
    correct: 1,
    explanation:
      'quiz.q3e',
  },
  {
    id: 'q4',
    question: 'quiz.q4',
    options: [
      'quiz.q4o1',
      'quiz.q4o2',
      'quiz.q4o3',
      'quiz.q4o4',
    ],
    correct: 1,
    explanation:
      'quiz.q4e',
  },
  {
    id: 'q5',
    question: 'quiz.q5',
    options: [
      'quiz.q5o1',
      'quiz.q5o2',
      'quiz.q5o3',
      'quiz.q5o4',
    ],
    correct: 1,
    explanation:
      'quiz.q5e',
  },
  {
    id: 'q6',
    question: 'quiz.q6',
    options: [
      'quiz.q6o1',
      'quiz.q6o2',
      'quiz.q6o3',
      'quiz.q6o4',
    ],
    correct: 1,
    explanation:
      'quiz.q6e',
  },
]

export interface QuizResult {
  score: number // 0..10
  correctCount: number
  total: number
  answers: boolean[]
}

export function evaluateQuiz(answers: (number | undefined)[]): QuizResult {
  const correctCount = QUIZ_QUESTIONS.reduce(
    (acc, q, i) => acc + (answers[i] === q.correct ? 1 : 0),
    0,
  )
  return {
    score: Math.round((correctCount / QUIZ_QUESTIONS.length) * 100) / 10,
    correctCount,
    total: QUIZ_QUESTIONS.length,
    answers: QUIZ_QUESTIONS.map((q, i) => answers[i] === q.correct),
  }
}

/* ------------------------------------------------------------------ */
/* Rúbrica de sesión                                                   */
/* ------------------------------------------------------------------ */

export interface MissionSpec {
  label: string
  /** Pureza mínima del destilado (componente más volátil) */
  xDmin: number
  /** Impureza máxima en fondos (componente más volátil) */
  xBmax: number
}

export const DEFAULT_MISSION: MissionSpec = {
  label: 'fb.misionDefault',
  xDmin: 0.95,
  xBmax: 0.05,
}

export interface AssessmentReport {
  mission: MissionSpec
  /** ¿Alcanzó la misión en algún momento de la sesión? */
  achieved: boolean
  /** Primer evento (índice) en el que se cumple la misión */
  achievedAtEvent?: number
  /** Cambios de consigna (input) hasta lograrlo */
  inputsToAchieve?: number
  /** Puntuación de eficiencia (0–10) */
  efficiencyScore: number
  /** Bonus por usar control automático (0–2) */
  controlBonus: number
  /** Puntuación del quiz (0–10) si se registró */
  quizScore: number | undefined
  /** Puntuación total (0–20) */
  totalScore: number
  nEvents: number
  durationRealS: number
  byKind: Record<string, number>
  feedback: string[]
}

function meetsMission(e: { state?: { xD: number; xB: number } }, m: MissionSpec): boolean {
  if (!e.state) return false
  return e.state.xD >= m.xDmin && e.state.xB <= m.xBmax
}

/** Analiza una sesión contra la misión y devuelve el informe. */
export function assessSession(log: SessionLog, mission: MissionSpec = DEFAULT_MISSION): AssessmentReport {
  const events = log.events
  const summary = log.summary()

  // Primer evento que cumple la misión
  let achieved = false
  let achievedAtEvent: number | undefined
  for (let i = 0; i < events.length; i++) {
    if (meetsMission(events[i], mission)) {
      achieved = true
      achievedAtEvent = i
      break
    }
  }

  // Eficiencia: nº de cambios de consigna hasta lograrlo
  let inputsToAchieve: number | undefined
  if (achievedAtEvent !== undefined) {
    inputsToAchieve = 0
    for (let i = 0; i <= achievedAtEvent; i++) {
      if (events[i].kind === 'input' || events[i].kind === 'scenario') inputsToAchieve++
    }
  }

  let efficiencyScore = 0
  if (achieved) {
    const n = inputsToAchieve ?? 99
    if (n <= 3) efficiencyScore = 10
    else if (n <= 6) efficiencyScore = 7
    else if (n <= 10) efficiencyScore = 4
    else efficiencyScore = 2
  }

  // Bonus por usar el control automático en algún momento
  const controlBonus = events.some((e) => e.kind === 'control' && String(e.detail.scheme ?? '') !== '')
    ? 2
    : 0

  // Quiz (si se registró)
  const quizEvent = [...events].reverse().find((e) => e.kind === 'note' && e.detail.quiz === true)
  const quizScore = quizEvent
    ? (quizEvent.detail.score as number | undefined)
    : undefined

  const totalScore = Math.min(20, efficiencyScore + controlBonus + (quizScore ?? 0))

  const feedback: string[] = []
  if (!achieved) {
    feedback.push(
      tGlobal('fb.nonAlcanzou', { mision: tGlobal(mission.label) }),
    )
  } else {
    feedback.push(
      tGlobal('fb.lograda', { n: inputsToAchieve ?? 0, ef: efficiencyScore }),
    )
  }
  if (controlBonus > 0) feedback.push(tGlobal('fb.controlBonus'))
  else feedback.push(tGlobal('fb.senControl'))
  if (quizScore !== undefined) feedback.push(`Quiz: ${quizScore}/10.`)
  else feedback.push(tGlobal('fb.faiQuiz'))
  if (totalScore >= 15) feedback.push(tGlobal('fb.excelente'))
  else if (totalScore >= 10) feedback.push(tGlobal('fb.boTraballo'))

  return {
    mission,
    achieved,
    achievedAtEvent,
    inputsToAchieve,
    efficiencyScore,
    controlBonus,
    quizScore,
    totalScore,
    nEvents: summary.nEvents,
    durationRealS: summary.durationRealS,
    byKind: summary.byKind,
    feedback,
  }
}
