import { useEffect, useRef, useState } from 'react'
import { ArrowRight, FlaskConical, GraduationCap, Pause, Play, Repeat, RotateCcw, SkipBack, SkipForward } from 'lucide-react'
import { CHAPTERS, nextLesson } from '../lessons'
import { PRESET_BY_ID } from '../sim/presets'
import { useStore } from '../store'
import type { Lesson, Quiz } from '../types'
import { Widget } from '../widgets'
import { PacketInspector } from './PacketInspector'
import { COLORS } from './timeline'

interface Props {
  lesson: Lesson
  activeIdx: number
  selectedIdx: number | null
  onSelect: (i: number | null) => void
  paused: boolean
  onPause: () => void
  onReplay: () => void
  progressEl: React.RefObject<HTMLElement>
}

export function PlayerDock({ lesson, activeIdx, selectedIdx, onSelect, paused, onPause, onReplay, progressEl }: Props) {
  const { stepIdx, setStep, speed, set, autoplay, level, openLesson, loadPreset, markDone } = useStore()
  const steps = lesson.steps
  const summary = stepIdx >= steps.length
  const step = steps[stepIdx]
  const chapter = CHAPTERS.find((c) => c.id === lesson.chapter)
  const chapterNo = CHAPTERS.findIndex((c) => c.id === lesson.chapter) + 1
  const inspectIdx = selectedIdx ?? activeIdx
  const inspectMsg = step?.msgs?.[inspectIdx]
  const next = nextLesson(lesson.id)
  const [tab, setTab] = useState<'packet' | 'try'>('packet')
  const name = (id: string) => lesson.nodes.find((n) => n.id === id)?.label ?? id
  const sandbox = lesson.sandbox ? PRESET_BY_ID[lesson.sandbox] : null

  useEffect(() => {
    if (summary) markDone(lesson.id)
  }, [summary, lesson.id, markDone])
  useEffect(() => {
    setTab(lesson.widget && !step?.msgs?.length ? 'try' : 'packet')
  }, [lesson.id, lesson.widget, step])

  return (
    <section className="dock" aria-label="Lesson player">
      <div className="dock-bar">
        <button className="ibtn" onClick={() => setStep(Math.max(0, stepIdx - 1))} disabled={stepIdx === 0} aria-label="Previous step" title="Previous (←)">
          <SkipBack size={17} />
        </button>
        <button className="ibtn boxed" onClick={onPause} disabled={summary} aria-label={paused ? 'Play' : 'Pause'} title="Play / pause (space)">
          {paused ? <Play size={17} /> : <Pause size={17} />}
        </button>
        <button className="ibtn hide-sm" onClick={onReplay} disabled={summary} aria-label="Replay step" title="Replay (R)">
          <RotateCcw size={16} />
        </button>
        <div className="scrub" role="tablist" aria-label="Steps">
          {[...steps, null].map((_, i) => {
            const isSum = i === steps.length
            return (
              <button key={i} className={i === stepIdx ? 'cur' : i < stepIdx ? 'past' : ''} onClick={() => setStep(i)} aria-label={isSum ? 'Summary' : `Step ${i + 1}`} style={isSum ? { flex: 0.5 } : undefined}>
                <span className="n">{isSum ? '✓' : String(i + 1).padStart(2, '0')}</span>
                <span className="bar">
                  {i === stepIdx && !isSum ? <i ref={progressEl as React.RefObject<HTMLElement & HTMLDivElement>} style={{ width: 0 }} /> : <i style={{ width: i < stepIdx || (isSum && summary) ? '100%' : 0 }} />}
                </span>
              </button>
            )
          })}
        </div>
        <div className="seg hide-sm" aria-label="Speed">
          {[0.5, 1, 2].map((s) => (
            <button key={s} className={speed === s ? 'on' : ''} onClick={() => set({ speed: s })}>{s}×</button>
          ))}
        </div>
        <button className={`ibtn hide-sm${autoplay ? ' on' : ''}`} onClick={() => set({ autoplay: !autoplay })} title={autoplay ? 'Auto‑advance on' : 'Auto‑advance off'} aria-label="Auto‑advance">
          <Repeat size={16} />
        </button>
        {summary ? (
          next && <button className="btn primary sm" onClick={() => openLesson(next.id)}>Next lesson <ArrowRight size={14} /></button>
        ) : (
          <button className="btn primary sm" onClick={() => setStep(stepIdx + 1)} title="Next (→)">
            {stepIdx === steps.length - 1 ? 'Finish' : 'Next'} <SkipForward size={14} />
          </button>
        )}
      </div>

      <div className="dock-grid">
        {/* ---- column 1: what's happening ---- */}
        <div className="dock-col c1">
          <div className="eyebrow">
            {chapterNo}. {chapter?.title} · <span style={{ color: lesson.level === 'beginner' ? 'var(--c-green)' : 'var(--c-violet)' }}>{lesson.level}</span>
          </div>
          {!summary && step && (
            <>
              <p className="narr">{step.say}</p>
              {step.deep && (
                <details className="deeper" open={level === 'intermediate'} key={`${lesson.id}-${stepIdx}-${level}`}>
                  <summary><GraduationCap size={14} /> Go deeper</summary>
                  <p>{step.deep}</p>
                </details>
              )}
            </>
          )}
          {summary && (
            <>
              <p className="narr" style={{ fontWeight: 600 }}>Lesson complete. Here is what to remember:</p>
              <ol className="takeaways">{lesson.takeaways.map((t) => <li key={t}>{t}</li>)}</ol>
            </>
          )}
        </div>

        {/* ---- column 2: packets on the wire / quiz ---- */}
        <div className="dock-col c2">
          {!summary ? (
            <>
              <div className="col-head">
                <span className="eyebrow">On the wire</span>
                {selectedIdx !== null && (
                  <button className="btn sm" style={{ marginLeft: 'auto', height: 22, fontSize: 11 }} onClick={() => onSelect(null)}>follow animation</button>
                )}
              </div>
              {step?.msgs?.length ? (
                <div className="wire-list">
                  {step.msgs.map((m, i) => (
                    <button
                      key={i}
                      className={`wire${i === inspectIdx ? ' cur' : ''}${i < activeIdx && i !== inspectIdx ? ' past' : ''}${m.drop ? ' lost' : ''}`}
                      onClick={() => {
                        onSelect(selectedIdx === i ? null : i)
                        setTab('packet')
                      }}
                    >
                      <span className="no">{String(i + 1).padStart(2, '0')}</span>
                      <span className="lb"><i style={{ background: COLORS[m.c ?? 'blue'] }} /><span>{m.label}</span></span>
                      <span className="ft">{m.from === m.to ? `inside ${name(m.from)}` : `${name(m.from)} → ${name(m.to)}`}{m.drop ? ' · lost' : ''}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="muted" style={{ fontSize: 13.5, margin: 0 }}>Nothing on the wire in this step. Look at the diagram, then press Next.</p>
              )}
            </>
          ) : lesson.quiz?.length ? (
            <>
              <div className="col-head"><span className="eyebrow">Check yourself</span></div>
              <QuizBlock key={lesson.id} quiz={lesson.quiz} onScore={(s) => markDone(lesson.id, s)} />
            </>
          ) : (
            <p className="muted">No quiz for this one.</p>
          )}
        </div>

        {/* ---- column 3: packet anatomy / try it / what next ---- */}
        <div className="dock-col c3">
          {summary ? (
            <>
              <div className="col-head"><span className="eyebrow">Keep going</span></div>
              <div className="cta">
                {next && (
                  <button className="btn primary" onClick={() => openLesson(next.id)} style={{ justifyContent: 'space-between' }}>
                    Next: {next.title} <ArrowRight size={15} />
                  </button>
                )}
                {sandbox && (
                  <button className="btn" onClick={() => loadPreset(sandbox.id)} style={{ justifyContent: 'flex-start' }}>
                    <FlaskConical size={15} /> Break it: {sandbox.title}
                  </button>
                )}
                <button className="btn" onClick={() => setStep(0)} style={{ justifyContent: 'flex-start' }}>
                  <RotateCcw size={15} /> Watch again
                </button>
              </div>
              {lesson.widget && <div style={{ marginTop: 14 }}><Widget kind={lesson.widget} /></div>}
            </>
          ) : (
            <>
              <div className="seg-tabs">
                <button className={tab === 'packet' ? 'on' : ''} onClick={() => setTab('packet')}>Packet anatomy</button>
                {lesson.widget && <button className={tab === 'try' ? 'on' : ''} onClick={() => setTab('try')}>Try it yourself</button>}
                {sandbox && <button onClick={() => loadPreset(sandbox.id)} title={`Open “${sandbox.title}” in the sandbox`}>Sandbox ↗</button>}
              </div>
              {tab === 'try' && lesson.widget ? (
                <Widget kind={lesson.widget} />
              ) : inspectMsg ? (
                <PacketInspector msg={inspectMsg} lesson={lesson} />
              ) : (
                <p className="muted" style={{ fontSize: 13, margin: 0 }}>
                  {step?.msgs?.length ? 'Headers appear here as each packet leaves. Click any message to pin it.' : 'No packet in this step.'}
                </p>
              )}
            </>
          )}
        </div>
      </div>
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
