import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Compass, FlaskConical, GraduationCap, List, Pause, Play, Repeat, RotateCcw, Sparkles, Trophy, X } from 'lucide-react'
import { CAT_COLOR, KINDS } from '../catalog'
import { CHAPTERS, LESSON_BY_ID, LESSONS, nextLesson } from '../lessons'
import { PRESET_BY_ID } from '../sim/presets'
import { useStore } from '../store'
import type { Kind, Lesson, Quiz, WidgetKind } from '../types'
import { Widget } from '../widgets'
import { describe } from './describe'
import { LessonCanvas } from './LessonCanvas'
import { LessonList } from './LessonList'
import { PacketInspector } from './PacketInspector'
import { choicesFor, hubOf } from './puzzle'
import { StepBubble } from './StepBubble'
import { buildTimeline, COLORS } from './timeline'

const EMPTY = { msgs: [], total: 0 }
const WIDGET_NAME: Record<WidgetKind, string> = {
  osi: 'Layer stack',
  subnet: 'Subnet calculator',
  cwnd: 'Congestion window',
  bdp: 'Bandwidth‑delay',
  latency: 'Latency numbers',
  http: 'HTTP versions',
  collective: 'All‑reduce cost',
  parallelism: 'Parallelism patterns',
}

export function LessonPlayer() {
  const { lessonId, stepIdx, setStep, autoplay, speed, set, courseOpen, level } = useStore()
  const lesson = LESSON_BY_ID[lessonId] ?? LESSONS[0]
  const summary = stepIdx >= lesson.steps.length
  const step = lesson.steps[stepIdx]

  // the missing-piece warm-up, once per lesson per visit
  const hub = useMemo(() => hubOf(lesson), [lesson])
  const [solved, setSolved] = useState<Record<string, boolean>>({})
  const [guess, setGuess] = useState<Kind | null>(null)
  const puzzle = !!hub && stepIdx === 0 && !solved[lesson.id]
  const [justSolved, setJustSolved] = useState(false)

  const timeline = useMemo(() => (summary || puzzle ? EMPTY : buildTimeline(lesson, step)), [lesson, step, summary, puzzle])
  const [active, setActive] = useState(-1)
  const [pinned, setPinned] = useState<number | null>(null)
  const [paused, setPaused] = useState(false)
  const [replay, setReplay] = useState(0)
  const [deepOpen, setDeepOpen] = useState(false)
  const [headersOpen, setHeadersOpen] = useState(false)
  const [widgetOpen, setWidgetOpen] = useState(false)
  const progressEl = useRef<HTMLElement>(null)
  const auto = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    setPinned(null)
    setActive(-1)
    setPaused(false)
    setHeadersOpen(false)
    setDeepOpen(level === 'intermediate')
    clearTimeout(auto.current)
  }, [lessonId, stepIdx, level])
  useEffect(() => {
    setGuess(null)
    setJustSolved(false)
    setWidgetOpen(false)
  }, [lessonId])

  const onDone = useCallback(() => {
    const s = useStore.getState()
    if (!s.autoplay || summary || puzzle) return
    const words = step?.say.split(/\s+/).length ?? 0
    const read = Math.max(1800, words * 240 - timeline.total) / s.speed
    clearTimeout(auto.current)
    auto.current = setTimeout(() => {
      const st = useStore.getState()
      if (st.autoplay && st.lessonId === lessonId && st.stepIdx === stepIdx) st.setStep(stepIdx + 1)
    }, read)
  }, [step, timeline.total, lessonId, stepIdx, summary, puzzle])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t?.closest?.('input, textarea, select, [contenteditable]')) return
      const s = useStore.getState()
      if (s.mode !== 'learn' || s.learnView !== 'lesson' || e.metaKey || e.ctrlKey) return
      if (e.key === 'ArrowRight') s.setStep(Math.min(lesson.steps.length, s.stepIdx + 1))
      else if (e.key === 'ArrowLeft') s.setStep(Math.max(0, s.stepIdx - 1))
      else if (e.key === ' ') {
        e.preventDefault()
        setPaused((p) => !p)
      } else if (e.key === 'r' || e.key === 'R') setReplay((r) => r + 1)
      else if (e.key === 'Escape') s.set({ learnView: 'map' })
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [lesson])

  const focusIdx = pinned ?? active
  const tm = timeline.msgs[focusIdx]
  const anchor = puzzle
    ? hub!.id
    : step?.focus?.[0] ?? step?.msgs?.[0]?.from ?? hub?.id ?? lesson.nodes[0].id
  const chapter = CHAPTERS.find((c) => c.id === lesson.chapter)
  const busy = useMemo(() => [...new Set(timeline.msgs.flatMap((m) => m.path))], [timeline])

  const answer = (k: Kind) => {
    setGuess(k)
    if (k === hub?.kind) {
      setJustSolved(true)
      setSolved((s) => ({ ...s, [lesson.id]: true }))
    }
  }

  return (
    <div className="body">
      {courseOpen && (
        <>
          <div className="drawer-scrim" onClick={() => set({ courseOpen: false })} />
          <aside className="sidebar course-drawer" aria-label="All lessons">
            <LessonList />
          </aside>
        </>
      )}
      <main className="main">
        <div className="canvas-wrap">
          <LessonCanvas
            lesson={lesson}
            stepIdx={Math.min(stepIdx, lesson.steps.length - 1)}
            timeline={timeline}
            paused={paused}
            speed={speed}
            replay={replay}
            progressEl={progressEl}
            onActive={setActive}
            onDone={onDone}
            ghostId={puzzle ? hub!.id : null}
            overlay={(ctx) =>
              summary ? null : (
                <StepBubble
                  ctx={ctx}
                  anchor={anchor}
                  busy={busy}
                  links={lesson.links.map(([x, y]) => [x, y] as [string, string])}
                  key={`${lesson.id}-${puzzle ? 'p' : stepIdx}`}
                >
                  {puzzle ? (
                    <PuzzleBody lesson={lesson} hubKind={hub!.kind} guess={guess} onAnswer={answer} onSkip={() => setSolved((s) => ({ ...s, [lesson.id]: true }))} />
                  ) : (
                    <>
                      {justSolved && stepIdx === 0 && (
                        <div className="b-solved">
                          <b>Right: {hub?.label}.</b> {KINDS[hub!.kind].desc}
                        </div>
                      )}
                      <div className="b-eyebrow">
                        <span>Step {stepIdx + 1} of {lesson.steps.length}</span>
                      </div>
                      <p className="b-say">{step?.say}</p>
                      {step?.deep && deepOpen && <p className="b-deep">{step.deep}</p>}
                      {tm && (
                        <div className="b-now">
                          <div className="b-now-top">
                            <i style={{ background: COLORS[tm.msg.c ?? 'blue'] }} />
                            <b>{tm.msg.label}</b>
                            <span>{focusIdx + 1}/{timeline.msgs.length}</span>
                          </div>
                          {(() => {
                            const d = describe(tm.msg, lesson, tm.path)
                            return <p>{d.lead} {d.detail}</p>
                          })()}
                          {headersOpen && tm.msg.h && <div style={{ marginTop: 8 }}><PacketInspector msg={tm.msg} lesson={lesson} /></div>}
                        </div>
                      )}
                      <div className="b-chips">
                        {step?.deep && (
                          <button className={`chipbtn${deepOpen ? ' on' : ''}`} onClick={() => setDeepOpen(!deepOpen)}><GraduationCap size={13} /> Go deeper</button>
                        )}
                        {tm?.msg.h && (
                          <button className={`chipbtn${headersOpen ? ' on' : ''}`} onClick={() => setHeadersOpen(!headersOpen)}>Inside this packet</button>
                        )}
                        {timeline.msgs.length > 1 && (
                          <span className="b-msgs">
                            {timeline.msgs.map((m, i) => (
                              <button
                                key={i}
                                className={i === focusIdx ? 'on' : i < active ? 'past' : ''}
                                style={{ ['--pc' as string]: COLORS[m.msg.c ?? 'blue'] }}
                                onClick={() => setPinned(pinned === i ? null : i)}
                                title={m.msg.label}
                                aria-label={`Packet ${i + 1}: ${m.msg.label}`}
                              />
                            ))}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </StepBubble>
              )
            }
          />

          <div className="lesson-bar">
            <button className="ibtn" onClick={() => set({ learnView: 'map' })} aria-label="Back to the map" title="Back to the map (Esc)"><Compass size={17} /></button>
            <div className="lb-title">
              <span className="eyebrow">{chapter?.title}</span>
              <b>{lesson.title}</b>
            </div>
            <div className="lb-steps" role="tablist" aria-label="Steps">
              {lesson.steps.map((_, i) => (
                <button key={i} className={i === stepIdx ? 'cur' : i < stepIdx || summary ? 'past' : ''} onClick={() => setStep(i)} aria-label={`Step ${i + 1}`}>
                  {i === stepIdx && !puzzle ? <i ref={progressEl as React.RefObject<HTMLElement & HTMLDivElement>} style={{ width: 0 }} /> : <i style={{ width: i < stepIdx || summary ? '100%' : 0 }} />}
                </button>
              ))}
            </div>
            {lesson.widget && (
              <button className={`chipbtn${widgetOpen ? ' on' : ''}`} onClick={() => setWidgetOpen(!widgetOpen)}><Sparkles size={13} /> {WIDGET_NAME[lesson.widget]}</button>
            )}
            <button className="ibtn" onClick={() => set({ courseOpen: true })} aria-label="All lessons" title="All lessons"><List size={17} /></button>
          </div>

          {widgetOpen && lesson.widget && (
            <div className="widget-float">
              <button className="ibtn sm wf-close" onClick={() => setWidgetOpen(false)} aria-label="Close"><X size={15} /></button>
              <Widget kind={lesson.widget} />
            </div>
          )}

          {!summary && !puzzle && (
            <div className="control-pill">
              <button className="ibtn" onClick={() => setStep(Math.max(0, stepIdx - 1))} disabled={stepIdx === 0} aria-label="Previous step" title="Previous (←)"><ArrowLeft size={17} /></button>
              <button className="ibtn" onClick={() => setPaused((p) => !p)} aria-label={paused ? 'Play' : 'Pause'} title="Play / pause (space)">{paused ? <Play size={16} /> : <Pause size={16} />}</button>
              <button className="ibtn" onClick={() => { setPaused(false); setReplay((r) => r + 1) }} aria-label="Replay step" title="Watch again (R)"><RotateCcw size={16} /></button>
              <div className="seg hide-sm" aria-label="Speed">
                {[0.5, 1, 2].map((s) => <button key={s} className={speed === s ? 'on' : ''} onClick={() => set({ speed: s })}>{s}×</button>)}
              </div>
              <button className={`ibtn hide-sm${autoplay ? ' on' : ''}`} onClick={() => set({ autoplay: !autoplay })} aria-label="Auto‑advance" title={autoplay ? 'Auto‑advance is on' : 'Auto‑advance is off'}><Repeat size={16} /></button>
              <button className="btn primary" onClick={() => setStep(stepIdx + 1)} title="Next (→)">
                {stepIdx === lesson.steps.length - 1 ? 'Finish' : 'Next'} <ArrowRight size={15} />
              </button>
            </div>
          )}

          {summary && <SummaryCard lesson={lesson} />}
        </div>
      </main>
    </div>
  )
}

function PuzzleBody({ lesson, hubKind, guess, onAnswer, onSkip }: { lesson: Lesson; hubKind: Kind; guess: Kind | null; onAnswer: (k: Kind) => void; onSkip: () => void }) {
  const hub = hubOf(lesson)!
  const choices = choicesFor(lesson, hub)
  const wrong = guess && guess !== hubKind ? guess : null
  return (
    <>
      <div className="b-eyebrow"><span>Missing piece</span></div>
      <p className="b-say">Something is missing in the middle of this network. Which part belongs here?</p>
      <div className="choices">
        {choices.map((k) => {
          const info = KINDS[k]
          const Icon = info.icon
          return (
            <button key={k} className={`choice${wrong === k ? ' wrong' : ''}`} style={{ ['--cat' as string]: CAT_COLOR[info.cat] }} onClick={() => onAnswer(k)}>
              <span className="disc"><Icon size={18} /></span>
              {info.label}
            </button>
          )
        })}
      </div>
      {wrong && <p className="b-wrong">Not this one. A {KINDS[wrong].label.toLowerCase()}: {KINDS[wrong].desc}</p>}
      <button className="linkbtn" onClick={onSkip} style={{ marginTop: 8 }}>Skip, just show me</button>
    </>
  )
}

function SummaryCard({ lesson }: { lesson: Lesson }) {
  const { markDone, openLesson, loadPreset, set, setStep } = useStore()
  const next = nextLesson(lesson.id)
  const sandbox = lesson.sandbox ? PRESET_BY_ID[lesson.sandbox] : null
  useEffect(() => {
    markDone(lesson.id)
  }, [lesson.id, markDone])
  return (
    <div className="summary-wrap">
      <div className="summary-card">
        <div className="sc-head">
          <Trophy size={22} style={{ color: 'var(--c-amber)' }} />
          <div>
            <span className="eyebrow">Lesson complete</span>
            <h2>{lesson.title}</h2>
          </div>
        </div>
        <ol className="takeaways">{lesson.takeaways.map((t) => <li key={t}>{t}</li>)}</ol>
        {!!lesson.quiz?.length && (
          <>
            <div className="eyebrow" style={{ margin: '18px 0 8px' }}>Quick check</div>
            <QuizBlock key={lesson.id} quiz={lesson.quiz} onScore={(s) => markDone(lesson.id, s)} />
          </>
        )}
        <div className="sc-actions">
          <button className="btn" onClick={() => set({ learnView: 'map' })}><Compass size={15} /> Back to the map</button>
          <button className="btn" onClick={() => setStep(0)}><RotateCcw size={15} /> Watch again</button>
          {sandbox && <button className="btn" onClick={() => loadPreset(sandbox.id)}><FlaskConical size={15} /> Break it in the sandbox</button>}
          {next && <button className="btn primary" onClick={() => openLesson(next.id)}>Next: {next.title} <ArrowRight size={15} /></button>}
        </div>
      </div>
    </div>
  )
}

function QuizBlock({ quiz, onScore }: { quiz: Quiz[]; onScore: (n: number) => void }) {
  const [ans, setAns] = useState<(number | null)[]>(quiz.map(() => null))
  const scored = useRef(onScore)
  scored.current = onScore
  useEffect(() => {
    if (ans.every((a) => a !== null)) scored.current(ans.filter((a, i) => a === quiz[i].answer).length)
  }, [ans, quiz])
  return (
    <>
      {quiz.map((q, qi) => {
        const a = ans[qi]
        return (
          <div className="quiz" key={qi}>
            <div className="q">{q.q}</div>
            {q.options.map((o, oi) => (
              <button
                key={oi}
                className={`opt${a !== null && oi === q.answer ? ' right' : ''}${a === oi && oi !== q.answer ? ' wrong' : ''}`}
                disabled={a !== null}
                onClick={() => setAns(ans.map((x, i) => (i === qi ? oi : x)))}
              >
                <span className="k">{String.fromCharCode(65 + oi)}</span>
                {o}
              </button>
            ))}
            {a !== null && (
              <div className="why">
                <b style={{ color: a === q.answer ? 'var(--ok)' : 'var(--bad)' }}>{a === q.answer ? 'Correct. ' : 'Not quite. '}</b>
                {q.why}
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}
