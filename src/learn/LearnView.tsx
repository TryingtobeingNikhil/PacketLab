import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LESSON_BY_ID, LESSONS } from '../lessons'
import { useStore } from '../store'
import { LessonCanvas } from './LessonCanvas'
import { LessonList } from './LessonList'
import { StoryPanel } from './StoryPanel'
import { LiveCaption } from './LiveCaption'
import { buildTimeline } from './timeline'

const EMPTY = { msgs: [], total: 0 }

export function LearnView() {
  const { lessonId, stepIdx, setStep, autoplay, speed, courseOpen, set } = useStore()
  const lesson = LESSON_BY_ID[lessonId] ?? LESSONS[0]
  const summary = stepIdx >= lesson.steps.length
  const step = lesson.steps[stepIdx]
  const timeline = useMemo(() => (summary ? EMPTY : buildTimeline(lesson, step)), [lesson, step, summary])
  const [active, setActive] = useState(-1)
  const [selected, setSelected] = useState<number | null>(null)
  const [paused, setPaused] = useState(false)
  const [replay, setReplay] = useState(0)
  const progressEl = useRef<HTMLElement>(null)
  const auto = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    setSelected(null)
    setActive(-1)
    setPaused(false)
    clearTimeout(auto.current)
  }, [lessonId, stepIdx])

  const onDone = useCallback(() => {
    const s = useStore.getState()
    if (!s.autoplay || summary) return
    const words = step?.say.split(/\s+/).length ?? 0
    const read = Math.max(1600, words * 230 - timeline.total) / s.speed
    clearTimeout(auto.current)
    auto.current = setTimeout(() => {
      const st = useStore.getState()
      if (st.autoplay && st.lessonId === lessonId && st.stepIdx === stepIdx) st.setStep(stepIdx + 1)
    }, read)
  }, [step, timeline.total, lessonId, stepIdx, summary])

  // switching auto-advance on after the animation has finished should still advance
  useEffect(() => {
    if (autoplay && active >= timeline.msgs.length - 1) onDone()
    return () => clearTimeout(auto.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t?.closest?.('input, textarea, select, [contenteditable]')) return
      if (useStore.getState().mode !== 'learn' || e.metaKey || e.ctrlKey) return
      if (e.key === 'ArrowRight') setStep(Math.min(lesson.steps.length, useStore.getState().stepIdx + 1))
      else if (e.key === 'ArrowLeft') setStep(Math.max(0, useStore.getState().stepIdx - 1))
      else if (e.key === ' ') {
        e.preventDefault()
        setPaused((p) => !p)
      } else if (e.key === 'r' || e.key === 'R') setReplay((r) => r + 1)
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [lesson, setStep])

  return (
    <div className="body learn">
      <StoryPanel
        lesson={lesson}
        timeline={timeline}
        activeIdx={active}
        selectedIdx={selected}
        onSelect={setSelected}
        paused={paused}
        onPause={() => setPaused((p) => !p)}
        onReplay={() => {
          setPaused(false)
          setReplay((r) => r + 1)
        }}
        progressEl={progressEl}
      />
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
          />
          {!summary && <LiveCaption lesson={lesson} timeline={timeline} idx={selected ?? active} />}
        </div>
      </main>
    </div>
  )
}
