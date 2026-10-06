import { useEffect, useState } from 'react'
import { BookOpen, Search, X } from 'lucide-react'
import { GLOSSARY } from '../glossary'
import { LESSON_BY_ID } from '../lessons'
import { useStore } from '../store'

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
        <b>Learn</b> is a map of the Internet: click any device to open its short animated lessons. Each one starts with a missing piece to place, then the explanation follows the packets on the canvas.
        <br />
        <b>Sandbox</b> is a live simulator: drag the load up, click boxes and links to change them, and watch where things break.
      </p>
      {rows.map(([k, v]) => (
        <div className="shortcut-row" key={k}>
          <span>{v}</span>
          <span className="kbd">{k}</span>
        </div>
      ))}
    </Modal>
  )
}
