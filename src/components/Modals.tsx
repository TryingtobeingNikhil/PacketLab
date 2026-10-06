import { useEffect, useState } from 'react'
import { ArrowRight, BookOpen, Cpu, FlaskConical, GraduationCap, Search, Sprout, X } from 'lucide-react'
import { GLOSSARY } from '../glossary'
import { LESSON_BY_ID, LESSONS } from '../lessons'
import { useStore } from '../store'
import { Logo } from './TopBar'

function Modal({ title, onClose, children, wide }: { title: React.ReactNode; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="scrim" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal card" role="dialog" aria-modal="true" style={wide ? { width: 'min(820px, 100%)' } : undefined}>
        <div className="modal-head">
          <h2>{title}</h2>
          <span className="spacer" />
          <button className="ibtn sm" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

export function Glossary() {
  const { set, openLesson } = useStore()
  const [q, setQ] = useState('')
  const query = q.trim().toLowerCase()
  const terms = GLOSSARY.filter((t) => !query || t.term.toLowerCase().includes(query) || t.def.toLowerCase().includes(query)).sort((a, b) => a.term.localeCompare(b.term))
  const close = () => set({ glossaryOpen: false })
  return (
    <Modal title={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><BookOpen size={18} /> Glossary</span>} onClose={close}>
      <div className="search" style={{ margin: '0 0 6px' }}>
        <Search size={15} className="muted" />
        <input autoFocus placeholder={`Search ${GLOSSARY.length} terms`} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search glossary" />
      </div>
      {terms.map((t) => (
        <div className="term" key={t.term}>
          <b>{t.term}</b>
          <p>{t.def}</p>
          {t.lesson && LESSON_BY_ID[t.lesson] && (
            <button onClick={() => { openLesson(t.lesson!); close() }}>Lesson: {LESSON_BY_ID[t.lesson].title} →</button>
          )}
        </div>
      ))}
      {!terms.length && <p className="muted">No matches.</p>}
    </Modal>
  )
}

export function Shortcuts() {
  const { set } = useStore()
  const rows: [string, string][] = [
    ['→ / ←', 'Next / previous lesson step'],
    ['Space', 'Pause or play (animation in Learn, simulation in Sandbox)'],
    ['R', 'Replay the current step'],
    ['Scroll', 'Pan the canvas'],
    ['Ctrl/⌘ + scroll, pinch', 'Zoom'],
    ['Drag background', 'Pan'],
    ['Drag ● on a box', 'Connect it to another box'],
    ['Backspace / Delete', 'Delete the selected box, link or note'],
    ['⌘Z / ⇧⌘Z', 'Undo / redo'],
    ['F', 'Fit the design to the screen'],
    ['Esc', 'Deselect / close'],
  ]
  return (
    <Modal title="Help & shortcuts" onClose={() => set({ shortcutsOpen: false })}>
      <p style={{ marginTop: 0, color: 'var(--text-2)' }}>
        <b>Learn</b> walks you through each protocol with animated packets: read the step, watch the packets, click any message to inspect its headers.
        <br />
        <b>Sandbox</b> is a live simulator: drag the load up, click boxes and links to change them, and watch where things break.
      </p>
      {rows.map(([k, v]) => (
        <div className="shortcut-row" key={k}>
          <span>{v}</span>
          <span className="kbd">{k}</span>
        </div>
      ))}
      <button className="btn sm" style={{ marginTop: 14 }} onClick={() => set({ shortcutsOpen: false, welcomed: false })}>Show the welcome screen again</button>
    </Modal>
  )
}

export function Welcome() {
  const { set, openLesson, loadPreset } = useStore()
  const done = (patch: Parameters<typeof set>[0]) => set({ welcomed: true, ...patch })
  const beginnerCount = LESSONS.filter((l) => l.level === 'beginner').length
  const paths = [
    { icon: Sprout, cat: 'var(--c-green)', title: 'I’m new to networking', text: `Start at “what is a packet?”. Plain language, one idea per step. ${beginnerCount} beginner lessons.`, go: () => { done({ level: 'beginner' }); openLesson('what-is-a-network') } },
    { icon: GraduationCap, cat: 'var(--c-violet)', title: 'I know the basics', text: 'Header‑level detail with every “Go deeper” note open. Starts at TCP loss recovery.', go: () => { done({ level: 'intermediate' }); openLesson('tcp-reliability') } },
    { icon: Cpu, cat: 'var(--c-pink)', title: 'Show me AI infrastructure', text: 'NVLink vs InfiniBand, RDMA, all‑reduce, parallelism, incast, LLM serving.', go: () => { done({}); openLesson('gpu-interconnects') } },
    { icon: FlaskConical, cat: 'var(--c-teal)', title: 'Let me break things', text: 'Open the simulator, push the load up and watch where it falls over.', go: () => { done({}); loadPreset('single') } },
  ]
  return (
    <div className="scrim">
      <div className="welcome" role="dialog" aria-modal="true" aria-label="Welcome">
        <div className="welcome-left">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, fontSize: 16 }}>
            <Logo size={30} /> Packetlab
          </div>
          <h1>Networks are <em>packets</em> in motion. Come watch them.</h1>
          <p>
            Every lesson is a small network you can see working: frames, packets and segments moving hop by hop, with their headers open.
            When you are ready, the bench lets you load a real topology until it breaks.
          </p>
          <div className="facts">
            <span><b>{LESSONS.length}</b>lessons</span>
            <span><b>7</b>chapters</span>
            <span><b>L2 → AI</b>Ethernet to GPU fabrics</span>
          </div>
        </div>
        <div className="welcome-right">
          <span className="eyebrow">Where do you want to start?</span>
          {paths.map((p) => (
            <button key={p.title} className="path" style={{ ['--cat' as string]: p.cat }} onClick={p.go}>
              <span className="disc"><p.icon size={20} /></span>
              <h3>{p.title}</h3>
              <p>{p.text}</p>
              <ArrowRight size={16} />
            </button>
          ))}
          <span className="muted" style={{ fontSize: 12, marginTop: 4 }}>You can switch between Beginner and Intermediate at any time from the top bar.</span>
        </div>
      </div>
    </div>
  )
}
