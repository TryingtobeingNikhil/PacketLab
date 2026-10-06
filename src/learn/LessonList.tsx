import { useState } from 'react'
import { Search } from 'lucide-react'
import { CHAPTERS, LESSONS } from '../lessons'
import { useStore } from '../store'

export function LessonList() {
  const { lessonId, openLesson, progress, set } = useStore()
  const [q, setQ] = useState('')
  const query = q.trim().toLowerCase()
  const visible = LESSONS
  const done = LESSONS.filter((l) => progress.done[l.id]).length

  return (
    <>
      <div className="side-head">
        <div className="eyebrow">Course</div>
        <div className="side-title">Computer networks, end to end</div>
        <div className="progress-line" title={`${done} of ${LESSONS.length} lessons done`}><i style={{ width: `${(done / LESSONS.length) * 100}%` }} /></div>
        <div className="mono muted" style={{ fontSize: 11, marginTop: 4 }}>{done} / {LESSONS.length} lessons complete</div>
        <div className="search">
          <Search size={15} className="muted" />
          <input placeholder="Find a topic: DNS, NAT, RDMA…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search lessons" />
        </div>
      </div>
      <div className="scroll">
        {CHAPTERS.map((ch, ci) => {
          const all = visible.filter((l) => l.chapter === ch.id)
          const items = all.filter((l) => !query || l.title.toLowerCase().includes(query) || l.blurb.toLowerCase().includes(query))
          if (!items.length) return null
          const n = all.filter((l) => progress.done[l.id]).length
          return (
            <div className="chapter" key={ch.id}>
              <div className="chapter-head">
                <span className={`chapter-num${n === all.length ? ' full' : ''}`}>{ci + 1}</span>
                <span className="chapter-name">{ch.title}</span>
                <span className="chapter-count">{n}/{all.length}</span>
              </div>
              {items.map((l) => (
                <button
                  key={l.id}
                  className={`lesson-link${l.id === lessonId ? ' on' : ''}`}
                  onClick={() => {
                    openLesson(l.id)
                    if (innerWidth <= 1000) set({ leftOpen: false })
                  }}
                >
                  <span className={`dotc${progress.done[l.id] ? ' done' : ''}`} />
                  <span className="ttl">{l.title}</span>
                  {l.level === 'intermediate' && <span className="lvl intermediate">int</span>}
                </button>
              ))}
            </div>
          )
        })}
        <div style={{ height: 16 }} />
      </div>
    </>
  )
}
