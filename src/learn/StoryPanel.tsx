import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, ChevronDown, FlaskConical, GraduationCap, ListTree, Pause, Play, Repeat, RotateCcw, Sparkles, Trophy } from 'lucide-react'
import { CHAPTERS, LESSONS, nextLesson } from '../lessons'
import { PRESET_BY_ID } from '../sim/presets'
import { useStore } from '../store'
import type { Lesson, Quiz, WidgetKind } from '../types'
import { Widget } from '../widgets'
import { describe } from './describe'
import { PacketInspector } from './PacketInspector'
import { COLORS, type Timeline } from './timeline'

const WIDGET_NAME: Record<WidgetKind, string> = {
  osi: 'Explore the layer stack',
  subnet: 'Subnet calculator',
  cwnd: 'Congestion window simulator',
  bdp: 'Bandwidth‑delay calculator',
  latency: 'Latency numbers & the speed of light',
  http: 'HTTP/1.1 vs 2 vs 3 page load',
  collective: 'All‑reduce cost calculator',
  parallelism: 'Parallelism traffic patterns',
}

interface Props {
  lesson: Lesson
  timeline: Timeline
  activeIdx: number
  selectedIdx: number | null
  onSelect: (i: number | null) => void
  paused: boolean
  onPause: () => void
  onReplay: () => void
  progressEl: React.RefObject<HTMLElement>
}

/** The reading column. Sits beside the canvas so the words and the motion are on screen together. */
export function StoryPanel({ lesson, timeline, activeIdx, selectedIdx, onSelect, paused, onPause, onReplay, progressEl }: Props) {
  const { stepIdx, setStep, speed, set, autoplay, level, openLesson, loadPreset, markDone, courseOpen } = useStore()
  const steps = lesson.steps
  const summary = stepIdx >= steps.length
  const step = steps[stepIdx]
  const chapter = CHAPTERS.find((c) => c.id === lesson.chapter)
  const lessonNo = LESSONS.findIndex((l) => l.id === lesson.id) + 1
  const focusIdx = selectedIdx ?? activeIdx
  const next = nextLesson(lesson.id)
  const sandbox = lesson.sandbox ? PRESET_BY_ID[lesson.sandbox] : null
  const [anatomyOpen, setAnatomyOpen] = useState(false)
  const body = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (summary) markDone(lesson.id)
  }, [summary, lesson.id, markDone])
  useEffect(() => {
    body.current?.scrollTo({ top: 0 })
  }, [lesson.id, stepIdx])

  return (
    <section className="story" aria-label="Lesson">
      <header className="story-head">
        <button className="course-btn" onClick={() => set({ courseOpen: !courseOpen })} aria-expanded={courseOpen}>
          <ListTree size={14} />
          <span>Lesson {lessonNo} of {LESSONS.length} · {chapter?.title}</span>
          <ChevronDown size={14} style={{ transform: courseOpen ? 'rotate(180deg)' : undefined, transition: 'transform .2s' }} />
        </button>
        <h1 className="story-title">{lesson.title}</h1>
        <p className="story-blurb">{lesson.blurb}</p>
        <div className="scrub" role="tablist" aria-label="Steps">
          {[...steps, null].map((_, i) => {
            const isSum = i === steps.length
            return (
              <button key={i} className={i === stepIdx ? 'cur' : i < stepIdx ? 'past' : ''} onClick={() => setStep(i)} aria-label={isSum ? 'Summary' : `Step ${i + 1}`} style={isSum ? { flex: 0.5 } : undefined}>
                <span className="bar">
                  {i === stepIdx && !isSum ? <i ref={progressEl as React.RefObject<HTMLElement & HTMLDivElement>} style={{ width: 0 }} /> : <i style={{ width: i < stepIdx || (isSum && summary) ? '100%' : 0 }} />}
                </span>
              </button>
            )
          })}
        </div>
        <div className="step-meta">
          <span>{summary ? 'Summary' : `Step ${stepIdx + 1} of ${steps.length}`}</span>
          <span className={`lvl ${lesson.level}`}>{lesson.level}</span>
        </div>
      </header>

      <div className="story-body" ref={body}>
        {!summary && step && (
          <>
            <p className="narr">{step.say}</p>
            {step.deep && (
              <details className="deeper" open={level === 'intermediate'} key={`${lesson.id}-${stepIdx}-${level}`}>
                <summary><GraduationCap size={14} /> Go deeper</summary>
                <p>{step.deep}</p>
              </details>
            )}

            {!!step.msgs?.length && (
              <div className="beats">
                <div className="beats-head">
                  <span className="eyebrow">What moves in this step</span>
                  {selectedIdx !== null && (
                    <button className="linkbtn" onClick={() => onSelect(null)}>follow the animation</button>
                  )}
                </div>
                {step.msgs.map((m, i) => {
                  const tm = timeline.msgs[i]
                  const d = describe(m, lesson, tm?.path ?? [m.from, m.to])
                  const cur = i === focusIdx
                  return (
                    <div key={i} className={`beat${cur ? ' cur' : ''}${i < activeIdx && !cur ? ' past' : ''}${m.drop ? ' lost' : ''}`}>
                      <button className="beat-row" onClick={() => onSelect(selectedIdx === i ? null : i)}>
                        <i style={{ background: COLORS[m.c ?? 'blue'] }} />
                        <span className="beat-label">{m.label}</span>
                        <span className="beat-no">{i + 1}/{step.msgs!.length}</span>
                      </button>
                      {cur && (
                        <div className="beat-body">
                          <p>{d.lead} {d.detail}</p>
                          {m.h && (
                            <>
                              <button className="linkbtn" onClick={() => setAnatomyOpen(!anatomyOpen)}>
                                <ChevronDown size={13} style={{ transform: anatomyOpen ? 'rotate(180deg)' : undefined }} /> {anatomyOpen ? 'Hide' : 'Show'} the headers inside this packet
                              </button>
                              {anatomyOpen && <div style={{ marginTop: 8 }}><PacketInspector msg={m} lesson={lesson} /></div>}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {lesson.widget && (
              <details className="try" open={stepIdx === steps.length - 1 || !step.msgs?.length}>
                <summary><Sparkles size={14} /> Try it: {WIDGET_NAME[lesson.widget]}</summary>
                <div style={{ padding: '0 12px 12px' }}><Widget kind={lesson.widget} /></div>
              </details>
            )}
            {sandbox && stepIdx === steps.length - 1 && (
              <button className="sandbox-cta" onClick={() => loadPreset(sandbox.id)}>
                <FlaskConical size={16} />
                <span><b>See it under load</b><small>Open “{sandbox.title}” in the sandbox</small></span>
                <ArrowRight size={15} />
              </button>
            )}
          </>
        )}

        {summary && (
          <>
            <p className="narr" style={{ display: 'flex', gap: 10, alignItems: 'center', fontWeight: 600 }}>
              <Trophy size={20} style={{ color: 'var(--c-amber)', flex: 'none' }} /> Lesson complete. Here is what to remember:
            </p>
            <ol className="takeaways">{lesson.takeaways.map((t) => <li key={t}>{t}</li>)}</ol>
            {!!lesson.quiz?.length && (
              <>
                <div className="eyebrow" style={{ margin: '22px 0 8px' }}>Check yourself</div>
                <QuizBlock key={lesson.id} quiz={lesson.quiz} onScore={(s) => markDone(lesson.id, s)} />
              </>
            )}
            {sandbox && (
              <button className="sandbox-cta" onClick={() => loadPreset(sandbox.id)}>
                <FlaskConical size={16} />
                <span><b>Break it in the sandbox</b><small>{sandbox.title}</small></span>
                <ArrowRight size={15} />
              </button>
            )}
            {lesson.widget && (
              <details className="try">
                <summary><Sparkles size={14} /> Try it: {WIDGET_NAME[lesson.widget]}</summary>
                <div style={{ padding: '0 12px 12px' }}><Widget kind={lesson.widget} /></div>
              </details>
            )}
          </>
        )}
      </div>

      <footer className="story-foot">
        <button className="ibtn" onClick={() => setStep(Math.max(0, stepIdx - 1))} disabled={stepIdx === 0} aria-label="Previous step" title="Previous (←)">
          <ArrowLeft size={17} />
        </button>
        <button className="ibtn boxed" onClick={onPause} disabled={summary} aria-label={paused ? 'Play' : 'Pause'} title="Play / pause (space)">
          {paused ? <Play size={16} /> : <Pause size={16} />}
        </button>
        <button className="ibtn" onClick={onReplay} disabled={summary} aria-label="Replay step" title="Watch this step again (R)">
          <RotateCcw size={16} />
        </button>
        <div className="seg hide-sm" aria-label="Speed">
          {[0.5, 1, 2].map((s) => (
            <button key={s} className={speed === s ? 'on' : ''} onClick={() => set({ speed: s })}>{s}×</button>
          ))}
        </div>
        <button className={`ibtn${autoplay ? ' on' : ''}`} onClick={() => set({ autoplay: !autoplay })} title={autoplay ? 'Auto‑advance is on' : 'Auto‑advance is off'} aria-label="Auto‑advance">
          <Repeat size={16} />
        </button>
        <span className="spacer" />
        {summary ? (
          next && <button className="btn primary" onClick={() => openLesson(next.id)}>Next lesson <ArrowRight size={15} /></button>
        ) : (
          <button className="btn primary" onClick={() => setStep(stepIdx + 1)} title="Next (→)">
            {stepIdx === steps.length - 1 ? 'Finish' : 'Next step'} <ArrowRight size={15} />
          </button>
        )}
      </footer>
    </section>
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
