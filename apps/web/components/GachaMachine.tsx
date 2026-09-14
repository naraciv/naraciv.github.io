'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Brain, CircleCheck, Dices, Hourglass } from 'lucide-react'
import { Stars } from '@/components/Stars'
import {
  QUIZ_MAX_PER_DAY,
  RARITY,
  canPullToday,
  fetchNarans,
  fetchQuestion,
  fetchState,
  getNextQuizDifficulty,
  getQuizCountToday,
  getSkinUrl,
  hasEverPulled,
  hasUsedQuizToday,
  markQuizFailed,
  markQuizUsed,
  pull,
  quizFailedToday,
  resetPullTimer,
  submitAnswer,
  timeUntilMidnight,
  type Collection,
  type Naran,
  type QuizQuestion,
} from '@/lib/gacha'

/**
 * The hero gacha machine.
 *
 *  - The quiz question is fetched only when the quiz is actually shown.
 *  - The machine renders immediately from local state and reconciles when
 *    /state answers: /state is no-store, so waiting on it would put a round
 *    trip to the origin in front of first paint.
 */

const quizInput =
  'w-full rounded-lg border-2 border-white/10 bg-[#1a1a2e] p-3 font-semibold text-[#c8cad0] placeholder:text-[#8b95a8]'

const BALL_COLORS = [
  '#FF6B35',
  '#E040FB',
  '#00BCD4',
  '#78909C',
  '#FF6B6B',
  '#4FC3F7',
  '#F7C948',
  '#E040FB',
  '#00BCD4',
  '#78909C',
  '#FF4081',
  '#00BCD4',
  '#E040FB',
  '#66BB6A',
  '#FF6B35',
]

const DIFFICULTY_BADGE: Record<string, { bg: string; color: string }> = {
  easy: { bg: '#E8F5E9', color: '#2E7D32' },
  medium: { bg: '#FFF3E0', color: '#B45309' },
  hard: { bg: '#FFEBEE', color: '#C62828' },
}

export function GachaMachine() {
  const [narans, setNarans] = useState<Naran[]>([])
  const [collection, setCollection] = useState<Collection>({})
  const [lastPull, setLastPull] = useState('')
  const [ready, setReady] = useState(false)
  const [pulling, setPulling] = useState(false)
  const [leverPulled, setLeverPulled] = useState(false)
  const [shaking, setShaking] = useState(false)
  const [countdown, setCountdown] = useState(timeUntilMidnight)
  const [reveal, setReveal] = useState<Naran | null>(null)
  const [revealCount, setRevealCount] = useState(1)
  /* Generated with the pull, not during render — a render must be pure. */
  const [burst, setBurst] = useState<{ bx: string; by: string; delay: string }[]>([])
  const [pullError, setPullError] = useState('')
  const closeButton = useRef<HTMLButtonElement>(null)

  const canPull = ready && canPullToday(lastPull)
  const collected = Object.keys(collection).length

  useEffect(() => {
    let alive = true
    Promise.all([fetchNarans(), fetchState()]).then(([roster, state]) => {
      if (!alive) return
      setNarans(roster)
      setCollection(state.collection)
      setLastPull(state.lastPull)
      setReady(true)
    })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    const id = setInterval(() => setCountdown(timeUntilMidnight()), 1000)
    return () => clearInterval(id)
  }, [])

  const doPull = useCallback(() => {
    if (pulling || !canPull) return
    setPulling(true)
    setPullError('')
    setLeverPulled(true)
    setShaking(true)

    setTimeout(async () => {
      setLeverPulled(false)
      setShaking(false)
      try {
        const data = await pull()
        setBurst(
          Array.from({ length: 20 }, (_, i) => {
            const angle = (Math.PI * 2 * i) / 20
            const dist = 80 + Math.random() * 120
            return {
              bx: `${Math.cos(angle) * dist}px`,
              by: `${Math.sin(angle) * dist}px`,
              delay: `${Math.random() * 0.3}s`,
            }
          }),
        )
        setCollection(data.collection)
        setLastPull(new Date().toISOString().slice(0, 10))
        setRevealCount(data.collection[data.pick.id]?.count ?? 1)
        setReveal(data.pick)
      } catch (err) {
        setPullError((err as { error?: string })?.error || 'Failed to pull')
      } finally {
        setPulling(false)
      }
    }, 1200)
  }, [canPull, pulling])

  /* Lock scroll and move focus while the reveal is open. */
  useEffect(() => {
    if (!reveal) return
    document.body.style.overflow = 'hidden'
    closeButton.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setReveal(null)
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', onKey)
    }
  }, [reveal])

  const rarity = reveal ? RARITY[reveal.rarity] : null
  const showQuiz = ready && !canPull && hasEverPulled(collection)

  return (
    <>
      <header className="hero-gacha">
        <h1 className="z-10 mb-2 font-display text-7xl font-bold text-[#f8fafc] md:text-8xl">
          NARA<span className="sr-only">, a Japanese-themed nation on CivMC</span>
        </h1>
        <p className="text-gacha z-10 mb-2 text-xl font-bold tracking-widest md:text-2xl">
          COLLECT-A-NARAN
        </p>
        <p className="z-10 mb-8 text-center text-ink-hero">
          Pull the lever once per day to unlock a Naran citizen!
        </p>

        {!canPull && ready && (
          <div
            className="z-10 mb-6 font-countdown text-[1.1rem] font-semibold text-orange"
            role="status"
          >
            Next free pull in <span>{countdown}</span>
          </div>
        )}

        <div className="gacha-machine z-10">
          <div className="machine-sparkles" aria-hidden>
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>

          <div
            className={`absolute inset-0 overflow-hidden rounded-[30px_30px_16px_16px] border-3 border-purple/40 bg-linear-180/srgb from-[#141425] to-[#0f0f1e] shadow-[0_8px_40px_rgba(224,64,251,0.15),0_0_0_1px_rgba(255,255,255,0.04)] ${shaking ? 'machine-shaking' : ''}`}
          >
            <div className="gacha-dome">
              <div
                className="absolute inset-x-0 bottom-0 flex h-[55%] flex-wrap items-end justify-center gap-1 p-2"
                aria-hidden
              >
                {BALL_COLORS.map((color, i) => (
                  <div
                    key={i}
                    className="gacha-ball"
                    style={{
                      background: `radial-gradient(circle at 35% 35%, ${color}, ${color}88)`,
                      animationDelay: `${(i * 0.2) % 3}s`,
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="absolute inset-x-0 bottom-30 text-center">
              <span className="text-gacha text-lg font-bold tracking-widest">NARAN GACHA</span>
            </div>

            <div className="absolute bottom-15 left-1/2 h-[50px] w-20 -translate-x-1/2 rounded-b-[40px] border-2 border-t-0 border-purple/30 bg-[#1a1a2e]" />

            <div className="absolute inset-x-0 bottom-5 text-center">
              <span className="text-sm text-ink-2">
                {collected} / {narans.length} collected
              </span>
            </div>
          </div>

          <button
            type="button"
            className={`gacha-lever-wrap ${leverPulled ? 'pulled' : ''}`}
            onClick={doPull}
            disabled={!canPull}
            aria-label="Pull the lever"
          >
            <div className="relative mx-auto h-[100px] w-3 rounded-md bg-linear-180/srgb from-[#b0bec5] to-[#90a4ae]">
              <div className="gacha-lever-handle" />
            </div>
          </button>
        </div>

        <button
          type="button"
          className="gacha-pull-btn z-10 mt-8 inline-flex items-center gap-2"
          onClick={doPull}
          disabled={!canPull || pulling}
        >
          {canPull ? (
            <>
              <Dices aria-hidden className="size-5" /> Pull Gacha!
            </>
          ) : (
            <>
              <Hourglass aria-hidden className="size-5" /> Come Back Tomorrow
            </>
          )}
        </button>

        {pullError && (
          <p role="alert" className="z-10 mt-4 text-[#FF6B6B]">
            {pullError}
          </p>
        )}
      </header>

      {reveal && rarity && (
        <div
          className="fixed inset-0 z-9999 flex flex-col items-center justify-center bg-[rgba(10,10,20,0.95)]"
          onClick={(e) => e.target === e.currentTarget && setReveal(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`You pulled ${reveal.name}`}
        >
          <div className="burst-particles" aria-hidden>
            {burst.map((particle, i) => (
              <span
                key={i}
                style={
                  {
                    background: rarity.color,
                    left: '50%',
                    top: '50%',
                    animationDelay: particle.delay,
                    '--bx': particle.bx,
                    '--by': particle.by,
                  } as React.CSSProperties
                }
              />
            ))}
          </div>

          <div
            className="gacha-reveal-card"
            style={{
              borderColor: rarity.color,
              boxShadow: `0 0 40px ${rarity.glow}, 0 0 80px ${rarity.glow}`,
            }}
          >
            <Stars rarity={reveal.rarity} className="flex text-2xl" />
            {/* eslint-disable-next-line @next/next/no-img-element -- external skin renderer, not a known-size asset */}
            <img
              className="mx-auto mb-3 h-auto w-[150px] [image-rendering:pixelated]"
              src={getSkinUrl(reveal.name)}
              alt={reveal.name}
            />
            <div className="mt-2 mb-1 text-2xl font-black" style={{ color: rarity.color }}>
              {reveal.name}
            </div>
            <div className="text-[0.95rem] opacity-70">{reveal.title}</div>
            <div className="mt-3 text-[0.85rem] leading-normal opacity-60">
              {reveal.description}
            </div>
            <div className="mt-4 text-xs opacity-40">
              {revealCount > 1 ? `Duplicate! (×${revealCount})` : 'NEW!'}
            </div>
            <button
              ref={closeButton}
              type="button"
              onClick={() => setReveal(null)}
              className="mt-5 cursor-pointer rounded-3xl border-0 bg-gradient-to-br from-purple to-orange px-8 py-2 font-semibold text-white"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {showQuiz && <Quiz onTimerReset={() => setLastPull('')} />}
    </>
  )
}

function Quiz({ onTimerReset }: { onTimerReset: () => void }) {
  const [init, setInit] = useState<{
    question: QuizQuestion | null
    difficulty: string
    exhausted: boolean
    loaded: boolean
  }>({ question: null, difficulty: 'easy', exhausted: false, loaded: false })
  const [selected, setSelected] = useState<string | boolean | null>(null)
  const [text, setText] = useState('')
  const [result, setResult] = useState<{ correct: boolean; message: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [validation, setValidation] = useState('')
  const [attempts, setAttempts] = useState(0)

  useEffect(() => {
    const count = getQuizCountToday()
    const done = quizFailedToday() || hasUsedQuizToday()
    const difficulty = getNextQuizDifficulty()
    /* One update, from the async chain — localStorage cannot be read during
       render, and a synchronous setState here would cascade. */
    const load = done ? Promise.resolve(null) : fetchQuestion(difficulty)
    load.then((question) => {
      setAttempts(count)
      setInit({ question, difficulty, exhausted: done, loaded: true })
    })
  }, [])

  const { question, difficulty, exhausted, loaded } = init

  const answered = result !== null

  async function onSubmit() {
    if (!question || answered) return

    let answer: unknown = selected
    if (question.type === 'short_answer' || question.type === 'date') answer = text.trim()

    if (answer === null || answer === '') {
      setValidation(
        question.type === 'true_false'
          ? 'Please select True or False!'
          : question.type === 'date'
            ? 'Please enter a date!'
            : question.type === 'short_answer'
              ? 'Please type your answer!'
              : 'Please select an answer!',
      )
      return
    }

    setValidation('')
    setSubmitting(true)
    try {
      const data = await submitAnswer(question.id, answer)
      markQuizUsed()
      setAttempts(getQuizCountToday())
      if (data.correct) {
        resetPullTimer()
        onTimerReset()
        setResult({
          correct: true,
          message: `Correct! ${data.explanation} Your timer has been reset!`,
        })
      } else {
        markQuizFailed()
        setResult({ correct: false, message: `Sorry! ${data.explanation} Try again tomorrow.` })
      }
    } catch {
      setValidation('Server error. Please try again later.')
    } finally {
      setSubmitting(false)
    }
  }

  /* The whole section hides when the backend has no question to give. */
  if (!loaded || (!question && !exhausted)) return null

  const badge = DIFFICULTY_BADGE[difficulty] ?? DIFFICULTY_BADGE.easy

  return (
    <section className="gacha-section px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <div className="gacha-banner" style={{ border: '2px solid rgba(0,188,212,0.3)' }}>
          <h2 className="relative z-10 mb-2 flex items-center justify-center gap-2 text-2xl font-bold">
            <Brain aria-hidden className="size-6 text-cyan" />
            <span className="text-gacha">Nara Quiz: Earn an Extra Pull!</span>
          </h2>
          <p className="relative z-10 mb-2 text-ink-hero">
            Answer correctly to reset your pull timer.
          </p>
          <p className="relative z-10 mb-4 text-sm text-ink-2">
            Attempts today: {attempts} / {QUIZ_MAX_PER_DAY}
          </p>

          {exhausted ? (
            <p className="relative z-10 flex items-center justify-center gap-2 text-ink-hero">
              <CircleCheck aria-hidden className="size-5 shrink-0 text-green" /> You&rsquo;ve used
              all {QUIZ_MAX_PER_DAY} quiz attempts today. Come back tomorrow!
            </p>
          ) : (
            question && (
              <div
                className="relative z-10 text-left"
                style={
                  answered
                    ? { opacity: 0.45, pointerEvents: 'none', filter: 'grayscale(0.5)' }
                    : undefined
                }
              >
                <div
                  className="relative z-10 mb-4 inline-block rounded-full px-4 py-1 text-[0.85rem] font-bold tracking-wider uppercase"
                  style={{
                    background: badge.bg,
                    color: badge.color,
                    border: `2px solid ${badge.color}`,
                  }}
                >
                  {difficulty}
                </div>

                <div className="mb-4 text-lg font-bold text-[#e2e4e8]">{question.question}</div>

                {(question.type === 'multiple_choice' || question.type === 'true_false') && (
                  <div className="mb-4 space-y-3">
                    {(question.type === 'true_false'
                      ? ['True', 'False']
                      : (question.options ?? [])
                    ).map((opt) => {
                      const value = question.type === 'true_false' ? opt === 'True' : opt
                      return (
                        <button
                          key={opt}
                          type="button"
                          aria-pressed={selected === value}
                          onClick={() => setSelected(value)}
                          className="block w-full cursor-pointer rounded-lg border-2 border-white/10 bg-[#1a1a2e] p-3 text-left font-semibold text-[#c8cad0] transition-all duration-200 hover:border-purple aria-pressed:border-purple aria-pressed:bg-purple/18 aria-pressed:text-[#f3e5f5]"
                        >
                          {opt}
                        </button>
                      )
                    })}
                  </div>
                )}

                {question.type === 'short_answer' && (
                  <div className="mb-4">
                    <label className="sr-only" htmlFor="quiz-answer">
                      Your answer
                    </label>
                    <input
                      id="quiz-answer"
                      className={quizInput}
                      placeholder="Type your answer..."
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                    />
                  </div>
                )}

                {question.type === 'date' && (
                  <div className="mb-4">
                    <label className="sr-only" htmlFor="quiz-date">
                      Your answer
                    </label>
                    <input
                      id="quiz-date"
                      type="date"
                      className={quizInput}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                    />
                  </div>
                )}

                <button
                  type="button"
                  onClick={onSubmit}
                  disabled={submitting}
                  className="gacha-pull-btn w-full"
                  style={{ padding: '10px 32px', fontSize: '1rem' }}
                >
                  {submitting ? 'Submitting…' : 'Submit Answer'}
                </button>

                {validation && (
                  <div role="alert" className="mt-4 text-center text-lg font-bold text-orange">
                    {validation}
                  </div>
                )}
              </div>
            )
          )}

          {result && (
            <div
              role="status"
              className="relative z-10 mt-4 text-center text-lg font-bold"
              style={{ color: result.correct ? '#66BB6A' : '#FF6B6B' }}
            >
              {result.message}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
